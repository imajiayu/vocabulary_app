/**
 * 单词相关的API接口
 */

import { supabase } from '@/shared/config/supabase'
import { getCurrentUserId } from '@/shared/composables/useAuth'
import { applyBoldToDefinition } from '@/shared/utils/definition'
import type { Word, DefinitionObject, ReviewBreakdown, SpellingBreakdown, RelatedWord } from '@/shared/types'

// 单词更新参数接口
export interface UpdateWordPayload {
  word?: string
  definition?: DefinitionObject
  ease_factor?: number
  stop_review?: boolean | number  // 支持 boolean 和 number (0/1)
  repetition?: number
  interval?: number
  next_review?: string
  lapse?: number
}

// 复习模式通知（param_type 判别联合）
export interface ReviewModeNotification {
  word: string
  param_type: 'ease_factor'
  param_change: number
  new_param_value: number
  next_review_date: string
  breakdown: ReviewBreakdown
}

// 拼写模式通知
export interface SpellingModeNotification {
  word: string
  param_type: 'spell_strength'
  param_change: number
  new_param_value: number
  next_review_date: string
  breakdown: SpellingBreakdown
}

// 判别联合：根据 param_type 区分两种通知结构
export type ReviewNotificationData = ReviewModeNotification | SpellingModeNotification

// 批量导入结果接口
export interface BatchImportResult {
  success_count: number
  failed_count: number
  failed_words: string[]
  failed_details: string[]
  total: number
  inserted_words: Word[]
}

/**
 * 单词API类
 */
export class WordsApi {
  /**
   * 更新单词信息（Supabase 直连）
   */
  static async updateWordDirect(wordId: number, data: UpdateWordPayload): Promise<Word> {
    const userId = getCurrentUserId()
    const payload: Record<string, unknown> = { ...data }

    // definition 需要 JSON.stringify
    if (payload.definition && typeof payload.definition === 'object') {
      payload.definition = JSON.stringify(payload.definition)
    }
    // stop_review: boolean → number
    if (typeof payload.stop_review === 'boolean') {
      payload.stop_review = payload.stop_review ? 1 : 0
    }

    const { data: row, error } = await supabase
      .from('words')
      .update(payload)
      .eq('id', wordId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return this.transformWord(row)
  }

  /**
   * 删除单词及其关联数据（DB Function 事务化级联删除）
   */
  static async deleteWordDirect(wordId: number): Promise<void> {
    const { error } = await supabase.rpc('delete_words_cascade', {
      p_word_ids: [wordId]
    })
    if (error) throw new Error(error.message)
  }

  /**
   * 批量删除单词及其关联数据（DB Function 事务化级联删除）
   */
  static async batchDeleteDirect(wordIds: number[]): Promise<void> {
    if (wordIds.length === 0) return
    const { error } = await supabase.rpc('delete_words_cascade', {
      p_word_ids: wordIds
    })
    if (error) throw new Error(error.message)
  }

  /**
   * 批量更新单词（Supabase 直连）
   */
  static async batchUpdateDirect(wordIds: number[], updateData: Partial<UpdateWordPayload>): Promise<Word[]> {
    if (wordIds.length === 0) return []
    const userId = getCurrentUserId()
    const payload: Record<string, unknown> = { ...updateData }

    if (payload.definition && typeof payload.definition === 'object') {
      payload.definition = JSON.stringify(payload.definition)
    }
    if (typeof payload.stop_review === 'boolean') {
      payload.stop_review = payload.stop_review ? 1 : 0
    }

    const { data, error } = await supabase
      .from('words')
      .update(payload)
      .eq('user_id', userId)
      .in('id', wordIds)
      .select()

    if (error) throw new Error(error.message)
    return (data || []).map(row => this.transformWord(row))
  }

  /**
   * 获取单词释义（Edge Function + Supabase 直连）
   * 1. 查询单词文本 2. Edge Function 爬取释义 3. 加粗例句 4. 写入 DB 5. 返回完整 Word
   */
  static async fetchDefinition(wordId: number): Promise<Word> {
    const userId = getCurrentUserId()

    // 1. 轻量查询获取单词文本
    const { data: row, error: queryError } = await supabase
      .from('words')
      .select('word')
      .eq('id', wordId)
      .eq('user_id', userId)
      .single()

    if (queryError || !row) throw new Error('单词不存在')

    const wordText = row.word as string

    // 2. 调用 Edge Function 爬取释义
    const { data, error: fnError } = await supabase.functions.invoke('fetch-definition', {
      body: { word: wordText },
    })

    if (fnError || !data?.success) {
      throw new Error(data?.error || fnError?.message || '获取释义失败')
    }

    // 3. 加粗例句
    const definition = applyBoldToDefinition(data.definition as DefinitionObject, wordText)

    // 4. 写入 DB 并返回更新后的行
    const definitionStr = JSON.stringify(definition)
    const [updateResult, relatedWords] = await Promise.all([
      supabase
        .from('words')
        .update({ definition: definitionStr })
        .eq('id', wordId)
        .eq('user_id', userId)
        .select()
        .single(),
      this.getRelatedWordsDirect(wordId)
    ])

    if (updateResult.error) throw new Error(updateResult.error.message)

    const word = this.transformWord(updateResult.data)
    word.related_words = relatedWords
    return word
  }

  // ============================================================================
  // Supabase 直连查询方法
  // ============================================================================

  /**
   * 获取错题集单词（lapse > 0），包含关联词
   */
  static async getLapseWordsDirect(source: string, limit?: number): Promise<Word[]> {
    const userId = getCurrentUserId()
    let query = supabase
      .from('words')
      .select('*')
      .eq('user_id', userId)
      .eq('stop_review', 0)
      .gt('lapse', 0)
      .eq('source', source)
      .order('word', { ascending: true })

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const words = (data || []).map(row => this.transformWord(row))

    // 并行获取关联词
    if (words.length > 0) {
      const wordIds = words.map(w => w.id)
      const relatedWordsMap = await this.getRelatedWordsByIds(wordIds)
      for (const word of words) {
        word.related_words = relatedWordsMap.get(word.id) || []
      }
    }

    return words
  }

  /**
   * 直接通过 Supabase 清除单词的 lapse 标记（fire-and-forget）
   */
  static async clearLapseDirect(wordId: number): Promise<void> {
    const userId = getCurrentUserId()
    const { error } = await supabase
      .from('words')
      .update({ lapse: 0 })
      .eq('id', wordId)
      .eq('user_id', userId)

    if (error) throw new Error(error.message)
  }

  /**
   * 直接从 Supabase 按 ID 列表批量获取单词
   * 用于恢复进度时加载快照中的单词
   * 并行查询单词数据和关联词数据
   */
  static async getWordsByIdsDirect(wordIds: number[]): Promise<Word[]> {
    if (wordIds.length === 0) return []
    const userId = getCurrentUserId()

    // 并行查询：单词数据 + 关联词数据
    const [wordsResult, relatedWordsMap] = await Promise.all([
      supabase
        .from('words')
        .select('*')
        .eq('user_id', userId)
        .in('id', wordIds),
      this.getRelatedWordsByIds(wordIds)
    ])

    if (wordsResult.error) throw new Error(wordsResult.error.message)

    // 按原始 wordIds 顺序排列结果，并填充 related_words
    const wordMap = new Map((wordsResult.data || []).map(row => [row.id as number, row]))
    return wordIds
      .filter(id => wordMap.has(id))
      .map(id => {
        const word = this.transformWord(wordMap.get(id)!)
        word.related_words = relatedWordsMap.get(id) || []
        return word
      })
  }

  /**
   * 获取单个单词的关联词
   */
  static async getRelatedWordsDirect(wordId: number): Promise<RelatedWord[]> {
    const result = await this.getRelatedWordsByIds([wordId])
    return result.get(wordId) || []
  }

  /**
   * 批量获取多个单词的关联词
   * 返回 Map<word_id, RelatedWord[]>
   */
  private static async getRelatedWordsByIds(wordIds: number[]): Promise<Map<number, RelatedWord[]>> {
    if (wordIds.length === 0) return new Map()
    const userId = getCurrentUserId()

    // 查询 words_relations，JOIN words 表获取关联词的文本
    // 分页获取，避免 PostgREST 1000 行限制
    const PAGE_SIZE = 1000
    const allRelationRows: Array<Record<string, unknown>> = []
    let offset = 0
    while (true) {
      const { data, error } = await supabase
        .from('words_relations')
        .select(`
          word_id,
          related_word_id,
          relation_type,
          confidence,
          related_word:words!words_relations_related_word_id_fkey(id, word)
        `)
        .eq('user_id', userId)
        .in('word_id', wordIds)
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) throw new Error(error.message)
      if (!data || data.length === 0) break
      allRelationRows.push(...data)
      if (data.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }

    // 按 word_id 分组
    const result = new Map<number, RelatedWord[]>()
    for (const row of allRelationRows) {
      const wordId = row.word_id as number
      // Supabase FK 查询返回对象（一对一关系），但 TS 类型推断为数组
      const relatedWord = row.related_word as unknown as { id: number; word: string } | null
      if (!relatedWord || !relatedWord.id) continue

      if (!result.has(wordId)) {
        result.set(wordId, [])
      }
      result.get(wordId)!.push({
        id: relatedWord.id,
        word: relatedWord.word,
        relation_type: row.relation_type as string,
        confidence: Number(row.confidence) || 1.0
      })
    }

    return result
  }

  /**
   * 获取单词详情（包含关联词）
   */
  static async getWordDirect(wordId: number): Promise<Word | null> {
    const userId = getCurrentUserId()

    // 并行查询：单词数据 + 关联词数据
    const [wordResult, relatedWords] = await Promise.all([
      supabase
        .from('words')
        .select('*')
        .eq('id', wordId)
        .eq('user_id', userId)
        .single(),
      this.getRelatedWordsDirect(wordId)
    ])

    if (wordResult.error) {
      if (wordResult.error.code === 'PGRST116') return null // Not found
      throw new Error(wordResult.error.message)
    }

    const word = this.transformWord(wordResult.data)
    word.related_words = relatedWords
    return word
  }

  /**
   * 分页获取单词列表
   */
  static async getWordsPaginatedDirect(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ words: Word[]; total: number; has_more: boolean }> {
    const userId = getCurrentUserId()
    const { data, error, count } = await supabase
      .from('words')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('word')
      .range(offset, offset + limit - 1)

    if (error) throw new Error(error.message)

    const total = count || 0
    const words = (data || []).map(row => this.transformWord(row))

    return {
      words,
      total,
      has_more: offset + limit < total
    }
  }

  /**
   * 创建新单词
   */
  static async createWordDirect(wordText: string, source: string): Promise<Word> {
    const userId = getCurrentUserId()
    const word = wordText.trim().toLowerCase()
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('words')
      .insert({
        user_id: userId,
        word,
        definition: '{}',
        source,
        date_added: today,
        next_review: today,
        stop_review: 0
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error(`单词 '${word}' 已存在`)
      }
      throw new Error(error.message)
    }

    return this.transformWord(data)
  }

  /**
   * 批量导入单词（单次 upsert）
   */
  static async batchImportWordsDirect(words: string[], source: string): Promise<BatchImportResult> {
    const userId = getCurrentUserId()
    const today = new Date().toISOString().split('T')[0]

    // 标准化 + 去重
    const uniqueWords = [...new Set(
      words.map(w => w.trim().toLowerCase()).filter(w => w.length > 0)
    )]

    const rows = uniqueWords.map(word => ({
      user_id: userId,
      word,
      definition: '{}',
      source,
      date_added: today,
      next_review: today,
      stop_review: 0
    }))

    const { data, error } = await supabase
      .from('words')
      .upsert(rows, { onConflict: 'word,user_id,source', ignoreDuplicates: true })
      .select()

    if (error) throw new Error(error.message)

    const insertedWords = (data || []).map(row => this.transformWord(row))
    const insertedSet = new Set(insertedWords.map(w => w.word))
    const failedWords = uniqueWords.filter(w => !insertedSet.has(w))

    // 构建对齐的失败详情消息
    const failedDetails: string[] = []
    if (failedWords.length > 0) {
      const maxLen = Math.max(...failedWords.map(w => w.length))
      for (const w of failedWords) {
        const spaces = ' '.repeat(maxLen - w.length)
        failedDetails.push(`单词 '${w}'${spaces} 已存在`)
      }
    }

    return {
      success_count: insertedWords.length,
      failed_count: failedWords.length,
      failed_words: failedWords,
      failed_details: failedDetails,
      total: uniqueWords.length,
      inserted_words: insertedWords
    }
  }

  // ============================================================================
  // 复习/拼写流程方法
  // ============================================================================

  /**
   * 获取需要复习的单词 ID 列表
   */
  static async getReviewWordIdsDirect(
    source: string,
    limit?: number,
    lowEfExtraCount = 0
  ): Promise<number[]> {
    const userId = getCurrentUserId()
    const today = new Date().toISOString().split('T')[0]

    // 1. 查询到期的单词（分页获取，避免 PostgREST 1000 行限制）
    const PAGE_SIZE = 1000
    const dueRows: Array<Record<string, unknown>> = []
    let offset = 0
    while (true) {
      const { data, error: dueError } = await supabase
        .from('words')
        .select('id, word')
        .eq('user_id', userId)
        .eq('stop_review', 0)
        .not('next_review', 'is', null)
        .lte('next_review', today)
        .eq('source', source)
        .range(offset, offset + PAGE_SIZE - 1)

      if (dueError) throw new Error(dueError.message)
      if (!data || data.length === 0) break
      dueRows.push(...data)
      if (data.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }

    // 前端按首字母排序（不区分大小写）
    const sortedDue = (dueRows || []).sort((a, b) =>
      (a.word as string).toLowerCase().localeCompare((b.word as string).toLowerCase())
    )
    let dueIds = sortedDue.map(r => r.id as number)

    if (limit) {
      dueIds = dueIds.slice(0, limit)
    }

    // 2. 查询低 EF 额外单词（排除今天已复习的）
    if (lowEfExtraCount > 0) {
      let lowEfQuery = supabase
        .from('words')
        .select('id, word')
        .eq('user_id', userId)
        .eq('stop_review', 0)
        .eq('source', source)
        .order('ease_factor', { ascending: true })
        .order('repetition', { ascending: true })
        .limit(lowEfExtraCount)

      // 排除今天已复习的单词
      lowEfQuery = lowEfQuery
        .not('last_remembered', 'eq', today)
        .not('last_forgot', 'eq', today)

      // 排除已在 dueIds 中的
      if (dueIds.length > 0) {
        lowEfQuery = lowEfQuery.not('id', 'in', `(${dueIds.join(',')})`)
      }

      const { data: lowEfRows, error: lowEfError } = await lowEfQuery
      if (lowEfError) throw new Error(lowEfError.message)

      // 先按 EF 选出 N 个（DB 已排序），再按首字母排序用于展示
      const selectedLowEf = (lowEfRows || []).slice(0, lowEfExtraCount)
      selectedLowEf.sort((a, b) =>
        (a.word as string).toLowerCase().localeCompare((b.word as string).toLowerCase())
      )
      const lowEfIds = selectedLowEf.map(r => r.id as number)
      return [...dueIds, ...lowEfIds]
    }

    return dueIds
  }

  /**
   * 获取需要拼写练习的单词 ID 列表
   *
   * 排序逻辑：到期 > 从未拼写 > 未到期
   * - shuffle=false: 每个分组内按首字母升序
   * - shuffle=true: 保持分组顺序，但每个分组内部随机
   *
   * 使用 3 个独立查询按优先级分组获取，避免 PostgREST 默认行数限制（1000）
   * 导致高优先级单词被截断丢失。
   */
  static async getSpellingWordIdsDirect(
    source: string,
    limit?: number,
    shuffle = false
  ): Promise<number[]> {
    const userId = getCurrentUserId()
    const today = new Date().toISOString().split('T')[0]

    // 公共筛选条件
    const baseFilter = {
      user_id: userId,
      stop_review: 0,
      source,
    }

    // 3 个独立查询按优先级分组获取，避免 PostgREST 默认行数限制（1000）
    // 导致高优先级单词被截断丢失
    const [dueResult, neverSpelledResult, notYetDueResult] = await Promise.all([
      // P0: 到期（spell_next_review <= today）
      supabase
        .from('words')
        .select('id, word')
        .eq('user_id', baseFilter.user_id)
        .eq('stop_review', baseFilter.stop_review)
        .eq('source', baseFilter.source)
        .or('repetition.gte.3,spell_strength.not.is.null')
        .not('spell_next_review', 'is', null)
        .lte('spell_next_review', today),

      // P1: 从未拼写（spell_next_review IS NULL）
      supabase
        .from('words')
        .select('id, word')
        .eq('user_id', baseFilter.user_id)
        .eq('stop_review', baseFilter.stop_review)
        .eq('source', baseFilter.source)
        .or('repetition.gte.3,spell_strength.not.is.null')
        .is('spell_next_review', null),

      // P2: 未到期（spell_next_review > today）
      supabase
        .from('words')
        .select('id, word')
        .eq('user_id', baseFilter.user_id)
        .eq('stop_review', baseFilter.stop_review)
        .eq('source', baseFilter.source)
        .or('repetition.gte.3,spell_strength.not.is.null')
        .gt('spell_next_review', today),
    ])

    if (dueResult.error) throw new Error(dueResult.error.message)
    if (neverSpelledResult.error) throw new Error(neverSpelledResult.error.message)
    if (notYetDueResult.error) throw new Error(notYetDueResult.error.message)

    const groups = [
      dueResult.data || [],
      neverSpelledResult.data || [],
      notYetDueResult.data || [],
    ]

    // Fisher-Yates 洗牌辅助函数
    const shuffleArray = <T>(arr: T[]): T[] => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    }

    // 对每个分组内部排序或随机，然后按优先级拼接
    const result: number[] = []
    for (const group of groups) {
      if (group.length === 0) continue

      if (shuffle) {
        shuffleArray(group)
      } else {
        group.sort((a, b) =>
          (a.word as string).toLowerCase().localeCompare((b.word as string).toLowerCase())
        )
      }

      result.push(...group.map(r => r.id as number))
    }

    return limit ? result.slice(0, limit) : result
  }

  /**
   * 获取未来每日的复习负荷（DB 端 GROUP BY 聚合）
   */
  static async getDailyReviewLoadsDirect(
    source: string,
    daysAhead = 45
  ): Promise<number[]> {
    const { data, error } = await supabase.rpc('get_daily_review_loads', {
      p_source: source,
      p_days_ahead: daysAhead
    })

    if (error) throw new Error(error.message)

    // 将稀疏的 {day_offset, review_count} 映射为连续数组
    const loads = new Array(daysAhead).fill(0)
    for (const row of data || []) {
      const idx = (row.day_offset as number) - 1  // day_offset 从 1 开始
      if (idx >= 0 && idx < daysAhead) {
        loads[idx] = Number(row.review_count) || 0
      }
    }
    return loads
  }

  /**
   * 获取未来每日的拼写负荷（DB 端 GROUP BY 聚合）
   */
  static async getDailySpellLoadsDirect(
    source: string,
    daysAhead = 45
  ): Promise<number[]> {
    const { data, error } = await supabase.rpc('get_daily_spell_loads', {
      p_source: source,
      p_days_ahead: daysAhead
    })

    if (error) throw new Error(error.message)

    const loads = new Array(daysAhead).fill(0)
    for (const row of data || []) {
      const idx = (row.day_offset as number) - 1
      if (idx >= 0 && idx < daysAhead) {
        loads[idx] = Number(row.review_count) || 0
      }
    }
    return loads
  }

  /**
   * 持久化复习结果到数据库
   *
   * remember_count/forget_count: 前端已持有当前值，直接 +1 写入（单用户无并发）
   */
  static async persistReviewResultDirect(
    wordId: number,
    persistData: {
      last_remembered: string | null
      last_forgot: string | null
      remember_inc: number
      forget_inc: number
      repetition: number
      interval: number
      ease_factor: number
      score: number
      next_review: string
      lapse: number
      avg_elapsed_time: number
      should_stop_review: boolean
      // 前端传入当前计数值，用于增量更新
      current_remember_count: number
      current_forget_count: number
    }
  ): Promise<void> {
    const userId = getCurrentUserId()
    const values: Record<string, unknown> = {
      last_remembered: persistData.last_remembered,
      last_forgot: persistData.last_forgot,
      remember_count: persistData.current_remember_count + persistData.remember_inc,
      forget_count: persistData.current_forget_count + persistData.forget_inc,
      repetition: persistData.repetition,
      interval: persistData.interval,
      ease_factor: persistData.ease_factor,
      last_score: persistData.score,
      next_review: persistData.next_review,
      lapse: persistData.lapse,
      avg_elapsed_time: persistData.avg_elapsed_time,
    }

    if (persistData.should_stop_review) {
      values.stop_review = 1
    }

    const { error } = await supabase
      .from('words')
      .update(values)
      .eq('id', wordId)
      .eq('user_id', userId)

    if (error) throw new Error(error.message)
  }

  /**
   * 插入复习历史记录（fire-and-forget，用于趋势统计）
   */
  static async insertReviewHistory(record: {
    word_id: number
    score: number
    remembered: boolean
    elapsed_time: number
    mode: 'review' | 'spelling'
    source: string
  }): Promise<void> {
    const userId = getCurrentUserId()
    const { error } = await supabase
      .from('review_history')
      .insert({
        user_id: userId,
        word_id: record.word_id,
        reviewed_at: new Date().toISOString(),
        score: record.score,
        remembered: record.remembered,
        elapsed_time: record.elapsed_time,
        mode: record.mode,
        source: record.source,
      })

    if (error) throw new Error(error.message)
  }

  /**
   * 持久化拼写结果到数据库
   */
  static async persistSpellingResultDirect(
    wordId: number,
    persistData: { new_strength: number; next_review: string }
  ): Promise<void> {
    const userId = getCurrentUserId()
    const { error } = await supabase
      .from('words')
      .update({
        spell_strength: persistData.new_strength,
        spell_next_review: persistData.next_review,
      })
      .eq('id', wordId)
      .eq('user_id', userId)

    if (error) throw new Error(error.message)
  }

  /**
   * 转换 Supabase 返回的原始数据为 Word 类型
   * 处理 definition JSON 解析和类型转换
   */
  private static transformWord(row: Record<string, unknown>): Word {
    // Supabase 可能返回 definition 为字符串或对象
    let definition = row.definition
    if (typeof definition === 'string') {
      try {
        definition = JSON.parse(definition)
      } catch {
        definition = {}
      }
    }

    return {
      id: row.id as number,
      word: row.word as string,
      definition: definition as DefinitionObject,
      ease_factor: Number(row.ease_factor) || 2.5,
      stop_review: Number(row.stop_review) || 0,
      date_added: row.date_added as string,
      repetition: Number(row.repetition) || 0,
      interval: Number(row.interval) || 0,
      next_review: row.next_review as string,
      lapse: Number(row.lapse) || 0,
      spell_strength: row.spell_strength !== null ? Number(row.spell_strength) : null,
      spell_next_review: row.spell_next_review as string | null,
      source: row.source as string,
      related_words: row.related_words as Word['related_words'],
      remember_count: Number(row.remember_count) || 0,
      forget_count: Number(row.forget_count) || 0,
      avg_elapsed_time: Number(row.avg_elapsed_time) || 0
    }
  }
}
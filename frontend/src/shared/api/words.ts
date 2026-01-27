/**
 * 单词相关的API接口
 */

import { get, post, patch, del } from './client'
import { supabase } from '@/shared/config/supabase'
import { getCurrentUserId } from '@/shared/composables/useUserSelection'
import type { Word, WordsApiResponse, SourceCounts, DefinitionObject } from '@/shared/types'

// 单词查询参数接口
export interface WordQueryParams {
  mode?: 'mode_review' | 'mode_lapse' | 'mode_spelling'
  shuffle?: boolean
  limit?: number
  source?: string  // 改为动态字符串
  batch_id?: number
  batch_size?: number
  offset?: number
  word_ids?: number[]  // 用于恢复进度时直接传递快照 ID
}

// 单词创建参数接口
export interface CreateWordPayload {
  word: string
  definition: {
    phonetic?: {
      us?: string
      uk?: string
    }
    definitions?: string[]
    examples?: {
      en: string
      zh: string
    }[]
  }
  source: string  // 改为动态字符串
}

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

// 单词操作结果接口
export interface WordActionResult {
  remembered: boolean
  elapsed_time?: number
  spelling_data?: {
    typed_count: number
    backspace_count: number
  }
  is_spelling?: boolean
  mode?: string
  // 分离式 API 使用：前端传完整 word 数据，跳过后端数据库查询
  word_data?: {
    word: string
    interval: number
    repetition: number
    ease_factor: number
    lapse: number
    source: string
    spell_strength?: number | null
    remember_count: number
    forget_count: number
    avg_elapsed_time: number
  }
}

// 复习结果通知数据接口
export interface ReviewNotificationData {
  word: string
  param_type: 'ease_factor' | 'spell_strength'
  param_change: number
  new_param_value: number
  next_review_date: string
  breakdown?: {
    elapsed_time?: number
    remembered?: boolean
    score?: number
    repetition?: number
    interval?: number
    // 拼写模式可能有其他字段
    [key: string]: unknown
  }
}

// 提交复习结果的响应接口
export interface SubmitWordResultResponse {
  word: Word
  notification: ReviewNotificationData | null
}

// 分离式 API：计算结果响应
export interface CalculateResultResponse {
  notification: ReviewNotificationData
  persist_data: Record<string, unknown>  // 需要传给 persist 接口的数据
}

// 分离式 API：持久化请求参数
export interface PersistResultPayload {
  persist_data: Record<string, unknown>
  mode: string
  is_spelling: boolean
}

// 批量导入参数接口
export interface BatchImportPayload {
  words: string[]
  source: string  // 改为动态字符串
}

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
   * 获取单词详情
   */
  static async getWord(wordId: number): Promise<Word> {
    return get<Word>(`/api/word/${wordId}`)
  }

  /**
   * 获取单词列表
   */
  static async getWords(): Promise<Word[]> {
    return get<Word[]>('/api/words')
  }

  /**
   * 分页获取单词列表
   */
  static async getWordsPaginated(limit: number = 50, offset: number = 0): Promise<{ words: Word[], total: number, has_more: boolean, counts?: SourceCounts }> {
    const searchParams = new URLSearchParams()
    searchParams.append('limit', String(limit))
    searchParams.append('offset', String(offset))

    return get<{ words: Word[], total: number, has_more: boolean, counts?: SourceCounts }>(`/api/words/paginated?${searchParams.toString()}`)
  }

  /**
   * 获取复习单词列表
   * 支持 word_ids 参数用于恢复进度时直接传递快照
   */
  static async getReviewWords(params: WordQueryParams): Promise<WordsApiResponse> {
    const searchParams = new URLSearchParams()

    if (params.mode) searchParams.append('mode', params.mode)
    if (params.shuffle !== undefined) searchParams.append('shuffle', String(params.shuffle))
    if (params.limit) searchParams.append('limit', String(params.limit))
    if (params.source) searchParams.append('source', params.source)
    if (params.batch_id !== undefined) searchParams.append('batch_id', String(params.batch_id))
    if (params.batch_size !== undefined) searchParams.append('batch_size', String(params.batch_size))
    if (params.offset !== undefined) searchParams.append('offset', String(params.offset))
    // 传递 word_ids 用于恢复进度（JSON 编码）
    if (params.word_ids && params.word_ids.length > 0) {
      searchParams.append('word_ids', JSON.stringify(params.word_ids))
    }

    return get<WordsApiResponse>(`/api/words/review?${searchParams.toString()}`)
  }

  /**
   * 创建新单词
   */
  static async createWord(wordData: CreateWordPayload): Promise<Word> {
    return post<Word>('/api/word', wordData)
  }

  /**
   * 批量导入单词
   */
  static async batchImportWords(payload: BatchImportPayload): Promise<BatchImportResult> {
    return post<BatchImportResult>('/api/words/batch', payload)
  }

  /**
   * 更新单词信息
   */
  static async updateWord(wordId: number, wordData: UpdateWordPayload): Promise<Word> {
    return patch<Word>(`/api/word/${wordId}`, wordData)
  }

  /**
   * 删除单词
   */
  static async deleteWord(wordId: number): Promise<void> {
    return del<void>(`/api/word/${wordId}`)
  }

  /**
   * 批量删除单词
   */
  static async batchDelete(wordIds: number[]): Promise<{ deleted_count: number; requested_count: number }> {
    return post<{ deleted_count: number; requested_count: number }>('/api/words/batch-delete', { word_ids: wordIds })
  }

  /**
   * 批量更新单词
   */
  static async batchUpdate(wordIds: number[], updateData: Partial<UpdateWordPayload>): Promise<{ updated_count: number; requested_count: number; words: Word[] }> {
    return patch<{ updated_count: number; requested_count: number; words: Word[] }>('/api/words/batch-update', { word_ids: wordIds, ...updateData })
  }

  /**
   * 提交单词复习结果（同步 API，仅用于 lapse 模式）
   * review/spelling 模式使用分离式 API (calculateWordResult + persistWordResult)
   */
  static async submitWordResult(wordId: number, result: WordActionResult): Promise<SubmitWordResultResponse> {
    return patch<SubmitWordResultResponse>(`/api/words/${wordId}/result`, result)
  }

  /**
   * 【分离式 API】只计算复习/拼写结果，不写数据库
   * 用于快速返回 notification，前端可立即显示
   */
  static async calculateWordResult(wordId: number, result: WordActionResult): Promise<CalculateResultResponse> {
    return post<CalculateResultResponse>(`/api/words/${wordId}/calculate-result`, result)
  }

  /**
   * 【分离式 API】持久化复习/拼写结果到数据库
   * 由前端在显示 notification 后异步调用（fire-and-forget）
   */
  static async persistWordResult(wordId: number, payload: PersistResultPayload): Promise<{ word: Word }> {
    return post<{ word: Word }>(`/api/words/${wordId}/persist-result`, payload)
  }

  /**
   * 停止复习单词
   * 返回更新后的完整单词数据（后端已返回，避免额外查询）
   */
  static async stopReview(wordId: number, mode?: string): Promise<Word> {
    return patch<Word>(`/api/word/${wordId}`, { stop_review: true, mode })
  }

  /**
   * 同步获取单词释义
   * 调用后端爬虫获取释义并更新数据库，返回更新后的单词
   */
  static async fetchDefinition(wordId: number): Promise<Word> {
    return post<Word>(`/api/words/${wordId}/fetch-definition`)
  }

  // ============================================================================
  // Supabase 直接查询方法（绕过 Flask 后端，减少延迟）
  // ============================================================================

  /**
   * 直接从 Supabase 获取单词详情
   * 替代 getWord() - 减少 Serverless 冷启动延迟
   */
  static async getWordDirect(wordId: number): Promise<Word | null> {
    const userId = getCurrentUserId()
    const { data, error } = await supabase
      .from('words')
      .select('*')
      .eq('id', wordId)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw new Error(error.message)
    }

    return this.transformWord(data)
  }

  /**
   * 直接从 Supabase 获取所有单词（分页处理大数据集）
   * 替代 getWords()
   */
  static async getWordsDirect(source?: string): Promise<Word[]> {
    const PAGE_SIZE = 1000
    const userId = getCurrentUserId()
    const allWords: Word[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      let query = supabase
        .from('words')
        .select('*')
        .eq('user_id', userId)
        .order('word')
        .range(offset, offset + PAGE_SIZE - 1)

      if (source) {
        query = query.eq('source', source)
      }

      const { data, error } = await query

      if (error) throw new Error(error.message)

      if (data && data.length > 0) {
        allWords.push(...data.map(row => this.transformWord(row)))
        offset += PAGE_SIZE
        hasMore = data.length === PAGE_SIZE
      } else {
        hasMore = false
      }
    }

    return allWords
  }

  /**
   * 直接从 Supabase 分页获取单词列表
   * 替代 getWordsPaginated()
   */
  static async getWordsPaginatedDirect(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ words: Word[]; total: number; has_more: boolean; counts?: SourceCounts }> {
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
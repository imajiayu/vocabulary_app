/**
 * AI 复习相关 Supabase 直连 API
 *
 * 涉及两张表：
 * - review_history：当天做过的单词（读取）
 * - ai_review_sessions：生成的题目 session（读写）
 */

import { supabase } from '@/shared/config/supabase'
import { getCurrentUserId } from '@/shared/composables/useAuth'

export interface AiReviewQuestion {
  type: 'zh_to_en' | 'en_to_zh'
  prompt: string
  answer: string
  target_words: string[]
}

export interface AiReviewSession {
  id: number
  user_id: string
  date: string
  word_ids: number[]
  questions: AiReviewQuestion[]
  created_at: string
  updated_at: string
}

/** 单条 review_history 聚合到单词维度的视图 */
export interface DailyReviewWordRow {
  word_id: number
  word: string
  definition: string | null
  source: string
  ease_factor: number
  /** 当天是否至少失败过一次（review 或 spelling 任一） */
  has_failure: boolean
}

export class AiReviewApi {
  /** 读取指定 UTC 日期的 session（不存在返回 null） */
  static async getSession(date: string): Promise<AiReviewSession | null> {
    const userId = getCurrentUserId()
    const { data, error } = await supabase
      .from('ai_review_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()

    if (error) throw new Error(`读取 AI 复习会话失败: ${error.message}`)
    if (!data) return null
    return data as AiReviewSession
  }

  /** UPSERT：同一天的 session 直接覆盖 */
  static async upsertSession(
    date: string,
    wordIds: number[],
    questions: AiReviewQuestion[],
  ): Promise<AiReviewSession> {
    const userId = getCurrentUserId()
    const { data, error } = await supabase
      .from('ai_review_sessions')
      .upsert(
        {
          user_id: userId,
          date,
          word_ids: wordIds,
          questions,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,date' },
      )
      .select()
      .single()

    if (error) throw new Error(`保存 AI 复习会话失败: ${error.message}`)
    return data as AiReviewSession
  }

  /** 列出 [start, end] 区间内有 session 的日期（UTC） */
  static async listSessionDates(startDate: string, endDate: string): Promise<string[]> {
    const userId = getCurrentUserId()
    const { data, error } = await supabase
      .from('ai_review_sessions')
      .select('date')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)

    if (error) throw new Error(`读取 AI 复习日期列表失败: ${error.message}`)
    return (data ?? []).map((row) => row.date as string)
  }

  /** 列出 [start, end] 区间内有 review_history 的 UTC 日期（便于在日期栏打标） */
  static async listHistoryDates(startDate: string, endDate: string): Promise<string[]> {
    const userId = getCurrentUserId()
    // PostgREST 的 gte/lte 作用在 timestamptz 上；转为 UTC 起止时刻
    const startTs = `${startDate}T00:00:00Z`
    const endTs = `${endDate}T23:59:59.999Z`
    const { data, error } = await supabase
      .from('review_history')
      .select('reviewed_at')
      .eq('user_id', userId)
      .gte('reviewed_at', startTs)
      .lte('reviewed_at', endTs)

    if (error) throw new Error(`读取复习历史日期失败: ${error.message}`)
    const set = new Set<string>()
    for (const row of data ?? []) {
      const ts = row.reviewed_at as string
      set.add(ts.slice(0, 10)) // ISO 字符串前 10 位 = UTC 日期
    }
    return [...set]
  }

  /**
   * 读取指定 UTC 日期用户做过的单词（聚合到 word_id）
   * 返回的 has_failure 标志用于前端排序（失败优先）
   */
  static async getDailyReviewWords(date: string): Promise<DailyReviewWordRow[]> {
    const userId = getCurrentUserId()
    const startTs = `${date}T00:00:00Z`
    const endTs = `${date}T23:59:59.999Z`

    // 1) 取当天所有 review_history 条目
    const { data: historyRows, error: histErr } = await supabase
      .from('review_history')
      .select('word_id, remembered')
      .eq('user_id', userId)
      .gte('reviewed_at', startTs)
      .lte('reviewed_at', endTs)

    if (histErr) throw new Error(`读取复习历史失败: ${histErr.message}`)
    if (!historyRows || historyRows.length === 0) return []

    // 2) 按 word_id 聚合：any failure = has_failure
    const wordFailMap = new Map<number, boolean>()
    for (const row of historyRows) {
      const wid = row.word_id as number
      const remembered = row.remembered as boolean
      const prev = wordFailMap.get(wid) ?? false
      wordFailMap.set(wid, prev || !remembered)
    }
    const wordIds = [...wordFailMap.keys()]

    // 3) 拉单词元数据（word / definition / ef / source）
    const { data: wordRows, error: wErr } = await supabase
      .from('words')
      .select('id, word, definition, source, ease_factor')
      .eq('user_id', userId)
      .in('id', wordIds)

    if (wErr) throw new Error(`读取单词元数据失败: ${wErr.message}`)

    return (wordRows ?? []).map((w) => ({
      word_id: w.id as number,
      word: w.word as string,
      definition: (w.definition as string | null) ?? null,
      source: w.source as string,
      ease_factor: Number(w.ease_factor ?? 2.5),
      has_failure: wordFailMap.get(w.id as number) ?? false,
    }))
  }
}

/**
 * 统计相关的API接口（Supabase Views 直连）
 */

import { supabase } from '@/shared/config/supabase'
import { getCurrentUserId } from '@/shared/composables/useAuth'
import {
  generateSpellHeatmapCell,
  generateEfHeatmapCell,
  type HeatmapCell
} from '@/shared/utils/statsColors'

// 每个 source 的 counts
export interface SourceCounts {
  review: number
  lapse: number
  spelling: number
  today_spell: number
}

// Source 统计数据（用于单个 source 的统计信息）
export interface SourceStats {
  total: number
  remembered: number
  unremembered: number
}

// Supabase VIEW 返回的原始数据类型
interface StatsWordRaw {
  word: string
  ease_factor: number | string | null
  ef_rounded: number | string | null
  elapsed_time_rounded: number | string | null
  spell_strength: number | string | null
  spell_strength_rounded: number | string | null
  repetition: number | string | null
  spell_available: boolean | string
  interval: number | string | null
  last_score: number | string | null
  lapse: number | string | null
  remember_count: number | string | null
  forget_count: number | string | null
}

interface DistributionRow {
  date: string
  count: number | string
}

interface ElapsedTimeRow {
  elapsed_time: number | string
  count: number | string
}

interface ReviewCountRow {
  review_count: number | string
  count: number | string
}

interface IntervalRow {
  interval: number | string
  count: number | string
}

interface MasteredOverviewRow {
  total_mastered: number | string
  avg_ease_factor: number | string | null
  avg_review_count: number | string | null
  avg_elapsed_time: number | string | null
}

interface DailyActivityRow {
  date: string
  total_reviews: number | string
  correct: number | string
  incorrect: number | string
  review_mode_count: number | string
  spelling_mode_count: number | string
}

interface HourlyDistributionRow {
  hour: number | string
  count: number | string
}

// getStats 返回类型
export interface StatsResponse {
  ef_dict: Array<{ word: string; ef: number }>
  next_review_dict: Record<string, number>
  spell_next_review_dict: Record<string, number>
  elapse_time_dict: Record<string, number>
  spell_strength_dict: Array<{ word: string; strength: number | null; available: boolean }>
  added_date_count_dict: Record<string, number>
  review_count_dict: Record<number, number>
  spell_heatmap_cells: HeatmapCell[]
  ef_heatmap_cells: HeatmapCell[]
  // Layer 1 new data
  interval_dict: Record<number, number>
  accuracy_dict: Record<string, number>
  mastered_overview: { total_mastered: number; avg_ease_factor: number | null; avg_review_count: number | null; avg_elapsed_time: number | null } | null
  // Layer 2 new data
  daily_activity: Array<{ date: string; review_count: number; spelling_count: number; correct: number; total: number }>
  hourly_distribution: Record<number, number>
}

// 辅助函数：安全转换为数字
function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const num = typeof value === 'string' ? parseFloat(value) : value
  return isNaN(num) ? null : num
}

// 辅助函数：安全转换为整数
function toInt(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const num = typeof value === 'string' ? parseInt(value, 10) : Math.round(value)
  return isNaN(num) ? 0 : num
}


// 辅助函数：四舍五入到指定小数位（与Python round一致）
function roundTo(value: number | null, decimals: number): number | null {
  if (value === null) return null
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

/**
 * 分页获取所有数据（绕过 Supabase 1000 行限制）
 */
async function fetchAllRows<T>(
  tableName: string,
  selectFields: string,
  filters: { column: string; value: string }[],
  orderBy?: string
): Promise<T[]> {
  const PAGE_SIZE = 1000
  const allRows: T[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from(tableName)
      .select(selectFields)
      .range(offset, offset + PAGE_SIZE - 1)

    for (const filter of filters) {
      query = query.eq(filter.column, filter.value)
    }

    if (orderBy) {
      query = query.order(orderBy)
    }

    const { data, error } = await query

    if (error) throw new Error(`Failed to fetch ${tableName}: ${error.message}`)

    if (data && data.length > 0) {
      allRows.push(...(data as T[]))
      offset += PAGE_SIZE
      hasMore = data.length === PAGE_SIZE
    } else {
      hasMore = false
    }
  }

  return allRows
}

/**
 * 统计API类
 */
export class StatsApi {
  /**
   * 获取详细统计数据
   * 重构：直接从Supabase VIEW查询，使用分页获取所有数据
   */
  static async getStats(params?: { source?: string }): Promise<StatsResponse> {
    const source = params?.source || 'IELTS'
    const userId = getCurrentUserId()
    const sourceFilter = [
      { column: 'source', value: source },
      { column: 'user_id', value: String(userId) }
    ]

    // 并行查询所有VIEW（使用分页获取完整数据）
    const [
      rawData,
      nextReviewData,
      spellNextReviewData,
      elapsedTimeData,
      reviewCountData,
      addedDateData,
      intervalData,
      masteredData,
      dailyActivityData,
      hourlyData
    ] = await Promise.all([
      // 原始单词数据（用于ef_dict, spell_strength_dict, 热力图, accuracy_dict）
      fetchAllRows<StatsWordRaw>(
        'stats_words_raw',
        'word, ease_factor, ef_rounded, elapsed_time_rounded, spell_strength, spell_strength_rounded, repetition, spell_available, interval, last_score, lapse, remember_count, forget_count',
        sourceFilter
      ),
      // 复习日期分布（聚合后行数较少，通常不需要分页）
      fetchAllRows<DistributionRow>(
        'stats_next_review_distribution',
        'date, count',
        sourceFilter,
        'date'
      ),
      // 拼写日期分布
      fetchAllRows<DistributionRow>(
        'stats_spell_next_review_distribution',
        'date, count',
        sourceFilter,
        'date'
      ),
      // 反应时间分布
      fetchAllRows<ElapsedTimeRow>(
        'stats_elapsed_time_distribution',
        'elapsed_time, count',
        sourceFilter,
        'elapsed_time'
      ),
      // 复习次数分布
      fetchAllRows<ReviewCountRow>(
        'stats_review_count_distribution',
        'review_count, count',
        sourceFilter,
        'review_count'
      ),
      // 添加日期分布
      fetchAllRows<DistributionRow>(
        'stats_added_date_distribution',
        'date, count',
        sourceFilter,
        'date'
      ),
      // 复习间隔分布
      fetchAllRows<IntervalRow>(
        'stats_interval_distribution',
        'interval, count',
        sourceFilter,
        'interval'
      ),
      // 已掌握词汇概览
      fetchAllRows<MasteredOverviewRow>(
        'stats_mastered_overview',
        'total_mastered, avg_ease_factor, avg_review_count, avg_elapsed_time',
        sourceFilter
      ),
      // 每日学习活动 (review_history)
      fetchAllRows<DailyActivityRow>(
        'stats_daily_activity',
        'date, total_reviews, correct, incorrect, review_mode_count, spelling_mode_count',
        sourceFilter,
        'date'
      ),
      // 学习时段分布 (review_history)
      fetchAllRows<HourlyDistributionRow>(
        'stats_hourly_distribution',
        'hour, count',
        sourceFilter,
        'hour'
      )
    ])

    // 转换为API响应格式（确保数据类型正确）
    // ef_dict: round(ease_factor, 2)
    const ef_dict: Array<{ word: string; ef: number }> = []
    for (const row of rawData) {
      const ef = toNumber(row.ease_factor)
      if (ef !== null) {
        ef_dict.push({ word: row.word, ef: roundTo(ef, 2)! })
      }
    }

    // spell_strength_dict
    const spell_strength_dict = rawData.map(row => {
      const repetition = toInt(row.repetition)
      const available = repetition >= 3
      const strength = toNumber(row.spell_strength)
      return {
        word: row.word,
        strength: strength !== null ? roundTo(strength, 2) : null,
        available
      }
    })

    // 生成热力图单元格（在前端计算颜色，使用原始值）
    const spell_heatmap_cells = rawData.map(row => {
      const repetition = toInt(row.repetition)
      const available = repetition >= 3
      const spellStrength = toNumber(row.spell_strength)
      return generateSpellHeatmapCell({
        word: row.word,
        spell_strength: spellStrength,
        spell_available: available
      })
    })

    const ef_heatmap_cells = rawData.map(row => {
      const easeFactorNum = toNumber(row.ease_factor)
      return generateEfHeatmapCell({
        word: row.word,
        ease_factor: easeFactorNum
      })
    })

    // 分布数据转换为字典格式
    const next_review_dict: Record<string, number> = {}
    for (const row of nextReviewData) {
      next_review_dict[row.date] = toInt(row.count)
    }

    const spell_next_review_dict: Record<string, number> = {}
    for (const row of spellNextReviewData) {
      spell_next_review_dict[row.date] = toInt(row.count)
    }

    const elapse_time_dict: Record<string, number> = {}
    for (const row of elapsedTimeData) {
      elapse_time_dict[String(toInt(row.elapsed_time))] = toInt(row.count)
    }

    const review_count_dict: Record<number, number> = {}
    for (const row of reviewCountData) {
      review_count_dict[toInt(row.review_count)] = toInt(row.count)
    }

    const added_date_count_dict: Record<string, number> = {}
    for (const row of addedDateData) {
      added_date_count_dict[row.date] = toInt(row.count)
    }

    // Interval distribution
    const interval_dict: Record<number, number> = {}
    for (const row of intervalData) {
      interval_dict[toInt(row.interval)] = toInt(row.count)
    }

    // Accuracy analysis: derive from rawData (remember_count / total * 100)
    const accuracy_dict: Record<string, number> = {}
    for (const row of rawData) {
      const rem = toInt(row.remember_count)
      const forg = toInt(row.forget_count)
      const total = rem + forg
      if (total === 0) continue
      const pct = Math.round(rem / total * 100)
      const bucket = pct <= 20 ? '0-20%'
        : pct <= 40 ? '21-40%'
        : pct <= 60 ? '41-60%'
        : pct <= 80 ? '61-80%'
        : '81-100%'
      accuracy_dict[bucket] = (accuracy_dict[bucket] || 0) + 1
    }

    // Mastered overview
    const masteredRow = masteredData[0] || null
    const mastered_overview = masteredRow ? {
      total_mastered: toInt(masteredRow.total_mastered),
      avg_ease_factor: toNumber(masteredRow.avg_ease_factor),
      avg_review_count: toNumber(masteredRow.avg_review_count),
      avg_elapsed_time: toNumber(masteredRow.avg_elapsed_time),
    } : null

    // Daily activity
    const daily_activity = dailyActivityData.map(row => ({
      date: row.date,
      review_count: toInt(row.review_mode_count),
      spelling_count: toInt(row.spelling_mode_count),
      correct: toInt(row.correct),
      total: toInt(row.total_reviews),
    }))

    // Hourly distribution
    const hourly_distribution: Record<number, number> = {}
    for (const row of hourlyData) {
      hourly_distribution[toInt(row.hour)] = toInt(row.count)
    }

    return {
      ef_dict,
      next_review_dict,
      spell_next_review_dict,
      elapse_time_dict,
      spell_strength_dict,
      added_date_count_dict,
      review_count_dict,
      spell_heatmap_cells,
      ef_heatmap_cells,
      interval_dict,
      accuracy_dict,
      mastered_overview,
      daily_activity,
      hourly_distribution,
    }
  }
}

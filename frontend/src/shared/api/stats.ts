/**
 * 统计相关的API接口
 * 重构后直接使用Supabase查询，不再通过Flask后端
 */

import { get } from './client'
import { supabase } from '@/shared/config/supabase'
import { getCurrentUserId } from '@/shared/composables/useUserSelection'
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

// Source 统计 API 响应
export interface SourceStatsResponse {
  counts: SourceCounts
  source_stats: SourceStats
}

// 首页摘要接口
export interface IndexSummary {
  counts: {
    new: number
    review: number
    lapse: number
    spelling: number
    today_spell: number
  }
  source_stats: Record<string, SourceStats>
  current_source: string
  recent_activity?: Array<{
    type: 'review' | 'new' | 'spelling'
    count: number
    date: string
  }>
  /**
   * @deprecated 前端现在直接从 Supabase 获取进度，此字段将被后端移除
   */
  progress_restore?: {
    has_progress: boolean
    summary?: {
      total_words: number
      current_index: number
      remaining_words: number
      initial_lapse_count: number
      initial_lapse_word_count: number
    }
    progress_basic?: {
      mode: string
      source: string
      shuffle: boolean
      current_index: number
    }
  }
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

// 辅助函数：安全转换为布尔值
function toBool(value: boolean | string | null | undefined): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return false
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
   * 获取首页摘要数据
   * 仍使用Flask后端（涉及session和复杂的progress_restore逻辑）
   */
  static async getIndexSummary(): Promise<IndexSummary> {
    return get<IndexSummary>('/api/index_summary')
  }

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
      addedDateData
    ] = await Promise.all([
      // 原始单词数据（用于ef_dict, spell_strength_dict, 热力图）
      fetchAllRows<StatsWordRaw>(
        'stats_words_raw',
        'word, ease_factor, ef_rounded, elapsed_time_rounded, spell_strength, spell_strength_rounded, repetition, spell_available',
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
      )
    ])

    // 转换为API响应格式（确保数据类型正确）
    // ef_dict: 与后端一致，使用 round(ease_factor, 2)
    const ef_dict: Array<{ word: string; ef: number }> = []
    for (const row of rawData) {
      const ef = toNumber(row.ease_factor)
      if (ef !== null) {
        ef_dict.push({ word: row.word, ef: roundTo(ef, 2)! })
      }
    }

    // spell_strength_dict: 与后端一致
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

    return {
      ef_dict,
      next_review_dict,
      spell_next_review_dict,
      elapse_time_dict,
      spell_strength_dict,
      added_date_count_dict,
      review_count_dict,
      spell_heatmap_cells,
      ef_heatmap_cells
    }
  }
}

// 导出便捷方法
export const statsApi = StatsApi

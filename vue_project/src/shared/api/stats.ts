/**
 * 统计相关的API接口
 */

import { get } from './client'

// 单词统计接口
export interface WordStats {
  total: number
  new: number
  review: number
  lapse: number
  spelling: number
  mastered: number
}

// 学习统计接口
export interface LearningStats {
  daily_reviews: Array<{
    date: string
    count: number
    accuracy: number
  }>
  weekly_progress: Array<{
    week: string
    reviews: number
    new_words: number
  }>
  monthly_summary: {
    total_reviews: number
    total_new_words: number
    avg_accuracy: number
    streak_days: number
  }
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
  source_stats: {
    IELTS: WordStats
    GRE: WordStats
  }
  current_source: 'IELTS' | 'GRE'
  recent_activity?: Array<{
    type: 'review' | 'new' | 'spelling'
    count: number
    date: string
  }>
  progress_restore?: {
    has_progress: boolean
    summary?: {
      total_words: number
      current_index: number
      remaining_words: number
    }
    progress_basic?: {
      mode: string
      source: string
      current_index: number
    }
  }
}

// 进度图表数据接口
export interface ProgressChartData {
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    backgroundColor?: string
    borderColor?: string
  }>
}

// 热力图数据接口
export interface HeatmapData {
  date: string
  count: number
  level: number
}

/**
 * 统计API类
 */
export class StatsApi {
  /**
   * 获取首页摘要数据
   */
  static async getIndexSummary(): Promise<IndexSummary> {
    return get<IndexSummary>('/api/index_summary')
  }

  /**
   * 获取详细统计数据
   */
  static async getStats(params?: { source?: string }): Promise<{
    ef_dict: Array<{ word: string; ef: number }>
    next_review_dict: Record<string, number>
    spell_next_review_dict: Record<string, number>
    elapse_time_dict: Record<string, number>
    spell_strength_dict: Array<{ word: string; strength: number | null; available: boolean }>
    added_date_count_dict: Record<string, number>
    review_count_dict: Record<number, number>
    spell_heatmap_cells: Array<{word: string, value: number | null, available: boolean, color: string, tooltip: string}>
    ef_heatmap_cells: Array<{word: string, value: number | null, available: boolean, color: string, tooltip: string}>
  }> {
    const urlParams = new URLSearchParams()
    if (params?.source) {
      urlParams.append('source', params.source)
    }

    const url = urlParams.toString()
      ? `/api/stats?${urlParams.toString()}`
      : '/api/stats'

    return get(url)
  }

  /**
   * 获取单词统计数据
   */
  static async getWordStats(source?: 'IELTS' | 'GRE'): Promise<WordStats> {
    const url = source ? `/api/stats/words?source=${source}` : '/api/stats/words'
    return get<WordStats>(url)
  }

  /**
   * 获取学习进度数据
   */
  static async getLearningProgress(
    startDate?: string,
    endDate?: string
  ): Promise<ProgressChartData> {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)

    const url = params.toString()
      ? `/api/stats/progress?${params.toString()}`
      : '/api/stats/progress'

    return get<ProgressChartData>(url)
  }

  /**
   * 获取学习热力图数据
   */
  static async getHeatmapData(year?: number): Promise<HeatmapData[]> {
    const url = year ? `/api/stats/heatmap?year=${year}` : '/api/stats/heatmap'
    return get<HeatmapData[]>(url)
  }

  /**
   * 获取准确率统计
   */
  static async getAccuracyStats(
    mode?: 'review' | 'spelling',
    days?: number
  ): Promise<{
    overall_accuracy: number
    daily_accuracy: Array<{
      date: string
      accuracy: number
      total_attempts: number
    }>
  }> {
    const params = new URLSearchParams()
    if (mode) params.append('mode', mode)
    if (days) params.append('days', String(days))

    const url = params.toString()
      ? `/api/stats/accuracy?${params.toString()}`
      : '/api/stats/accuracy'

    return get(url)
  }

  /**
   * 获取学习连续天数
   */
  static async getStreakStats(): Promise<{
    current_streak: number
    longest_streak: number
    total_days: number
  }> {
    return get('/api/stats/streak')
  }

  /**
   * 导出学习数据
   */
  static async exportData(
    format: 'json' | 'csv' = 'json',
    dataType: 'words' | 'reviews' | 'all' = 'all'
  ): Promise<Blob> {
    const params = new URLSearchParams({
      format,
      type: dataType
    })

    return get(`/api/stats/export?${params.toString()}`)
  }
}

// 导出便捷方法
export const statsApi = StatsApi
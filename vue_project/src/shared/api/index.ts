/**
 * API模块统一导出文件
 */

// 导出HTTP客户端
export { httpClient, get, post, put, patch, del, ApiError } from './client'
export type { ApiResponse } from './client'

// 导入所有API类
import { WordsApi } from './words'
import { SpeakingApi } from './speaking'
import { StatsApi } from './stats'
import { ConfigApi } from './config'
import { SettingsApi } from './settings'
import { RelationsApi } from './relations'
import { get } from './client'
import type { Word } from '@/shared/types'

// 导出API类
export { WordsApi } from './words'
export type {
  WordQueryParams,
  CreateWordPayload,
  UpdateWordPayload,
  WordActionResult
} from './words'

export { SpeakingApi } from './speaking'
export type {
  CreateTopicPayload,
  UpdateTopicPayload,
  CreateQuestionPayload,
  UpdateQuestionPayload,
  SpeechToTextResponse,
  AiFeedbackResponse,
  CreateRecordPayload
} from './speaking'

export { StatsApi } from './stats'
export type {
  WordStats,
  LearningStats,
  IndexSummary,
  ProgressChartData,
  HeatmapData
} from './stats'

export { ConfigApi } from './config'
export type {
  SourceSwitchResponse,
  AppSettings,
  BackupData
} from './config'

export { SettingsApi } from './settings'

export { RelationsApi } from './relations'
export type {
  GraphNode,
  GraphEdge,
  GraphData,
  RelationStats,
  GenerateRelationsPayload,
  GenerateRelationsResponse,
  ClearRelationsPayload,
  ClearRelationsResponse,
  AddRelationPayload,
  DeleteRelationPayload
} from './relations'

// 进度恢复API
export class ProgressApi {
  /**
   * 获取可恢复的进度数据
   */
  static async getRestoreData(): Promise<{
    progress: {
      mode: string
      source: string
      shuffle: boolean
      current_index: number
      word_ids: number[]
      initial_lapse_count: number
    }
    words: Word[]
    total: number
  }> {
    return get('/api/progress/restore')
  }
}

// 创建统一的API对象，便于使用
export const api = {
  words: WordsApi,
  speaking: SpeakingApi,
  stats: StatsApi,
  config: ConfigApi,
  settings: SettingsApi,
  relations: RelationsApi,
  progress: ProgressApi
} as const

export default api
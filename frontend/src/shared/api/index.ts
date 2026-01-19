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
import { VocabularyAssistanceApi } from './vocabulary-assistance'
import { get, post } from './client'
import type { Word } from '@/shared/types'

// 导出API类
export { WordsApi } from './words'
export type {
  WordQueryParams,
  CreateWordPayload,
  UpdateWordPayload,
  WordActionResult,
  ReviewNotificationData,
  SubmitWordResultResponse
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

export { VocabularyAssistanceApi } from './vocabulary-assistance'
export type {
  VocabularyAssistanceMessagePayload,
  VocabularyAssistanceResponse
} from './vocabulary-assistance'

// 进度恢复API
export class ProgressApi {
  /**
   * 获取可恢复的进度数据
   *
   * 统一逻辑：
   * - 后端只恢复session快照，不返回单词数据
   * - 前端需要调用 /api/words/review 分页加载单词
   *   - lapse模式：batch_id=1, offset=0, batch_size=total（一次性加载全部）
   *   - 非lapse模式：batch_id=计算的批次+1, 分批加载
   * - 注意：使用 batch_id >= 1 避免覆盖快照（batch_id=0会创建新快照）
   */
  static async getRestoreData(): Promise<{
    progress: {
      mode: string
      source: string
      shuffle: boolean
      current_index: number
      word_ids: number[]
      initial_lapse_count: number
      initial_lapse_word_count: number
    }
    total: number
  }> {
    return get('/api/progress/restore')
  }

  /**
   * 清除当前保存的进度
   */
  static async clearProgress(): Promise<void> {
    return post('/api/progress/clear', {})
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
  progress: ProgressApi,
  vocabularyAssistance: VocabularyAssistanceApi
} as const

export default api
/**
 * API模块统一导出文件
 */

// 导出HTTP客户端
export { get, post, ApiError, createEventSource } from './client'

// 导入所有API类
import { WordsApi } from './words'
import { SpeakingApi } from './speaking'
import { WritingApi } from './writing'
import { StatsApi } from './stats'
import { ConfigApi } from './config'
import { SettingsSupabaseApi } from './settings-supabase'
import { RelationsApi } from './relations'
import { VocabularyAssistanceApi } from './vocabulary-assistance'
import type { Progress, SaveProgressPayload, RestoreData } from '@/shared/types'
import { supabase } from '@/shared/config/supabase'
import { getCurrentUserId } from '@/shared/composables/useAuth'
import { logger } from '@/shared/utils/logger'

const log = logger.create('ProgressApi')

// 导出API类
export { WordsApi } from './words'
export type {
  UpdateWordPayload,
  ReviewNotificationData,
} from './words'

export { SpeakingApi } from './speaking'
export type {
  AiFeedbackResponse,
  CreateRecordPayload
} from './speaking'

export { WritingApi } from './writing'

export { StatsApi } from './stats'
export type {
  SourceCounts,
  SourceStats,
} from './stats'

export { ConfigApi } from './config'
export { SettingsSupabaseApi } from './settings-supabase'

export { RelationsApi } from './relations'
export type {
  GraphNode,
  GraphEdge,
  GraphData,
  RelationStats,
  AddRelationPayload,
  DeleteRelationPayload,
  GenerationTaskStatus
} from './relations'

export { VocabularyAssistanceApi } from './vocabulary-assistance'
export type {
  VocabularyAssistanceMessagePayload,
  VocabularyAssistanceResponse
} from './vocabulary-assistance'

// 进度恢复API（直连 Supabase）
export class ProgressApi {
  // ============================================================================
  // Supabase 直连方法（新实现）
  // ============================================================================

  /**
   * 获取当前进度（直连 Supabase）
   */
  static async getProgressDirect(): Promise<Progress | null> {
    const userId = getCurrentUserId()

    const { data, error } = await supabase
      .from('current_progress')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      // 没有记录不算错误
      if (error.code === 'PGRST116') return null
      throw new Error(`获取进度失败: ${error.message}`)
    }

    if (!data) return null

    // 解析 word_ids_snapshot（存储为 JSON 字符串）
    let wordIds: number[] = []
    if (data.word_ids_snapshot) {
      try {
        wordIds = typeof data.word_ids_snapshot === 'string'
          ? JSON.parse(data.word_ids_snapshot)
          : data.word_ids_snapshot
      } catch {
        wordIds = []
      }
    }

    return {
      id: data.id as number,
      user_id: data.user_id as string,
      mode: data.mode as string,
      source: data.source as string,
      shuffle: data.shuffle as boolean,
      word_ids_snapshot: wordIds,
      current_index: data.current_index as number,
      initial_lapse_count: (data.initial_lapse_count as number) || 0,
      initial_lapse_word_count: (data.initial_lapse_word_count as number) || 0
    }
  }

  /**
   * 保存进度（覆盖式，直连 Supabase）
   */
  static async saveProgressDirect(payload: SaveProgressPayload): Promise<boolean> {
    const userId = getCurrentUserId()

    // 序列化 word_ids 为 JSON 字符串
    const wordIdsJson = JSON.stringify(payload.word_ids)

    const progressData = {
      user_id: userId,
      mode: payload.mode,
      source: payload.source,
      shuffle: payload.shuffle,
      word_ids_snapshot: wordIdsJson,
      current_index: 0,
      initial_lapse_count: payload.initial_lapse_count || 0,
      initial_lapse_word_count: payload.initial_lapse_word_count || 0
    }

    const { error } = await supabase
      .from('current_progress')
      .upsert(progressData, { onConflict: 'user_id' })

    if (error) {
      log.error('保存进度失败:', error)
      return false
    }

    return true
  }

  /**
   * 更新进度索引（直连 Supabase）
   */
  static async updateProgressIndexDirect(currentIndex: number): Promise<boolean> {
    const userId = getCurrentUserId()

    const { error } = await supabase
      .from('current_progress')
      .update({ current_index: currentIndex })
      .eq('user_id', userId)

    if (error) {
      log.error('更新进度索引失败:', error)
      return false
    }

    return true
  }

  /**
   * 更新进度快照（仅更新 word_ids_snapshot，用于 lapse 模式移除单词后同步）
   */
  static async updateProgressSnapshotDirect(wordIds: number[]): Promise<boolean> {
    const userId = getCurrentUserId()

    const { error } = await supabase
      .from('current_progress')
      .update({ word_ids_snapshot: JSON.stringify(wordIds) })
      .eq('user_id', userId)

    if (error) {
      log.error('更新快照失败:', error)
      return false
    }

    return true
  }

  /**
   * 清除进度（重置为初始状态，直连 Supabase）
   */
  static async clearProgressDirect(): Promise<boolean> {
    const userId = getCurrentUserId()

    const { error } = await supabase
      .from('current_progress')
      .update({
        mode: 'mode_review',
        source: 'IELTS',
        shuffle: false,
        word_ids_snapshot: '[]',
        current_index: 0,
        initial_lapse_count: 0,
        initial_lapse_word_count: 0
      })
      .eq('user_id', userId)

    if (error) {
      log.error('清除进度失败:', error)
      return false
    }

    return true
  }

  /**
   * 获取恢复数据（含 lapse 模式过滤，直连 Supabase）
   */
  static async getRestoreDataDirect(): Promise<RestoreData | null> {
    const userId = getCurrentUserId()

    // 1. 获取进度
    const progress = await this.getProgressDirect()

    if (!progress || !progress.word_ids_snapshot?.length) {
      return null
    }

    // 验证进度有效性
    const currentIndex = progress.current_index || 0
    if (currentIndex < 0 || currentIndex >= progress.word_ids_snapshot.length) {
      return null
    }

    let wordIds = progress.word_ids_snapshot

    // 2. Lapse 模式：过滤已完成的单词（lapse = 0）
    if (progress.mode === 'mode_lapse') {
      const { data: activeWords, error } = await supabase
        .from('words')
        .select('id')
        .in('id', wordIds)
        .gt('lapse', 0)
        .eq('user_id', userId)

      if (error) {
        log.error('获取活跃 lapse 单词失败:', error)
        return null
      }

      const activeWordIds = activeWords?.map(w => w.id as number) || []

      // 如果有单词被过滤，仅更新快照字段
      if (activeWordIds.length !== wordIds.length) {
        await this.updateProgressSnapshotDirect(activeWordIds)
        wordIds = activeWordIds
      }

      // Lapse 模式如果没有剩余单词，返回 null
      if (wordIds.length === 0) {
        return null
      }
    }

    return {
      progress: {
        mode: progress.mode,
        source: progress.source,
        shuffle: progress.shuffle,
        current_index: progress.current_index,
        word_ids: wordIds,
        initial_lapse_count: progress.initial_lapse_count,
        initial_lapse_word_count: progress.initial_lapse_word_count
      },
      total: wordIds.length
    }
  }

}

// 创建统一的API对象，便于使用
export const api = {
  words: WordsApi,
  speaking: SpeakingApi,
  writing: WritingApi,
  stats: StatsApi,
  config: ConfigApi,
  settings: SettingsSupabaseApi,
  relations: RelationsApi,
  progress: ProgressApi,
  vocabularyAssistance: VocabularyAssistanceApi
} as const

export default api
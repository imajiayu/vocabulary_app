/**
 * 配置相关的API接口
 */

import { get, post } from './client'
import { SettingsSupabaseApi } from './settings-supabase'

/**
 * 配置API类
 */
export class ConfigApi {
  /**
   * 获取当前源信息
   */
  static async getCurrentSource(): Promise<{
    current_source: string
  }> {
    return get('/api/source')
  }

  /**
   * 设置当前源
   */
  static async setSource(source: string): Promise<{
    current_source: string
  }> {
    return post('/api/source', { source })
  }

  /**
   * 获取所有 sources 的统计信息（直连 Supabase）
   */
  static async getSourcesStats(): Promise<Record<string, number>> {
    return SettingsSupabaseApi.getSourcesStats()
  }

  /**
   * 删除指定 source（调用 Supabase Edge Function）
   */
  static async deleteSource(sourceName: string): Promise<{
    message: string
    deleted_words: number
    deleted_progress: number
    remaining_sources: string[]
  }> {
    const result = await SettingsSupabaseApi.deleteSource(sourceName)
    return {
      message: result.message,
      deleted_words: result.deleted_words,
      deleted_progress: result.deleted_progress,
      remaining_sources: result.remaining_sources
    }
  }

}
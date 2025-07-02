/**
 * 配置相关的API接口
 */

import { SettingsSupabaseApi } from './settings-supabase'

/**
 * 配置API类
 */
export class ConfigApi {
  /**
   * 获取所有 sources 的统计信息（直连 Supabase）
   * @param customSources 传入已有的 customSources 列表可避免额外查询 settings
   */
  static async getSourcesStats(customSources?: string[]): Promise<Record<string, number>> {
    return SettingsSupabaseApi.getSourcesStats(customSources)
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

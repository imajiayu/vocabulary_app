/**
 * 用户设置API
 */
import { get, post } from './client'
import type { UserSettings, SettingsApiResponse } from '@/shared/types'

export class SettingsApi {
  /**
   * 获取用户设置
   */
  static async getSettings(): Promise<UserSettings> {
    return get<SettingsApiResponse>('/api/settings')
  }

  /**
   * 更新用户设置（部分更新）
   * @param settings - 要更新的设置字段（可以只传需要更新的字段）
   */
  static async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    return post<UserSettings>('/api/settings', settings)
  }

  /**
   * 重置为默认设置
   */
  static async resetToDefaults(): Promise<UserSettings> {
    const defaults: UserSettings = {
      learning: {
        dailyReviewLimit: 300,
        dailySpellLimit: 200,
        maxPrepDays: 45
      }
    }
    return this.updateSettings(defaults)
  }
}

export default SettingsApi

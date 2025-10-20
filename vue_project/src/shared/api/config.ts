/**
 * 配置相关的API接口
 */

import { get, post } from './client'

// 源切换响应接口
export interface SourceSwitchResponse {
  current_source: 'IELTS' | 'GRE'
  counts: {
    new: number
    review: number
    lapse: number
    spelling: number
  }
  ielts_stats: {
    total: number
    new: number
    review: number
    lapse: number
    spelling: number
  }
  gre_stats: {
    total: number
    new: number
    review: number
    lapse: number
    spelling: number
  }
}

// 应用设置接口
export interface AppSettings {
  default_source: 'IELTS' | 'GRE'
  daily_review_limit: number
  auto_play_audio: boolean
  show_phonetic: boolean
  review_mode_settings: {
    shuffle_by_default: boolean
    show_definition_first: boolean
    auto_advance_time: number
  }
  spelling_mode_settings: {
    show_hints: boolean
    allow_skip: boolean
    max_attempts: number
  }
  ui_preferences: {
    theme: 'light' | 'dark' | 'auto'
    language: 'zh' | 'en'
    compact_mode: boolean
  }
}

// 数据备份接口
export interface BackupData {
  words: any[]
  reviews: any[]
  speaking_records: any[]
  settings: AppSettings
  export_date: string
  version: string
}

/**
 * 配置API类
 */
export class ConfigApi {
  /**
   * 切换单词源
   */
  static async switchSource(source: 'IELTS' | 'GRE'): Promise<SourceSwitchResponse> {
    return post<SourceSwitchResponse>('/api/switch_source', { source })
  }

  /**
   * 获取当前源信息
   */
  static async getCurrentSource(): Promise<{
    current_source: 'IELTS' | 'GRE'
  }> {
    return get('/api/source')
  }

  /**
   * 设置当前源
   */
  static async setSource(source: 'IELTS' | 'GRE'): Promise<{
    current_source: 'IELTS' | 'GRE'
  }> {
    return post('/api/source', { source })
  }

  /**
   * 获取应用设置
   */
  static async getSettings(): Promise<AppSettings> {
    return get<AppSettings>('/api/settings')
  }

  /**
   * 更新应用设置
   */
  static async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    return post<AppSettings>('/api/settings', settings)
  }

  /**
   * 重置设置为默认值
   */
  static async resetSettings(): Promise<AppSettings> {
    return post<AppSettings>('/api/settings/reset')
  }

  /**
   * 获取系统信息
   */
  static async getSystemInfo(): Promise<{
    version: string
    database_size: number
    total_words: number
    total_reviews: number
    uptime: number
    memory_usage: number
  }> {
    return get('/api/system/info')
  }

  /**
   * 健康检查
   */
  static async healthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'error'
    checks: Array<{
      name: string
      status: 'pass' | 'fail'
      message?: string
    }>
    timestamp: string
  }> {
    return get('/api/health')
  }

  /**
   * 创建数据备份
   */
  static async createBackup(): Promise<BackupData> {
    return post<BackupData>('/api/backup/create')
  }

  /**
   * 恢复数据备份
   */
  static async restoreBackup(backupFile: File): Promise<{
    success: boolean
    message: string
    restored_items: {
      words: number
      reviews: number
      speaking_records: number
    }
  }> {
    const formData = new FormData()
    formData.append('backup_file', backupFile)

    return post('/api/backup/restore', formData)
  }

  /**
   * 清除所有数据
   */
  static async clearAllData(): Promise<{
    success: boolean
    message: string
    cleared_items: string[]
  }> {
    return post('/api/data/clear')
  }

  /**
   * 重建数据库索引
   */
  static async rebuildIndexes(): Promise<{
    success: boolean
    message: string
    rebuilt_indexes: string[]
  }> {
    return post('/api/database/rebuild-indexes')
  }

  /**
   * 获取数据库统计信息
   */
  static async getDatabaseStats(): Promise<{
    total_size: number
    table_stats: Array<{
      table_name: string
      row_count: number
      size_bytes: number
    }>
    index_stats: Array<{
      index_name: string
      table_name: string
      size_bytes: number
    }>
  }> {
    return get('/api/database/stats')
  }
}

// 导出便捷方法
export const configApi = ConfigApi
/**
 * 单词相关的API接口
 */

import { get, post, patch, del } from './client'
import type { Word, WordsApiResponse, SourceCounts } from '@/shared/types'

// 单词查询参数接口
export interface WordQueryParams {
  mode?: 'mode_review' | 'mode_lapse' | 'mode_spelling'
  shuffle?: boolean
  limit?: number
  source?: 'IELTS' | 'GRE'
  batch_id?: number
  batch_size?: number
  offset?: number
}

// 单词创建参数接口
export interface CreateWordPayload {
  word: string
  definition: {
    phonetic?: {
      us?: string
      uk?: string
    }
    definitions?: string[]
    examples?: {
      en: string
      zh: string
    }[]
  }
  source: 'IELTS' | 'GRE'
}

// 单词更新参数接口
export interface UpdateWordPayload {
  word?: string
  definition?: any
  ease_factor?: number
  stop_review?: boolean
  repetition?: number
  interval?: number
  next_review?: string
  lapse?: number
}

// 单词操作结果接口
export interface WordActionResult {
  remembered: boolean
  elapsed_time?: number
  spelling_data?: {
    typed_count: number
    backspace_count: number
  }
  is_spelling?: boolean
}

// 批量导入参数接口
export interface BatchImportPayload {
  words: string[]
  source: 'IELTS' | 'GRE'
}

// 批量导入结果接口
export interface BatchImportResult {
  success_count: number
  failed_count: number
  failed_words: string[]
  total: number
  inserted_words: Word[]
}

/**
 * 单词API类
 */
export class WordsApi {
  /**
   * 获取单词详情
   */
  static async getWord(wordId: number): Promise<Word> {
    return get<Word>(`/api/word/${wordId}`)
  }

  /**
   * 获取单词列表
   */
  static async getWords(): Promise<Word[]> {
    return get<Word[]>('/api/words')
  }

  /**
   * 分页获取单词列表
   */
  static async getWordsPaginated(limit: number = 50, offset: number = 0): Promise<{ words: Word[], total: number, has_more: boolean, counts?: SourceCounts }> {
    const searchParams = new URLSearchParams()
    searchParams.append('limit', String(limit))
    searchParams.append('offset', String(offset))

    return get<{ words: Word[], total: number, has_more: boolean, counts?: SourceCounts }>(`/api/words/paginated?${searchParams.toString()}`)
  }

  /**
   * 获取复习单词列表
   */
  static async getReviewWords(params: WordQueryParams): Promise<WordsApiResponse> {
    const searchParams = new URLSearchParams()

    if (params.mode) searchParams.append('mode', params.mode)
    if (params.shuffle !== undefined) searchParams.append('shuffle', String(params.shuffle))
    if (params.limit) searchParams.append('limit', String(params.limit))
    if (params.source) searchParams.append('source', params.source)
    if (params.batch_id !== undefined) searchParams.append('batch_id', String(params.batch_id))
    if (params.batch_size !== undefined) searchParams.append('batch_size', String(params.batch_size))
    if (params.offset !== undefined) searchParams.append('offset', String(params.offset))

    return get<WordsApiResponse>(`/api/words/review?${searchParams.toString()}`)
  }

  /**
   * 创建新单词
   */
  static async createWord(wordData: CreateWordPayload): Promise<Word> {
    return post<Word>('/api/word', wordData)
  }

  /**
   * 批量导入单词
   */
  static async batchImportWords(payload: BatchImportPayload): Promise<BatchImportResult> {
    return post<BatchImportResult>('/api/words/batch', payload)
  }

  /**
   * 更新单词信息
   */
  static async updateWord(wordId: number, wordData: UpdateWordPayload): Promise<Word> {
    return patch<Word>(`/api/word/${wordId}`, wordData)
  }

  /**
   * 部分更新单词信息
   */
  static async patchWord(wordId: number, wordData: Partial<UpdateWordPayload>): Promise<Word> {
    return patch<Word>(`/api/word/${wordId}`, wordData)
  }

  /**
   * 删除单词
   */
  static async deleteWord(wordId: number): Promise<void> {
    return del<void>(`/api/word/${wordId}`)
  }

  /**
   * 提交单词复习结果
   * @returns 返回更新后的完整单词数据（包含related_words）
   */
  static async submitWordResult(wordId: number, result: WordActionResult): Promise<Word> {
    return patch<Word>(`/api/words/${wordId}/result`, result)
  }

  /**
   * 停止复习单词
   */
  static async stopReview(wordId: number, mode?: string): Promise<void> {
    return patch<void>(`/api/word/${wordId}`, { stop_review: true, mode })
  }

  /**
   * 重置单词学习进度
   */
  static async resetWordProgress(wordId: number): Promise<Word> {
    return patch<Word>(`/api/word/${wordId}`, {
      ease_factor: 2.5,
      repetition: 0,
      interval: 1,
      lapse: 0,
      stop_review: false
    })
  }

  /**
   * 标记单词为已掌握
   */
  static async markAsMastered(wordId: number): Promise<Word> {
    return patch<Word>(`/api/word/${wordId}`, {
      ease_factor: 3.0,
      repetition: 10,
      interval: 365,
      stop_review: true
    })
  }

  /**
   * 标记单词为困难
   */
  static async markAsDifficult(wordId: number): Promise<Word> {
    return patch<Word>(`/api/word/${wordId}`, {
      ease_factor: 1.3,
      lapse: (await this.getWord(wordId)).lapse + 1
    })
  }
}

// 导出便捷方法
export const wordsApi = WordsApi
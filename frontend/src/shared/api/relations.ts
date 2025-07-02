/**
 * 单词关系API
 *
 * 写操作已迁移到 Supabase 直接写入
 * 图查询保留后端（涉及递归深度查询）
 */
import { get, post, createEventSource } from './client'
import { supabase } from '@/shared/config/supabase'
import { getCurrentUserId } from '@/shared/composables/useAuth'

export interface GraphNode {
  id: number
  word: string
  definition: string
}

export interface GraphEdge {
  source: number
  target: number
  relation_type: string
  confidence: number
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface RelationStats {
  synonym: number
  antonym: number
  root: number
  confused: number
  topic: number
  total: number
}

export interface AddRelationPayload {
  word_id: number
  related_word_id: number
  relation_type: string
  confidence?: number
}

export interface DeleteRelationPayload {
  word_id: number
  related_word_id: number
  relation_type: string
}

export interface GenerationTaskStatus {
  status: 'idle' | 'running' | 'completed' | 'stopped' | 'error'
  processed: number
  total: number
  found: number
  saved: number
  skipped: number    // 因已生成过该类型关系而跳过的单词数
  error?: string
}

export class RelationsApi {
  /**
   * 获取单词关系图数据（保留后端：涉及递归深度查询）
   * @param params 查询参数
   */
  static async getGraph(params?: {
    relation_types?: string[]
    word_id?: number
    max_depth?: number
  }): Promise<GraphData> {
    const queryParams: string[] = []

    if (params?.relation_types && params.relation_types.length > 0) {
      queryParams.push(`relation_types=${params.relation_types.join(',')}`)
    }

    if (params?.word_id) {
      queryParams.push(`word_id=${params.word_id}`)
    }

    if (params?.max_depth) {
      queryParams.push(`max_depth=${params.max_depth}`)
    }

    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : ''
    return get<GraphData>(`/api/relations/graph${queryString}`)
  }

  // ============================================================================
  // Supabase 直接查询方法
  // ============================================================================

  /**
   * 获取关系统计
   * 使用 relation_stats view（已在 Supabase 中创建）
   */
  static async getStatsDirect(): Promise<RelationStats> {
    const userId = getCurrentUserId()
    const { data, error } = await supabase
      .from('relation_stats')
      .select('*')
      .eq('user_id', userId)

    if (error) throw new Error(error.message)

    const stats: RelationStats = {
      synonym: 0,
      antonym: 0,
      root: 0,
      confused: 0,
      topic: 0,
      total: 0
    }

    for (const row of data || []) {
      const type = row.relation_type as string
      if (type in stats && type !== 'total') {
        const key = type as keyof Omit<RelationStats, 'total'>
        stats[key] = Number(row.count) || 0
        stats.total += stats[key]
      }
    }

    return stats
  }

  // ============================================================================
  // Supabase 直接写入方法
  // ============================================================================

  /**
   * 添加关系（双向插入）
   */
  static async addDirect(payload: AddRelationPayload): Promise<void> {
    const { word_id, related_word_id, relation_type, confidence = 1.0 } = payload
    const userId = getCurrentUserId()

    const { error } = await supabase
      .from('words_relations')
      .insert([
        { word_id, related_word_id, relation_type, confidence, user_id: userId },
        { word_id: related_word_id, related_word_id: word_id, relation_type, confidence, user_id: userId }
      ])

    if (error) throw new Error(error.message)
  }

  /**
   * 删除关系（双向删除）
   */
  static async deleteDirect(payload: DeleteRelationPayload): Promise<void> {
    const { word_id, related_word_id, relation_type } = payload
    const userId = getCurrentUserId()

    // 删除正向关系
    const { error: error1 } = await supabase
      .from('words_relations')
      .delete()
      .eq('word_id', word_id)
      .eq('related_word_id', related_word_id)
      .eq('relation_type', relation_type)
      .eq('user_id', userId)

    if (error1) throw new Error(error1.message)

    // 删除反向关系
    const { error: error2 } = await supabase
      .from('words_relations')
      .delete()
      .eq('word_id', related_word_id)
      .eq('related_word_id', word_id)
      .eq('relation_type', relation_type)
      .eq('user_id', userId)

    if (error2) throw new Error(error2.message)
  }

  // ============================================================================
  // 关系生成控制（Flask 后端）
  // ============================================================================

  static async startGeneration(relationType: string): Promise<void> {
    await post('/api/relations/generate', { relation_type: relationType })
  }

  static async stopGeneration(relationType: string): Promise<void> {
    await post('/api/relations/generate/stop', { relation_type: relationType })
  }

  static async getGenerationStatus(): Promise<Record<string, GenerationTaskStatus>> {
    return get<Record<string, GenerationTaskStatus>>('/api/relations/generate/status')
  }

  static async createProgressStream(): Promise<EventSource> {
    return createEventSource('/api/relations/generate/progress')
  }

  // ============================================================================
  // 清空关系（Supabase 直连）
  // ============================================================================

  static async clearByType(relationType: string): Promise<void> {
    const userId = getCurrentUserId()

    const { error: err1 } = await supabase
      .from('words_relations')
      .delete()
      .eq('user_id', userId)
      .eq('relation_type', relationType)

    if (err1) throw new Error(err1.message)

    const { error: err2 } = await supabase
      .from('relation_generation_log')
      .delete()
      .eq('user_id', userId)
      .eq('relation_type', relationType)

    if (err2) throw new Error(err2.message)
  }
}

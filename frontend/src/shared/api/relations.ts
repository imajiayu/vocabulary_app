/**
 * 单词关系API
 */
import { get, post, del } from './client'

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

export interface ClearRelationsPayload {
  relation_types?: string[]
}

export interface ClearRelationsResponse {
  count: number
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

export class RelationsApi {
  /**
   * 获取单词关系图数据
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

  /**
   * 获取关系统计信息
   */
  static async getStats(): Promise<RelationStats> {
    return get<RelationStats>('/api/relations/stats')
  }

  /**
   * 清空指定类型的关系
   * @param payload 请求体
   */
  static async clear(payload?: ClearRelationsPayload): Promise<ClearRelationsResponse> {
    return post<ClearRelationsResponse>('/api/relations/clear', payload || {})
  }

  /**
   * 添加单条关系
   * @param payload 请求体
   */
  static async add(payload: AddRelationPayload): Promise<any> {
    return post('/api/relations', payload)
  }

  /**
   * 删除单条关系
   * @param payload 请求体
   */
  static async delete(payload: DeleteRelationPayload): Promise<void> {
    return del('/api/relations', {
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    } as RequestInit)
  }

}

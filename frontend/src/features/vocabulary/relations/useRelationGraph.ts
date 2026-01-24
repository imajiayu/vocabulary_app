import { ref, computed } from 'vue'
import { api } from '@/shared/api'
import type { GraphNode, GraphEdge, GraphData } from '@/shared/api'
import { logger } from '@/shared/utils/logger'

export interface RelationFilters {
  synonym: boolean
  antonym: boolean
  root: boolean
  confused: boolean
  topic: boolean
}

export const relationColors: Record<string, string> = {
  synonym: '#5D7A5D',   // 橄榄绿
  antonym: '#9B3B3B',   // 砖红
  root: '#6B4F0F',      // 深赭石
  confused: '#B87333',  // 铜橙
  topic: '#996B3D'      // 铜褐
}

export const relationTypeOptions = [
  { value: 'synonym', label: '同义词', color: '#5D7A5D' },
  { value: 'antonym', label: '反义词', color: '#9B3B3B' },
  { value: 'root', label: '词根', color: '#6B4F0F' },
  { value: 'confused', label: '易混淆', color: '#B87333' },
  { value: 'topic', label: '主题', color: '#996B3D' }
]

export function useRelationGraph() {
  // Core state
  const filters = ref<RelationFilters>({
    synonym: true,
    antonym: true,
    root: true,
    confused: true,
    topic: true
  })
  const searchWord = ref('')
  const centerWordId = ref<number | null>(null)
  const showAllNodes = ref(false)
  const loading = ref(false)
  const error = ref('')

  // Graph data
  const graphData = ref<GraphData>({ nodes: [], edges: [] })
  const fullGraphData = ref<GraphData>({ nodes: [], edges: [] })

  // Computed
  const selectedTypes = computed(() =>
    Object.entries(filters.value)
      .filter(([_, enabled]) => enabled)
      .map(([type]) => type)
  )

  const hasData = computed(() => fullGraphData.value.nodes.length > 0)

  // Fetch graph data from API
  async function fetchGraphData() {
    loading.value = true
    error.value = ''

    try {
      const params: { word_id?: number; max_depth?: number } = {}

      if (centerWordId.value) {
        params.word_id = centerWordId.value
        params.max_depth = 1
      }

      const data = await api.relations.getGraph(params)
      fullGraphData.value = data
      applyFilters()
    } catch (e: unknown) {
      const err = e as Error
      error.value = err.message || '网络错误'
      logger.error('Failed to fetch graph data:', e)
    } finally {
      loading.value = false
    }
  }

  // Apply filters to full data (frontend-only, no API call)
  function applyFilters(): GraphData {
    const types = selectedTypes.value
    const data = fullGraphData.value

    let filteredData: GraphData

    if (centerWordId.value) {
      // Show only directly connected nodes
      const directNodeIds = new Set<number>([centerWordId.value])

      data.edges.forEach(edge => {
        if (types.includes(edge.relation_type)) {
          if (edge.source === centerWordId.value) {
            directNodeIds.add(edge.target)
          } else if (edge.target === centerWordId.value) {
            directNodeIds.add(edge.source)
          }
        }
      })

      const filteredNodes = data.nodes.filter(node => directNodeIds.has(node.id))
      const filteredEdges = data.edges.filter(edge =>
        types.includes(edge.relation_type) &&
        (edge.source === centerWordId.value || edge.target === centerWordId.value) &&
        directNodeIds.has(edge.source) &&
        directNodeIds.has(edge.target)
      )

      filteredData = { nodes: filteredNodes, edges: filteredEdges }
    } else if (showAllNodes.value) {
      if (types.length === 0 || types.length === 5) {
        filteredData = data
      } else {
        const nodeIdsWithRelations = new Set<number>()
        data.edges.forEach(edge => {
          if (types.includes(edge.relation_type)) {
            nodeIdsWithRelations.add(edge.source)
            nodeIdsWithRelations.add(edge.target)
          }
        })

        filteredData = {
          nodes: data.nodes.filter(node => nodeIdsWithRelations.has(node.id)),
          edges: data.edges.filter(edge => types.includes(edge.relation_type))
        }
      }
    } else {
      filteredData = { nodes: [], edges: [] }
    }

    graphData.value = filteredData
    return filteredData
  }

  // Search word and focus on it
  function focusOnWord(node: GraphNode) {
    searchWord.value = node.word
    centerWordId.value = node.id
    showAllNodes.value = false
    applyFilters()
  }

  // Toggle show all nodes
  function toggleShowAllNodes() {
    showAllNodes.value = !showAllNodes.value
    centerWordId.value = null
    searchWord.value = ''

    if (showAllNodes.value && fullGraphData.value.nodes.length === 0) {
      fetchGraphData()
    } else {
      applyFilters()
    }
  }

  // Add relation (optimistic update)
  async function addRelation(
    sourceId: number,
    targetId: number,
    relationType: string
  ) {
    // Optimistic update
    fullGraphData.value.edges.push({
      source: sourceId,
      target: targetId,
      relation_type: relationType,
      confidence: 1.0
    })
    applyFilters()

    // Sync with backend
    try {
      await api.relations.add({
        word_id: sourceId,
        related_word_id: targetId,
        relation_type: relationType,
        confidence: 1.0
      })
    } catch (e: unknown) {
      const err = e as Error
      error.value = `添加关系失败: ${err.message}`
      setTimeout(() => { error.value = '' }, 3000)
      await fetchGraphData() // Restore correct state
    }
  }

  // Delete relation (optimistic update)
  async function deleteRelation(
    sourceId: number,
    targetId: number,
    relationType: string
  ) {
    // Optimistic update
    fullGraphData.value.edges = fullGraphData.value.edges.filter(e =>
      !(
        ((e.source === sourceId && e.target === targetId) ||
          (e.source === targetId && e.target === sourceId)) &&
        e.relation_type === relationType
      )
    )
    applyFilters()

    // Sync with backend
    try {
      await api.relations.delete({
        word_id: sourceId,
        related_word_id: targetId,
        relation_type: relationType
      })
    } catch (e: unknown) {
      const err = e as Error
      error.value = `删除关系失败: ${err.message}`
      setTimeout(() => { error.value = '' }, 3000)
      await fetchGraphData() // Restore correct state
    }
  }

  // Reset state when modal closes
  function reset() {
    centerWordId.value = null
    searchWord.value = ''
    error.value = ''
  }

  // Find target node by word
  function findNodeByWord(word: string): GraphNode | undefined {
    return fullGraphData.value.nodes.find(
      n => n.word.toLowerCase() === word.toLowerCase()
    )
  }

  return {
    // State
    filters,
    searchWord,
    centerWordId,
    showAllNodes,
    loading,
    error,
    graphData,
    fullGraphData,

    // Computed
    selectedTypes,
    hasData,

    // Actions
    fetchGraphData,
    applyFilters,
    focusOnWord,
    toggleShowAllNodes,
    addRelation,
    deleteRelation,
    reset,
    findNodeByWord
  }
}

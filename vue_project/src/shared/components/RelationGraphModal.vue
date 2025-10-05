<template>
  <Teleport to="body">
    <div v-if="show" class="relation-graph-modal">
      <!-- 遮罩层 -->
      <div class="modal-overlay" @click="handleClose"></div>

      <!-- 浮窗内容 -->
      <div class="modal-content">
        <!-- 图表页面内容 -->
        <div class="graph-wrapper">
          <!-- 关闭按钮 -->
          <button class="close-btn" @click="handleClose">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
          <div class="controls-bar">
            <div class="control-group">
              <label>关系类型:</label>
              <div class="relation-filters">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="filters.synonym" @change="fetchGraphData" />
                  同义词
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="filters.antonym" @change="fetchGraphData" />
                  反义词
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="filters.root" @change="fetchGraphData" />
                  词根
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="filters.confused" @change="fetchGraphData" />
                  易混淆
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="filters.topic" @change="fetchGraphData" />
                  主题
                </label>
              </div>
            </div>

            <div class="control-group">
              <label>搜索单词:</label>
              <div class="search-autocomplete-wrapper">
                <input
                  v-model="searchWord"
                  type="text"
                  placeholder="输入单词查看其关系网络..."
                  @input="updateSearchCandidates"
                  @keydown="handleSearchKeydown"
                  class="search-input"
                  autocomplete="off"
                />
                <div v-if="searchCandidates.length > 0" class="search-candidates-list">
                  <div
                    v-for="(candidate, index) in searchCandidates"
                    :key="candidate.id"
                    class="search-candidate-item"
                    :class="{ selected: index === searchSelectedIndex }"
                    @click="selectSearchCandidate(candidate)"
                    @mouseenter="searchSelectedIndex = index"
                  >
                    <span class="candidate-word">{{ candidate.word }}</span>
                    <span v-if="candidate.definition" class="candidate-definition">
                      {{ candidate.definition.split('; ')[0] }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="control-group">
              <button @click="toggleShowAllNodes" class="show-all-btn" :class="{ active: showAllNodes }">
                {{ showAllNodes ? '隐藏全部节点' : '展示所有节点' }}
              </button>
            </div>

            <div class="stats">
              <span>节点: {{ graphData.nodes.length }}</span>
              <span>关系: {{ graphData.edges.length }}</span>
            </div>
          </div>

          <div ref="chartContainer" class="chart-container"></div>

          <div v-if="loading" class="loading-overlay">
            <div class="spinner"></div>
            <p>加载中...</p>
          </div>

          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <!-- 右键菜单 -->
          <div v-if="contextMenu.show" class="context-menu" :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }" @click.stop>
            <div v-if="contextMenu.type === 'edge'" class="menu-item" @click="deleteRelation">
              <span>🗑️</span>
              <span>删除关系</span>
            </div>
            <div v-if="contextMenu.type === 'node'" class="menu-item" @click="showAddRelationDialog">
              <span>➕</span>
              <span>添加关系</span>
            </div>
          </div>

          <!-- 点击任意位置关闭右键菜单 -->
          <div v-if="contextMenu.show" class="context-menu-backdrop" @click="closeContextMenu"></div>
        </div>

        <!-- 添加关系对话框 -->
        <div v-if="addRelationDialog.show" class="dialog-overlay" @click="cancelAddRelation">
          <div class="add-relation-dialog" @click.stop>
            <h3>为「{{ addRelationDialog.sourceNode?.word }}」添加关系</h3>

            <div class="dialog-field">
              <label>目标单词：</label>
              <div class="autocomplete-wrapper">
                <input
                  v-model="addRelationDialog.targetWord"
                  type="text"
                  placeholder="输入单词名称"
                  @input="updateCandidates"
                  @keydown="handleKeydown"
                  autocomplete="off"
                />
                <div v-if="candidateWords.length > 0" class="candidates-list">
                  <div
                    v-for="(candidate, index) in candidateWords"
                    :key="candidate.id"
                    class="candidate-item"
                    :class="{ selected: index === selectedCandidateIndex }"
                    @click="selectCandidate(candidate)"
                    @mouseenter="selectedCandidateIndex = index"
                  >
                    <span class="candidate-word">{{ candidate.word }}</span>
                    <span v-if="candidate.definition" class="candidate-definition">
                      {{ candidate.definition.split('; ')[0] }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="dialog-field">
              <label>关系类型：</label>
              <div class="custom-select-wrapper">
                <div
                  class="custom-select-trigger"
                  @click="relationTypeDropdown = !relationTypeDropdown"
                >
                  <span class="selected-type">
                    <span
                      class="type-indicator"
                      :style="{ backgroundColor: relationTypeOptions.find(opt => opt.value === addRelationDialog.relationType)?.color }"
                    ></span>
                    {{ getRelationTypeLabel(addRelationDialog.relationType) }}
                  </span>
                  <svg
                    class="dropdown-arrow"
                    :class="{ open: relationTypeDropdown }"
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </div>
                <div v-if="relationTypeDropdown" class="custom-select-dropdown">
                  <div
                    v-for="option in relationTypeOptions"
                    :key="option.value"
                    class="select-option"
                    :class="{ selected: option.value === addRelationDialog.relationType }"
                    @click="selectRelationType(option.value)"
                  >
                    <span class="type-indicator" :style="{ backgroundColor: option.color }"></span>
                    <span>{{ option.label }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="dialog-actions">
              <button class="btn-confirm" @click="addRelation">确认</button>
              <button class="btn-cancel" @click="cancelAddRelation">取消</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { api } from '@/shared/api'
import type { GraphNode, GraphEdge, GraphData } from '@/shared/api'

interface Props {
  show: boolean
}

interface Emits {
  (e: 'update:show', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const chartContainer = ref<HTMLDivElement>()
let chartInstance: echarts.ECharts | null = null

const filters = ref({
  synonym: true,
  antonym: true,
  root: true,
  confused: true,
  topic: true
})
const searchWord = ref('')
const centerWordId = ref<number | null>(null)
const searchCandidates = ref<GraphNode[]>([])
const searchSelectedIndex = ref(-1)
const graphData = ref<GraphData>({ nodes: [], edges: [] })
const fullGraphData = ref<GraphData>({ nodes: [], edges: [] }) // 保存完整的图数据用于搜索
const loading = ref(false)
const error = ref('')
const showAllNodes = ref(false) // 是否显示所有节点

// 右键菜单
const contextMenu = ref({
  show: false,
  type: '' as 'node' | 'edge' | '',
  x: 0,
  y: 0,
  data: null as any
})

// 添加关系对话框
const addRelationDialog = ref({
  show: false,
  sourceNode: null as GraphNode | null,
  targetWord: '',
  relationType: 'synonym' as string
})

// 候选单词列表
const candidateWords = ref<GraphNode[]>([])
const selectedCandidateIndex = ref(-1)

// 关系类型下拉菜单
const relationTypeDropdown = ref(false)
const relationTypeOptions = [
  { value: 'synonym', label: '同义词', color: '#52c41a' },
  { value: 'antonym', label: '反义词', color: '#ff4d4f' },
  { value: 'root', label: '词根', color: '#722ed1' },
  { value: 'confused', label: '易混淆', color: '#fa8c16' },
  { value: 'topic', label: '主题', color: '#1677ff' }
]

// 关系类型配色
const relationColors: Record<string, string> = {
  synonym: '#52c41a',
  antonym: '#ff4d4f',
  root: '#722ed1',
  confused: '#fa8c16',
  topic: '#1677ff'
}

const handleClose = () => {
  emit('update:show', false)
}

const fetchGraphData = async () => {
  loading.value = true
  error.value = ''

  try {
    const selectedTypes = Object.entries(filters.value)
      .filter(([_, enabled]) => enabled)
      .map(([type]) => type)

    const params: {
      relation_types?: string[]
      word_id?: number
      max_depth?: number
    } = {}

    if (selectedTypes.length > 0 && selectedTypes.length < 5) {
      params.relation_types = selectedTypes
    }

    if (centerWordId.value) {
      params.word_id = centerWordId.value
      params.max_depth = 1
    }

    const data = await api.relations.getGraph(params)

    // 只在没有选中中心词时更新 fullGraphData（保存真正的全量数据）
    if (!centerWordId.value) {
      fullGraphData.value = data
    }

    // 如果有中心词，只显示直连节点
    if (centerWordId.value) {
      const directNodeIds = new Set<number>()
      directNodeIds.add(centerWordId.value)

      // 找出所有直连的节点
      data.edges.forEach(edge => {
        if (edge.source === centerWordId.value) {
          directNodeIds.add(edge.target)
        } else if (edge.target === centerWordId.value) {
          directNodeIds.add(edge.source)
        }
      })

      // 过滤节点，只保留中心节点和直连节点
      const filteredNodes = data.nodes.filter(node => directNodeIds.has(node.id))

      // 过滤边，只保留与中心节点直接相连的边
      const filteredEdges = data.edges.filter(edge =>
        (edge.source === centerWordId.value || edge.target === centerWordId.value) &&
        directNodeIds.has(edge.source) &&
        directNodeIds.has(edge.target)
      )

      graphData.value = {
        nodes: filteredNodes,
        edges: filteredEdges
      }
    } else if (showAllNodes.value) {
      // 显示所有节点
      graphData.value = data
    } else {
      // 默认不显示任何节点
      graphData.value = { nodes: [], edges: [] }
    }

    renderGraph()
  } catch (e: any) {
    error.value = e.message || '网络错误'
    console.error('Failed to fetch graph data:', e)
  } finally {
    loading.value = false
  }
}


// 更新搜索候选词
const updateSearchCandidates = () => {
  const input = searchWord.value.trim().toLowerCase()
  if (!input) {
    searchCandidates.value = []
    searchSelectedIndex.value = -1
    return
  }

  const allWords = fullGraphData.value.nodes

  // 前缀匹配
  const prefixMatches: GraphNode[] = []
  // 子序列匹配
  const subsequenceMatches: GraphNode[] = []

  allWords.forEach(node => {
    const word = node.word.toLowerCase()
    if (word.startsWith(input)) {
      prefixMatches.push(node)
    } else if (isSubsequenceMatch(input, word)) {
      subsequenceMatches.push(node)
    }
  })

  // 按字母顺序排序
  prefixMatches.sort((a, b) => a.word.localeCompare(b.word))
  subsequenceMatches.sort((a, b) => a.word.localeCompare(b.word))

  // 合并结果，最多显示10个
  searchCandidates.value = [...prefixMatches, ...subsequenceMatches].slice(0, 10)
  searchSelectedIndex.value = -1
}

// 处理搜索框键盘导航
const handleSearchKeydown = (event: KeyboardEvent) => {
  if (searchCandidates.value.length === 0) {
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    searchSelectedIndex.value = Math.min(
      searchSelectedIndex.value + 1,
      searchCandidates.value.length - 1
    )
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    searchSelectedIndex.value = Math.max(searchSelectedIndex.value - 1, -1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (searchSelectedIndex.value >= 0) {
      selectSearchCandidate(searchCandidates.value[searchSelectedIndex.value])
    }
  }
}

// 选择搜索候选词
const selectSearchCandidate = async (node: GraphNode) => {
  searchWord.value = node.word
  centerWordId.value = node.id
  searchCandidates.value = []
  searchSelectedIndex.value = -1
  showAllNodes.value = false
  await fetchGraphData()
}

// 展示所有节点
const toggleShowAllNodes = async () => {
  showAllNodes.value = !showAllNodes.value
  centerWordId.value = null
  searchWord.value = ''
  searchCandidates.value = []
  await fetchGraphData()
}

const renderGraph = () => {
  if (!chartContainer.value) return

  if (!chartInstance) {
    chartInstance = echarts.init(chartContainer.value)
  }

  // 如果没有节点，显示提示信息
  if (graphData.value.nodes.length === 0) {
    const emptyOption: echarts.EChartsOption = {
      title: {
        text: '请搜索单词或展示所有节点',
        left: 'center',
        top: 'center',
        textStyle: {
          fontSize: 18,
          color: '#94a3b8',
          fontWeight: 'normal'
        }
      }
    }
    chartInstance.setOption(emptyOption, true)
    return
  }

  const nodes = graphData.value.nodes.map(node => {
    const isCenterNode = node.id === centerWordId.value
    const wordLength = node.word.length
    // 根据单词长度计算宽度，每个字符约8像素，最小40，最大150
    const width = Math.min(150, Math.max(40, wordLength * 8 + 20))
    const height = isCenterNode ? 35 : 25

    return {
      id: node.id.toString(),
      name: node.word,
      symbol: 'rect',
      symbolSize: [width, height],
      itemStyle: {
        color: isCenterNode ? '#5470c6' : '#91cc75',
        borderRadius: 4
      },
      label: {
        show: true,
        fontSize: isCenterNode ? 14 : 12,
        fontWeight: (isCenterNode ? 'bold' : 'normal') as 'bold' | 'normal',
        color: '#fff'
      },
      emphasis: {
        disabled: true
      }
    }
  })

  const links = graphData.value.edges.map(edge => ({
    source: edge.source.toString(),
    target: edge.target.toString(),
    lineStyle: {
      color: relationColors[edge.relation_type] || '#999',
      width: Math.max(1, edge.confidence * 3),
      curveness: 0.2
    },
    label: {
      show: true,
      formatter: edge.relation_type,
      fontSize: 10,
      color: relationColors[edge.relation_type] || '#999'
    }
  }))

  const option: echarts.EChartsOption = {
    title: {
      text: centerWordId.value
        ? `${searchWord.value} 的关系网络`
        : '单词关系图',
      left: 'center',
      top: 10
    },
    tooltip: {
      trigger: 'item',
      confine: true,
      extraCssText: 'max-width: 400px; white-space: normal; word-wrap: break-word;',
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const node = graphData.value.nodes.find(n => n.id.toString() === params.data.id)
          if (node) {
            const definitions = node.definition ? node.definition.split('; ').join('<br/>') : '暂无释义'
            return `<b>${node.word}</b><br/>${definitions}<br/><span style="color: #999; font-size: 12px;">点击查看关系</span>`
          }
          return `<b>${params.data.name}</b><br/>点击查看关系`
        } else if (params.dataType === 'edge') {
          const sourceNode = graphData.value.nodes.find(n => n.id.toString() === params.data.source)
          const targetNode = graphData.value.nodes.find(n => n.id.toString() === params.data.target)
          return `${sourceNode?.word} ⟷ ${targetNode?.word}<br/>关系: ${params.data.label.formatter}`
        }
        return ''
      }
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        data: nodes,
        links: links,
        roam: true,
        draggable: true,
        force: {
          repulsion: centerWordId.value ? 500 : 300,
          edgeLength: centerWordId.value ? 150 : 100,
          gravity: 0.1
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: {
            width: 4
          }
        }
      }
    ]
  }

  chartInstance.setOption(option, true)

  chartInstance.off('click')
  chartInstance.on('click', (params: any) => {
    if (params.dataType === 'node') {
      const nodeId = parseInt(params.data.id)
      const node = graphData.value.nodes.find(n => n.id === nodeId)
      if (node) {
        searchWord.value = node.word
        centerWordId.value = nodeId
        showAllNodes.value = false
        fetchGraphData()
      }
    }
  })

  // 监听右键点击
  chartInstance.off('contextmenu')
  chartInstance.on('contextmenu', (params: any) => {
    params.event.event.preventDefault()

    if (params.dataType === 'edge') {
      contextMenu.value = {
        show: true,
        type: 'edge',
        x: params.event.event.clientX,
        y: params.event.event.clientY,
        data: params.data
      }
    } else if (params.dataType === 'node') {
      const nodeId = parseInt(params.data.id)
      const node = graphData.value.nodes.find(n => n.id === nodeId)
      contextMenu.value = {
        show: true,
        type: 'node',
        x: params.event.event.clientX,
        y: params.event.event.clientY,
        data: node
      }
    }
  })
}

const handleResize = () => {
  chartInstance?.resize()
}

// 关闭右键菜单
const closeContextMenu = () => {
  contextMenu.value.show = false
  // 清除 ECharts 的高亮状态和拖拽状态
  if (chartInstance) {
    chartInstance.dispatchAction({
      type: 'downplay'
    })
    // 强制重置拖拽状态
    chartInstance.setOption({
      series: [{
        type: 'graph',
        draggable: true
      }]
    })
  }
}

// 显示添加关系对话框
const showAddRelationDialog = () => {
  addRelationDialog.value = {
    show: true,
    sourceNode: contextMenu.value.data,
    targetWord: '',
    relationType: 'synonym'
  }
  closeContextMenu()
}

// 删除关系
const deleteRelation = async () => {
  try {
    const edge = contextMenu.value.data
    await api.relations.delete({
      word_id: parseInt(edge.source),
      related_word_id: parseInt(edge.target),
      relation_type: edge.label.formatter
    })
    closeContextMenu()
    await fetchGraphData()
  } catch (e: any) {
    error.value = `删除关系失败: ${e.message}`
    setTimeout(() => {
      error.value = ''
    }, 3000)
  }
}

// 添加关系
const addRelation = async () => {
  try {
    const targetWord = addRelationDialog.value.targetWord.trim().toLowerCase()
    if (!targetWord) {
      error.value = '请输入目标单词'
      setTimeout(() => { error.value = '' }, 3000)
      return
    }

    // 在已有节点中搜索目标单词
    const targetNode = graphData.value.nodes.find(n => n.word.toLowerCase() === targetWord)
    if (!targetNode) {
      error.value = `未找到单词: ${targetWord}`
      setTimeout(() => { error.value = '' }, 3000)
      return
    }

    // 检查是否与自己建立关系
    if (targetNode.id === addRelationDialog.value.sourceNode?.id) {
      error.value = '不能与自己建立关系'
      setTimeout(() => { error.value = '' }, 3000)
      return
    }

    await api.relations.add({
      word_id: addRelationDialog.value.sourceNode!.id,
      related_word_id: targetNode.id,
      relation_type: addRelationDialog.value.relationType,
      confidence: 1.0
    })

    addRelationDialog.value.show = false
    await fetchGraphData()
  } catch (e: any) {
    error.value = `添加关系失败: ${e.message}`
    setTimeout(() => {
      error.value = ''
    }, 3000)
  }
}

// 取消添加关系
const cancelAddRelation = () => {
  addRelationDialog.value.show = false
  candidateWords.value = []
  selectedCandidateIndex.value = -1
  relationTypeDropdown.value = false
  // 清除 ECharts 的拖拽状态
  if (chartInstance) {
    chartInstance.dispatchAction({
      type: 'downplay'
    })
    // 强制重置拖拽状态
    chartInstance.setOption({
      series: [{
        type: 'graph',
        draggable: true
      }]
    })
  }
}

// 更新候选单词列表
const updateCandidates = () => {
  const input = addRelationDialog.value.targetWord.trim().toLowerCase()
  if (!input) {
    candidateWords.value = []
    selectedCandidateIndex.value = -1
    return
  }

  // 从完整的图数据中搜索候选单词（排除源节点自身）
  const sourceId = addRelationDialog.value.sourceNode?.id
  const allWords = fullGraphData.value.nodes.filter(node => node.id !== sourceId)

  // 前缀匹配
  const prefixMatches: GraphNode[] = []
  // 子序列匹配
  const subsequenceMatches: GraphNode[] = []

  allWords.forEach(node => {
    const word = node.word.toLowerCase()
    if (word.startsWith(input)) {
      prefixMatches.push(node)
    } else if (isSubsequenceMatch(input, word)) {
      subsequenceMatches.push(node)
    }
  })

  // 按字母顺序排序
  prefixMatches.sort((a, b) => a.word.localeCompare(b.word))
  subsequenceMatches.sort((a, b) => a.word.localeCompare(b.word))

  // 合并结果，最多显示10个
  candidateWords.value = [...prefixMatches, ...subsequenceMatches].slice(0, 10)
  selectedCandidateIndex.value = -1
}

// 子序列匹配算法
const isSubsequenceMatch = (pattern: string, text: string): boolean => {
  let patternIndex = 0
  for (let i = 0; i < text.length && patternIndex < pattern.length; i++) {
    if (text[i] === pattern[patternIndex]) {
      patternIndex++
    }
  }
  return patternIndex === pattern.length
}

// 处理键盘导航
const handleKeydown = (event: KeyboardEvent) => {
  if (candidateWords.value.length === 0) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    selectedCandidateIndex.value = Math.min(
      selectedCandidateIndex.value + 1,
      candidateWords.value.length - 1
    )
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    selectedCandidateIndex.value = Math.max(selectedCandidateIndex.value - 1, -1)
  } else if (event.key === 'Enter' && selectedCandidateIndex.value >= 0) {
    event.preventDefault()
    selectCandidate(candidateWords.value[selectedCandidateIndex.value])
  }
}

// 选择候选单词
const selectCandidate = (node: GraphNode) => {
  addRelationDialog.value.targetWord = node.word
  candidateWords.value = []
  selectedCandidateIndex.value = -1
}

// 选择关系类型
const selectRelationType = (type: string) => {
  addRelationDialog.value.relationType = type
  relationTypeDropdown.value = false
}

// 获取当前选中的关系类型标签
const getRelationTypeLabel = (type: string) => {
  return relationTypeOptions.find(opt => opt.value === type)?.label || type
}

// 监听 show 变化
watch(() => props.show, async (newShow) => {
  if (newShow) {
    await fetchGraphData()
    // 等待 DOM 更新后初始化图表
    setTimeout(() => {
      window.addEventListener('resize', handleResize)
    }, 100)
  } else {
    // 清空搜索状态
    centerWordId.value = null
    searchWord.value = ''
    error.value = ''

    window.removeEventListener('resize', handleResize)
    if (chartInstance) {
      chartInstance.dispose()
      chartInstance = null
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
})
</script>

<style scoped>
.relation-graph-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal-content {
  position: relative;
  width: 95vw;
  height: 95vh;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1;
}

.close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border: none;
  background: white;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.close-btn:hover {
  background: #f1f5f9;
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.close-btn svg {
  color: #64748b;
  width: 20px;
  height: 20px;
  transition: color 0.2s;
}

.close-btn:hover svg {
  color: #334155;
}

.graph-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  position: relative;
}

.controls-bar {
  background: linear-gradient(to bottom, #ffffff, #fafafa);
  padding: 16px 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  z-index: 10;
  position: relative;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.control-group {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.control-group label {
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  font-size: 14px;
}

.relation-filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #475569;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s;
}

.checkbox-label:hover {
  background: #f1f5f9;
}

.checkbox-label input[type="checkbox"] {
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: #667eea;
}

.search-autocomplete-wrapper {
  position: relative;
  display: inline-block;
}

.search-input {
  padding: 8px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  min-width: 240px;
  font-size: 14px;
  color: #0f172a;
  transition: all 0.2s;
  background: white;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-input::placeholder {
  color: #94a3b8;
}

.search-candidates-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-top: none;
  border-radius: 0 0 8px 8px;
  max-height: 240px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  margin-top: -1px;
  min-width: 240px;
}

.search-candidate-item {
  padding: 8px 14px;
  cursor: pointer;
  transition: background-color 0.15s;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.search-candidate-item:last-child {
  border-bottom: none;
}

.search-candidate-item:hover,
.search-candidate-item.selected {
  background: #f8fafc;
}

.search-autocomplete-wrapper .candidate-word {
  font-weight: 600;
  color: #0f172a;
  font-size: 13px;
}

.search-autocomplete-wrapper .candidate-definition {
  font-size: 11px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.show-all-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  background: white;
  color: #667eea;
  border: 1px solid #e0e7ff;
}

.show-all-btn:hover {
  background: #f5f7ff;
  border-color: #c7d2fe;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.2);
}

.show-all-btn:active {
  transform: translateY(0);
}

.show-all-btn.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-color: transparent;
}

.show-all-btn.active:hover {
  background: linear-gradient(135deg, #5568d3, #6a3f8f);
}

.stats {
  display: flex;
  gap: 20px;
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
  padding: 8px 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.stats span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.chart-container {
  flex: 1;
  background: white;
  margin: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 100;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #1677ff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 4px;
  padding: 1rem 2rem;
  color: #ff4d4f;
  font-size: 14px;
  z-index: 101;
}

/* ===== 右键菜单 ===== */
.context-menu-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9998;
}

.context-menu {
  position: fixed;
  z-index: 9999;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 4px;
  min-width: 150px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  font-size: 14px;
  color: #0f172a;
}

.menu-item:hover {
  background: #f1f5f9;
}

.menu-item span:first-child {
  font-size: 16px;
}

/* ===== 添加关系对话框 ===== */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.add-relation-dialog {
  background: white;
  border-radius: 16px;
  padding: 24px;
  width: 90%;
  max-width: 480px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.add-relation-dialog h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.dialog-field {
  margin-bottom: 16px;
}

.dialog-field label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #475569;
}

.dialog-field input,
.dialog-field select,
.dialog-field .custom-select-wrapper {
  width: 100%;
  box-sizing: border-box;
}

.dialog-field input,
.dialog-field select {
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #0f172a;
  transition: all 0.2s;
  background: white;
  box-sizing: border-box;
}

.dialog-field input:focus,
.dialog-field select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.dialog-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.btn-confirm,
.btn-cancel {
  flex: 1;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-confirm {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.btn-confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-cancel {
  background: white;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.btn-cancel:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

/* ===== 自动完成候选列表 ===== */
.autocomplete-wrapper {
  position: relative;
  width: 100%;
  box-sizing: border-box;
}

.candidates-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-top: none;
  border-radius: 0 0 8px 8px;
  max-height: 240px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  margin-top: -1px;
}

.candidate-item {
  padding: 10px 14px;
  cursor: pointer;
  transition: background-color 0.15s;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.candidate-item:last-child {
  border-bottom: none;
}

.candidate-item:hover,
.candidate-item.selected {
  background: #f8fafc;
}

.candidate-word {
  font-weight: 600;
  color: #0f172a;
  font-size: 14px;
}

.candidate-definition {
  font-size: 12px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.autocomplete-wrapper input:focus {
  border-radius: 8px 8px 0 0;
}

/* ===== 自定义关系类型选择器 ===== */
.custom-select-wrapper {
  position: relative;
  width: 100%;
  box-sizing: border-box;
}

.custom-select-trigger {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #0f172a;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s;
  box-sizing: border-box;
}

.custom-select-trigger:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.selected-type {
  display: flex;
  align-items: center;
  gap: 8px;
}

.type-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}

.dropdown-arrow {
  color: #64748b;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.custom-select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1001;
  overflow: hidden;
}

.select-option {
  padding: 10px 14px;
  cursor: pointer;
  transition: background-color 0.15s;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #0f172a;
}

.select-option:hover {
  background: #f8fafc;
}

.select-option.selected {
  background: #f1f5f9;
  font-weight: 500;
}


</style>

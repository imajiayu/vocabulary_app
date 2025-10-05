<template>
  <Teleport to="body">
    <div v-if="show" class="relation-graph-modal">
      <!-- 遮罩层 -->
      <div class="modal-overlay" @click="handleClose"></div>

      <!-- 浮窗内容 -->
      <div class="modal-content">
        <!-- 图表页面内容 -->
        <div class="graph-wrapper">
          <div class="controls-bar">
            <!-- 关闭按钮 -->
            <button class="close-btn" @click="handleClose">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
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
              <input
                v-model="searchWord"
                type="text"
                placeholder="输入单词查看其关系网络..."
                @keyup.enter="handleSearch"
                class="search-input"
              />
              <button @click="handleSearch" class="search-btn">搜索</button>
              <button v-if="centerWordId" @click="resetView" class="reset-btn">重置</button>
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
              <input
                v-model="addRelationDialog.targetWord"
                type="text"
                placeholder="输入单词名称"
                @keyup.enter="addRelation"
              />
            </div>

            <div class="dialog-field">
              <label>关系类型：</label>
              <select v-model="addRelationDialog.relationType">
                <option value="synonym">同义词</option>
                <option value="antonym">反义词</option>
                <option value="root">词根</option>
                <option value="confused">易混淆</option>
                <option value="topic">主题</option>
              </select>
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
const graphData = ref<GraphData>({ nodes: [], edges: [] })
const loading = ref(false)
const error = ref('')

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
      params.max_depth = 2
    }

    const data = await api.relations.getGraph(params)

    graphData.value = data
    renderGraph()
  } catch (e: any) {
    error.value = e.message || '网络错误'
    console.error('Failed to fetch graph data:', e)
  } finally {
    loading.value = false
  }
}

const handleSearch = async () => {
  const word = searchWord.value.trim().toLowerCase()
  if (!word) {
    resetView()
    return
  }

  // 在已有的节点中搜索
  const foundNode = graphData.value.nodes.find(n => n.word.toLowerCase() === word)

  if (foundNode) {
    centerWordId.value = foundNode.id
    searchWord.value = foundNode.word
    await fetchGraphData()
  } else {
    error.value = `未找到单词: ${word}`
    // 3秒后自动清除错误提示
    setTimeout(() => {
      error.value = ''
    }, 3000)
  }
}

const resetView = () => {
  centerWordId.value = null
  searchWord.value = ''
  fetchGraphData()
}

const renderGraph = () => {
  if (!chartContainer.value || graphData.value.nodes.length === 0) return

  if (!chartInstance) {
    chartInstance = echarts.init(chartContainer.value)
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
        itemStyle: {
          color: isCenterNode ? '#5470c6' : '#91cc75',
          borderRadius: 4
        },
        label: {
          show: true,
          fontSize: isCenterNode ? 14 : 12,
          fontWeight: (isCenterNode ? 'bold' : 'normal') as 'bold' | 'normal',
          color: '#fff'
        }
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
          },
          label: {
            show: true
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
  top: 50%;
  right: 16px;
  transform: translateY(-50%);
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
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.close-btn:hover {
  background: #f1f5f9;
  transform: translateY(-50%) scale(1.05);
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

.search-btn,
.reset-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.search-btn {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.search-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
}

.search-btn:active {
  transform: translateY(0);
}

.reset-btn {
  background: white;
  color: #ef4444;
  border: 1px solid #fee2e2;
}

.reset-btn:hover {
  background: #fef2f2;
  border-color: #fecaca;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(239, 68, 68, 0.2);
}

.reset-btn:active {
  transform: translateY(0);
}

.stats {
  margin-left: auto;
  margin-right: 80px;
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
.dialog-field select {
  width: 100%;
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

@media (max-width: 768px) {
  .modal-content {
    width: 100vw;
    height: 100vh;
    border-radius: 0;
  }

  .controls-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .control-group {
    flex-direction: column;
    align-items: stretch;
  }

  .relation-filters {
    flex-direction: column;
  }

  .stats {
    margin-left: 0;
  }

  .search-input {
    min-width: auto;
    width: 100%;
  }

  .add-relation-dialog {
    width: 95%;
    padding: 20px;
  }
}
</style>

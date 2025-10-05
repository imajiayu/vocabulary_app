<template>
  <div class="relation-graph-page">
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { api } from '@/shared/api'
import type { GraphNode, GraphEdge, GraphData } from '@/shared/api'

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

// 关系类型配色
const relationColors: Record<string, string> = {
  synonym: '#52c41a',    // 绿色
  antonym: '#ff4d4f',    // 红色
  root: '#722ed1',       // 紫色
  confused: '#fa8c16',   // 橙色
  topic: '#1677ff'       // 蓝色
}

const fetchGraphData = async () => {
  loading.value = true
  error.value = ''

  try {
    // 构建查询参数
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

  try {
    // 搜索单词ID
    const data = await api.words.getWordsPaginated(200, 0)

    const foundWord = data.words.find((w: any) =>
      w.word.toLowerCase() === word
    )

    if (foundWord) {
      centerWordId.value = foundWord.id
      await fetchGraphData()
    } else {
      error.value = `未找到单词: ${word}`
    }
  } catch (e: any) {
    error.value = e.message || '搜索失败'
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

  // 转换数据格式
  const nodes = graphData.value.nodes.map(node => ({
    id: node.id.toString(),
    name: node.word,
    symbolSize: node.id === centerWordId.value ? 50 : 30,
    itemStyle: {
      color: node.id === centerWordId.value ? '#5470c6' : '#91cc75'
    },
    label: {
      show: true,
      fontSize: node.id === centerWordId.value ? 14 : 12,
      fontWeight: (node.id === centerWordId.value ? 'bold' : 'normal') as 'bold' | 'normal'
    }
  }))

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
      formatter: (params: any) => {
        if (params.dataType === 'node') {
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

  // 点击节点事件
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
}

const handleResize = () => {
  chartInstance?.resize()
}

onMounted(async () => {
  await fetchGraphData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
})
</script>

<style scoped>
.relation-graph-page {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  position: relative;
}

.controls-bar {
  background: white;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  z-index: 10;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.control-group label {
  font-weight: 600;
  color: #333;
  white-space: nowrap;
}

.control-group select {
  padding: 0.4rem 0.8rem;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
}

.relation-filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
  font-size: 14px;
}

.checkbox-label input[type="checkbox"] {
  cursor: pointer;
}

.search-input {
  padding: 0.4rem 0.8rem;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  min-width: 200px;
  font-size: 14px;
}

.search-btn,
.reset-btn {
  padding: 0.4rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.search-btn {
  background: #1677ff;
  color: white;
}

.search-btn:hover {
  background: #4096ff;
}

.reset-btn {
  background: #ff4d4f;
  color: white;
}

.reset-btn:hover {
  background: #ff7875;
}

.stats {
  margin-left: auto;
  display: flex;
  gap: 1rem;
  font-size: 14px;
  color: #666;
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

/* 移动端适配 */
@media (max-width: 768px) {
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

}
</style>

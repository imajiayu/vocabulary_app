<template>
  <div class="canvas-wrapper">
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
import { ref, watch, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import type { GraphData, GraphNode } from '@/shared/api'
import { relationColors } from './useRelationGraph'
import { palette, textColors } from '@/shared/config/chartColors'

interface ContextMenuData {
  type: 'node' | 'edge'
  x: number
  y: number
  data: GraphNode | { source: string; target: string; label: { formatter: string } }
}

interface Props {
  graphData: GraphData
  centerWordId: number | null
  searchWord: string
  loading: boolean
  error: string
}

interface Emits {
  (e: 'nodeClick', node: GraphNode): void
  (e: 'contextMenu', data: ContextMenuData): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const chartContainer = ref<HTMLDivElement>()
let chartInstance: echarts.ECharts | null = null

function renderGraph() {
  if (!chartContainer.value) return

  if (!chartInstance) {
    chartInstance = echarts.init(chartContainer.value)
  }

  // Empty state
  if (props.graphData.nodes.length === 0) {
    const emptyOption: echarts.EChartsOption = {
      title: {
        text: '请搜索单词或展示所有节点',
        left: 'center',
        top: 'center',
        textStyle: {
          fontSize: 18,
          color: textColors.muted,
          fontWeight: 'normal'
        }
      }
    }
    chartInstance.setOption(emptyOption, true)
    return
  }

  // Build nodes
  const nodes = props.graphData.nodes.map(node => {
    const isCenterNode = node.id === props.centerWordId
    const wordLength = node.word.length
    const width = Math.min(150, Math.max(40, wordLength * 8 + 20))
    const height = isCenterNode ? 35 : 25

    return {
      id: node.id.toString(),
      name: node.word,
      symbol: 'rect',
      symbolSize: [width, height],
      itemStyle: {
        color: isCenterNode ? palette.primary : palette.success,
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

  // Build links with curvature for parallel edges
  const edgeWithIds = props.graphData.edges.map((edge, idx) => ({
    ...edge,
    _id: idx
  }))

  const edgeGroups = new Map<string, typeof edgeWithIds>()
  edgeWithIds.forEach(edge => {
    const pairKey = [edge.source, edge.target].sort((a, b) => a - b).join('-')
    if (!edgeGroups.has(pairKey)) {
      edgeGroups.set(pairKey, [])
    }
    edgeGroups.get(pairKey)!.push(edge)
  })

  const links = edgeWithIds.map(edge => {
    const pairKey = [edge.source, edge.target].sort((a, b) => a - b).join('-')
    const edgesInGroup = edgeGroups.get(pairKey) || []
    const totalEdges = edgesInGroup.length
    const currentIndex = edgesInGroup.findIndex(e => e._id === edge._id)

    let curveness = 0
    if (totalEdges === 1) {
      curveness = 0
    } else if (totalEdges === 2) {
      curveness = currentIndex === 0 ? 0.25 : -0.25
    } else if (totalEdges === 3) {
      curveness = (currentIndex - 1) * 0.3
    } else if (totalEdges === 4) {
      const positions = [-0.3, -0.1, 0.1, 0.3]
      curveness = positions[currentIndex]
    } else {
      const step = 0.8 / (totalEdges - 1)
      curveness = -0.4 + currentIndex * step
    }

    return {
      source: edge.source.toString(),
      target: edge.target.toString(),
      lineStyle: {
        color: relationColors[edge.relation_type] || '#999',
        width: Math.max(1, edge.confidence * 3),
        curveness
      },
      label: {
        show: true,
        formatter: edge.relation_type,
        fontSize: 10,
        color: relationColors[edge.relation_type] || '#999'
      }
    }
  })

  const option: echarts.EChartsOption = {
    title: {
      text: props.centerWordId
        ? `${props.searchWord} 的关系网络`
        : '单词关系图',
      left: 'center',
      top: 10
    },
    tooltip: {
      trigger: 'item',
      confine: true,
      extraCssText: 'max-width: 400px; white-space: normal; word-wrap: break-word;',
      formatter: (params: unknown) => {
        const p = params as { dataType: string; data: { id?: string; name?: string; source?: string; target?: string; label?: { formatter: string } } }
        if (p.dataType === 'node') {
          const node = props.graphData.nodes.find(n => n.id.toString() === p.data.id)
          if (node) {
            const definitions = node.definition ? node.definition.split('; ').join('<br/>') : '暂无释义'
            return `<b>${node.word}</b><br/>${definitions}<br/><span style="color: #999; font-size: 12px;">点击查看关系</span>`
          }
          return `<b>${p.data.name}</b><br/>点击查看关系`
        } else if (p.dataType === 'edge') {
          const sourceNode = props.graphData.nodes.find(n => n.id.toString() === p.data.source)
          const targetNode = props.graphData.nodes.find(n => n.id.toString() === p.data.target)
          return `${sourceNode?.word} ⟷ ${targetNode?.word}<br/>关系: ${p.data.label?.formatter}`
        }
        return ''
      }
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        data: nodes,
        links,
        roam: true,
        draggable: true,
        force: {
          repulsion: props.centerWordId ? 500 : 300,
          edgeLength: props.centerWordId ? 150 : 100,
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

  // Node click handler
  chartInstance.off('click')
  chartInstance.on('click', (params: unknown) => {
    const p = params as { dataType: string; data: { id: string } }
    if (p.dataType === 'node') {
      const nodeId = parseInt(p.data.id)
      const node = props.graphData.nodes.find(n => n.id === nodeId)
      if (node) {
        emit('nodeClick', node)
      }
    }
  })

  // Context menu handler
  chartInstance.off('contextmenu')
  chartInstance.on('contextmenu', (params: unknown) => {
    const p = params as {
      dataType: string
      data: { id?: string; source?: string; target?: string; label?: { formatter: string } }
      event: { event: MouseEvent }
    }
    const originalEvent = p.event.event
    originalEvent.preventDefault()

    // Dispatch mouseup to end dragging
    const mouseUpEvent = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: originalEvent.clientX,
      clientY: originalEvent.clientY
    })
    originalEvent.target?.dispatchEvent(mouseUpEvent)

    if (p.dataType === 'edge') {
      emit('contextMenu', {
        type: 'edge',
        x: originalEvent.clientX,
        y: originalEvent.clientY,
        data: p.data as { source: string; target: string; label: { formatter: string } }
      })
    } else if (p.dataType === 'node') {
      const nodeId = parseInt(p.data.id!)
      const node = props.graphData.nodes.find(n => n.id === nodeId)
      if (node) {
        emit('contextMenu', {
          type: 'node',
          x: originalEvent.clientX,
          y: originalEvent.clientY,
          data: node
        })
      }
    }
  })
}

function handleResize() {
  chartInstance?.resize()
}

function resetChartState() {
  if (chartInstance) {
    chartInstance.dispatchAction({ type: 'downplay' })
    chartInstance.setOption({
      series: [{ type: 'graph', draggable: true }]
    })
  }
}

watch(
  () => [props.graphData, props.centerWordId, props.searchWord],
  () => {
    renderGraph()
  }
)

onMounted(() => {
  window.addEventListener('resize', handleResize)
  renderGraph()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
  chartInstance = null
})

defineExpose({
  resetChartState
})
</script>

<style scoped>
.canvas-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
}

.chart-container {
  flex: 1;
  background: white;
  margin: 1rem;
  border-radius: var(--radius-default);
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
  border: 4px solid var(--color-bg-tertiary);
  border-top: 4px solid var(--color-primary);
  border-radius: var(--radius-full);
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}

/* spin animation defined in animations.css */

.error-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--color-danger-light);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-xs);
  padding: 1rem 2rem;
  color: var(--color-danger);
  font-size: 14px;
  z-index: 101;
}
</style>

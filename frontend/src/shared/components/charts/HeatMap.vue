<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { logger } from '@/shared/utils/logger'
import { heatmapColors } from '@/shared/config/chartColors'

interface CellData {
  word: string
  value: number | null
  available?: boolean
  color?: string
  tooltip?: string
}

interface Props {
  cells: CellData[]
  gap?: number           // 小方块间隙（像素）
  valueToColor?: (v: number | null, available?: boolean) => string
  tooltipText?: (cell: CellData) => string
  precomputedColors?: boolean  // 是否使用预计算的颜色和tooltip
}

const props = defineProps<Props>()

const elRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
const isVisible = ref(false)

// 固定的方块尺寸配置
const DESKTOP_CELL_SIZE = 10   // 桌面端正方形边长
const MOBILE_CELL_WIDTH = 10   // 移动端长方形宽度
const MOBILE_CELL_HEIGHT = 5  // 移动端长方形高度
const DEFAULT_GAP = 1          // 默认间隙

// 检测是否为移动端
const isMobile = ref(false)
const cellWidth = ref(DESKTOP_CELL_SIZE)
const cellHeight = ref(DESKTOP_CELL_SIZE)
const gap = computed(() => props.gap ?? DEFAULT_GAP)

// 计算列数和行数
const columns = ref(20)
const rows = computed(() => Math.ceil((props.cells?.length || 0) / columns.value))

// 计算最佳列数
const calculateLayout = () => {
  if (!elRef.value) return

  const containerWidth = elRef.value.clientWidth || elRef.value.offsetWidth

  // 如果容器宽度为0，使用默认值
  if (containerWidth === 0) {
    columns.value = 20
    return
  }

  isMobile.value = containerWidth < 768

  if (isMobile.value) {
    // 移动端：2:1长方形
    cellWidth.value = MOBILE_CELL_WIDTH
    cellHeight.value = MOBILE_CELL_HEIGHT
  } else {
    // 桌面端：正方形
    cellWidth.value = DESKTOP_CELL_SIZE
    cellHeight.value = DESKTOP_CELL_SIZE
  }

  // 计算能放下的列数
  const availableWidth = containerWidth - 16 // 减去左右边距
  const cellWithGap = cellWidth.value + gap.value
  columns.value = Math.max(1, Math.floor((availableWidth + gap.value) / cellWithGap))
}

// 统一的高度计算函数
const calculateHeight = () => {
  const cellCount = props.cells?.length || 0
  if (cellCount === 0) return 100

  const numRows = rows.value
  const cellH = cellHeight.value
  const gapValue = gap.value

  // 内容高度：行数 × 方块高度 + 间隙
  const contentHeight = numRows * cellH + (numRows - 1) * gapValue
  // 总高度：内容 + 上下边距
  const totalHeight = contentHeight + 20

  // 最小高度限制
  const minHeightLimit = isMobile.value ? 60 : 80

  return Math.max(minHeightLimit, totalHeight)
}

const buildData = () => {
  const data: [number, number, number | null, string, boolean | undefined, string?, string?][] = []
  const numCols = columns.value
  const total = props.cells?.length || 0

  for (let i = 0; i < total; i++) {
    const cell = props.cells[i]
    const x = i % numCols
    const y = Math.floor(i / numCols)
    data.push([x, y, cell?.value ?? null, cell?.word ?? '', cell?.available, cell?.color, cell?.tooltip])
  }
  return data
}

const renderChart = () => {
  if (!elRef.value) return

  // 检查是否有数据
  if (!props.cells || props.cells.length === 0) {
    return
  }

  if (!chart) {
    // 初始化前确保容器有正确尺寸
    const targetHeight = calculateHeight()
    elRef.value.style.width = '100%'
    elRef.value.style.height = targetHeight + 'px'

    // 强制触发重排
    elRef.value.offsetHeight

    // 检查容器是否有有效尺寸，避免 ECharts 警告
    const containerWidth = elRef.value.clientWidth
    const containerHeight = elRef.value.clientHeight
    if (containerWidth === 0 || containerHeight === 0) {
      // 容器尚无尺寸，延迟重试
      setTimeout(() => renderChart(), 100)
      return
    }

    try {
      chart = echarts.init(elRef.value)
    } catch (error) {
      logger.warn('ECharts初始化失败，重试中...', error)
      setTimeout(() => renderChart(), 100)
      return
    }
  }

  const data = buildData()
  const numCols = columns.value
  const numRows = rows.value

  const option: echarts.EChartsOption = {
    animation: true,
    animationDuration: 600,
    animationEasing: 'cubicOut',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(50,50,50,0.9)',
      borderColor: 'rgba(50,50,50,0.9)',
      textStyle: { color: '#fff', fontSize: 12 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (paramsData: any) => {
        const [, , value, word, available, , tooltip] = paramsData.data as [number, number, number | null, string, boolean, string?, string?]

        if (props.precomputedColors && tooltip) {
          return tooltip
        } else if (props.tooltipText) {
          return props.tooltipText({ word, value, available })
        }
        return `${word}: ${value !== null ? value : '无数据'}`
      }
    },
    grid: {
      left: 8,
      right: 8,
      top: 8,
      bottom: 8,
      containLabel: false
    },
    xAxis: {
      type: 'category',
      data: Array.from({ length: numCols }, (_, i) => String(i)),
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { show: false },
      splitLine: { show: false },
      boundaryGap: false
    },
    yAxis: {
      type: 'category',
      data: Array.from({ length: numRows }, (_, i) => String(i)),
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { show: false },
      splitLine: { show: false },
      inverse: true,
      boundaryGap: false,
      min: 0,
      max: numRows - 1
    },
    series: [{
      type: 'custom',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      renderItem: (_: any, api: any) => {
        const xIdx = api.value(0)
        const yIdx = api.value(1)
        const val = api.value(2)
        const availRaw = api.value(4)
        const precomputedColor = api.value(5)

        // 计算每个单元格的精确位置
        const cellWithGap = cellWidth.value + gap.value
        const x = 8 + xIdx * cellWithGap // 左边距 + 位置偏移
        const y = 8 + yIdx * (cellHeight.value + gap.value) // 顶边距 + 位置偏移

        // 使用预计算的颜色或动态计算颜色
        let color: string
        if (props.precomputedColors && precomputedColor) {
          color = precomputedColor
        } else if (props.valueToColor) {
          const isAvail = typeof availRaw === 'boolean' ? availRaw : !!availRaw
          color = props.valueToColor(val, isAvail)
        } else {
          color = heatmapColors.spell.notAvailable
        }

        return {
          type: 'rect',
          shape: {
            x,
            y,
            width: cellWidth.value,
            height: cellHeight.value,
            r: Math.min(2, Math.min(cellWidth.value, cellHeight.value) * 0.1)
          },
          style: {
            fill: color,
            opacity: 1,
            stroke: 'rgba(255,255,255,0.3)',
            lineWidth: 0.5
          },
          styleEmphasis: {
            fill: color,
            opacity: 0.8,
            stroke: 'rgba(255,255,255,0.8)',
            lineWidth: 1,
            shadowBlur: 4,
            shadowColor: 'rgba(0,0,0,0.3)'
          }
        }
      },
      data,
      silent: false
    }]
  }

  // 最后应用setOption
  try {
    if (chart && !chart.isDisposed()) {
      chart.setOption(option, true)
    } else {
      logger.warn('ECharts实例不可用，重新初始化')
      chart = null
      setTimeout(() => renderChart(), 150)
    }
  } catch (error) {
    logger.warn('设置ECharts选项失败:', error, {
      chartExists: !!chart,
      containerWidth: elRef.value?.clientWidth,
      containerHeight: elRef.value?.clientHeight
    })
    // 尝试重新初始化
    chart?.dispose()
    chart = null
    setTimeout(() => renderChart(), 200)
  }
}

// 计算容器样式 - 只返回width，height通过手动设置
const containerStyle = computed(() => {
  return {
    width: '100%'
  } as Record<string, string>
})

// 统一的渲染入口函数
const doRender = async () => {
  if (!elRef.value) return
  if (!props.cells || props.cells.length === 0) return

  calculateLayout()
  const targetHeight = calculateHeight()
  elRef.value.style.height = targetHeight + 'px'

  await nextTick()

  if (chart) {
    try {
      chart.resize()
    } catch (error) {
      logger.warn('图表resize失败', error)
    }
  }
  renderChart()
}

onMounted(() => {
  if (!elRef.value) return

  // 立即标记为可见，允许渲染（即使不在视口内）
  isVisible.value = true

  // 首次渲染（如果有数据）
  doRender()

  // ResizeObserver
  ro = new ResizeObserver(() => {
    setTimeout(() => {
      doRender()
    }, 50)
  })

  ro.observe(elRef.value)

  // 延迟启动 IntersectionObserver，避免初始化时立即触发
  setTimeout(() => {
    if (!elRef.value) return

    // 设置Intersection Observer监控可见性（仅用于性能优化）
    io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isVisible.value = entry.isIntersecting
      })
    }, { threshold: 0.1 })

    io.observe(elRef.value)
  }, 1000)
})

onBeforeUnmount(() => {
  chart?.dispose()
  chart = null
  ro?.disconnect()
  ro = null
  io?.disconnect()
  io = null
})

// 监听数据变化，调用统一的渲染函数
watch(() => props.cells, () => {
  doRender()
})
</script>

<template>
  <div ref="elRef" class="echart heatmap" :style="containerStyle"></div>
</template>

<style scoped>
.echart.heatmap {
  width: 100%;
  /* 移除 flex: 1 避免高度被父容器干扰 */
}
</style>
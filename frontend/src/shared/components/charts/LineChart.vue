<script setup lang="ts">
import { watch, computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { init, type ECharts, type EChartsOption } from '@/shared/config/echarts'
import type { LineSeriesOption } from 'echarts/charts'
import { palette, borderColors } from '@/shared/config/chartColors'

interface LineSeries {
  name?: string
  labels: string[]
  values: (number | null)[]
  lineColor?: string
  areaColor?: string
}

interface Props {
  series?: LineSeries[]
}

const props = defineProps<Props>()

const elRef = ref<HTMLDivElement | null>(null)
let chart: ECharts | null = null
let ro: ResizeObserver | null = null

// 对齐 labels 和 values
const processedData = computed(() => {
  if (!props.series || props.series.length === 0) return { mergedLabels: [], processedSeries: [] }

  const allLabelsSet = new Set<string>()
  props.series.forEach(s => s.labels.forEach(l => allLabelsSet.add(l)))
  const mergedLabels = Array.from(allLabelsSet).sort()

  const processedSeries = props.series.map(s => {
    const alignedValues = mergedLabels.map(label => {
      const index = s.labels.indexOf(label)
      return index !== -1 ? s.values[index] : null
    })
    return { ...s, values: alignedValues }
  })

  return { mergedLabels, processedSeries }
})

const render = () => {
  if (!elRef.value) return
  if (!chart) chart = init(elRef.value)

  const { mergedLabels, processedSeries } = processedData.value
  const finalSeries: EChartsOption['series'] = []

  processedSeries.forEach(s => {
    finalSeries.push({
      type: 'line',
      name: s.name,
      data: s.values.map(v => v !== null ? Number(v) : null),
      smooth: true,
      showSymbol: true,
      connectNulls: true,
      lineStyle: { color: s.lineColor ?? palette.primary, width: 3 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: (s.areaColor ?? palette.primary) + '66' },
            { offset: 1, color: (s.areaColor ?? palette.primary) + '11' }
          ]
        }
      },
      symbol: 'circle',
      symbolSize: 6,
      emphasis: { symbolSize: 8, lineStyle: { width: 4 } }
    } as LineSeriesOption)
  })

  const option: EChartsOption = {
    animation: true,
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    grid: {
      left: '8%',
      right: '4%',
      top: finalSeries.length > 1 ? '15%' : '8%',
      bottom: '15%',
      containLabel: true
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(50,50,50,0.9)',
      borderColor: 'rgba(50,50,50,0.9)',
      textStyle: { color: '#fff' },
      axisPointer: { type: 'cross', lineStyle: { color: '#999' } },
      // 关键：添加 confine 属性，将 tooltip 限制在图表区域内
      confine: true,
      // 自定义 position 函数，实现智能定位
      position: function (point, _params, _dom, _rect, size) {
        // point: 鼠标位置 [x, y]
        // size: {contentSize: [width, height], viewSize: [width, height]}
        const [mouseX, mouseY] = point
        const tooltipWidth = size.contentSize[0]
        const tooltipHeight = size.contentSize[1]
        const viewWidth = size.viewSize[0]
        const viewHeight = size.viewSize[1]
        
        let x = mouseX + 10 // 默认在鼠标右侧
        let y = mouseY + 10 // 默认在鼠标下方
        
        // 如果右侧空间不够，则显示在左侧
        if (x + tooltipWidth > viewWidth) {
          x = mouseX - tooltipWidth - 10
        }
        
        // 如果下方空间不够，则显示在上方
        if (y + tooltipHeight > viewHeight) {
          y = mouseY - tooltipHeight - 10
        }
        
        // 确保不会超出左边界和上边界
        x = Math.max(10, x)
        y = Math.max(10, y)
        
        return [x, y]
      }
    },
    xAxis: {
      type: 'category',
      data: mergedLabels as any,
      axisLabel: { rotate: mergedLabels.length > 10 ? 45 : 0, fontSize: 11 },
      axisTick: { alignWithLabel: true }
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: { fontSize: 11 },
      splitLine: { lineStyle: { type: 'dashed', color: borderColors.light } }
    },
    legend: finalSeries.length > 1 ? {
      data: finalSeries.map(s => s.name).filter((n): n is string => !!n),
      top: '2%',
      textStyle: { fontSize: 11 }
    } : undefined,
    series: finalSeries
  }

  chart.setOption(option, true)
}

onMounted(() => {
  render()
  ro = new ResizeObserver(() => {
    if (chart) {
      chart.resize()
      render()
    }
  })
  if (elRef.value) ro.observe(elRef.value)
})

onBeforeUnmount(() => {
  chart?.dispose();
  chart = null;
  ro?.disconnect();
  ro = null
})

watch(() => props.series, render, { deep: true })
</script>

<template>
  <div ref="elRef" class="echart"></div>
</template>

<style scoped>
.echart {
  width: 100%;
  height: 100%;
  min-height: 180px;
  flex: 1;
  box-sizing: border-box;
}
</style>
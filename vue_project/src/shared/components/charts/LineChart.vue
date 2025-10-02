<script setup lang="ts">
import { watch, computed, onMounted, onBeforeUnmount, ref } from 'vue'
import * as echarts from 'echarts'

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
let chart: echarts.ECharts | null = null
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
  if (!chart) chart = echarts.init(elRef.value)

  const { mergedLabels, processedSeries } = processedData.value
  const finalSeries: echarts.EChartsOption['series'] = []

  processedSeries.forEach(s => {
    finalSeries.push({
      type: 'line',
      name: s.name,
      data: s.values.map(v => v !== null ? Number(v) : null),
      smooth: true,
      lineStyle: { color: s.lineColor ?? '#36cfc9', width: 3 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: (s.areaColor ?? '#36cfc9') + '66' },
            { offset: 1, color: (s.areaColor ?? '#36cfc9') + '11' }
          ]
        }
      },
      symbol: 'circle',
      symbolSize: 6,
      emphasis: { symbolSize: 8, lineStyle: { width: 4 } }
    } as echarts.LineSeriesOption)
  })

  const option: echarts.EChartsOption = {
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
      axisPointer: { type: 'cross', lineStyle: { color: '#999' } }
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
      splitLine: { lineStyle: { type: 'dashed', color: '#e0e0e0' } }
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

// 完全模仿BarChart的处理方式
onMounted(() => {
  render()
  ro = new ResizeObserver(() => {
    if (chart) {
      chart.resize()
      // 重新渲染以重新计算布局
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
  /* 确保图表容器能完全适应父元素 */
  box-sizing: border-box;
}
</style>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { init, type ECharts, type EChartsOption } from '@/shared/config/echarts'

interface Props {
  labels: (string | number)[]
  values: number[]
  barColor?: string
  axisLabel?: string
  transparent?: boolean
}

const props = defineProps<Props>()

const elRef = ref<HTMLDivElement | null>(null)
let chart: ECharts | null = null
let ro: ResizeObserver | null = null

const render = () => {
  if (!elRef.value) return
  if (!chart) chart = init(elRef.value)

  const color = props.barColor ?? 'rgba(75,192,192,0.8)'
  const option: EChartsOption = {
    // Enable animations
    animation: true,
    animationDuration: 800,
    animationEasing: 'cubicOut',
    // 调整网格边距，确保图表充分利用空间
    grid: {
      left: '8%',
      right: '4%',
      top: '8%',
      bottom: '15%',
      containLabel: true
    },
    tooltip: { 
      trigger: 'axis',
      backgroundColor: 'rgba(50,50,50,0.9)',
      borderColor: 'rgba(50,50,50,0.9)',
      textStyle: { color: '#fff' }
    },
    xAxis: {
      type: 'category',
      data: props.labels as any,
      name: props.axisLabel,
      axisTick: { alignWithLabel: true },
      axisLabel: { 
        rotate: props.labels.length > 8 ? 45 : 0,
        fontSize: 11
      }
    },
    yAxis: { 
      type: 'value', 
      min: 0,
      axisLabel: { fontSize: 11 }
    },
    series: [{
      type: 'bar',
      data: props.values,
      itemStyle: { 
        color, 
        opacity: props.transparent ? 0.7 : 1,
        borderRadius: [4, 4, 0, 0]
      },
      emphasis: { 
        itemStyle: { 
          opacity: 0.9,
          shadowBlur: 10,
          shadowColor: 'rgba(0,0,0,0.3)'
        } 
      },
      barMaxWidth: Math.min(60, Math.max(20, 400 / props.labels.length))
    }]
  }

  chart.setOption(option, true)
}

onMounted(() => {
  render()
  ro = new ResizeObserver(() => {
    if (chart) {
      chart.resize()
      // 重新渲染以调整柱子宽度
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

watch(() => [props.labels, props.values, props.barColor], () => {
  render()
}, { deep: true })
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
}
</style>
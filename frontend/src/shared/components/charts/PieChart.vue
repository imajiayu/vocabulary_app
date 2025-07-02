<script setup lang="ts">
import { watch, onMounted, onBeforeUnmount, ref } from 'vue'
import * as echarts from 'echarts'

interface Props {
  labels: string[]
  values: number[]
  colors?: string[]
}

const props = defineProps<Props>()

const elRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let ro: ResizeObserver | null = null

const render = () => {
  if (!elRef.value) return

  // 动态计算饼图大小和位置
  const containerRect = elRef.value.getBoundingClientRect()
  const isWide = containerRect.width > containerRect.height * 1.3
  const isTall = containerRect.height > containerRect.width * 1.3

  let center: [string, string], radius: [string, string], legendTop: string

  if (isTall) {
    center = ['50%', '60%']
    radius = ['35%', '55%']
    legendTop = '8%'
  } else if (isWide) {
    center = ['65%', '50%']
    radius = ['30%', '50%']
    legendTop = 'center'
  } else {
    center = ['50%', '55%']
    radius = ['40%', '65%']
    legendTop = '8%'
  }

  const option: echarts.EChartsOption = {
    // Enable animations
    animation: true,
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)',
      backgroundColor: 'rgba(50,50,50,0.9)',
      borderColor: 'rgba(50,50,50,0.9)',
      textStyle: { color: '#fff' }
    },
    legend: {
      top: legendTop,
      left: isWide ? '5%' : 'center',
      orient: isWide ? 'vertical' : 'horizontal',
      textStyle: { fontSize: 11 },
      itemWidth: 12,
      itemHeight: 8,
      itemGap: isWide ? 12 : 8
    },
    series: [{
      name: '统计',
      type: 'pie',
      center: center,
      radius: radius,
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 2,
        shadowBlur: 5,
        shadowColor: 'rgba(0,0,0,0.1)'
      },
      label: {
        show: false,
        position: 'outside',
        fontSize: 10
      },
      labelLine: { show: false },
      emphasis: {
        label: {
          show: true,
          fontSize: 12,
          fontWeight: 'bold'
        },
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.3)'
        }
      },
      data: props.labels.map((l, i) => ({
        value: props.values[i] ?? 0,
        name: l,
        itemStyle: props.colors?.[i] ? { color: props.colors[i] } : undefined
      }))
    }]
  }

  if (!chart) chart = echarts.init(elRef.value)
  chart.setOption(option, true)
}

onMounted(() => {
  render()
  ro = new ResizeObserver(() => {
    if (chart) {
      chart.resize()
      // 重新渲染以重新计算布局
      setTimeout(render, 100)
    }
  })
  if (elRef.value) ro.observe(elRef.value)
})

onBeforeUnmount(() => {
  chart?.dispose()
  chart = null
  ro?.disconnect()
  ro = null
})

watch(() => [props.labels, props.values, props.colors], render)
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
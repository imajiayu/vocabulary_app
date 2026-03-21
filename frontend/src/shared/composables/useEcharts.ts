import { ref, onMounted, onBeforeUnmount } from 'vue'
import { init, type ECharts } from '@/shared/config/echarts'

/**
 * ECharts 生命周期管理 — init / resize / dispose
 *
 * @param onResize 容器尺寸变化时的额外回调（resize 之后调用）
 */
export function useEcharts(onResize?: () => void) {
  const elRef = ref<HTMLDivElement | null>(null)
  let chart: ECharts | null = null
  let ro: ResizeObserver | null = null

  function ensureChart(): ECharts | null {
    if (!elRef.value) return null
    if (!chart) chart = init(elRef.value)
    return chart
  }

  onMounted(() => {
    ro = new ResizeObserver(() => {
      if (!chart) return
      chart.resize()
      onResize?.()
    })
    if (elRef.value) ro.observe(elRef.value)
  })

  onBeforeUnmount(() => {
    chart?.dispose()
    chart = null
    ro?.disconnect()
    ro = null
  })

  return { elRef, ensureChart }
}

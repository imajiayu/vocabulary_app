<template>
  <PageLayout
    with-topbar
    show-top-bar
    show-home-button
    show-management-button
    max-width="100%"
    content-class="statistics-content"
  >
    <template #topbar-center>
      <span class="title">统计</span>
    </template>
    <template #topbar-right>
      <SwitchTab
        v-model="currentSource"
        :tabs="sourceTabs"
        container-class="primary-theme"
        :show-indicator="true"
        @change="handleSourceChange"
      />
    </template>

    <Loading v-if="isLoading" text="加载中..." />
    <ChartGrid v-else>
      <ChartCard
        v-for="(chart, idx) in CHART_DEFINITIONS"
        :key="chart.id"
        :chart="chart"
        :index="idx"
      >
        <template v-if="chart.id === 'review-count'">
          <BarChart
            :labels="Object.keys(reviewCountDict)"
            :values="Object.values(reviewCountDict)"
            :bar-color="palette.yellow"
            :transparent="true"
          />
        </template>
        <template v-else-if="chart.id === 'spell-strength'">
          <LineChart :series="spellingPintSeries" />
        </template>
        <template v-else-if="chart.id === 'ef-histogram'">
          <BarChart
            :labels="efBuckets.labels"
            :values="efBuckets.values"
            :bar-color="palette.teal"
            :transparent="true"
          />
        </template>
        <template v-else-if="chart.id === 'reaction-time'">
          <BarChart
            :labels="elapseTimeBar.labels"
            :values="elapseTimeBar.values"
            :bar-color="palette.orange"
            :transparent="true"
          />
        </template>
        <template v-else-if="chart.id === 'added-review-trend'">
          <LineChart :series="addedReviewSeries" />
        </template>
        <template v-else-if="chart.id === 'ef-pie'">
          <PieChart
            :labels="efPie.labels"
            :values="efPie.values"
            :colors="[palette.orange, palette.green, palette.blue]"
          />
        </template>
        <template v-else-if="chart.id === 'interval-distribution'">
          <BarChart
            :labels="intervalBuckets.labels"
            :values="intervalBuckets.values"
            :bar-color="palette.blue"
            :transparent="true"
          />
        </template>
        <template v-else-if="chart.id === 'accuracy-analysis'">
          <BarChart
            :labels="accuracyBar.labels"
            :values="accuracyBar.values"
            :bar-color="palette.green"
            :transparent="true"
          />
        </template>
        <template v-else-if="chart.id === 'daily-activity'">
          <LineChart :series="dailyActivitySeries" />
        </template>
        <template v-else-if="chart.id === 'daily-accuracy'">
          <LineChart :series="dailyAccuracySeries" />
        </template>
        <template v-else-if="chart.id === 'study-heatmap'">
          <BarChart
            :labels="hourlyBar.labels"
            :values="hourlyBar.values"
            :bar-color="palette.purple"
            :transparent="true"
          />
        </template>

        <template v-if="chart.id === 'ef-pie'" #title-extra>
          <button @click="openEFSettings" class="settings-btn" title="配置区间">
            <BaseIcon name="Settings" size="xs" />
          </button>
        </template>
      </ChartCard>
    </ChartGrid>

    <!-- 热力图单独放在 ChartGrid 外面，避免 grid-column 影响其他图表的布局 -->
    <section
      v-if="!isLoading"
      class="chart-card heatmap-card"
      :style="{ '--accent': heatmapColors.spell.hasStrength, '--stagger': `${CHART_DEFINITIONS.length * 60}ms` }"
    >
      <h2 class="chart-title">
        单词拼写热力图
        <span class="legend">
          <span class="legend-item">
            <span class="spell-cell" :style="{ background: heatmapColors.spell.hasStrength }"></span>拼写强度 ({{ spellLegendCounts.hasStrength }})
          </span>
          <span class="legend-item">
            <span class="spell-cell" :style="{ background: heatmapColors.spell.notSpelled }"></span>未拼写过 ({{ spellLegendCounts.notSpelled }})
          </span>
          <span class="legend-item">
            <span class="spell-cell" :style="{ background: heatmapColors.spell.notAvailable }"></span>不可拼写 ({{ spellLegendCounts.notAvailable }})
          </span>
        </span>
      </h2>
      <HeatMap :cells="spellHeatmapCells" :precomputed-colors="true" :gap="0.1" />
    </section>

    <section
      v-if="!isLoading"
      class="chart-card heatmap-card"
      :style="{ '--accent': heatmapColors.ef.difficult, '--stagger': `${(CHART_DEFINITIONS.length + 1) * 60}ms` }"
    >
      <h2 class="chart-title">
        单词EF热力图
        <span class="legend">
          <span class="legend-item">
            <span class="spell-cell" :style="{ background: heatmapColors.ef.mastered }"></span>熟练单词 ({{ efLegendCounts.mastered }})
          </span>
          <span class="legend-item">
            <span class="spell-cell" :style="{ background: heatmapColors.ef.difficult }"></span>困难单词 ({{ efLegendCounts.difficult }})
          </span>
        </span>
      </h2>
      <HeatMap :cells="efHeatmapCells" :precomputed-colors="true" :gap="0.1"/>
    </section>

    <!-- EF Range Settings Modal -->
    <Teleport to="body">
      <div v-if="showEFSettings" class="modal-overlay" @click.self="cancelEFSettings">
        <div class="modal-content">
          <div class="modal-header">
            <h3>EF 区间配置</h3>
            <button @click="cancelEFSettings" class="close-btn"><AppIcon name="cross" /></button>
          </div>
          <div class="modal-body">
            <div class="setting-row">
              <label>低 EF 上限（不含）:</label>
              <input
                type="number"
                step="0.1"
                min="1.3"
                :max="tempEFRangeConfig.mediumMax"
                v-model.number="tempEFRangeConfig.lowMax"
                class="number-input"
                :class="{ 'input-error': tempEFRangeConfig.lowMax > tempEFRangeConfig.mediumMax }"
              />
            </div>
            <div class="setting-row">
              <label>中 EF 上限（不含）:</label>
              <input
                type="number"
                step="0.1"
                :min="tempEFRangeConfig.lowMax"
                max="3.0"
                v-model.number="tempEFRangeConfig.mediumMax"
                class="number-input"
                :class="{ 'input-error': tempEFRangeConfig.lowMax > tempEFRangeConfig.mediumMax }"
              />
            </div>
            <div v-if="tempEFRangeConfig.lowMax > tempEFRangeConfig.mediumMax" class="error-message">
              <BaseIcon name="AlertTriangle" size="xs" color="warning" /> 低 EF 上限必须小于等于中 EF 上限
            </div>
            <div class="preview">
              <p>预览:</p>
              <ul v-if="tempEFRangeConfig.lowMax === tempEFRangeConfig.mediumMax">
                <li>低 EF: &lt;{{ tempEFRangeConfig.lowMax }}</li>
                <li>中 EF: ={{ tempEFRangeConfig.lowMax }}</li>
                <li>高 EF: &gt;{{ tempEFRangeConfig.lowMax }}</li>
              </ul>
              <ul v-else>
                <li>低 EF: &lt;{{ tempEFRangeConfig.lowMax }}</li>
                <li>中 EF: [{{ tempEFRangeConfig.lowMax }}, {{ tempEFRangeConfig.mediumMax }})</li>
                <li>高 EF: ≥{{ tempEFRangeConfig.mediumMax }}</li>
              </ul>
            </div>
          </div>
          <div class="modal-footer">
            <button @click="resetEFRange" class="reset-btn">重置默认</button>
            <button
              @click="confirmEFSettings"
              class="confirm-btn"
              :disabled="tempEFRangeConfig.lowMax > tempEFRangeConfig.mediumMax"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </PageLayout>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, triggerRef, computed, watch, Teleport } from 'vue'
import { useBreakpoint } from '@/shared/composables/useBreakpoint'
import PageLayout from '@/shared/components/layout/PageLayout.vue'
import ChartGrid from '@/features/statistics/components/ChartGrid.vue'
import ChartCard from '@/features/statistics/components/ChartCard.vue'
import BarChart from '@/shared/components/charts/BarChart.vue'
import PieChart from '@/shared/components/charts/PieChart.vue'
import LineChart from '@/shared/components/charts/LineChart.vue'
import HeatMap from '@/shared/components/charts/HeatMap.vue'
import Loading from '@/shared/components/feedback/Loading.vue'
import SwitchTab from '@/shared/components/controls/SwitchTab.vue'
import { BaseIcon } from '@/shared/components/base'
import AppIcon from '@/shared/components/controls/Icons.vue'
import { api } from '@/shared/api'
import { useSourceSelectionReadOnly } from '@/shared/composables/useSourceSelection'
import { palette, heatmapColors } from '@/shared/config/chartColors'
import { CHART_DEFINITIONS } from '@/features/statistics/constants'

type EfItem = { word: string; ef: number }
type StrengthItem = { word: string; strength: number | null; available: boolean }

interface EFRangeConfig {
  lowMax: number      // 低EF上限（不含），默认 2.3
  mediumMax: number   // 中EF上限（不含），默认 2.5
}

const isLoading = ref(true)
const error = ref<string | null>(null)

// EF Range Configuration with localStorage persistence
const defaultEFRange: EFRangeConfig = { lowMax: 2.3, mediumMax: 2.5 }
const efRangeConfig = ref<EFRangeConfig>(
  JSON.parse(localStorage.getItem('efRangeConfig') || JSON.stringify(defaultEFRange))
)

// Settings modal state
const showEFSettings = ref(false)

// Temporary config for editing (only applied on confirm)
const tempEFRangeConfig = ref<EFRangeConfig>({ ...efRangeConfig.value })

// Use read-only source selection for initial sync from WordIndex
const { currentSource: initialSource, availableSources, initializeFromData } = useSourceSelectionReadOnly()

// Local source state for StatisticsPage - can be changed but doesn't affect WordIndex
const currentSource = ref<string>('')

const sourceTabs = computed(() => {
  return availableSources.value.map(source => ({
    value: source,
    label: source,
    icon: ''
  }))
})

// Store data for both sources
const statsData = shallowRef<Record<string, {
  efDict: EfItem[]
  nextReviewDict: Record<string, number>
  spellNextReviewDict: Record<string, number>
  elapseTimeDict: Record<string, number>
  spellStrengthDict: StrengthItem[]
  addedDateCountDict: Record<string, number>
  reviewCountDict: Record<number, number>
  spellHeatmapCells: Array<{word: string, value: number | null, available: boolean, color: string, tooltip: string}>
  efHeatmapCells: Array<{word: string, value: number | null, available: boolean, color: string, tooltip: string}>
  intervalDict: Record<number, number>
  accuracyDict: Record<string, number>
  dailyActivity: Array<{ date: string; review_count: number; spelling_count: number; correct: number; total: number }>
  hourlyDistribution: Record<number, number>
}>>({})

// 空数组常量，避免每次computed都创建新引用
const EMPTY_ARRAY: readonly never[] = []

// Current data refs (computed from statsData)
const efDict = computed(() => statsData.value[currentSource.value]?.efDict || EMPTY_ARRAY)
const nextReviewDict = computed(() => statsData.value[currentSource.value]?.nextReviewDict || {})
const spellNextReviewDict = computed(() => statsData.value[currentSource.value]?.spellNextReviewDict || {})
const elapseTimeDict = computed(() => statsData.value[currentSource.value]?.elapseTimeDict || {})
const spellStrengthDict = computed(() => statsData.value[currentSource.value]?.spellStrengthDict || EMPTY_ARRAY)
const addedDateCountDict = computed(() => statsData.value[currentSource.value]?.addedDateCountDict || {})
const reviewCountDict = computed(() => statsData.value[currentSource.value]?.reviewCountDict || {})
const spellHeatmapCells = computed(() => statsData.value[currentSource.value]?.spellHeatmapCells || EMPTY_ARRAY)
const efHeatmapCells = computed(() => statsData.value[currentSource.value]?.efHeatmapCells || EMPTY_ARRAY)
const intervalDict = computed(() => statsData.value[currentSource.value]?.intervalDict || {})
const accuracyDict = computed(() => statsData.value[currentSource.value]?.accuracyDict || {})
const dailyActivity = computed(() => statsData.value[currentSource.value]?.dailyActivity || EMPTY_ARRAY)
const hourlyDistribution = computed(() => statsData.value[currentSource.value]?.hourlyDistribution || {})

const fetchStats = async (source: string) => {
  try {
    const data = await api.stats.getStats({ source })
    // Mutate in place + triggerRef — avoids creating a new top-level object
    // and re-allocating the entire record on each source fetch
    statsData.value[source] = {
      efDict: data.ef_dict,
      nextReviewDict: data.next_review_dict,
      spellNextReviewDict: data.spell_next_review_dict,
      elapseTimeDict: data.elapse_time_dict,
      spellStrengthDict: data.spell_strength_dict,
      addedDateCountDict: data.added_date_count_dict,
      reviewCountDict: data.review_count_dict,
      spellHeatmapCells: data.spell_heatmap_cells || [],
      efHeatmapCells: data.ef_heatmap_cells || [],
      intervalDict: data.interval_dict,
      accuracyDict: data.accuracy_dict,
      dailyActivity: data.daily_activity,
      hourlyDistribution: data.hourly_distribution,
    }
    triggerRef(statsData)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e)
    throw e
  }
}

const preloadAllStats = async () => {
  try {
    isLoading.value = true
    // Dynamically fetch stats for all available sources
    await Promise.all(
      availableSources.value.map(source => fetchStats(source))
    )
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    isLoading.value = false
  }
}

// Handle source change - only changes local display, doesn't affect WordIndex
const handleSourceChange = (newSource: string) => {
  currentSource.value = newSource
}

// 桌面端隐藏页面滚动条
const { isDesktop } = useBreakpoint()
onMounted(async () => {
  if (isDesktop.value) document.documentElement.classList.add('hide-scrollbar')
  try {
    // Initialize source from Supabase settings to sync with WordIndex
    await initializeFromData()

    // Set local source to match WordIndex selection, or use first available source as fallback
    if (initialSource.value) {
      currentSource.value = initialSource.value
    } else if (availableSources.value.length > 0) {
      currentSource.value = availableSources.value[0]
    }

    // Then preload stats data for both sources
    await preloadAllStats()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

onUnmounted(() => {
  document.documentElement.classList.remove('hide-scrollbar')
})

// EF histogram buckets (0.1 rounding)
const efBuckets = computed(() => {
  const buckets: Record<string, number> = {}
  efDict.value.forEach(({ ef }) => {
    const rounded = Math.round(ef * 10) / 10
    buckets[String(rounded)] = (buckets[String(rounded)] || 0) + 1
  })
  const labels = Object.keys(buckets).sort((a, b) => Number(a) - Number(b))
  const values = labels.map(l => buckets[l])
  return { labels, values }
})

// EF pie (low, medium, high) - uses dynamic configuration
const efPie = computed(() => {
  let low = 0, medium = 0, high = 0
  const { lowMax, mediumMax } = efRangeConfig.value

  // Check if it's single-value mode (lowMax == mediumMax)
  const isSingleValueMode = lowMax === mediumMax

  efDict.value.forEach(({ ef }) => {
    if (ef < lowMax) {
      low++
    } else if (isSingleValueMode) {
      // Single value mode: separate exact match from higher values
      if (ef === lowMax) medium++
      else high++
    } else {
      // Range mode: [lowMax, mediumMax)
      if (ef >= lowMax && ef < mediumMax) medium++
      else high++
    }
  })

  // Generate labels based on mode
  const labels = isSingleValueMode
    ? [`低EF <${lowMax}`, `中EF =${lowMax}`, `高EF >${lowMax}`]
    : [`低EF <${lowMax}`, `中EF [${lowMax},${mediumMax})`, `高EF ≥${mediumMax}`]

  return {
    labels,
    values: [low, medium, high]
  }
})

// Elapse time histogram (1..10 seconds buckets)
const elapseTimeBar = computed(() => {
  const buckets = Array.from({ length: 10 }, () => 0)
  Object.entries(elapseTimeDict.value).forEach(([sec, count]) => {
    const i = Number(sec) - 1
    if (i >= 0 && i < 10) buckets[i] = count as number
  })
  const labels = Array.from({ length: 10 }, (_, i) => `${i + 1}秒`)
  return { labels, values: buckets }
})

// Spell strength cumulative distribution (均匀分桶 0.0-5.0，间隔 0.1)
const spellBuckets = computed(() => {
  // 创建固定的桶：0.0, 0.1, 0.2, ..., 5.0
  const bucketSize = 0.1
  const maxStrength = 5.0
  const numBuckets = Math.round(maxStrength / bucketSize) + 1
  const buckets = Array(numBuckets).fill(0)
  const labels = Array.from({ length: numBuckets }, (_, i) => (i * bucketSize).toFixed(1))

  // 把数据分配到对应的桶
  spellStrengthDict.value.forEach(({ strength, available }) => {
    if (!available) return  // 不计算不可拼写的
    if (strength === null || strength === undefined) return

    const s = Number(strength)
    if (s < 0 || s > maxStrength) return

    // 计算应该放入哪个桶（向下取整）
    const bucketIndex = Math.min(Math.floor(s / bucketSize), numBuckets - 1)
    buckets[bucketIndex]++
  })

  // 计算累积值
  const cumulativeValues: number[] = []
  buckets.reduce((sum, v) => {
    const newSum = sum + v
    cumulativeValues.push(newSum)
    return newSum
  }, 0)

  return { keys: labels, values: cumulativeValues }
})

const addedReviewSeries = computed(() => [
  {
    name: '新增单词数',
    labels: Object.keys(addedDateCountDict.value),
    values: Object.values(addedDateCountDict.value),
    lineColor: palette.purple,
    areaColor: palette.purple
  },
  {
    name: '复习单词数',
    labels: Object.keys(nextReviewDict.value),
    values: Object.values(nextReviewDict.value),
    lineColor: palette.blue,
    areaColor: palette.blue
  },
  {
    name: '拼写复习数',
    labels: Object.keys(spellNextReviewDict.value),
    values: Object.values(spellNextReviewDict.value),
    lineColor: palette.orange,
    areaColor: palette.orange
  }
])

const spellingPintSeries = computed(() => [{
  name: '单词数量',
  labels: spellBuckets.value.keys,
  values: spellBuckets.value.values,
  lineColor: palette.green,
  areaColor: palette.green
}])

// Interval distribution — aggregate into 6 buckets (Layer 1)
const intervalBuckets = computed(() => {
  const buckets = [0, 0, 0, 0, 0, 0]
  const labels = ['1天', '2-3天', '4-7天', '8-14天', '15-30天', '31+天']
  for (const [key, count] of Object.entries(intervalDict.value)) {
    const d = Number(key)
    if (d <= 1) buckets[0] += count
    else if (d <= 3) buckets[1] += count
    else if (d <= 7) buckets[2] += count
    else if (d <= 14) buckets[3] += count
    else if (d <= 30) buckets[4] += count
    else buckets[5] += count
  }
  return { labels, values: buckets }
})

// Accuracy analysis — pre-bucketed by stats.ts (Layer 1)
const accuracyBar = computed(() => {
  const orderedKeys = ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%']
  const dict = accuracyDict.value
  return {
    labels: orderedKeys,
    values: orderedKeys.map(k => dict[k] || 0),
  }
})

// Daily activity series — 2 lines (review & spelling) (Layer 2)
const dailyActivitySeries = computed(() => {
  const data = dailyActivity.value as Array<{ date: string; review_count: number; spelling_count: number }>
  return [
    {
      name: '复习',
      labels: data.map(d => d.date),
      values: data.map(d => d.review_count),
      lineColor: palette.blue,
      areaColor: palette.blue,
    },
    {
      name: '拼写',
      labels: data.map(d => d.date),
      values: data.map(d => d.spelling_count),
      lineColor: palette.orange,
      areaColor: palette.orange,
    },
  ]
})

// Daily accuracy series — 1 line (correct/total * 100) (Layer 2)
const dailyAccuracySeries = computed(() => {
  const data = dailyActivity.value as Array<{ date: string; correct: number; total: number }>
  return [{
    name: '正确率',
    labels: data.map(d => d.date),
    values: data.map(d => d.total > 0 ? Math.round(d.correct / d.total * 100) : 0),
    lineColor: palette.green,
    areaColor: palette.green,
  }]
})

// Hourly distribution — 0-23h bar chart (Layer 2)
const hourlyBar = computed(() => {
  const dist = hourlyDistribution.value
  const labels = Array.from({ length: 24 }, (_, i) => `${i}时`)
  const values = Array.from({ length: 24 }, (_, i) => (dist as Record<number, number>)[i] || 0)
  return { labels, values }
})

// 拼写热力图图例计数
const spellLegendCounts = computed(() => {
  let hasStrength = 0
  let notSpelled = 0
  let notAvailable = 0

  spellHeatmapCells.value.forEach(cell => {
    if (!cell.available) {
      notAvailable++
    } else if (cell.value === null) {
      notSpelled++
    } else {
      hasStrength++
    }
  })

  return { hasStrength, notSpelled, notAvailable }
})

// EF热力图图例计数
const efLegendCounts = computed(() => {
  let mastered = 0  // EF == 3.0 的单词
  let difficult = 0  // EF < 3.0 的单词

  efHeatmapCells.value.forEach(cell => {
    if (cell.value === null) return

    if (cell.value === 3.0) {
      mastered++
    } else {
      difficult++
    }
  })

  return { mastered, difficult }
})

// Watch for configuration changes and save to localStorage
watch(efRangeConfig, (newVal) => {
  localStorage.setItem('efRangeConfig', JSON.stringify(newVal))
})

// Open settings modal - initialize temp config
const openEFSettings = () => {
  tempEFRangeConfig.value = { ...efRangeConfig.value }
  showEFSettings.value = true
}

// Confirm settings - apply temp config to actual config
const confirmEFSettings = () => {
  efRangeConfig.value = { ...tempEFRangeConfig.value }
  showEFSettings.value = false
}

// Cancel settings - discard temp config
const cancelEFSettings = () => {
  showEFSettings.value = false
}

// Reset EF range to default (in temp config)
const resetEFRange = () => {
  tempEFRangeConfig.value = { ...defaultEFRange }
}

</script>

<style scoped>
/* 修复 Loading 组件在有 TopBar 时导致的滚动条问题 */
:deep(.min-h-screen) {
  min-height: calc(100vh - 48px);
}

/* 热力图卡片 - 放在 ChartGrid 外面，全宽显示 */
.chart-card {
  background: var(--color-surface-card);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border-light);
  border-left: 3px solid var(--accent, var(--color-brand-primary));
  padding: var(--space-5);
  padding-left: calc(var(--space-5) + 3px);
  display: flex;
  flex-direction: column;
  overflow: visible;

  /* Staggered entrance — same as ChartCard */
  animation: cardReveal 0.5s cubic-bezier(0.25, 1, 0.5, 1) both;
  animation-delay: var(--stagger, 0ms);
}

@keyframes cardReveal {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.chart-card:hover {
  box-shadow: var(--shadow-md);
}

.heatmap-card {
  width: 100%;
}

.chart-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-family: var(--font-serif);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-3);
  color: var(--color-text-primary);
  flex-wrap: wrap;
  letter-spacing: -0.01em;
}

.legend {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-family: var(--font-ui);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.legend .spell-cell {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-xs);
  display: inline-block;
}

/* 响应式优化 */
@media (max-width: 768px) {
  .chart-card {
    padding: var(--space-4);
  }

  .chart-title {
    font-size: var(--font-size-sm);
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .legend {
    gap: var(--space-2);
  }

  .legend-item {
    font-size: 10px;
  }
}

/* Settings button */
.settings-btn {
  background: none;
  border: none;
  font-size: 1.2em;
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  line-height: 1;
  color: var(--color-text-tertiary);
}

.settings-btn:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-brand-primary);
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 32, 44, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-surface-card);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 450px;
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.04),
    0 20px 50px -10px rgba(26, 32, 44, 0.18);
  border: 1px solid var(--color-border-light);
  animation: modalFadeIn 0.25s cubic-bezier(0.34, 1.2, 0.64, 1);
  overflow: hidden;
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-border-light);
}

.modal-header h3 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-tertiary);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-default);
  transition: all var(--transition-fast);
}

.close-btn .icon {
  width: 16px;
  height: 16px;
}

.close-btn:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.modal-body {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.setting-row label {
  font-family: var(--font-ui);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

.number-input {
  width: 100px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-default);
  font-family: var(--font-data);
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
  background: var(--color-surface-card);
}

.number-input:focus {
  outline: none;
  border-color: var(--color-brand-primary);
  box-shadow: 0 0 0 3px rgba(153, 107, 61, 0.12);
}

.number-input.input-error {
  border-color: var(--color-state-error);
}

.number-input.input-error:focus {
  border-color: var(--color-state-error);
  box-shadow: 0 0 0 3px rgba(155, 59, 59, 0.12);
}

.error-message {
  background: var(--alert-error-bg);
  border: 1px solid var(--primitive-brick-200);
  color: var(--color-state-error);
  padding: var(--space-3);
  border-radius: var(--radius-default);
  font-family: var(--font-ui);
  font-size: var(--font-size-sm);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.preview {
  background: var(--color-bg-secondary);
  padding: var(--space-4);
  border-radius: var(--radius-default);
  border: 1px solid var(--color-border-light);
}

.preview p {
  margin: 0 0 var(--space-2) 0;
  font-family: var(--font-ui);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.preview ul {
  margin: 0;
  padding-left: 1.5em;
  list-style: disc;
}

.preview li {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: var(--space-1) 0;
}

.modal-footer {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border-light);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

.reset-btn, .confirm-btn {
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-sm);
  font-family: var(--font-ui);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: none;
}

.reset-btn {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

.reset-btn:hover {
  background: var(--control-bg-hover);
  color: var(--color-text-primary);
}

.confirm-btn {
  background: var(--color-brand-primary);
  color: var(--color-text-inverse);
}

.confirm-btn:hover {
  background: var(--color-brand-primary-hover);
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.confirm-btn:disabled:hover {
  background: var(--color-brand-primary);
}
</style>

<!-- 非 scoped 样式，用于覆盖 PageLayout 的 gap -->
<style>
.statistics-content {
  gap: var(--space-5) !important;
}
</style>

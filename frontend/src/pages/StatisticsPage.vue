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
    <ChartGrid v-else :min-width="280" :gap="20">
        <section class="chart-card ultra" data-width="tall">
          <h2>复习次数分布</h2>
          <BarChart :labels="Object.keys(reviewCountDict)" :values="Object.values(reviewCountDict)"
            :bar-color="palette.yellow" :transparent="true" />
        </section>

        <!-- 宽图表 - 双线图 -->
        <section class="chart-card landscape" data-width="tall">
          <h2>拼写强度累积分布图</h2>
          <LineChart :series="spellingPintSeries" />
        </section>

        <!-- 正方形图表 - EF 分布柱状图 -->
        <section class="chart-card ultra" data-width="wide">
          <h2>EF 分布柱状图</h2>
          <BarChart :labels="efBuckets.labels" :values="efBuckets.values" :bar-color="palette.teal"
            :transparent="true" />
        </section>

        <!-- 长方形图表 - 竖向 -->
        <section class="chart-card portrait" data-height="tall">
          <h2>反应时间分布图</h2>
          <BarChart :labels="elapseTimeBar.labels" :values="elapseTimeBar.values" :bar-color="palette.orange"
            :transparent="true" />
        </section>

        <!-- 超宽图表 - 累积分布 -->
        <section class="chart-card ultra-wide" data-width="extra-wide">
          <h2>新增与复习趋势</h2>
          <LineChart :series="addedReviewSeries" />
        </section>

        <!-- 大图表 - 占用2x2空间 -->
        <section class="chart-card" data-size="large">
          <h2 class="chart-title">
            EF 阶段占比
            <button @click="openEFSettings" class="settings-btn" title="配置区间">
              ⚙️
            </button>
          </h2>
          <PieChart :labels="efPie.labels" :values="efPie.values"
            :colors="[palette.orange, palette.green, palette.blue]" />
        </section>

        <!-- 热力图 - 单词拼写热力图 -->
        <section class="chart-card" data-width="full">
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
          <HeatMap :key="`spell-${currentSource}-${spellHeatmapCells.length}`" :cells="spellHeatmapCells" :precomputed-colors="true" :gap="0.1" />
        </section>
        <!-- 热力图 - 单词EF热力图 -->
        <section class="chart-card" data-width="full">
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
          <HeatMap :key="`ef-${currentSource}-${efHeatmapCells.length}`" :cells="efHeatmapCells" :precomputed-colors="true" :gap="0.1"/>
        </section>


      </ChartGrid>

    <!-- EF Range Settings Modal -->
    <Teleport to="body">
      <div v-if="showEFSettings" class="modal-overlay" @click.self="cancelEFSettings">
        <div class="modal-content">
          <div class="modal-header">
            <h3>EF 区间配置</h3>
            <button @click="cancelEFSettings" class="close-btn">✕</button>
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
              ⚠️ 低 EF 上限必须小于等于中 EF 上限
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
import { onMounted, ref, computed, watch, Teleport } from 'vue'
import PageLayout from '@/shared/components/layout/PageLayout.vue'
import ChartGrid from '@/features/statistics/components/ChartGrid.vue'
import BarChart from '@/shared/components/charts/BarChart.vue'
import PieChart from '@/shared/components/charts/PieChart.vue'
import LineChart from '@/shared/components/charts/LineChart.vue'
import HeatMap from '@/shared/components/charts/HeatMap.vue'
import Loading from '@/shared/components/feedback/Loading.vue'
import SwitchTab from '@/shared/components/controls/SwitchTab.vue'
import { api } from '@/shared/api'
import { useSourceSelectionReadOnly } from '@/shared/composables/useSourceSelection'
import { palette as chartPalette, heatmapColors } from '@/shared/config/chartColors'

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
const statsData = ref<Record<string, {
  efDict: EfItem[]
  nextReviewDict: Record<string, number>
  spellNextReviewDict: Record<string, number>
  elapseTimeDict: Record<string, number>
  spellStrengthDict: StrengthItem[]
  addedDateCountDict: Record<string, number>
  reviewCountDict: Record<number, number>
  spellHeatmapCells: Array<{word: string, value: number | null, available: boolean, color: string, tooltip: string}>
  efHeatmapCells: Array<{word: string, value: number | null, available: boolean, color: string, tooltip: string}>
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

// Color palette for charts - using centralized config
const palette = {
  ...chartPalette,
  // Light variants for charts
  tealLight: 'rgba(54,207,201,0.25)',
  orangeLight: 'rgba(250,140,22,0.25)',
  blueLight: 'rgba(24,144,255,0.25)',
  purpleLight: 'rgba(146,84,222,0.25)',
  greenLight: 'rgba(82,196,26,0.25)',
  redLight: 'rgba(255,77,79,0.25)',
  yellowLight: 'rgba(250,219,20,0.25)',
  pinkLight: 'rgba(235,47,150,0.25)',
  grayLight: 'rgba(140,140,140,0.25)',
  cyanLight: 'rgba(19,194,194,0.25)'
}


const fetchStats = async (source: string) => {
  try {
    const data = await api.stats.getStats({ source })
    statsData.value[source] = {
      efDict: data.ef_dict,
      nextReviewDict: data.next_review_dict,
      spellNextReviewDict: data.spell_next_review_dict,
      elapseTimeDict: data.elapse_time_dict,
      spellStrengthDict: data.spell_strength_dict,
      addedDateCountDict: data.added_date_count_dict,
      reviewCountDict: data.review_count_dict,
      spellHeatmapCells: data.spell_heatmap_cells || [],
      efHeatmapCells: data.ef_heatmap_cells || []
    }
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

onMounted(async () => {
  try {
    // First get the current source from the backend to sync with WordIndex
    await initializeFromData()

    // Set local source to match WordIndex selection
    if (initialSource.value) {
      currentSource.value = initialSource.value
    }

    // Then preload stats data for both sources
    await preloadAllStats()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e)
  }
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
}, { deep: true })

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

.main-content {
    max-width: 72rem;
    margin: 0 auto;
    padding: 2rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.chart-card {
  background: #fff;
  border-radius: var(--radius-md);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 1.2em;
  display: flex;
  flex-direction: column;
  overflow: visible; /* 确保内容不被截断 */
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.chart-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.chart-card h2 {
  font-size: 1.1em;
  font-weight: 600;
  margin-bottom: 0.8em;
  color: var(--color-text-primary);
  flex-shrink: 0;
}

.chart-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.1em;
  font-weight: 600;
  margin-bottom: 0.8em;
  color: var(--color-text-primary);
  flex-wrap: wrap;
}

.legend {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85em;
  color: var(--color-text-secondary);
}

.legend .spell-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  display: inline-block;
}

/* 响应式优化 */
@media (max-width: 480px) {
  .chart-card {
    padding: 1em;
  }

  .chart-card h2,
  .chart-title {
    font-size: 1em;
  }

  .legend {
    gap: 6px;
  }

  .legend-item {
    font-size: 0.8em;
  }

  .chart-title {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}

/* Settings button */
.settings-btn {
  background: none;
  border: none;
  font-size: 1.2em;
  cursor: pointer;
  padding: 0.2em 0.4em;
  border-radius: var(--radius-xs);
  transition: background-color 0.2s;
  line-height: 1;
}

.settings-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  border-radius: var(--radius-md);
  width: 90%;
  max-width: 450px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  animation: modalFadeIn 0.2s ease;
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2em 1.5em;
  border-bottom: 1px solid var(--color-border-light);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.2em;
  font-weight: 600;
  color: var(--color-text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5em;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xs);
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.modal-body {
  padding: 1.5em;
  display: flex;
  flex-direction: column;
  gap: 1.2em;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1em;
}

.setting-row label {
  font-size: 0.95em;
  color: var(--color-text-primary);
  font-weight: 500;
}

.number-input {
  width: 100px;
  padding: 0.5em 0.75em;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-size: 0.95em;
  transition: border-color 0.2s;
}

.number-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1);
}

.number-input.input-error {
  border-color: var(--color-danger);
}

.number-input.input-error:focus {
  border-color: var(--color-danger);
  box-shadow: 0 0 0 2px rgba(255, 77, 79, 0.1);
}

.error-message {
  background: var(--color-danger-light);
  border: 1px solid var(--color-danger);
  color: var(--color-danger);
  padding: 0.6em 0.8em;
  border-radius: var(--radius-sm);
  font-size: 0.9em;
  display: flex;
  align-items: center;
  gap: 0.5em;
}

.preview {
  background: var(--color-bg-page);
  padding: 1em;
  border-radius: var(--radius-default);
  margin-top: 0.5em;
}

.preview p {
  margin: 0 0 0.5em 0;
  font-size: 0.9em;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.preview ul {
  margin: 0;
  padding-left: 1.5em;
  list-style: disc;
}

.preview li {
  font-size: 0.9em;
  color: var(--color-text-secondary);
  margin: 0.3em 0;
}

.modal-footer {
  padding: 1em 1.5em;
  border-top: 1px solid var(--color-border-light);
  display: flex;
  justify-content: flex-end;
  gap: 0.8em;
}

.reset-btn, .confirm-btn {
  padding: 0.6em 1.2em;
  border-radius: var(--radius-sm);
  font-size: 0.95em;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  font-weight: 500;
}

.reset-btn {
  background: var(--color-bg-page);
  color: var(--color-text-secondary);
}

.reset-btn:hover {
  background: var(--color-border-light);
}

.confirm-btn {
  background: var(--color-primary);
  color: white;
}

.confirm-btn:hover {
  background: var(--color-primary-hover);
}

.confirm-btn:disabled {
  background: var(--color-border-strong);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.confirm-btn:disabled:hover {
  background: var(--color-border-strong);
}
</style>
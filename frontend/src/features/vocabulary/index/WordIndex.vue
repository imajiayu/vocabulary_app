<template>
  <Loading v-if="loading" text="连接中..." />
  <div v-else class="glass-card w-full word-index-container">
    <!-- 进度恢复通知条 -->
    <ProgressNotification
      :show="showProgressNotification"
      :progress-info="progressInfo"
      @resume="resumeProgress"
      @dismiss="dismissProgressNotification"
    />

    <header class="text-center header-section">
      <div class="header-with-switch">
        <h1 class="text-3xl font-bold text-primary m-0 main-title">单词复习</h1>
        <IOSSwitch v-model="shuffleModel" label="打乱顺序" class="shuffle-switch" />
      </div>
      <p class="text-sm text-secondary m-0 subtitle">选择一个模式开始练习，支持打乱顺序与单词数量设置</p>
    </header>

    <!-- 来源切换 tabs -->
    <SwitchTab
      v-model="currentSource"
      :tabs="sourceTabs"
      container-class="secondary-theme"
      :show-indicator="true"
      @change="handleSourceChange"
      class="source-tabs"
    />

    <ButtonGrid>
      <!-- Compact按钮容器 -->
      <div class="compact-buttons-container">
        <IndexButton
          icon="➕"
          title="管理单词"
          variant="compact"
          border-color="rgba(100, 149, 237, 0.2)"
          background="transparent"
          @click="goManagement"
        />

        <IndexButton
          icon="📈"
          title="查看统计"
          variant="compact"
          border-color="rgba(112, 128, 144, 0.2)"
          background="transparent"
          @click="goStats"
        />
      </div>

      <Transition name="review-button" mode="out-in">
        <IndexButton
          :key="`review-${currentSource}`"
          icon="🔁"
          title="复习已有"
          v-model:wheelValue="reviewLimit"
          :count="counts.review"
          border-color="rgba(107, 142, 35, 0.2)"
          background="transparent"
          @click="goto('mode_review')"
        />
      </Transition>

      <Transition name="review-button" mode="out-in">
        <IndexButton
          :key="`lapse-${currentSource}`"
          icon="❗"
          title="复习错题"
          v-model:wheelValue="lapseLimit"
          :count="counts.lapse"
          border-color="rgba(165, 42, 42, 0.2)"
          background="transparent"
          @click="goto('mode_lapse')"
        />
      </Transition>

      <Transition name="review-button" mode="out-in">
        <IndexButton
          :key="`spelling-${currentSource}`"
          icon="⌨️"
          title="拼写熟练"
          v-model:wheelValue="spellingLimit"
          :count="counts.spelling"
          border-color="rgba(138, 43, 226, 0.2)"
          background="transparent"
          @click="goto('mode_spelling')"
        />
      </Transition>
    </ButtonGrid>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, reactive, computed } from 'vue'
import IndexButton from '@/shared/components/controls/IndexButton.vue'
import ButtonGrid from '@/shared/components/controls/ButtonGrid.vue'
import IOSSwitch from '@/shared/components/controls/IOSSwitch.vue'
import SwitchTab from '@/shared/components/controls/SwitchTab.vue'
import ProgressNotification from '@/shared/components/feedback/ProgressNotification.vue'
import { useRouter } from 'vue-router'
import Loading from '@/shared/components/feedback/Loading.vue'
import { useSourceSelection } from '@/shared/composables/useSourceSelection'
import { useShuffleSelection } from '@/shared/composables/useShuffleSelection'
import { api } from '@/shared/api'
import { useSettings } from '@/shared/composables/useSettings'
import { logger } from '@/shared/utils/logger'

const log = logger.create('WordIndex')

type Counts = { review: number; lapse: number; spelling: number; today_spell: number }

const loading = ref(true)
const error = ref<string | null>(null)
const retryDelay = 1000 // 1秒
const counts = reactive<Counts>({ review: 0, lapse: 0, spelling: 0, today_spell: 0 })
const spellingLimit = ref(50)
const reviewLimit = ref(0)
const lapseLimit = ref(0)

// 进度恢复通知相关
const showProgressNotification = ref(false)
const progressInfo = ref({
  mode: '',
  source: '',
  shuffle: false,
  current_index: 0,
  total_words: 0,
  remaining_words: 0,
  initial_lapse_word_count: 0
})

// 使用 source selection composable
const {
  currentSource,
  availableSources,
  sourceStatsMap,
  allCountsMap,
  switchSource: switchSourceComposable,
  initializeFromData,
  loadAvailableSources,
  fetchAllSourcesStats,
  updateAllCaches
} = useSourceSelection()

// 使用全局设置管理
const { loadSettings } = useSettings()

// 使用 shuffle selection composable
const {
  shuffle,
  setShuffle,
  initializeFromData: initializeShuffleFromData
} = useShuffleSelection()

const router = useRouter()

// 构建选项卡数据 - 动态生成
const sourceTabs = computed(() => {
  return availableSources.value.map(source => ({
    value: source,
    label: `${source} ${sourceStatsMap[source]?.total || 0}`,
    disabled: availableSources.value.length === 1  // 只有1个source时禁用
  }))
})

// 处理来源切换 - 直接从 Supabase 获取最新数据（不显示整页 loading，保留卡片动画）
const handleSourceChange = async (source: string) => {
  try {
    const sourceCounts = await switchSourceComposable(source)
    Object.assign(counts, sourceCounts)
    updateWheelValues()
  } catch (e) {
    log.error('Failed to switch source:', e)
  }
}

// 更新滚轮值的辅助函数
const updateWheelValues = async () => {
  try {
    const settings = await loadSettings()
    lapseLimit.value = Math.min(counts.lapse, settings.learning.lapseQueueSize)
  } catch {
    lapseLimit.value = Math.min(counts.lapse, 25)
  }
  reviewLimit.value = counts.review > 0 ? counts.review : 0
  spellingLimit.value = counts.today_spell > 0 ? counts.today_spell : 0
}

// 创建双向绑定的shuffle computed
const shuffleModel = computed({
  get: () => shuffle.value,
  set: (value: boolean) => {
    setShuffle(value)
  }
})

const fetchSummary = async (isRetry = false) => {
  try {
    if (!isRetry) {
      loading.value = true
    }

    // 并行获取：后端 index_summary + Supabase 所有 source 统计
    const [data, allStats] = await Promise.all([
      api.stats.getIndexSummary(),
      fetchAllSourcesStats()
    ])

    // 设置当前 source（从后端获取）
    initializeFromData({ current_source: data.current_source })

    // 更新所有缓存（sourceStatsMap 和 allCountsMap）
    updateAllCaches(allStats)

    // 使用当前 source 的 counts
    const currentCounts = allCountsMap[data.current_source] || data.counts
    Object.assign(counts, currentCounts)

    // 从settings获取配置并初始化shuffle状态（使用缓存）
    try {
      const settings = await loadSettings()
      // 初始化shuffle默认值（直接设置，不触发POST）
      shuffle.value = settings.learning.defaultShuffle
      // 设置lapse队列大小（从30改为配置值）
      lapseLimit.value = Math.min(counts.lapse, settings.learning.lapseQueueSize)
    } catch (e) {
      log.error('Failed to load settings:', e)
      // 如果获取settings失败，使用默认值
      shuffle.value = false
    }

    // 检查进度恢复信息
    if (data.progress_restore?.has_progress && data.progress_restore?.progress_basic) {
      const basic = data.progress_restore.progress_basic
      const summary = data.progress_restore.summary

      progressInfo.value = {
        mode: basic.mode,
        source: basic.source,
        shuffle: basic.shuffle,
        current_index: basic.current_index,
        total_words: summary?.total_words || 0,
        remaining_words: summary?.remaining_words || 0,
        initial_lapse_word_count: summary?.initial_lapse_word_count || 0
      }
      showProgressNotification.value = true
    }

    // 设置默认滚轮值（lapseLimit已在settings中设置）
    reviewLimit.value = counts.review > 0 ? counts.review : 0
    spellingLimit.value = counts.today_spell > 0 ? counts.today_spell : 0

    // 成功后清除错误
    error.value = null
  } catch (e: unknown) {
    log.error('Failed to fetch summary:', e)
    error.value = e instanceof Error ? e.message : String(e)

    // 无限重试
    log.log(`Retrying in ${retryDelay}ms...`)
    setTimeout(() => {
      fetchSummary(true)
    }, retryDelay)
  } finally {
    // 只有在成功时才停止loading
    if (!error.value) {
      loading.value = false
    }
  }
}

onMounted(async () => {
  await loadAvailableSources()  // 先加载可用的 sources
  await fetchSummary()
})

const goto = (mode: string) => {
  let limit: number
  switch (mode) {
    case 'mode_review':
      limit = reviewLimit.value
      break
    case 'mode_lapse':
      limit = lapseLimit.value
      break
    case 'mode_spelling':
      limit = spellingLimit.value
      break
    default:
      limit = 50
  }

  router.push({
    path: '/review',
    query: {
      mode,
      limit: limit.toString()
    }
  })
}

const goStats = () => {
  router.push('/stats')
}

const goManagement = () => {
  router.push('/management')
}

const dismissProgressNotification = async () => {
  try {
    // 调用 API 清除进度
    await api.progress.clearProgress()
    showProgressNotification.value = false
  } catch (e) {
    log.error('Failed to clear progress:', e)
    // 即使 API 调用失败，也隐藏通知条
    showProgressNotification.value = false
  }
}

const resumeProgress = () => {
  router.push({
    path: '/review',
    query: {
      resume: 'true'
    }
  })
}

</script>

<style scoped>
.word-index-container {
  padding: 2rem;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.header-section {
  margin-bottom: 2rem;
}

.header-with-switch {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  margin-bottom: 6px;
}

.shuffle-switch {
  flex-shrink: 0;
}

.source-tabs {
  margin-bottom: 1.5rem;
}

/* Compact按钮容器 */
.compact-buttons-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}


/* 移动端全面适配 */
@media (max-width: 480px) {
  .word-index-container {
    padding: 1.5rem;
    max-width: 100%;
    min-height: auto; /* 让高度由内容决定 */
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }

  .header-section {
    margin-bottom: 1.5rem;
  }

  .compact-buttons-container {
    gap: 0.875rem;
  }

}

/* 小屏手机进一步优化 */
@media (max-width: 480px) {
  .word-index-container {
    padding: 1rem;
    min-height: auto; /* 让高度由内容决定 */
  }

  .header-section {
    margin-bottom: 1.25rem;
  }

  .compact-buttons-container {
    gap: 0.75rem;
  }

}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .word-index-container {
    padding: 1rem;
  }

  .header-section {
    margin-bottom: 1rem;
  }

}

/* 超宽屏适配 */
@media (min-width: 1440px) {
  .word-index-container {
    padding: 3rem;
    max-width: 800px;
  }

}

/* 复习按钮过渡动画 */
.review-button-enter-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.review-button-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.review-button-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.review-button-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}
</style>
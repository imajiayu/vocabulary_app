<template>
  <Loading v-if="loading" text="连接中..." />
  <div v-else class="word-index">
    <!-- ═══════════════════════════════════════════════════════════════════
         桌面端布局
         ═══════════════════════════════════════════════════════════════════ -->
    <div v-if="!isMobile" class="desktop-layout">
      <!-- 左侧：来源切换竖排标签 -->
      <aside class="source-rail">
        <div class="rail-header">
          <span class="rail-label">词库</span>
        </div>
        <div class="rail-tabs">
          <button
            v-for="source in availableSources"
            :key="source"
            :class="['rail-tab', { active: currentSource === source }]"
            @click="handleSourceChange(source)"
          >
            <span class="tab-name">{{ source }}</span>
            <span class="tab-count">{{ sourceStatsMap[source]?.total || 0 }}</span>
          </button>
        </div>
      </aside>

      <!-- 中央：主内容区 -->
      <main class="main-content">
        <!-- 进度恢复通知条 - 桌面端 -->
        <ProgressNotification
          :show="showProgressNotification"
          :progress-info="progressInfo"
          @resume="resumeProgress"
          @dismiss="dismissProgressNotification"
        />

        <!-- 顶部标题栏 -->
        <header class="title-bar">
          <div class="title-group">
            <h1 class="page-title">单词</h1>
            <span class="title-divider"></span>
            <span class="current-source">{{ currentSource }}</span>
          </div>
          <label class="shuffle-toggle">
            <IOSSwitch v-model="shuffleModel" />
            <span class="shuffle-label">打乱</span>
          </label>
        </header>

        <!-- 英雄区：主复习按钮 -->
        <section class="hero-section">
          <Transition name="hero-card" mode="out-in">
            <div :key="`hero-${currentSource}`" class="hero-card" @click="goto('mode_review')">
              <!-- 装饰性背景 -->
              <div class="hero-decoration">
                <svg class="ink-splash" viewBox="0 0 200 200" preserveAspectRatio="none">
                  <circle cx="100" cy="100" r="80" fill="url(#inkGradient)" opacity="0.08"/>
                  <defs>
                    <radialGradient id="inkGradient">
                      <stop offset="0%" stop-color="var(--primitive-copper-500)"/>
                      <stop offset="100%" stop-color="transparent"/>
                    </radialGradient>
                  </defs>
                </svg>
              </div>

              <!-- 弧形进度指示器 -->
              <div class="arc-progress">
                <svg viewBox="0 0 120 120" class="progress-ring">
                  <circle
                    class="progress-track"
                    cx="60" cy="60" r="54"
                    stroke-width="6"
                    fill="none"
                  />
                  <circle
                    class="progress-fill"
                    cx="60" cy="60" r="54"
                    stroke-width="6"
                    fill="none"
                    :stroke-dasharray="339.29"
                    :stroke-dashoffset="339.29 * (1 - (reviewLimit / Math.max(counts.review, 1)))"
                  />
                </svg>
                <div class="progress-center">
                  <span class="progress-value">{{ reviewLimit }}</span>
                  <span class="progress-total">/{{ counts.review }}</span>
                </div>
              </div>

              <!-- 内容 -->
              <div class="hero-content">
                <div class="hero-icon">
                  <AppIcon name="refresh" class="hero-icon-svg" />
                </div>
                <div class="hero-text">
                  <h2 class="hero-title">复习已有</h2>
                  <p class="hero-desc">继续巩固已学单词</p>
                </div>
              </div>

              <!-- 滚轮选择器 -->
              <div class="hero-wheel" @click.stop>
                <WheelSelector
                  :model-value="reviewLimit"
                  :max="Math.min(counts.review, 500)"
                  :display-max="counts.review"
                  :min="0"
                  @update:model-value="(v: number) => reviewLimit = Math.min(v, counts.review)"
                />
              </div>
            </div>
          </Transition>
        </section>

        <!-- 次要按钮网格 -->
        <section class="secondary-grid">
          <Transition name="card-slide" mode="out-in">
            <div :key="`lapse-${currentSource}`" class="action-card action-card--lapse" @click="goto('mode_lapse')">
              <div class="card-icon">
                <AppIcon name="alert" class="card-icon-svg" />
              </div>
              <div class="card-body">
                <span class="card-title">复习错题</span>
                <span class="card-stats">{{ lapseLimit }}/{{ counts.lapse }}</span>
              </div>
              <div class="card-wheel" @click.stop>
                <WheelSelector
                  :model-value="lapseLimit"
                  :max="Math.min(counts.lapse, 500)"
                  :display-max="counts.lapse"
                  :min="0"
                  @update:model-value="(v: number) => lapseLimit = Math.min(v, counts.lapse)"
                />
              </div>
            </div>
          </Transition>

          <Transition name="card-slide" mode="out-in">
            <div :key="`spelling-${currentSource}`" class="action-card action-card--spelling" @click="goto('mode_spelling')">
              <div class="card-icon">
                <AppIcon name="keyboard" class="card-icon-svg" />
              </div>
              <div class="card-body">
                <span class="card-title">拼写熟练</span>
                <span class="card-stats">{{ spellingLimit }}/{{ counts.spelling }}</span>
              </div>
              <div class="card-wheel" @click.stop>
                <WheelSelector
                  :model-value="spellingLimit"
                  :max="Math.min(counts.spelling, 500)"
                  :display-max="counts.spelling"
                  :min="0"
                  @update:model-value="(v: number) => spellingLimit = Math.min(v, counts.spelling)"
                />
              </div>
            </div>
          </Transition>
        </section>

        <!-- 快捷入口 -->
        <section class="quick-links">
          <button class="quick-link" @click="goManagement">
            <AppIcon name="plus-circle" class="link-icon-svg" />
            <span class="link-text">管理单词</span>
          </button>
          <span class="link-separator">·</span>
          <button class="quick-link" @click="goStats">
            <AppIcon name="chart" class="link-icon-svg" />
            <span class="link-text">查看统计</span>
          </button>
        </section>
      </main>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════
         移动端布局
         ═══════════════════════════════════════════════════════════════════ -->
    <div v-else class="mobile-layout">
      <!-- 顶部区域 -->
      <header class="mobile-header">
        <div class="header-top">
          <h1 class="mobile-title">单词</h1>
          <label class="mobile-shuffle">
            <span class="shuffle-text">打乱</span>
            <IOSSwitch v-model="shuffleModel" />
          </label>
        </div>
        <!-- 来源横向滚动 -->
        <div class="source-scroll">
          <button
            v-for="source in availableSources"
            :key="source"
            :class="['source-chip', { active: currentSource === source }]"
            @click="handleSourceChange(source)"
          >
            {{ source }}
            <span class="chip-count">{{ sourceStatsMap[source]?.total || 0 }}</span>
          </button>
        </div>
      </header>

      <!-- 进度恢复通知条 - 移动端 -->
      <div v-if="showProgressNotification" class="mobile-notification-wrapper">
        <ProgressNotification
          :show="showProgressNotification"
          :progress-info="progressInfo"
          @resume="resumeProgress"
          @dismiss="dismissProgressNotification"
        />
      </div>

      <!-- 三个复习模式卡片 -->
      <section class="mobile-cards">
        <!-- 复习已有 -->
        <Transition name="card-fade" mode="out-in">
          <div :key="`m-review-${currentSource}`" class="mobile-card mobile-card--review" @click="goto('mode_review')">
            <div class="card-left">
              <span class="card-icon">
                <AppIcon name="refresh" class="card-icon-svg" />
              </span>
              <div class="card-info">
                <span class="card-title">复习已有</span>
                <span class="card-count">{{ reviewLimit }}/{{ counts.review }}</span>
              </div>
            </div>
            <div class="card-wheel" @click.stop>
              <WheelSelector
                :model-value="reviewLimit"
                :max="Math.min(counts.review, 500)"
                :display-max="counts.review"
                :min="0"
                @update:model-value="(v: number) => reviewLimit = Math.min(v, counts.review)"
              />
            </div>
          </div>
        </Transition>

        <!-- 复习错题 -->
        <Transition name="card-fade" mode="out-in">
          <div :key="`m-lapse-${currentSource}`" class="mobile-card mobile-card--lapse" @click="goto('mode_lapse')">
            <div class="card-left">
              <span class="card-icon">
                <AppIcon name="alert" class="card-icon-svg" />
              </span>
              <div class="card-info">
                <span class="card-title">复习错题</span>
                <span class="card-count">{{ lapseLimit }}/{{ counts.lapse }}</span>
              </div>
            </div>
            <div class="card-wheel" @click.stop>
              <WheelSelector
                :model-value="lapseLimit"
                :max="Math.min(counts.lapse, 500)"
                :display-max="counts.lapse"
                :min="0"
                @update:model-value="(v: number) => lapseLimit = Math.min(v, counts.lapse)"
              />
            </div>
          </div>
        </Transition>

        <!-- 拼写熟练 -->
        <Transition name="card-fade" mode="out-in">
          <div :key="`m-spell-${currentSource}`" class="mobile-card mobile-card--spelling" @click="goto('mode_spelling')">
            <div class="card-left">
              <span class="card-icon">
                <AppIcon name="keyboard" class="card-icon-svg" />
              </span>
              <div class="card-info">
                <span class="card-title">拼写熟练</span>
                <span class="card-count">{{ spellingLimit }}/{{ counts.spelling }}</span>
              </div>
            </div>
            <div class="card-wheel" @click.stop>
              <WheelSelector
                :model-value="spellingLimit"
                :max="Math.min(counts.spelling, 500)"
                :display-max="counts.spelling"
                :min="0"
                @update:model-value="(v: number) => spellingLimit = Math.min(v, counts.spelling)"
              />
            </div>
          </div>
        </Transition>
      </section>

      <!-- 底部快捷入口 -->
      <section class="mobile-quick-links">
        <button class="quick-btn" @click="goManagement">
          <AppIcon name="plus-circle" class="quick-icon-svg" />
          <span class="quick-text">管理单词</span>
        </button>
        <span class="quick-divider">·</span>
        <button class="quick-btn" @click="goStats">
          <AppIcon name="chart" class="quick-icon-svg" />
          <span class="quick-text">查看统计</span>
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, reactive, computed, onUnmounted } from 'vue'
import IOSSwitch from '@/shared/components/controls/IOSSwitch.vue'
import WheelSelector from '@/shared/components/controls/WheelSelector.vue'
import ProgressNotification from '@/shared/components/feedback/ProgressNotification.vue'
import AppIcon from '@/shared/components/controls/Icons.vue'
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
const retryDelay = 1000
const counts = reactive<Counts>({ review: 0, lapse: 0, spelling: 0, today_spell: 0 })
const spellingLimit = ref(0)
const reviewLimit = ref(0)
const lapseLimit = ref(0)
const isMobile = ref(false)

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
  loadAvailableSources,
} = useSourceSelection()

// 使用全局设置管理
const { loadSettings } = useSettings()

// 使用 shuffle selection composable
const {
  shuffle,
  setShuffle,
} = useShuffleSelection()

const router = useRouter()

// 处理来源切换
const handleSourceChange = async (source: string) => {
  try {
    const sourceCounts = await switchSourceComposable(source)
    Object.assign(counts, sourceCounts)
    updateWheelValues()
  } catch (e) {
    log.error('Failed to switch source:', e)
  }
}

// 滚轮选择器的最大可选值
const WHEEL_MAX = 500

// 更新滚轮值的辅助函数
const updateWheelValues = async () => {
  try {
    const settings = await loadSettings()
    lapseLimit.value = Math.min(counts.lapse, settings.learning.lapseQueueSize, WHEEL_MAX)
  } catch {
    lapseLimit.value = Math.min(counts.lapse, 25, WHEEL_MAX)
  }
  reviewLimit.value = Math.min(counts.review, WHEEL_MAX)
  spellingLimit.value = Math.min(counts.today_spell, WHEEL_MAX)
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

    // counts 已由 loadAvailableSources 填充到 allCountsMap
    const currentCounts = allCountsMap[currentSource.value] || { review: 0, lapse: 0, spelling: 0, today_spell: 0 }
    Object.assign(counts, currentCounts)

    // 并行加载设置和进度
    const [settingsResult, progressResult] = await Promise.allSettled([
      loadSettings(),
      api.progress.getProgressDirect()
    ])

    if (settingsResult.status === 'fulfilled') {
      const settings = settingsResult.value
      shuffle.value = settings.learning.defaultShuffle
      lapseLimit.value = Math.min(counts.lapse, settings.learning.lapseQueueSize, WHEEL_MAX)
    } else {
      log.error('Failed to load settings:', settingsResult.reason)
      shuffle.value = false
      lapseLimit.value = Math.min(counts.lapse, 25, WHEEL_MAX)
    }

    if (progressResult.status === 'fulfilled') {
      const progressData = progressResult.value
      if (progressData && progressData.word_ids_snapshot?.length > 0) {
        const totalWords = progressData.word_ids_snapshot.length
        const currentIndex = progressData.current_index || 0
        if (currentIndex >= 0 && currentIndex < totalWords) {
          progressInfo.value = {
            mode: progressData.mode,
            source: progressData.source,
            shuffle: progressData.shuffle,
            current_index: currentIndex,
            total_words: totalWords,
            remaining_words: totalWords - currentIndex,
            initial_lapse_word_count: progressData.initial_lapse_word_count || 0
          }
          showProgressNotification.value = true
        }
      }
    } else {
      log.warn('Failed to get progress from Supabase:', progressResult.reason)
    }

    reviewLimit.value = Math.min(counts.review, WHEEL_MAX)
    spellingLimit.value = Math.min(counts.today_spell, WHEEL_MAX)
    error.value = null
  } catch (e: unknown) {
    log.error('Failed to fetch summary:', e)
    error.value = e instanceof Error ? e.message : String(e)

    log.log(`Retrying in ${retryDelay}ms...`)
    setTimeout(() => {
      fetchSummary(true)
    }, retryDelay)
  } finally {
    if (!error.value) {
      loading.value = false
    }
  }
}

// 检测移动端
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

onMounted(async () => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  await loadAvailableSources()
  await fetchSummary()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
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

  // 如果选择数量为 0，不执行任何操作
  if (limit === 0) {
    return
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

const dismissProgressNotification = () => {
  showProgressNotification.value = false
  api.progress.clearProgressDirect().catch((e) => {
    log.error('Failed to clear progress:', e)
  })
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
/* ═══════════════════════════════════════════════════════════════════════════
   基础容器
   ═══════════════════════════════════════════════════════════════════════════ */

.word-index {
  width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  /* 内容垂直居中 */
  justify-content: center;

  /* 温暖的象牙纸质背景 - 如同翻阅古典词典 */
  background:
    /* 微妙的纸张纹理 */
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(139, 105, 20, 0.008) 2px,
      rgba(139, 105, 20, 0.008) 4px
    ),
    /* 主渐变：温暖的羊皮纸色调 */
    linear-gradient(
      165deg,
      var(--primitive-paper-100) 0%,
      var(--primitive-paper-200) 35%,
      #F8F3E8 70%,
      var(--primitive-paper-300) 100%
    );
  min-height: 100vh;
}

/* ═══════════════════════════════════════════════════════════════════════════
   桌面端布局
   ═══════════════════════════════════════════════════════════════════════════ */

.desktop-layout {
  display: flex;
  gap: 0;
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
  /* 不设置 min-height，让父容器 .word-index 的 justify-content: center 生效 */
  align-items: flex-start;
}

/* ── 左侧来源导航轨道 ── */
.source-rail {
  width: 140px;
  flex-shrink: 0;
  padding-top: 4rem;
  position: sticky;
  top: 2rem;
}

.rail-header {
  padding: 0 0.5rem 1rem;
  margin-bottom: 0.5rem;
}

.rail-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--primitive-ink-400);
}

.rail-tabs {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rail-tab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.rail-tab:hover {
  background: var(--primitive-paper-300);
}

.rail-tab.active {
  background: var(--gradient-primary);
  box-shadow: 0 4px 16px rgba(153, 107, 61, 0.25);
}

.rail-tab .tab-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--primitive-ink-700);
  transition: color 0.2s;
}

.rail-tab.active .tab-name {
  color: var(--primitive-paper-50);
  font-weight: 600;
}

.rail-tab .tab-count {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--primitive-ink-400);
  transition: color 0.2s;
}

.rail-tab.active .tab-count {
  color: rgba(255, 255, 255, 0.8);
}

/* ── 主内容区 ── */
.main-content {
  flex: 1;
  max-width: 600px;
  padding-left: 2rem;
}

/* ── 标题栏 ── */
.title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--primitive-paper-400);
}

.title-group {
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.page-title {
  font-family: var(--font-serif);
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--primitive-ink-800);
  margin: 0;
  letter-spacing: -0.02em;
}

.title-divider {
  width: 2px;
  height: 1.5rem;
  background: var(--primitive-paper-500);
  transform: translateY(2px);
}

.current-source {
  font-size: 1rem;
  font-weight: 500;
  color: var(--primitive-ink-500);
}

.title-actions {
  display: flex;
  align-items: center;
}

.shuffle-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.shuffle-label {
  font-size: 13px;
  color: var(--primitive-ink-500);
  font-weight: 500;
}

/* ── 英雄区：主复习按钮 ── */
.hero-section {
  margin-bottom: 1.5rem;
}

.hero-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
  background: var(--primitive-paper-100);
  border: 1px solid var(--primitive-paper-400);
  border-radius: var(--radius-xl);
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.hero-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px rgba(153, 107, 61, 0.15);
  border-color: var(--primitive-copper-300);
}

.hero-decoration {
  position: absolute;
  right: -50px;
  top: -50px;
  width: 200px;
  height: 200px;
  pointer-events: none;
}

.ink-splash {
  width: 100%;
  height: 100%;
}

/* 弧形进度 */
.arc-progress {
  position: relative;
  width: 100px;
  height: 100px;
  flex-shrink: 0;
}

.progress-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-track {
  stroke: var(--primitive-paper-400);
}

.progress-fill {
  stroke: var(--primitive-copper-500);
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.progress-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.progress-value {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primitive-copper-600);
  line-height: 1;
}

.progress-total {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--primitive-ink-400);
}

.hero-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hero-icon {
  font-size: 2rem;
  margin-bottom: 0.25rem;
}

.hero-icon-svg {
  width: 2rem;
  height: 2rem;
  fill: var(--primitive-copper-500);
}

.hero-title {
  font-family: var(--font-serif);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primitive-ink-800);
  margin: 0;
}

.hero-desc {
  font-size: 0.875rem;
  color: var(--primitive-ink-500);
  margin: 0;
}

.hero-wheel {
  position: relative;
  width: 60px;
  height: 80px;
  flex-shrink: 0;
}

/* ── 次要按钮网格 ── */
.secondary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

.action-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: var(--primitive-paper-100);
  border: 1px solid var(--primitive-paper-400);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.action-card--lapse {
  border-left: 3px solid var(--primitive-brick-400);
}

.action-card--spelling {
  border-left: 3px solid var(--primitive-olive-400);
}

.card-icon {
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-icon-svg {
  width: 1.25rem;
  height: 1.25rem;
  fill: var(--primitive-ink-600);
}

.action-card--lapse .card-icon-svg {
  fill: var(--primitive-brick-500);
}

.action-card--spelling .card-icon-svg {
  fill: var(--primitive-olive-500);
}

.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--primitive-ink-700);
}

.card-stats {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--primitive-ink-400);
}

.card-wheel {
  position: relative;
  width: 60px;
  height: 80px;
  flex-shrink: 0;
}

/* ── 快捷入口 ── */
.quick-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding-top: 1.5rem;
  border-top: 1px dashed var(--primitive-paper-400);
}

.quick-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-link:hover {
  background: var(--primitive-paper-300);
}

.link-icon-svg {
  width: 1rem;
  height: 1rem;
  fill: var(--primitive-ink-500);
}

.link-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--primitive-ink-600);
}

.link-separator {
  color: var(--primitive-ink-300);
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端布局
   ═══════════════════════════════════════════════════════════════════════════ */

.mobile-layout {
  display: flex;
  flex-direction: column;
  /* 不设置 min-height，让父容器 .word-index 的 justify-content: center 生效 */
  /* 外边距由组件自己控制，与 HomePage main-container 解耦 */
  padding: 1rem;
  padding-bottom: 1rem;
}

/* ── 移动端头部 ── */
.mobile-header {
  padding: 0.25rem 0.25rem 0;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.mobile-title {
  font-family: var(--font-serif);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primitive-ink-800);
  margin: 0;
}

.mobile-shuffle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.shuffle-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--primitive-ink-500);
}

/* 移动端通知包装 */
.mobile-notification-wrapper {
  padding: 0 0.25rem;
}

/* 来源横向滚动 */
.source-scroll {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.75rem;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.source-scroll::-webkit-scrollbar {
  display: none;
}

.source-chip {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border: 1px solid var(--primitive-paper-400);
  background: var(--primitive-paper-100);
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--primitive-ink-600);
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.source-chip:active {
  transform: scale(0.96);
}

.source-chip.active {
  background: var(--gradient-primary);
  border-color: transparent;
  color: var(--primitive-paper-50);
}

.chip-count {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  opacity: 0.8;
}

/* ── 移动端卡片区 ── */
.mobile-cards {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0.75rem 0.25rem;
}

.mobile-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  background: var(--primitive-paper-100);
  border: 1px solid var(--primitive-paper-400);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
}

.mobile-card:active {
  transform: scale(0.98);
  background: var(--primitive-paper-200);
}

.mobile-card--review {
  border-left: 3px solid var(--primitive-copper-400);
}

.mobile-card--lapse {
  border-left: 3px solid var(--primitive-brick-400);
}

.mobile-card--spelling {
  border-left: 3px solid var(--primitive-olive-400);
}

.card-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.mobile-card .card-icon {
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-card .card-icon-svg {
  width: 1.5rem;
  height: 1.5rem;
}

.mobile-card--review .card-icon-svg {
  fill: var(--primitive-copper-500);
}

.mobile-card--lapse .card-icon-svg {
  fill: var(--primitive-brick-500);
}

.mobile-card--spelling .card-icon-svg {
  fill: var(--primitive-olive-500);
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.mobile-card .card-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--primitive-ink-800);
}

.mobile-card .card-count {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--primitive-ink-400);
}

.mobile-card .card-wheel {
  position: relative;
  width: 60px;
  height: 80px;
  flex-shrink: 0;
}

/* ── 移动端快捷入口 ── */
.mobile-quick-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  padding: 0.875rem 0.25rem;
  margin-top: 0.25rem;
  border-top: 1px dashed var(--primitive-paper-400);
}

.quick-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-btn:active {
  background: var(--primitive-paper-300);
  transform: scale(0.96);
}

.quick-icon-svg {
  width: 1rem;
  height: 1rem;
  fill: var(--primitive-ink-500);
}

.quick-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--primitive-ink-600);
}

.quick-divider {
  color: var(--primitive-ink-300);
  font-size: 1.25rem;
}

/* ═══════════════════════════════════════════════════════════════════════════
   动画
   ═══════════════════════════════════════════════════════════════════════════ */

/* 英雄卡片切换 - 桌面端 */
.hero-card-enter-active {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.hero-card-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.hero-card-enter-from {
  opacity: 0;
  transform: translateY(30px) scale(0.95);
}

.hero-card-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.98);
}

/* 次要卡片切换 - 桌面端 */
.card-slide-enter-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.card-slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

/* 移动端卡片淡入 */
.card-fade-enter-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-fade-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-fade-enter-from {
  opacity: 0;
  transform: translateX(15px);
}

.card-fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   响应式调整
   ═══════════════════════════════════════════════════════════════════════════ */

/* 小屏手机 */
@media (max-width: 768px) {
  .word-index {
    /* 减去底部导航高度，避免与父容器 padding-bottom 叠加导致多余滚动 */
    min-height: calc(100dvh - var(--mobile-nav-height, 88px));
  }

  .mobile-layout {
    padding: 0.75rem;
  }

  .mobile-header {
    padding: 0;
  }

  .mobile-title {
    font-size: 1.25rem;
  }

  .shuffle-text {
    font-size: 0.75rem;
  }

  .source-chip {
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
  }

  .mobile-cards {
    gap: 0.5rem;
    padding: 0.5rem 0;
  }

  .mobile-card {
    padding: 0.75rem 0.875rem;
  }

  .mobile-card .card-icon {
    font-size: 1.25rem;
  }

  .mobile-card .card-title {
    font-size: 0.875rem;
  }

  .mobile-card .card-count {
    font-size: 0.75rem;
  }

  .mobile-card .card-wheel {
    width: 55px;
    height: 70px;
  }

  .mobile-quick-links {
    padding: 0.75rem 0;
    gap: 1rem;
    margin-top: 0.125rem;
  }

  .quick-icon {
    font-size: 0.875rem;
  }

  .quick-text {
    font-size: 0.8125rem;
  }

  .mobile-notification-wrapper {
    padding: 0;
  }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .mobile-layout {
    flex-direction: row;
    flex-wrap: wrap;
    padding: 0.75rem;
  }

  .mobile-header {
    width: 100%;
    padding: 0;
  }

  .header-top {
    margin-bottom: 0.375rem;
  }

  .mobile-title {
    font-size: 1.125rem;
  }

  .source-scroll {
    padding-bottom: 0.25rem;
  }

  .mobile-notification-wrapper {
    width: 100%;
    padding: 0;
  }

  .mobile-cards {
    flex: 1;
    flex-direction: row;
    gap: 0.5rem;
    padding: 0.25rem 0;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .mobile-card {
    flex: 1;
    min-width: 180px;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.5rem;
  }

  .card-left {
    flex-direction: row;
    width: 100%;
  }

  .mobile-card .card-wheel {
    width: 50px;
    height: 65px;
    align-self: center;
  }

  .mobile-quick-links {
    width: 100%;
    padding: 0.375rem 0;
  }
}

/* 超宽屏 */
@media (min-width: 1440px) {
  .desktop-layout {
    max-width: 1100px;
    padding: 3rem;
  }

  .source-rail {
    width: 160px;
  }

  .main-content {
    max-width: 700px;
  }
}
</style>

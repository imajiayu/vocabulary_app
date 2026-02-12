<template>
  <section v-if="mode !== 'mode_lapse'" class="load-preview-section" :class="modeClass">
    <header class="section-header">
      <div class="header-accent"></div>
      <span class="header-title">未来负荷</span>
    </header>

    <!-- Scrollable vertical timeline -->
    <div v-if="loadsCache" ref="scrollEl" class="timeline-scroll scrollbar-thin">
      <div
        v-for="(day, i) in days"
        :key="i"
        class="timeline-row"
        :class="{
          'is-highlighted': highlightIndex === i,
          'is-empty': day.load === 0
        }"
      >
        <span class="row-date">{{ day.label }}</span>
        <div class="row-bar-track">
          <div
            class="row-bar-fill"
            :class="{ 'over-limit': day.load > dailyLimit }"
            :style="{ width: barWidth(day.load) }"
          ></div>
        </div>
        <span class="row-count" :class="{ 'over-limit': day.load > dailyLimit }">
          {{ day.load }}
        </span>

        <!-- Word capsule overlay -->
        <Transition name="capsule">
          <span
            v-if="highlightIndex === i && capsuleWord"
            :key="capsuleKey"
            class="word-capsule"
            :class="{ 'is-mastered': capsuleMastered }"
          >{{ capsuleMastered ? `${capsuleWord} 已掌握` : capsuleWord }}</span>
        </Transition>
      </div>
    </div>

    <!-- Ghost state before first answer -->
    <div v-else class="timeline-ghost">
      <div class="ghost-rows">
        <div v-for="i in 10" :key="i" class="ghost-row">
          <div class="ghost-date"></div>
          <div class="ghost-bar">
            <div
              class="ghost-bar-inner"
              :style="{ width: ghostWidths[(i - 1) % ghostWidths.length], animationDelay: `${(i - 1) * 0.15}s` }"
            ></div>
          </div>
        </div>
      </div>
      <p class="ghost-hint">答题后显示<br/>未来复习分布</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, watch, ref, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useReviewStore } from '@/features/vocabulary/stores/review'
import { useSettings } from '@/shared/composables/useSettings'

const reviewStore = useReviewStore()
const { mode, notification, reviewLoadsCache, spellLoadsCache } = storeToRefs(reviewStore)
const { settings: userSettings, loadSettings } = useSettings()

loadSettings()

const modeClass = computed(() =>
  mode.value === 'mode_spelling' ? 'mode-spelling' : 'mode-review'
)

const loadsCache = computed(() =>
  mode.value === 'mode_spelling' ? spellLoadsCache.value : reviewLoadsCache.value
)

const dailyLimit = computed(() => {
  if (!userSettings.value) return Infinity
  return mode.value === 'mode_spelling'
    ? userSettings.value.learning.dailySpellLimit
    : userSettings.value.learning.dailyReviewLimit
})

const days = computed(() => {
  const cache = loadsCache.value
  if (!cache) return []

  const today = new Date()
  return cache.map((load, i) => {
    const date = new Date(today)
    date.setDate(date.getDate() + i + 1)
    let label: string
    if (i === 0) label = '明天'
    else if (i === 1) label = '后天'
    else label = `${date.getMonth() + 1}/${date.getDate()}`

    return { load, label }
  })
})

const maxLoad = computed(() => {
  if (!loadsCache.value) return 1
  return Math.max(...loadsCache.value, 1)
})

const barWidth = (load: number): string => {
  if (load === 0) return '0%'
  return `${Math.max((load / maxLoad.value) * 100, 6)}%`
}

const ghostWidths = ['40%', '60%', '25%', '50%', '70%', '35%', '55%', '45%', '30%', '65%']

// ── Scroll & highlight state ──
const scrollEl = ref<HTMLElement | null>(null)
const highlightIndex = ref<number | null>(null)
const capsuleWord = ref('')
const capsuleKey = ref(0)
const capsuleMastered = ref(false)
let highlightTimer: ReturnType<typeof setTimeout> | null = null

const ROW_HEIGHT = 28

const scrollToRow = (index: number) => {
  const el = scrollEl.value
  if (!el) return
  const targetTop = index * ROW_HEIGHT
  const centerOffset = el.clientHeight / 2 - ROW_HEIGHT / 2
  el.scrollTo({
    top: Math.max(0, targetTop - centerOffset),
    behavior: 'smooth'
  })
}

watch(
  () => notification.value.data,
  (data) => {
    if (!data) return

    // Calculate target day index
    let dayIndex: number
    if (data.param_type === 'ease_factor') {
      dayIndex = data.breakdown.interval - 1
    } else {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const next = new Date(data.next_review_date)
      next.setHours(0, 0, 0, 0)
      dayIndex = Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) - 1
    }

    const cacheLen = loadsCache.value?.length ?? 0
    if (dayIndex < 0 || dayIndex >= cacheLen) return

    // Detect auto-stop (mastered): ease_factor >= 3.0 && repetition >= 6
    const mastered = data.param_type === 'ease_factor'
      && data.new_param_value >= 3.0
      && data.breakdown.repetition >= 6

    if (highlightTimer) clearTimeout(highlightTimer)

    capsuleWord.value = data.word
    capsuleMastered.value = mastered
    highlightIndex.value = dayIndex
    capsuleKey.value++

    nextTick(() => scrollToRow(dayIndex))

    highlightTimer = setTimeout(() => {
      highlightIndex.value = null
      capsuleWord.value = ''
    }, 2500)
  }
)
</script>

<style scoped>
.load-preview-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ── Section header ── */
.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-shrink: 0;
}

.header-accent {
  width: 3px;
  height: 14px;
  background: var(--gradient-primary);
  border-radius: 2px;
}

.header-title {
  font-family: var(--font-serif);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--primitive-ink-500);
  letter-spacing: 0.05em;
}

/* ── Timeline scroll container ── */
.timeline-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: linear-gradient(145deg,
    rgba(58, 50, 42, 0.92),
    rgba(42, 36, 30, 0.88)
  );
  border-radius: var(--radius-md);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 253, 247, 0.06);
  border: 1px solid rgba(255, 253, 247, 0.06);
  padding: 4px 0;
}

.mode-review .timeline-scroll {
  border-top: 3px solid var(--primitive-copper-400);
}

.mode-spelling .timeline-scroll {
  border-top: 3px solid var(--primitive-olive-400);
}

/* ── Timeline row ── */
.timeline-row {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 8px;
  gap: 6px;
  position: relative;
  transition: background 0.3s ease, box-shadow 0.3s ease;
}

.timeline-row.is-highlighted {
  background: rgba(255, 253, 247, 0.07);
}

.mode-review .timeline-row.is-highlighted {
  box-shadow: inset 3px 0 0 var(--primitive-copper-400);
}

.mode-spelling .timeline-row.is-highlighted {
  box-shadow: inset 3px 0 0 var(--primitive-olive-400);
}

.timeline-row.is-empty {
  opacity: 0.35;
}

/* Row date label */
.row-date {
  width: 32px;
  flex-shrink: 0;
  font-family: var(--font-data);
  font-size: 0.58rem;
  color: var(--primitive-paper-300);
  text-align: right;
  opacity: 0.8;
}

.timeline-row.is-highlighted .row-date {
  opacity: 1;
  color: var(--primitive-paper-100);
}

/* Row bar */
.row-bar-track {
  flex: 1;
  height: 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 2px;
  overflow: hidden;
}

.row-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s ease;
}

.mode-review .row-bar-fill {
  background: linear-gradient(90deg,
    var(--primitive-copper-600),
    var(--primitive-copper-400)
  );
}

.mode-spelling .row-bar-fill {
  background: linear-gradient(90deg,
    var(--primitive-olive-600),
    var(--primitive-olive-400)
  );
}

.row-bar-fill.over-limit {
  background: linear-gradient(90deg,
    var(--primitive-brick-600),
    var(--primitive-brick-400)
  );
}

/* Row count */
.row-count {
  width: 20px;
  flex-shrink: 0;
  font-family: var(--font-data);
  font-size: 0.58rem;
  color: var(--primitive-paper-300);
  text-align: right;
  opacity: 0.8;
}

.row-count.over-limit {
  color: var(--primitive-brick-300);
  opacity: 1;
}

.timeline-row.is-highlighted .row-count {
  opacity: 1;
  color: var(--primitive-paper-100);
}

/* ── Word capsule ── */
.word-capsule {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--font-serif);
  font-size: 0.6rem;
  font-weight: 600;
  white-space: nowrap;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 2px 8px;
  border-radius: 10px;
  z-index: 2;
  pointer-events: none;
  backdrop-filter: blur(4px);
}

.mode-review .word-capsule {
  background: rgba(153, 107, 61, 0.55);
  color: var(--primitive-copper-100);
  box-shadow: 0 0 8px rgba(153, 107, 61, 0.3);
}

.mode-spelling .word-capsule {
  background: rgba(93, 122, 93, 0.55);
  color: var(--primitive-olive-100);
  box-shadow: 0 0 8px rgba(93, 122, 93, 0.3);
}

.word-capsule.is-mastered {
  background: rgba(184, 134, 11, 0.6);
  color: var(--primitive-gold-100);
  box-shadow: 0 0 12px rgba(184, 134, 11, 0.4);
}

/* Capsule animation */
.capsule-enter-active {
  animation: capsuleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.capsule-leave-active {
  animation: capsuleOut 0.4s ease forwards;
}

@keyframes capsuleIn {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.7);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes capsuleOut {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
}

/* ── Ghost state ── */
.timeline-ghost {
  flex: 1;
  min-height: 0;
  background: linear-gradient(145deg,
    rgba(58, 50, 42, 0.92),
    rgba(42, 36, 30, 0.88)
  );
  border-radius: var(--radius-md);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 253, 247, 0.06);
  border: 1px solid rgba(255, 253, 247, 0.06);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 1rem 0.75rem;
  gap: 0.5rem;
}

.ghost-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ghost-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px;
}

.ghost-date {
  width: 28px;
  height: 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  flex-shrink: 0;
}

.ghost-bar {
  flex: 1;
  height: 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 2px;
  overflow: hidden;
}

.ghost-bar-inner {
  height: 100%;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  animation: ghostPulse 2.5s ease-in-out infinite;
}

.ghost-hint {
  text-align: center;
  font-family: var(--font-serif);
  font-size: 0.65rem;
  color: var(--primitive-paper-300);
  opacity: 0.4;
  line-height: 1.5;
  margin-top: 0.25rem;
}

@keyframes ghostPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.7; }
}
</style>

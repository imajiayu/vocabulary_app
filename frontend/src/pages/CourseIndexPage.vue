<template>
  <div class="course-index-page" :class="{ embedded }" :data-course="config.theme">
    <CourseTopBar v-if="!embedded" :config="config" />

    <main class="course-index-main">
      <!-- ══ 左侧 Rail: 章节索引 ══ -->
      <aside class="course-rail" aria-label="按周索引">
        <header class="rail-header">
          <span class="rail-numeral">§</span>
          <span class="rail-label">Chapitres</span>
          <span class="rail-count stat-number">{{ ribbonTabs.length }}</span>
        </header>

        <ul ref="railEl" class="rail-list" role="tablist">
          <li
            v-for="tab in ribbonTabs"
            :key="tab.week"
            class="rail-row"
            :class="{
              active: activeWeek === tab.week,
              future: tab.type === 'future',
              done: tab.type === 'current' && weekDone(tab.week) === tab.total
            }"
          >
            <button
              type="button"
              class="rail-btn"
              role="tab"
              :aria-selected="activeWeek === tab.week"
              :tabindex="activeWeek === tab.week ? 0 : -1"
              @click="selectWeek(tab.week)"
              @keydown="onTabKeydown($event, tab.week)"
            >
              <span class="rail-roman">{{ toRoman(tab.week) }}</span>
              <span class="rail-body">
                <span class="rail-title">{{ tab.title }}</span>
                <span class="rail-meta">
                  <template v-if="tab.type === 'current'">
                    <span class="rail-dots" aria-hidden="true">
                      <span
                        v-for="n in tab.total"
                        :key="n"
                        class="rail-dot"
                        :class="{ filled: n <= weekDone(tab.week) }"
                      />
                    </span>
                    <span class="rail-ratio stat-number">
                      {{ weekDone(tab.week) }}/{{ tab.total }}
                    </span>
                  </template>
                  <template v-else>
                    <span class="rail-future-label">À venir</span>
                  </template>
                </span>
              </span>
              <span class="rail-bracket" aria-hidden="true" />
            </button>
          </li>
        </ul>

        <footer class="rail-footer">
          <span class="rail-footer-text">{{ completedCount }}/{{ totalLessons }}</span>
          <span class="rail-footer-label">已完成</span>
        </footer>
      </aside>

      <!-- ══ 右侧 Content ══ -->
      <section class="course-content">
        <!-- Masthead: 课程标题 + 进度环 -->
        <header class="masthead">
          <div class="masthead-text">
            <span class="masthead-kicker">
              {{ heroKicker }}
              <span class="masthead-kicker-dot">·</span>
              <span class="masthead-kicker-year">MMXXVI</span>
            </span>
            <h1 class="masthead-title">{{ config.name }}</h1>
            <p class="masthead-subtitle">{{ heroSubtitle }}</p>
          </div>

          <div class="masthead-stats">
            <div class="masthead-meta">
              <span class="meta-item">
                <strong class="stat-number">{{ totalLessons }}</strong>
                <span class="meta-label">课时</span>
              </span>
              <span class="meta-divider" aria-hidden="true" />
              <span class="meta-item">
                <strong class="stat-number">{{ weekCount }}</strong>
                <span class="meta-label">周期</span>
              </span>
            </div>

            <div class="masthead-ring" role="img" :aria-label="`已完成 ${completionPct}`">
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle class="ring-track" cx="60" cy="60" r="52" />
                <circle
                  class="ring-progress"
                  cx="60"
                  cy="60"
                  r="52"
                  :stroke-dasharray="ringCircumference"
                  :stroke-dashoffset="ringOffset"
                />
              </svg>
              <div class="masthead-ring-content">
                <span class="masthead-ring-pct stat-number">{{ completionPct }}</span>
              </div>
            </div>
          </div>
        </header>

        <!-- 激活周条带 -->
        <div class="week-strip" role="tabpanel" :aria-label="`第 ${activeWeek} 周`">
          <span class="week-strip-numeral">§</span>
          <span class="week-strip-no stat-number">{{ toRoman(activeWeek) }}</span>
          <div class="week-strip-title-col">
            <span class="week-strip-label">Week {{ activeWeek }}</span>
            <span class="week-strip-title">{{ activeTabTitle }}</span>
          </div>
          <div class="week-strip-progress" v-if="!activeIsFuture">
            <span class="week-strip-ratio stat-number">
              {{ weekDone(activeWeek) }} / {{ activeWeekLessons.length }}
            </span>
            <div class="week-strip-track" aria-hidden="true">
              <div
                class="week-strip-bar"
                :style="{ width: activeWeekLessons.length ? (weekDone(activeWeek) / activeWeekLessons.length * 100) + '%' : '0%' }"
              />
            </div>
          </div>
          <div class="week-strip-progress future-pill" v-else>
            <span class="future-pill-text">尚未开启</span>
          </div>
        </div>

        <!-- 课时流 (或未来周预告) -->
        <div class="lesson-stream" :class="{ 'is-future': activeIsFuture }">
          <!-- 当前周 -->
          <ol
            v-if="!activeIsFuture && activeWeekLessons.length"
            class="lesson-grid"
            :key="`lessons-${activeWeek}`"
          >
            <li
              v-for="(lesson, idx) in activeWeekLessons"
              :key="lesson.id"
              class="lesson-item"
              :style="{ '--reveal-delay': `${idx * 28}ms` }"
            >
              <router-link
                :to="`${config.basePath}/${lesson.id}`"
                class="lesson-card"
                :class="{
                  completed: isCompleted(lesson.id),
                  'is-vocab': lesson.vocab,
                  'is-review': lesson.review
                }"
              >
                <div class="lesson-head">
                  <span class="lesson-day stat-number">D{{ lesson.day }}</span>
                  <span class="lesson-kind">
                    <template v-if="lesson.vocab">词汇预载</template>
                    <template v-else-if="lesson.review">综合复习</template>
                    <template v-else>讲授</template>
                  </span>
                  <button
                    type="button"
                    class="lesson-check"
                    :class="{ checked: isCompleted(lesson.id) }"
                    :aria-pressed="isCompleted(lesson.id)"
                    :title="isCompleted(lesson.id) ? '标记为未完成' : '标记为已完成'"
                    @click.prevent.stop="toggleLesson(lesson.id)"
                  >
                    <svg v-if="isCompleted(lesson.id)" viewBox="0 0 14 14" aria-hidden="true">
                      <path d="m3.5 7.5 2.2 2.2L10.5 4.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                    </svg>
                    <span v-else class="lesson-check-dot" />
                  </button>
                </div>

                <h3 class="lesson-title">{{ lesson.title }}</h3>
                <p class="lesson-topic">{{ lesson.topic }}</p>

                <span class="lesson-arrow" aria-hidden="true">
                  <svg viewBox="0 0 16 16"><path d="M5 3.5 9.5 8 5 12.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
              </router-link>
            </li>
          </ol>

          <!-- 未来周预告 -->
          <div v-else-if="activeIsFuture && activeFutureWeek" class="future-panel">
            <span class="future-ornament" aria-hidden="true">❦</span>
            <span class="future-kicker">À venir · Week {{ activeFutureWeek.week }}</span>
            <h2 class="future-title">{{ activeFutureWeek.title }}</h2>
            <p class="future-topic">{{ activeFutureWeek.topic }}</p>
            <p class="future-note">
              此章节尚未编订 · 课程按周渐次展开
            </p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, provide, ref } from 'vue'
import { useCourseConfig } from '@/features/courses/composables/useCourseConfig'
import { useCourseProgress } from '@/features/courses/composables/useCourseProgress'
import { getLessonsByCourse, type LessonMeta, type FutureWeek } from '@/features/courses/data/lessons'
import CourseTopBar from '@/features/courses/components/navigation/CourseTopBar.vue'

import '@/features/courses/styles/course.css'
import '@/features/courses/styles/course-themes.css'

const props = withDefaults(defineProps<{
  courseId: string
  embedded?: boolean
}>(), {
  embedded: false
})

const { config } = useCourseConfig(props.courseId)
const { lessons, futureWeeks, weekTitles } = getLessonsByCourse(props.courseId)
const { isCompleted, toggleLesson, fetchProgress } = useCourseProgress(props.courseId)

provide('courseConfig', config.value)

// ── 统计 ──
const totalLessons = lessons.length

const weekCount = computed(() => {
  const s = new Set(lessons.map(l => l.week))
  return s.size + futureWeeks.length
})

const completedCount = computed(() =>
  lessons.filter(l => isCompleted(l.id)).length
)

const completionPct = computed(() => {
  if (totalLessons === 0) return '0%'
  return Math.round(completedCount.value / totalLessons * 100) + '%'
})

const ringCircumference = 2 * Math.PI * 52
const ringOffset = computed(() => {
  if (totalLessons === 0) return ringCircumference
  const p = completedCount.value / totalLessons
  return ringCircumference * (1 - p)
})

// ── 按周组织数据 ──
const currentWeeks = computed(() => {
  const map = new Map<number, LessonMeta[]>()
  for (const l of lessons) {
    if (!map.has(l.week)) map.set(l.week, [])
    map.get(l.week)!.push(l)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([num, lessons]) => ({ num, lessons }))
})

type RibbonTab =
  | { type: 'current'; week: number; title: string; total: number }
  | { type: 'future'; week: number; title: string; topic: string }

const ribbonTabs = computed<RibbonTab[]>(() => {
  const current: RibbonTab[] = currentWeeks.value.map(w => ({
    type: 'current',
    week: w.num,
    title: weekTitles[w.num] || `第 ${w.num} 周`,
    total: w.lessons.length
  }))
  const future: RibbonTab[] = futureWeeks.map(fw => ({
    type: 'future',
    week: fw.week,
    title: fw.title,
    topic: fw.topic
  }))
  return [...current, ...future]
})

function weekDone(n: number) {
  return lessons.filter(l => l.week === n && isCompleted(l.id)).length
}

// ── 当前激活周 ──
const activeWeek = ref<number>(1)

const activeTab = computed(() =>
  ribbonTabs.value.find(t => t.week === activeWeek.value)
)

const activeIsFuture = computed(() => activeTab.value?.type === 'future')

const activeWeekLessons = computed(() => {
  const w = currentWeeks.value.find(x => x.num === activeWeek.value)
  return w?.lessons ?? []
})

const activeFutureWeek = computed<FutureWeek | undefined>(() =>
  futureWeeks.find(fw => fw.week === activeWeek.value)
)

const activeTabTitle = computed(() => activeTab.value?.title ?? `第 ${activeWeek.value} 周`)

function selectWeek(n: number) {
  activeWeek.value = n
}

const railEl = ref<HTMLUListElement | null>(null)

function onTabKeydown(e: KeyboardEvent, week: number) {
  const tabs = ribbonTabs.value
  const idx = tabs.findIndex(t => t.week === week)
  if (idx < 0) return
  let next = idx
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = Math.min(idx + 1, tabs.length - 1)
  else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = Math.max(idx - 1, 0)
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = tabs.length - 1
  else return
  e.preventDefault()
  activeWeek.value = tabs[next].week
  nextTick(() => {
    const btn = document.querySelectorAll<HTMLButtonElement>('.rail-btn')[next]
    btn?.focus()
  })
}

// ── 默认激活周: 最新的未全部完成的周 ──
function pickDefaultWeek(): number {
  const weeks = currentWeeks.value
  if (weeks.length === 0) return futureWeeks[0]?.week ?? 1
  for (const w of weeks) {
    const done = w.lessons.filter(l => isCompleted(l.id)).length
    if (done < w.lessons.length) return w.num
  }
  return weeks[weeks.length - 1].num
}

// ── 罗马数字 (装饰用) ──
const ROMAN_NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
function toRoman(n: number): string {
  return ROMAN_NUMERALS[n] ?? String(n)
}

// ── 文案 ──
const heroKicker = computed(() =>
  config.value.id === 'ukrainian'
    ? 'Ukrainian · Study Journal'
    : 'Legal English · Study Journal'
)

const heroSubtitle = computed(() =>
  config.value.id === 'ukrainian'
    ? '从名词性别到七格变位，系统学习乌克兰语核心语法'
    : '从合同基础到违约救济，精研法律英语术语与起草'
)

onMounted(async () => {
  await fetchProgress()
  activeWeek.value = pickDefaultWeek()
  await nextTick()
  const el = railEl.value
  if (el) {
    const idx = ribbonTabs.value.findIndex(t => t.week === activeWeek.value)
    const row = el.querySelectorAll<HTMLElement>('.rail-row')[idx]
    row?.scrollIntoView({ block: 'nearest' })
  }
})
</script>

<style scoped>
/* ══════════════════════════════════════════════════════════════════
   整屏容器 — 与 WordIndex 一致：不滚动、内容居中
   ══════════════════════════════════════════════════════════════════ */
.course-index-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-surface-page);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  overflow: hidden;
  position: relative;
}

.course-index-page.embedded {
  min-height: 100%;
  height: 100%;
}

/* 纸质背景纹理 + 主题色柔和光晕 */
.course-index-page::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    repeating-linear-gradient(
      0deg,
      transparent 0,
      transparent 2px,
      color-mix(in srgb, var(--primitive-gold-600) 0.6%, transparent) 2px,
      color-mix(in srgb, var(--primitive-gold-600) 0.6%, transparent) 3px
    ),
    radial-gradient(900px 500px at 18% -10%, var(--course-accent-soft) 0%, transparent 60%),
    radial-gradient(700px 400px at 100% 110%, color-mix(in srgb, var(--primitive-gold-500) 5%, transparent) 0%, transparent 55%);
}

.course-index-main {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 20px;
  width: 100%;
  max-width: 1220px;
  margin: 0 auto;
  padding: 22px 28px 24px;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

/* ══════════════════════════════════════════════════════════════════
   左侧 Rail
   ══════════════════════════════════════════════════════════════════ */
.course-rail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-lg);
  overflow: hidden;
  position: relative;
}

/* 左侧装饰竖线 — 像书脊上的烫金带 */
.course-rail::before {
  content: '';
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 4px;
  width: 1px;
  background: linear-gradient(
    to bottom,
    transparent,
    var(--course-accent-soft-strong) 20%,
    var(--course-accent-soft-strong) 80%,
    transparent
  );
  opacity: 0.6;
}

.rail-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.rail-numeral {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 18px;
  color: var(--course-accent-strong);
  line-height: 1;
}

.rail-label {
  font-family: var(--font-serif);
  font-size: 12px;
  color: var(--course-accent);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 600;
  flex: 1;
}

.rail-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-tertiary);
  letter-spacing: 0.04em;
}

.rail-list {
  list-style: none;
  padding: 6px 6px;
  margin: 0;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
  scrollbar-width: thin;
  scrollbar-color: var(--course-accent-soft-strong) transparent;
}

.rail-list::-webkit-scrollbar {
  width: 4px;
}
.rail-list::-webkit-scrollbar-track {
  background: transparent;
}
.rail-list::-webkit-scrollbar-thumb {
  background: var(--course-accent-soft-strong);
  border-radius: 2px;
}

.rail-row {
  position: relative;
}

.rail-btn {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 10px 7px 10px;
  background: transparent;
  border: 0;
  border-radius: var(--radius-default);
  cursor: pointer;
  text-align: left;
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  transition: background 0.15s ease, color 0.15s ease, transform 0.18s ease;
  position: relative;
}

.rail-btn:hover {
  background: var(--course-accent-soft);
}

.rail-btn:focus-visible {
  outline: 2px solid var(--course-accent);
  outline-offset: -2px;
}

.rail-roman {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 14px;
  font-weight: 500;
  color: var(--course-accent);
  letter-spacing: 0.02em;
  line-height: 1;
  min-width: 22px;
  text-align: center;
}

.rail-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.rail-title {
  font-family: var(--font-serif);
  font-size: 12.5px;
  font-weight: 500;
  color: var(--color-text-primary);
  line-height: 1.3;
  letter-spacing: 0.01em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.rail-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--color-text-tertiary);
}

.rail-dots {
  display: flex;
  gap: 2px;
}

.rail-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: transparent;
  border: 1px solid var(--course-accent-soft-strong);
  transition: background 0.2s ease;
}

.rail-dot.filled {
  background: var(--course-accent);
  border-color: var(--course-accent);
}

.rail-ratio {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-tertiary);
  letter-spacing: 0.02em;
  margin-left: auto;
}

.rail-future-label {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 10.5px;
  color: var(--color-text-tertiary);
  letter-spacing: 0.04em;
}

/* Active — 底色加重 + 左侧 accent bar */
.rail-row.active .rail-btn {
  background: var(--course-accent-soft);
}

.rail-row.active .rail-roman {
  color: var(--course-accent-strong);
  font-weight: 600;
}

.rail-row.active .rail-title {
  color: var(--course-accent-strong);
  font-weight: 600;
}

.rail-row.active .rail-bracket {
  position: absolute;
  left: 3px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: var(--course-accent);
  border-radius: 1px;
}

/* Done — 完成标记 */
.rail-row.done .rail-btn::after {
  content: '✓';
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 9px;
  width: 12px;
  height: 12px;
  display: grid;
  place-items: center;
  color: var(--color-state-success);
  background: var(--color-state-success-light);
  border-radius: 50%;
  font-weight: 700;
}

.rail-row.done .rail-ratio {
  opacity: 0;
}

/* Future — 斜纹底、斜体 */
.rail-row.future .rail-btn {
  opacity: 0.55;
}

.rail-row.future .rail-btn:hover {
  opacity: 0.85;
}

.rail-row.future .rail-roman,
.rail-row.future .rail-title {
  font-style: italic;
  color: var(--color-text-tertiary);
}

.rail-row.future.active .rail-btn {
  opacity: 0.92;
  background: var(--course-accent-soft);
}

.rail-footer {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--color-border-light);
  flex-shrink: 0;
  background: var(--course-accent-soft);
}

.rail-footer-text {
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 600;
  color: var(--course-accent-strong);
  letter-spacing: 0.02em;
}

.rail-footer-label {
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
}

/* ══════════════════════════════════════════════════════════════════
   右侧 Content
   ══════════════════════════════════════════════════════════════════ */
.course-content {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 14px;
}

/* ── Masthead ── */
.masthead {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 24px;
  align-items: center;
  padding: 18px 22px 16px;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-lg);
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

.masthead::before {
  content: '';
  position: absolute;
  left: 22px;
  right: 22px;
  top: 26px;
  height: 1px;
  background: linear-gradient(
    to right,
    transparent,
    var(--course-accent-soft-strong) 20%,
    var(--course-accent-soft-strong) 80%,
    transparent
  );
  opacity: 0.4;
}

.masthead-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.masthead-kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--course-accent);
  font-weight: 600;
  margin-bottom: 2px;
}

.masthead-kicker-dot {
  font-size: 14px;
  opacity: 0.5;
  letter-spacing: 0;
}

.masthead-kicker-year {
  font-family: var(--font-serif);
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--color-text-tertiary);
  font-weight: 500;
}

.masthead-title {
  font-family: var(--font-serif);
  font-size: clamp(22px, 2.6vw, 30px);
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.15;
  letter-spacing: -0.01em;
  margin: 0;
}

.masthead-subtitle {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 4px 0 0;
}

.masthead-stats {
  display: flex;
  align-items: center;
  gap: 22px;
  flex-shrink: 0;
}

.masthead-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
}

.meta-item {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.meta-item strong {
  font-family: var(--font-serif);
  font-size: 17px;
  color: var(--color-text-primary);
  font-weight: 600;
}

.meta-label {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
}

.meta-divider {
  width: 24px;
  height: 1px;
  background: var(--course-accent-soft-strong);
  margin: 2px 0;
}

.masthead-ring {
  position: relative;
  width: 76px;
  height: 76px;
  flex-shrink: 0;
}

.masthead-ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-track {
  fill: none;
  stroke: var(--course-accent-soft-strong);
  stroke-width: 5;
}

.ring-progress {
  fill: none;
  stroke: var(--course-accent);
  stroke-width: 5;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.masthead-ring-content {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  text-align: center;
}

.masthead-ring-pct {
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 600;
  color: var(--course-accent-strong);
  line-height: 1;
  letter-spacing: -0.02em;
}

/* ── 周条带 ── */
.week-strip {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: center;
  gap: 14px;
  padding: 10px 18px;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-default);
  flex-shrink: 0;
  position: relative;
}

.week-strip::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--course-accent);
  border-radius: var(--radius-default) 0 0 var(--radius-default);
}

.week-strip-numeral {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 16px;
  color: var(--course-accent);
  margin-left: 6px;
}

.week-strip-no {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 22px;
  font-weight: 500;
  color: var(--course-accent-strong);
  letter-spacing: 0.02em;
  line-height: 1;
}

.week-strip-title-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.week-strip-label {
  font-size: 9.5px;
  font-family: var(--font-mono);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  font-weight: 600;
}

.week-strip-title {
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.week-strip-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.week-strip-ratio {
  font-size: 13px;
  color: var(--color-text-primary);
  font-weight: 600;
}

.week-strip-track {
  width: 120px;
  height: 3px;
  background: var(--color-border-light);
  border-radius: 999px;
  overflow: hidden;
}

.week-strip-bar {
  height: 100%;
  background: var(--course-accent);
  border-radius: 999px;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.future-pill {
  padding: 3px 10px;
  border: 1px dashed var(--course-accent-soft-strong);
  border-radius: 999px;
}

.future-pill-text {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 11.5px;
  color: var(--course-accent);
  letter-spacing: 0.04em;
}

/* ══════════════════════════════════════════════════════════════════
   课时流
   ══════════════════════════════════════════════════════════════════ */
.lesson-stream {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.lesson-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-rows: 1fr;
  gap: 10px;
  flex: 1;
  min-height: 0;
}

.lesson-item {
  min-width: 0;
  min-height: 0;
  animation: cardIn 0.32s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: var(--reveal-delay, 0ms);
}

@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.lesson-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 100%;
  padding: 12px 14px 12px 16px;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--color-text-primary);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  position: relative;
  overflow: hidden;
}

.lesson-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--course-accent);
  transform: scaleY(0);
  transform-origin: top;
  transition: transform 0.24s cubic-bezier(0.4, 0, 0.2, 1);
}

.lesson-card:hover {
  border-color: var(--course-accent);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px -10px var(--course-accent-shadow);
}

.lesson-card:hover::before { transform: scaleY(1); }

.lesson-card.completed { background: var(--course-accent-soft); }
.lesson-card.completed::before {
  background: var(--color-state-success);
  transform: scaleY(1);
}

.lesson-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lesson-day {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  font-weight: 600;
  color: var(--course-accent);
  letter-spacing: 0.02em;
}

.lesson-kind {
  flex: 1;
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid var(--color-border-medium);
  background: var(--color-surface-elevated);
  text-align: center;
  max-width: max-content;
  font-weight: 600;
}

.lesson-card.is-vocab .lesson-kind {
  color: var(--course-accent-strong);
  background: var(--course-accent-soft);
  border-color: var(--course-accent-soft-strong);
}

.lesson-card.is-review .lesson-kind {
  color: var(--primitive-gold-700);
  background: rgba(184, 134, 11, 0.08);
  border-color: rgba(184, 134, 11, 0.2);
}

.lesson-check {
  margin-left: auto;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  background: transparent;
  border: 1px solid var(--color-border-medium);
  border-radius: 50%;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
  padding: 0;
}

.lesson-check:hover {
  border-color: var(--course-accent);
  color: var(--course-accent-strong);
}

.lesson-check.checked {
  color: var(--color-state-success);
  background: var(--color-state-success-light);
  border-color: var(--color-state-success);
}

.lesson-check svg {
  width: 11px;
  height: 11px;
}

.lesson-check-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.55;
}

.lesson-title {
  font-family: var(--font-serif);
  font-size: 14.5px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.3;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.lesson-topic {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.lesson-arrow {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 14px;
  height: 14px;
  display: grid;
  place-items: center;
  color: var(--color-text-tertiary);
  opacity: 0;
  transform: translateX(-3px);
  transition: all 0.18s ease;
}

.lesson-arrow svg {
  width: 11px;
  height: 11px;
}

.lesson-card:hover .lesson-arrow {
  opacity: 1;
  transform: translateX(0);
  color: var(--course-accent);
}

/* ══════════════════════════════════════════════════════════════════
   未来周预告
   ══════════════════════════════════════════════════════════════════ */
.lesson-stream.is-future {
  display: flex;
}

.future-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
  background: repeating-linear-gradient(
    135deg,
    var(--color-surface-elevated) 0 2px,
    transparent 2px 24px
  ), var(--color-surface-card);
  border: 1px dashed var(--course-accent-soft-strong);
  border-radius: var(--radius-md);
}

.future-ornament {
  font-family: var(--font-serif);
  font-size: 28px;
  color: var(--course-accent);
  opacity: 0.65;
  line-height: 1;
  margin-bottom: 14px;
}

.future-kicker {
  display: inline-block;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 11.5px;
  color: var(--course-accent);
  letter-spacing: 0.08em;
  padding: 3px 12px;
  border-top: 1px solid var(--course-accent-soft-strong);
  border-bottom: 1px solid var(--course-accent-soft-strong);
  margin-bottom: 16px;
  line-height: 1.8;
}

.future-title {
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px;
  line-height: 1.25;
}

.future-topic {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13.5px;
  color: var(--color-text-secondary);
  margin: 0 0 14px;
  line-height: 1.6;
  max-width: 360px;
}

.future-note {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 11.5px;
  color: var(--color-text-tertiary);
  margin: 0;
  letter-spacing: 0.04em;
}

/* ══════════════════════════════════════════════════════════════════
   响应式 — 移动端保持单屏密集布局
   ══════════════════════════════════════════════════════════════════ */
@media (max-width: 768px) {
  .course-index-page.embedded {
    min-height: calc(100dvh - var(--mobile-nav-height, 88px));
  }

  .course-index-main {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 10px 12px 8px;
  }

  .course-rail {
    flex-direction: column;
  }

  .rail-header {
    padding: 8px 12px 6px;
  }

  .rail-label {
    font-size: 10.5px;
  }

  .rail-list {
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 6px 8px;
    gap: 6px;
    scroll-snap-type: x proximity;
  }

  .rail-row {
    flex-shrink: 0;
    scroll-snap-align: center;
  }

  .rail-btn {
    min-width: 190px;
    grid-template-columns: auto 1fr;
    padding: 7px 10px;
  }

  .rail-row.active .rail-bracket {
    left: 3px;
    top: 6px;
    bottom: 6px;
  }

  .rail-row.done .rail-btn::after {
    right: 6px;
  }

  .rail-footer {
    padding: 7px 12px;
    font-size: 12px;
  }

  .masthead {
    padding: 14px 16px 12px;
    grid-template-columns: 1fr auto;
    gap: 14px;
  }

  .masthead::before {
    left: 16px;
    right: 16px;
    top: 22px;
  }

  .masthead-kicker { font-size: 9.5px; }
  .masthead-title { font-size: 20px; }
  .masthead-subtitle { font-size: 12px; }

  .masthead-stats { gap: 14px; }
  .masthead-meta { display: none; }
  .masthead-ring { width: 62px; height: 62px; }
  .masthead-ring-pct { font-size: 14px; }

  .week-strip {
    padding: 8px 14px;
    gap: 10px;
  }
  .week-strip-numeral { font-size: 14px; }
  .week-strip-no { font-size: 18px; }
  .week-strip-title { font-size: 13.5px; }
  .week-strip-track { width: 70px; }

  .lesson-grid {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .lesson-card {
    padding: 10px 12px;
    gap: 4px;
  }

  .lesson-title { font-size: 13.5px; }
  .lesson-topic { font-size: 11.5px; -webkit-line-clamp: 1; }
  .lesson-arrow { display: none; }

  .future-panel { padding: 18px; }
  .future-title { font-size: 18px; }
  .future-topic { font-size: 12.5px; }
}

/* 超宽屏留白 */
@media (min-width: 1440px) {
  .course-index-main {
    max-width: 1320px;
    grid-template-columns: 320px 1fr;
    padding: 28px 32px 30px;
  }
}
</style>

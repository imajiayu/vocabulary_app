<template>
  <div class="course-index-page" :class="{ embedded }" :data-course="config.theme">
    <CourseTopBar v-if="!embedded" :config="config" />

    <main class="course-index-main">
      <!-- Hero：课程名 + 副标题 + 进度环 -->
      <section class="course-hero">
        <div class="course-hero-decor" aria-hidden="true" />

        <div class="course-hero-inner">
          <div class="course-hero-text">
            <span class="course-hero-kicker">{{ heroKicker }}</span>
            <h1 class="course-hero-title">{{ config.name }}</h1>
            <p class="course-hero-subtitle">{{ heroSubtitle }}</p>

            <div class="course-hero-meta">
              <span class="course-hero-meta-item">
                <strong class="stat-number">{{ totalLessons }}</strong>
                课时
              </span>
              <span class="course-hero-sep" aria-hidden="true">·</span>
              <span class="course-hero-meta-item">
                <strong class="stat-number">{{ weekCount }}</strong>
                周期
              </span>
              <span class="course-hero-sep" aria-hidden="true">·</span>
              <span class="course-hero-meta-item">
                <strong class="stat-number">{{ completedCount }}/{{ totalLessons }}</strong>
                已完成
              </span>
            </div>
          </div>

          <div class="course-hero-ring">
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
            <div class="course-hero-ring-content">
              <span class="course-hero-ring-pct stat-number">{{ completionPct }}</span>
              <span class="course-hero-ring-label">完成度</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 周分组 -->
      <section
        v-for="week in weeks"
        :key="week.num"
        class="course-week"
      >
        <header class="course-week-header">
          <div class="course-week-meta">
            <span class="course-week-index stat-number">W{{ String(week.num).padStart(2, '0') }}</span>
            <h2 class="course-week-title">
              <span v-if="weekTitles[week.num]">{{ weekTitles[week.num] }}</span>
              <span v-else>第 {{ week.num }} 周</span>
            </h2>
          </div>
          <div class="course-week-progress">
            <span class="course-week-progress-text">
              {{ weekDone(week.num) }} / {{ week.lessons.length }}
            </span>
            <div class="course-week-progress-track">
              <div
                class="course-week-progress-bar"
                :style="{ width: (weekDone(week.num) / week.lessons.length * 100) + '%' }"
              />
            </div>
          </div>
        </header>

        <ol class="course-lesson-grid">
          <li
            v-for="lesson in week.lessons"
            :key="lesson.id"
            class="course-lesson-item"
          >
            <router-link
              :to="`${config.basePath}/${lesson.id}`"
              class="course-lesson-card"
              :class="{
                completed: isCompleted(lesson.id),
                'is-vocab': lesson.vocab,
                'is-review': lesson.review
              }"
            >
              <div class="course-lesson-card-head">
                <span class="course-lesson-dayno stat-number">
                  D{{ lesson.day }}
                </span>
                <span class="course-lesson-kind">
                  <template v-if="lesson.vocab">词汇预载</template>
                  <template v-else-if="lesson.review">综合复习</template>
                  <template v-else>讲授</template>
                </span>
              </div>

              <h3 class="course-lesson-title">{{ lesson.title }}</h3>
              <p class="course-lesson-topic">{{ lesson.topic }}</p>

              <div class="course-lesson-card-foot">
                <span class="course-lesson-status" :class="{ done: isCompleted(lesson.id) }">
                  <svg v-if="isCompleted(lesson.id)" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="m4 8.5 2.5 2.5L12 5.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                  </svg>
                  <span v-else class="course-lesson-status-dot" />
                </span>
                <button
                  type="button"
                  class="course-lesson-toggle"
                  :class="{ checked: isCompleted(lesson.id) }"
                  :aria-pressed="isCompleted(lesson.id)"
                  :title="isCompleted(lesson.id) ? '标记为未完成' : '标记为已完成'"
                  @click.prevent.stop="toggleLesson(lesson.id)"
                >
                  {{ isCompleted(lesson.id) ? '已完成' : '标记完成' }}
                </button>
              </div>
            </router-link>
          </li>
        </ol>
      </section>

      <!-- 未来周预告 -->
      <section v-if="futureWeeks.length" class="course-future">
        <header class="course-future-header">
          <span class="course-future-kicker">À venir</span>
          <h2>即将展开的章节</h2>
        </header>
        <ul class="course-future-list">
          <li v-for="fw in futureWeeks" :key="fw.week" class="course-future-item">
            <span class="course-future-week stat-number">W{{ String(fw.week).padStart(2, '0') }}</span>
            <div class="course-future-meta">
              <span class="course-future-title">{{ fw.title }}</span>
              <span class="course-future-topic">{{ fw.topic }}</span>
            </div>
          </li>
        </ul>
      </section>

      <footer class="course-footer">
        <span>{{ config.name }} — Curated for IELTS Study</span>
      </footer>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, provide } from 'vue'
import { useCourseConfig } from '@/features/courses/composables/useCourseConfig'
import { useCourseProgress } from '@/features/courses/composables/useCourseProgress'
import { getLessonsByCourse } from '@/features/courses/data/lessons'
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

const weeks = computed(() => {
  const map = new Map<number, typeof lessons>()
  for (const l of lessons) {
    if (!map.has(l.week)) map.set(l.week, [])
    map.get(l.week)!.push(l)
  }
  return Array.from(map.entries()).map(([num, lessons]) => ({ num, lessons }))
})

function weekDone(n: number) {
  return lessons.filter(l => l.week === n && isCompleted(l.id)).length
}

const heroKicker = computed(() =>
  config.value.id === 'ukrainian'
    ? 'Ukrainian · A Study Journal'
    : 'Legal English · A Study Journal'
)

const heroSubtitle = computed(() =>
  config.value.id === 'ukrainian'
    ? '从名词性别到七格变位，系统学习乌克兰语核心语法。每一课配套真实词汇与练习。'
    : '从合同基础到违约救济，精研法律英语术语。每一课配套真实条款与翻译练习。'
)

onMounted(() => {
  fetchProgress()
})
</script>

<style scoped>
.course-index-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-surface-page);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
}

.course-index-page.embedded {
  min-height: auto;
  width: 100%;
}

.course-index-main {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 28px 96px;
}

/* ══════════ HERO ══════════ */
.course-hero {
  position: relative;
  margin: 32px 0 48px;
  padding: 52px 48px;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-lg);
  overflow: hidden;
  isolation: isolate;
}

.course-hero-decor {
  position: absolute;
  inset: 0;
  background: var(--course-hero-gradient);
  z-index: -1;
  pointer-events: none;
}

.course-hero-inner {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 48px;
  align-items: center;
}

.course-hero-text { min-width: 0; }

.course-hero-kicker {
  display: inline-block;
  font-size: 11px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--course-accent);
  font-weight: 600;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--course-accent-soft-strong);
  margin-bottom: 20px;
}

.course-hero-title {
  font-family: var(--font-serif);
  font-size: clamp(32px, 4.2vw, 46px);
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.1;
  letter-spacing: -0.01em;
  margin: 0 0 14px;
}

.course-hero-subtitle {
  font-family: var(--font-serif);
  font-size: 16px;
  line-height: 1.7;
  color: var(--color-text-secondary);
  max-width: 520px;
  margin: 0 0 24px;
  font-style: italic;
}

.course-hero-meta {
  display: flex;
  align-items: baseline;
  gap: 12px;
  color: var(--color-text-secondary);
  font-size: 13.5px;
}

.course-hero-meta-item strong {
  color: var(--color-text-primary);
  font-size: 17px;
  margin-right: 4px;
  font-weight: 600;
}

.course-hero-sep { opacity: 0.4; }

/* 进度环 */
.course-hero-ring {
  position: relative;
  width: 140px;
  height: 140px;
  flex-shrink: 0;
}

.course-hero-ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-track {
  fill: none;
  stroke: var(--course-accent-soft-strong);
  stroke-width: 6;
}

.ring-progress {
  fill: none;
  stroke: var(--course-accent);
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.course-hero-ring-content {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  align-content: center;
  text-align: center;
}

.course-hero-ring-pct {
  font-family: var(--font-serif);
  font-size: 28px;
  font-weight: 600;
  color: var(--course-accent-strong);
  line-height: 1;
}

.course-hero-ring-label {
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  margin-top: 6px;
}

/* ══════════ 周分组 ══════════ */
.course-week {
  margin-bottom: 48px;
}

.course-week-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--color-border-light);
}

.course-week-meta {
  display: flex;
  align-items: baseline;
  gap: 14px;
  min-width: 0;
}

.course-week-index {
  font-family: var(--font-serif);
  font-size: 14px;
  font-weight: 600;
  color: var(--course-accent);
  letter-spacing: 0.04em;
}

.course-week-title {
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.3;
}

.course-week-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--color-text-tertiary);
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.course-week-progress-track {
  width: 80px;
  height: 3px;
  background: var(--color-border-light);
  border-radius: 999px;
  overflow: hidden;
}

.course-week-progress-bar {
  height: 100%;
  background: var(--course-accent);
  border-radius: 999px;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ── 课时卡片网格 ── */
.course-lesson-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.course-lesson-item { min-width: 0; }

.course-lesson-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 18px 20px;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--color-text-primary);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  position: relative;
  overflow: hidden;
}

.course-lesson-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--course-accent);
  transform: scaleY(0);
  transform-origin: top;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.course-lesson-card:hover {
  border-color: var(--course-accent);
  box-shadow: 0 8px 28px -12px var(--course-accent-shadow);
  transform: translateY(-2px);
}

.course-lesson-card:hover::before { transform: scaleY(1); }

.course-lesson-card.completed::before {
  background: var(--color-state-success);
  transform: scaleY(1);
}

.course-lesson-card.completed { background: var(--color-surface-elevated); }

.course-lesson-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.course-lesson-dayno {
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 600;
  color: var(--course-accent);
  letter-spacing: 0.06em;
}

.course-lesson-kind {
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid var(--color-border-medium);
  background: var(--color-surface-elevated);
}

.course-lesson-card.is-vocab .course-lesson-kind {
  color: var(--course-accent-strong);
  background: var(--course-accent-soft);
  border-color: var(--course-accent-soft-strong);
}

.course-lesson-card.is-review .course-lesson-kind {
  color: var(--primitive-gold-700);
  background: rgba(184, 134, 11, 0.08);
  border-color: rgba(184, 134, 11, 0.2);
}

.course-lesson-title {
  font-family: var(--font-serif);
  font-size: 16.5px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 6px;
  line-height: 1.35;
}

.course-lesson-topic {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin: 0 0 16px;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.course-lesson-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px dashed var(--color-border-light);
}

.course-lesson-status {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  color: var(--color-text-tertiary);
}

.course-lesson-status svg { width: 14px; height: 14px; }
.course-lesson-status.done { color: var(--color-state-success); }

.course-lesson-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
}

.course-lesson-toggle {
  font-family: var(--font-sans);
  font-size: 11.5px;
  letter-spacing: 0.02em;
  color: var(--color-text-tertiary);
  background: transparent;
  border: 1px solid var(--color-border-medium);
  padding: 5px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.course-lesson-toggle:hover {
  border-color: var(--course-accent);
  color: var(--course-accent-strong);
  background: var(--course-accent-soft);
}

.course-lesson-toggle.checked {
  color: var(--color-state-success);
  border-color: var(--color-state-success);
  background: var(--color-state-success-light);
}

/* ══════════ 未来周 ══════════ */
.course-future {
  margin-top: 56px;
  padding: 32px 36px;
  background: transparent;
  border-top: 1px solid var(--color-border-light);
}

.course-future-header { margin-bottom: 20px; }

.course-future-kicker {
  display: inline-block;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--course-accent);
  margin-bottom: 6px;
  letter-spacing: 0.02em;
}

.course-future-header h2 {
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin: 0;
}

.course-future-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}

.course-future-item {
  display: flex;
  align-items: baseline;
  gap: 14px;
  padding: 12px 16px;
  background: var(--color-surface-card);
  border: 1px dashed var(--color-border-medium);
  border-radius: var(--radius-default);
  opacity: 0.72;
  transition: opacity 0.2s ease;
}

.course-future-item:hover { opacity: 1; }

.course-future-week {
  font-family: var(--font-serif);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--course-accent);
  letter-spacing: 0.05em;
  flex-shrink: 0;
  min-width: 34px;
}

.course-future-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.course-future-title {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--color-text-primary);
  line-height: 1.4;
}

.course-future-topic {
  font-size: 11.5px;
  color: var(--color-text-tertiary);
  font-style: italic;
  font-family: var(--font-serif);
  line-height: 1.4;
}

.course-footer {
  text-align: center;
  margin-top: 64px;
  padding-top: 32px;
  border-top: 1px solid var(--color-border-light);
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--color-text-tertiary);
  letter-spacing: 0.02em;
}

/* ══════════ 响应式 ══════════ */
@media (max-width: 768px) {
  .course-index-main { padding: 0 16px 72px; }

  .course-hero {
    padding: 32px 24px;
    margin: 20px 0 36px;
    border-radius: var(--radius-md);
  }

  .course-hero-inner {
    grid-template-columns: 1fr;
    gap: 24px;
    text-align: center;
  }

  .course-hero-text { text-align: left; }
  .course-hero-kicker { font-size: 10px; }
  .course-hero-subtitle { font-size: 14.5px; }
  .course-hero-meta { gap: 8px; font-size: 12.5px; flex-wrap: wrap; }
  .course-hero-meta-item strong { font-size: 15px; }
  .course-hero-ring { width: 110px; height: 110px; margin: 0 auto; }

  .course-week { margin-bottom: 36px; }
  .course-week-header { flex-direction: column; align-items: stretch; gap: 10px; }
  .course-week-title { font-size: 17px; }
  .course-week-progress { justify-content: flex-start; }

  .course-lesson-grid { grid-template-columns: 1fr; gap: 10px; }
  .course-lesson-card { padding: 16px 18px; }
  .course-lesson-title { font-size: 15px; }

  .course-future { padding: 24px 4px; }
  .course-future-list { grid-template-columns: 1fr; }
}
</style>

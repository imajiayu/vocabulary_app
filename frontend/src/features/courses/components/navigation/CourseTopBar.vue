<template>
  <header class="course-topbar" :class="{ scrolled: scrolled }">
    <!-- 滚动进度条（课时页才显示） -->
    <div v-if="lessonId" class="course-topbar-progress" :style="{ transform: `scaleX(${progress})` }" />

    <div class="course-topbar-inner">
      <!-- 左：返回课程目录 + 课程标识 -->
      <div class="course-topbar-left">
        <a href="/" class="course-topbar-home" title="返回课程目录" @click.prevent="returnToCourseIndex">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10.5 3.5 6 8l4.5 4.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </a>

        <div class="course-topbar-brand" :class="`theme-${config.theme}`">
          <span class="course-topbar-badge" aria-hidden="true">
            <component :is="badgeIcon" />
          </span>
          <a href="/" class="course-topbar-brand-text" @click.prevent="returnToCourseIndex">
            <span class="course-topbar-brand-name">{{ brandTitle }}</span>
            <span class="course-topbar-brand-sub">{{ brandSubtitle }}</span>
          </a>
        </div>
      </div>

      <!-- 中：面包屑（课时页才显示） -->
      <nav v-if="lessonId" class="course-topbar-crumbs" aria-label="面包屑">
        <a href="/" class="course-crumb-link" @click.prevent="returnToCourseIndex">目录</a>
        <span class="course-crumb-sep" aria-hidden="true">·</span>
        <span class="course-crumb-current">
          <span v-if="lessonMeta" class="course-crumb-week">W{{ lessonMeta.week }} · D{{ lessonMeta.day }}</span>
          <span class="course-crumb-title">{{ lessonTitle || '载入中…' }}</span>
        </span>
      </nav>

      <!-- 右：课时翻页（课时页）+ 添加单词 + Source 选择器 -->
      <div class="course-topbar-right">
        <div v-if="lessonId && (prevLesson || nextLesson)" class="course-topbar-paging">
          <router-link
            v-if="prevLesson"
            :to="`${config.basePath}/${prevLesson.id}`"
            class="course-page-btn"
            title="上一课"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 4 6 8l4 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </router-link>
          <span v-else class="course-page-btn course-page-btn-disabled" aria-disabled="true">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 4 6 8l4 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </span>
          <router-link
            v-if="nextLesson"
            :to="`${config.basePath}/${nextLesson.id}`"
            class="course-page-btn"
            title="下一课"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 4 10 8 6 12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </router-link>
          <span v-else class="course-page-btn course-page-btn-disabled" aria-disabled="true">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 4 10 8 6 12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </span>
        </div>

        <button
          v-if="lessonId"
          class="course-add-btn"
          :disabled="!selectedSource"
          :title="selectedSource ? `添加单词到 ${selectedSource}` : '请先选择词本'"
          @click="handleAddWord"
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
          </svg>
          <span class="course-add-btn-label">添加</span>
        </button>

        <CourseSourceSelector />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted, onBeforeUnmount } from 'vue'
import type { Component, ComputedRef } from 'vue'
import { inject } from 'vue'
import { useRouter } from 'vue-router'
import CourseSourceSelector from './CourseSourceSelector.vue'
import type { CourseConfig } from '../../types/course'
import { getLessonsByCourse } from '../../data/lessons'
import { useCourseSource } from '../../composables/useCourseSource'
import { useWordEditorStore } from '@/features/vocabulary/stores/wordEditor'

const props = defineProps<{
  config: CourseConfig
  lessonId?: string
}>()

const router = useRouter()

const { selectedSource } = useCourseSource(props.config)
const wordEditorStore = useWordEditorStore()

function handleAddWord() {
  if (!selectedSource.value) return
  wordEditorStore.openForCreate({
    source: selectedSource.value,
    lang: props.config.lang,
  })
}

const lessonTitleRef = inject<ComputedRef<string>>('lessonTitle')
const lessonTitle = computed(() => lessonTitleRef?.value || '')

// 返回"课程目录"tab：写入 localStorage，HomePage 挂载时会读取并显示对应课程 index
function returnToCourseIndex() {
  const tabId = props.config.id === 'legal-english' ? 'course-legal' : 'course-uk'
  localStorage.setItem('activeTab', tabId)
  router.push('/')
}

const { lessons } = getLessonsByCourse(props.config.id)

const currentIndex = computed(() =>
  props.lessonId ? lessons.findIndex(l => l.id === props.lessonId) : -1
)

const lessonMeta = computed(() =>
  currentIndex.value >= 0 ? lessons[currentIndex.value] : null
)

const prevLesson = computed(() =>
  currentIndex.value > 0 ? lessons[currentIndex.value - 1] : null
)

const nextLesson = computed(() =>
  currentIndex.value >= 0 && currentIndex.value < lessons.length - 1
    ? lessons[currentIndex.value + 1]
    : null
)

// 品牌
const brandTitle = computed(() => {
  if (props.config.id === 'ukrainian') return 'Ukrainian'
  if (props.config.id === 'legal-english') return 'Legal English'
  return props.config.name
})

const brandSubtitle = computed(() => {
  if (props.config.id === 'ukrainian') return '乌克兰语 · Мова'
  if (props.config.id === 'legal-english') return '法律英语 · Contracts'
  return ''
})

// 课程徽标
const BadgeUK: Component = () =>
  h('svg', { viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': 'true' }, [
    h('path', {
      d: 'M3 3h14v6H3zM3 11h14v6H3z',
      stroke: 'currentColor',
      'stroke-width': '1.5',
      fill: 'var(--course-accent-soft-strong)'
    })
  ])

const BadgeLegal: Component = () =>
  h('svg', { viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': 'true' }, [
    h('path', {
      d: 'M10 3v14M4 7h12M6 7v8M14 7v8M3 17h14',
      stroke: 'currentColor',
      'stroke-width': '1.5',
      'stroke-linecap': 'round'
    })
  ])

const badgeIcon = computed(() =>
  props.config.id === 'legal-english' ? BadgeLegal : BadgeUK
)

// 滚动状态
const scrolled = ref(false)
const progress = ref(0)

function onScroll() {
  const y = window.scrollY
  scrolled.value = y > 8

  if (props.lessonId) {
    const h = document.documentElement
    const scrollable = h.scrollHeight - h.clientHeight
    progress.value = scrollable > 0 ? Math.min(1, y / scrollable) : 0
  }
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<style scoped>
.course-topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--course-topbar-bg);
  backdrop-filter: saturate(1.3) blur(14px);
  -webkit-backdrop-filter: saturate(1.3) blur(14px);
  border-bottom: 1px solid transparent;
  transition: border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
}

.course-topbar.scrolled {
  border-bottom-color: var(--color-border-light);
  box-shadow: 0 8px 24px -20px rgba(15, 23, 42, 0.35);
}

.course-topbar-progress {
  position: absolute;
  left: 0;
  bottom: -1px;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, var(--course-accent), var(--course-accent-glow));
  transform-origin: left center;
  transform: scaleX(0);
  transition: transform 0.08s linear;
  pointer-events: none;
}

.course-topbar-inner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  max-width: 1180px;
  margin: 0 auto;
  padding: 12px 28px;
}

/* ── 左区 ── */
.course-topbar-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.course-topbar-home {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  color: var(--color-text-secondary);
  background: transparent;
  text-decoration: none;
  transition: background 0.16s ease, color 0.16s ease;
  flex-shrink: 0;
}

.course-topbar-home:hover {
  background: var(--course-accent-soft);
  color: var(--course-accent-strong);
}

.course-topbar-home svg { width: 14px; height: 14px; }

.course-topbar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.course-topbar-badge {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--course-accent);
  color: var(--course-accent-on);
  box-shadow: 0 2px 8px -2px var(--course-accent-shadow);
  flex-shrink: 0;
}

.course-topbar-badge :deep(svg) { width: 17px; height: 17px; }

.course-topbar-brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.05;
  text-decoration: none;
  min-width: 0;
}

.course-topbar-brand-name {
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.005em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.course-topbar-brand-sub {
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  margin-top: 4px;
  white-space: nowrap;
}

/* ── 中区：面包屑 ── */
.course-topbar-crumbs {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-family: var(--font-serif);
  font-size: 13.5px;
  color: var(--color-text-secondary);
  min-width: 0;
  justify-content: center;
}

.course-crumb-link {
  color: var(--color-text-tertiary);
  text-decoration: none;
  font-style: italic;
  transition: color 0.15s ease;
  white-space: nowrap;
}

.course-crumb-link:hover { color: var(--course-accent-strong); }

.course-crumb-sep {
  color: var(--color-text-tertiary);
  opacity: 0.55;
}

.course-crumb-current {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.course-crumb-week {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.05em;
  color: var(--course-accent-strong);
  background: var(--course-accent-soft);
  padding: 2px 7px;
  border-radius: 999px;
  line-height: 1.5;
  flex-shrink: 0;
}

.course-crumb-title {
  color: var(--color-text-primary);
  font-weight: 500;
  font-style: normal;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* ── 右区 ── */
.course-topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
  min-width: 0;
}

.course-topbar-paging {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--course-surface-chip);
  border: 1px solid var(--course-chip-border);
  border-radius: 999px;
}

.course-page-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  color: var(--color-text-secondary);
  background: transparent;
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}

.course-page-btn:hover:not(.course-page-btn-disabled) {
  background: var(--course-accent);
  color: var(--course-accent-on);
}

.course-page-btn svg { width: 13px; height: 13px; }

.course-page-btn-disabled {
  color: var(--color-text-tertiary);
  opacity: 0.35;
  cursor: not-allowed;
}

.course-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--course-chip-border);
  background: var(--course-surface-chip);
  color: var(--color-text-secondary);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.course-add-btn:hover:not(:disabled) {
  background: var(--course-accent);
  color: var(--course-accent-on);
  border-color: var(--course-accent);
}

.course-add-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.course-add-btn svg {
  width: 12px;
  height: 12px;
}

/* ── 响应式 ── */
@media (max-width: 960px) {
  .course-topbar-inner {
    grid-template-columns: auto 1fr auto;
    padding: 10px 18px;
    gap: 12px;
  }

  .course-topbar-crumbs { font-size: 12.5px; }
  .course-crumb-link { display: none; }
  .course-crumb-sep { display: none; }
  .course-crumb-week { font-size: 10px; }
}

@media (max-width: 768px) {
  .course-topbar-inner {
    grid-template-columns: auto auto;
    gap: 10px;
    padding: 9px 14px;
  }

  .course-topbar-home { width: 28px; height: 28px; border-radius: 8px; }
  .course-topbar-badge { width: 30px; height: 30px; border-radius: 8px; }
  .course-topbar-brand-name { font-size: 15.5px; }
  .course-topbar-brand-sub { font-size: 9.5px; letter-spacing: 0.12em; }

  /* 移动端：面包屑下行显示 */
  .course-topbar-crumbs {
    grid-column: 1 / -1;
    justify-content: flex-start;
    font-size: 12px;
    padding-top: 2px;
    border-top: 1px dashed var(--color-border-light);
    padding: 8px 0 2px;
  }

  .course-crumb-link,
  .course-crumb-sep { display: inline; }

  .course-topbar-right { gap: 8px; }

  .course-topbar-paging { display: none; }

  .course-add-btn { padding: 0 8px; }
  .course-add-btn-label { display: none; }
}
</style>

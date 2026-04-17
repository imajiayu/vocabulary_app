<template>
  <div class="course-lesson-page" :data-course="config.theme">
    <CourseTopBar :config="config" :lesson-id="lessonId" />

    <!-- 加载中 -->
    <div v-if="loading" class="course-state course-state-loading">
      <div class="course-state-spinner" aria-hidden="true" />
      <p>加载中…</p>
    </div>

    <!-- 错误 -->
    <div v-else-if="error" class="course-state course-state-error">
      <h2>课时加载失败</h2>
      <p>{{ error }}</p>
      <a href="/" class="course-state-link" @click.prevent="returnToCourseIndex">← 返回目录</a>
    </div>

    <!-- 课时内容 -->
    <LessonRenderer
      v-else-if="lesson"
      :lesson="lesson"
      :config="config"
      :lesson-id="lessonId"
    />

    <!-- 底部翻页栏 -->
    <footer v-if="lesson" class="course-lesson-foot">
      <router-link
        v-if="prevLesson"
        :to="`${config.basePath}/${prevLesson.id}`"
        class="course-lesson-foot-link"
      >
        <span class="course-lesson-foot-arrow">←</span>
        <span class="course-lesson-foot-meta">
          <span class="course-lesson-foot-kicker">上一课 · D{{ prevLesson.day }}</span>
          <span class="course-lesson-foot-title">{{ prevLesson.title }}</span>
        </span>
      </router-link>
      <span v-else />

      <router-link
        v-if="nextLesson"
        :to="`${config.basePath}/${nextLesson.id}`"
        class="course-lesson-foot-link right"
      >
        <span class="course-lesson-foot-meta">
          <span class="course-lesson-foot-kicker">下一课 · D{{ nextLesson.day }}</span>
          <span class="course-lesson-foot-title">{{ nextLesson.title }}</span>
        </span>
        <span class="course-lesson-foot-arrow">→</span>
      </router-link>
      <span v-else />
    </footer>

    <!-- 交互组件 -->
    <WordEditorModal v-if="lesson" />
    <CourseChat v-if="lesson" />
  </div>
</template>

<script setup lang="ts">
import { computed, provide, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useLessonData } from '@/features/courses/composables/useLessonData'
import { useCourseConfig } from '@/features/courses/composables/useCourseConfig'
import { useCourseSource } from '@/features/courses/composables/useCourseSource'
import { checkCourseAccess } from '@/features/courses/composables/useCourseAccess'
import { useToast } from '@/shared/composables/useToast'
import { getLessonsByCourse } from '@/features/courses/data/lessons'
import LessonRenderer from '@/features/courses/components/LessonRenderer.vue'
import WordEditorModal from '@/features/vocabulary/editor/WordEditorModal.vue'
import CourseChat from '@/features/courses/components/interactions/CourseChat.vue'
import CourseTopBar from '@/features/courses/components/navigation/CourseTopBar.vue'
import { useWordEditorStore } from '@/features/vocabulary/stores/wordEditor'

import '@/features/courses/styles/course.css'
import '@/features/courses/styles/course-themes.css'

const props = defineProps<{
  courseId: string
  lessonId: string
}>()

const router = useRouter()
const { config } = useCourseConfig(props.courseId)
const { lesson, loading, error } = useLessonData(props.courseId, props.lessonId)
const { lessons } = getLessonsByCourse(props.courseId)
const { selectedSource, loadSources } = useCourseSource(config.value)
const wordEditorStore = useWordEditorStore()
const toast = useToast()

// 全局点击单词/术语 → 用 WordEditorModal 替代旧 popover
const PUNCT_RE = /[.,!?;:…—–\-"«»()"。，！？：；]/g
function handleWordClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (!target) return
  const wordEl = target.closest(
    `.${config.value.wordClass}, .tts-word`
  ) as HTMLElement | null
  if (!wordEl) return

  e.stopPropagation()
  // quiz 选项 <label> 内点词，阻止默认行为防止误选 radio
  if (wordEl.closest('label')) e.preventDefault()

  const text = (wordEl.textContent || '').replace(PUNCT_RE, '').trim()
  if (!text) return
  if (!selectedSource.value) return

  const def = wordEl.getAttribute('data-def') || undefined
  wordEditorStore.openForCourse(text, def, {
    source: selectedSource.value,
    lang: config.value.lang,
  })
}

onMounted(async () => {
  // URL 直接进入课时页：检查准入，无对应语言 source 则跳回主页
  const access = await checkCourseAccess(config.value)
  if (!access.allowed) {
    toast.warning(access.reason || '无法进入该课程')
    router.push('/')
    return
  }
  loadSources()
  document.addEventListener('click', handleWordClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleWordClick)
})

// 错误态的"返回目录"：写入 activeTab 后跳 `/`，HomePage 恢复为对应课程 tab
function returnToCourseIndex() {
  const tabId = props.courseId === 'legal-english' ? 'course-legal' : 'course-uk'
  localStorage.setItem('activeTab', tabId)
  router.push('/')
}

const currentIndex = computed(() => lessons.findIndex(l => l.id === props.lessonId))
const prevLesson = computed(() =>
  currentIndex.value > 0 ? lessons[currentIndex.value - 1] : null
)
const nextLesson = computed(() =>
  currentIndex.value >= 0 && currentIndex.value < lessons.length - 1
    ? lessons[currentIndex.value + 1]
    : null
)

// Provide 给兄弟组件 WordEditorModal / CourseChat / CourseTopBar
// 标题可能包含 HTML 标签（如 <span class="term">），面包屑/AI 提示词只需要纯文本
provide('courseConfig', config.value)
provide('lessonTitle', computed(() => {
  const raw = lesson.value?.title || ''
  if (!raw) return ''
  const tmp = document.createElement('div')
  tmp.innerHTML = raw
  return tmp.textContent || ''
}))
</script>

<style scoped>
.course-lesson-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-surface-page);
}

/* ── 状态视图 ── */
.course-state {
  max-width: 640px;
  margin: 0 auto;
  padding: 100px 24px;
  text-align: center;
  color: var(--color-text-secondary);
  font-family: var(--font-serif);
}

.course-state-loading { font-style: italic; }

.course-state-spinner {
  width: 28px;
  height: 28px;
  margin: 0 auto 18px;
  border-radius: 50%;
  border: 2px solid var(--color-border-light);
  border-top-color: var(--course-accent);
  animation: course-state-spin 0.9s linear infinite;
}

@keyframes course-state-spin { to { transform: rotate(360deg); } }

.course-state-error h2 {
  font-size: 22px;
  color: var(--color-text-primary);
  margin-bottom: 12px;
  font-weight: 500;
}

.course-state-link {
  display: inline-block;
  margin-top: 20px;
  color: var(--course-accent);
  text-decoration: none;
  font-style: italic;
  padding-bottom: 2px;
  border-bottom: 1px solid var(--course-accent-soft-strong);
  transition: border-color 0.15s ease;
}

.course-state-link:hover { border-bottom-color: var(--course-accent); }

/* ── 底部翻页栏 ── */
.course-lesson-foot {
  max-width: 860px;
  margin: 16px auto 64px;
  padding: 0 28px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.course-lesson-foot-link {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 22px;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--color-text-primary);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.course-lesson-foot-link.right {
  flex-direction: row-reverse;
  text-align: right;
}

.course-lesson-foot-link:hover {
  border-color: var(--course-accent);
  box-shadow: 0 8px 24px -14px var(--course-accent-shadow);
  transform: translateY(-2px);
}

.course-lesson-foot-arrow {
  font-family: var(--font-serif);
  font-size: 22px;
  color: var(--course-accent);
  line-height: 1;
  flex-shrink: 0;
}

.course-lesson-foot-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.course-lesson-foot-kicker {
  font-size: 10.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
}

.course-lesson-foot-title {
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.35;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .course-lesson-foot {
    grid-template-columns: 1fr;
    padding: 0 16px;
    margin: 8px auto 80px;
  }

  .course-lesson-foot-link { padding: 14px 16px; }
  .course-lesson-foot-link.right { flex-direction: row; text-align: left; }
}
</style>

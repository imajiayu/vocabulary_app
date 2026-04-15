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
      <router-link :to="config.basePath + '/'" class="course-state-link">← 返回目录</router-link>
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
    <WordPopover v-if="lesson" />
    <CourseChat v-if="lesson" />
  </div>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue'
import { useLessonData } from '@/features/courses/composables/useLessonData'
import { useCourseConfig } from '@/features/courses/composables/useCourseConfig'
import { getLessonsByCourse } from '@/features/courses/data/lessons'
import LessonRenderer from '@/features/courses/components/LessonRenderer.vue'
import WordPopover from '@/features/courses/components/interactions/WordPopover.vue'
import CourseChat from '@/features/courses/components/interactions/CourseChat.vue'
import CourseTopBar from '@/features/courses/components/navigation/CourseTopBar.vue'

import '@/features/courses/styles/course.css'
import '@/features/courses/styles/course-themes.css'

const props = defineProps<{
  courseId: string
  lessonId: string
}>()

const { config } = useCourseConfig(props.courseId)
const { lesson, loading, error } = useLessonData(props.courseId, props.lessonId)
const { lessons } = getLessonsByCourse(props.courseId)

const currentIndex = computed(() => lessons.findIndex(l => l.id === props.lessonId))
const prevLesson = computed(() =>
  currentIndex.value > 0 ? lessons[currentIndex.value - 1] : null
)
const nextLesson = computed(() =>
  currentIndex.value >= 0 && currentIndex.value < lessons.length - 1
    ? lessons[currentIndex.value + 1]
    : null
)

// Provide 给兄弟组件 WordPopover / CourseChat / CourseTopBar
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

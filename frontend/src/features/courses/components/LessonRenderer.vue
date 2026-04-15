<template>
  <article class="course-content" :data-course="config.theme">
    <h1 v-html="wrap(lesson.title)" />

    <div v-if="lesson.objective" class="course-objective">
      <strong>学习目标：</strong><span v-html="wrap(lesson.objective)" />
    </div>

    <template v-for="(section, i) in lesson.sections" :key="i">
      <VocabPreloadSection
        v-if="section.type === 'vocab-preload'"
        :section="section"
      />
      <VocabTableSection
        v-else-if="section.type === 'vocab-table'"
        :section="section"
      />
      <GrammarSection
        v-else-if="section.type === 'grammar'"
        :section="section"
      />
      <ExamplesSection
        v-else-if="section.type === 'examples'"
        :section="section"
      />
      <ExercisesSection
        v-else-if="section.type === 'exercises'"
        :section="section"
      />
      <SummarySection
        v-else-if="section.type === 'summary'"
        :section="section"
      />
      <SentenceAnalysisSection
        v-else-if="section.type === 'sentence-analysis'"
        :section="section"
      />
    </template>
  </article>
</template>

<script setup lang="ts">
import { provide } from 'vue'
import type { Lesson } from '../types/lesson'
import type { CourseConfig } from '../types/course'
import VocabPreloadSection from './sections/VocabPreloadSection.vue'
import VocabTableSection from './sections/VocabTableSection.vue'
import GrammarSection from './sections/GrammarSection.vue'
import ExamplesSection from './sections/ExamplesSection.vue'
import ExercisesSection from './sections/ExercisesSection.vue'
import SummarySection from './sections/SummarySection.vue'
import SentenceAnalysisSection from './sections/SentenceAnalysisSection.vue'
import { useExerciseState } from '../composables/useExerciseState'
import { autoWrapWords } from '../utils/autoWrapWords'

const props = defineProps<{
  lesson: Lesson
  config: CourseConfig
  lessonId: string
}>()

// Provide 课程配置给子组件
provide('courseConfig', props.config)
provide('courseWordClass', props.config.wordClass)
provide('courseTextClass', props.config.textClass)

// 本组件自身不能 inject 自己 provide 的值，直接用 props 包一层；
// 用轻样式 tts-word（见 useCourseHtml）
const wrap = (html: string | undefined | null) =>
  autoWrapWords(html, 'tts-word', props.config.lang === 'en' ? 'en' : 'uk')

// 练习状态（如有 exercises section 才创建）
const hasExercises = props.lesson.sections.some(s => s.type === 'exercises')
if (hasExercises) {
  const { state } = useExerciseState({
    courseId: props.config.id,
    lessonId: props.lessonId,
    basePath: props.config.basePath
  })
  provide('exerciseState', state)
}
</script>

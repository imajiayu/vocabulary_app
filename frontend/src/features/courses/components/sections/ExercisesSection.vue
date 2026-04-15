<template>
  <section>
    <h2 v-if="section.heading" v-html="wrap(section.heading)" />
    <template v-for="(group, gi) in section.groups" :key="gi">
      <QuizExercise
        v-if="group.style === 'quiz'"
        :group="group"
        :group-index="gi"
      />
      <FillBlankExercise
        v-else-if="group.style === 'fill-blank'"
        :group="group"
        :group-index="gi"
      />
      <TranslationExercise
        v-else-if="group.style === 'translation'"
        :group="group"
        :group-index="gi"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import type { ExercisesSection } from '../../types/lesson'
import QuizExercise from '../exercises/QuizExercise.vue'
import FillBlankExercise from '../exercises/FillBlankExercise.vue'
import TranslationExercise from '../exercises/TranslationExercise.vue'
import { useCourseHtml } from '../../composables/useCourseHtml'

defineProps<{
  section: ExercisesSection
}>()

const { wrap } = useCourseHtml()
</script>

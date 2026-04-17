<template>
  <section>
    <h2 v-if="section.heading" v-html="wrap(section.heading)" />
    <BlockRenderer
      v-for="(blk, bi) in section.blocks || []"
      :key="`blk-${bi}`"
      :block="blk"
    />
    <template v-for="(group, gi) in section.groups" :key="gi">
      <QuizExercise
        v-if="group.style === 'quiz'"
        :group="group"
        :group-index="uniqueGroupIndex(gi)"
      />
      <FillBlankExercise
        v-else-if="group.style === 'fill-blank'"
        :group="group"
        :group-index="uniqueGroupIndex(gi)"
      />
      <TranslationExercise
        v-else-if="group.style === 'translation'"
        :group="group"
        :group-index="uniqueGroupIndex(gi)"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import type { ExercisesSection } from '../../types/lesson'
import QuizExercise from '../exercises/QuizExercise.vue'
import FillBlankExercise from '../exercises/FillBlankExercise.vue'
import TranslationExercise from '../exercises/TranslationExercise.vue'
import BlockRenderer from '../blocks/BlockRenderer.vue'
import { useCourseHtml } from '../../composables/useCourseHtml'

const props = defineProps<{
  section: ExercisesSection
  /** lesson 内的 section 序号，用于在多个 exercises 段间生成唯一 groupIndex */
  sectionIndex?: number
}>()

const { wrap } = useCourseHtml()

function uniqueGroupIndex(gi: number): number {
  const si = props.sectionIndex ?? 0
  return si * 1000 + gi
}
</script>

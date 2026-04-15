<template>
  <section>
    <h2 v-if="section.heading" v-html="wrap(section.heading)" />
    <BlockRenderer
      v-for="(block, i) in section.blocks"
      :key="i"
      :block="block"
    />
  </section>
</template>

<script setup lang="ts">
import type { GrammarSection } from '../../types/lesson'
import BlockRenderer from '../blocks/BlockRenderer.vue'
import { useCourseHtml } from '../../composables/useCourseHtml'

defineProps<{
  section: GrammarSection
}>()

const { wrap } = useCourseHtml()
</script>

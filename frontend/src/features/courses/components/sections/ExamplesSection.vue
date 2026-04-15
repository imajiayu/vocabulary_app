<template>
  <section>
    <h2 v-if="section.heading" v-html="wrap(section.heading)" />
    <p v-if="section.intro" v-html="wrap(section.intro)" />

    <template v-for="(group, gi) in section.groups" :key="gi">
      <h3 v-if="group.heading" v-html="wrap(group.heading)" />
      <p
        v-for="(item, i) in group.items"
        :key="`${gi}-${i}`"
        class="course-example"
      >
        {{ gi > 0 || section.groups.length === 1 ? i + 1 : '' }}{{ gi > 0 || section.groups.length === 1 ? '. ' : '' }}
        <span :class="textClass" v-html="wrap(item.text)" />
        {{ ' ' }}
        <span class="translation">&mdash; {{ item.translation }}</span>
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import type { ExamplesSection } from '../../types/lesson'
import { useCourseHtml } from '../../composables/useCourseHtml'

defineProps<{
  section: ExamplesSection
}>()

const textClass = inject<string>('courseTextClass', 'uk-text')
const { wrap } = useCourseHtml()
</script>

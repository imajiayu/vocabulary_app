<template>
  <section>
    <h2 v-if="section.heading" v-html="wrap(section.heading)" />
    <div
      v-for="(item, i) in section.items"
      :key="i"
      class="course-sentence-analysis"
    >
      <h3>{{ item.title || `长难句 ${i + 1}` }}</h3>
      <blockquote v-if="item.sentence">
        <span :class="textClass" v-html="wrap(item.sentence)" />
      </blockquote>
      <ul v-if="item.structure" class="structure">
        <li v-for="(s, si) in item.structure" :key="si" v-html="wrap(s)" />
      </ul>
      <div v-if="item.translation" class="full-translation">
        <strong>翻译：</strong><span v-html="wrap(item.translation)" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import type { SentenceAnalysisSection } from '../../types/lesson'
import { useCourseHtml } from '../../composables/useCourseHtml'

defineProps<{
  section: SentenceAnalysisSection
}>()

const textClass = inject<string>('courseTextClass', 'uk-text')
const { wrap } = useCourseHtml()
</script>

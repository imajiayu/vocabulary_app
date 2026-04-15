<template>
  <section>
    <h2 v-if="section.heading" v-html="wrap(section.heading)" />
    <div class="course-summary-box">
      <template v-if="section.html">
        <div v-html="wrap(section.html)" />
      </template>
      <template v-else>
        <ol v-if="section.points">
          <li v-for="(pt, i) in section.points" :key="i" v-html="wrap(pt)" />
        </ol>
        <p v-if="section.next">
          <strong>下节预告：</strong><span v-html="wrap(section.next)" />
        </p>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { SummarySection } from '../../types/lesson'
import { useCourseHtml } from '../../composables/useCourseHtml'

defineProps<{
  section: SummarySection
}>()

const { wrap } = useCourseHtml()
</script>

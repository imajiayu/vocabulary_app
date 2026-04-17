<template>
  <section>
    <h2 v-if="section.heading" v-html="wrap(section.heading)" />
    <p v-if="section.intro" v-html="wrap(section.intro)" />
    <table>
      <thead>
        <tr>
          <th v-for="(col, i) in section.columns" :key="i" v-html="wrap(col)" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, ri) in section.rows" :key="ri">
          <td
            v-for="(cell, ci) in row"
            :key="ci"
            v-html="wrap(cell)"
          />
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup lang="ts">
import type { VocabTableSection } from '../../types/lesson'
import { useCourseHtml } from '../../composables/useCourseHtml'

defineProps<{
  section: VocabTableSection
}>()

const { wrap } = useCourseHtml()
</script>

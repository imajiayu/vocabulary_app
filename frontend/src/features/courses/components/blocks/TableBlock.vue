<template>
  <table>
    <thead v-if="block.headers">
      <tr>
        <th v-for="(h, i) in block.headers" :key="i" v-html="wrap(h)" />
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, ri) in block.rows" :key="ri">
        <td
          v-for="(cell, ci) in row"
          :key="ci"
          v-html="wrap(cell)"
        />
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import type { TableBlock } from '../../types/lesson'
import { useCourseHtml } from '../../composables/useCourseHtml'

defineProps<{
  block: TableBlock
}>()

const { wrap } = useCourseHtml()
</script>

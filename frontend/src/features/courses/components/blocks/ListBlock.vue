<template>
  <component :is="block.type">
    <li v-for="(item, i) in block.items" :key="i" v-html="wrap(item)" />
  </component>
</template>

<script setup lang="ts">
import type { ListBlock } from '../../types/lesson'
import { useCourseHtml } from '../../composables/useCourseHtml'

defineProps<{
  block: ListBlock
}>()

const { wrap } = useCourseHtml()
</script>

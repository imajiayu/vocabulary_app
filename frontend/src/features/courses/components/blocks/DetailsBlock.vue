<template>
  <details>
    <summary>{{ block.summary || '查看答案' }}</summary>
    <div class="answer-content" v-html="wrap(block.html)" />
  </details>
</template>

<script setup lang="ts">
import type { DetailsBlock } from '../../types/lesson'
import { useCourseHtml } from '../../composables/useCourseHtml'

defineProps<{
  block: DetailsBlock
}>()

const { wrap } = useCourseHtml()
</script>

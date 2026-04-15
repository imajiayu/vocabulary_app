<template>
  <p v-if="block.type === 'p'" v-html="wrapped" />
  <h3 v-else-if="block.type === 'h3'" v-html="wrapped" />
  <h4 v-else-if="block.type === 'h4'" v-html="wrapped" />
  <div v-else-if="block.type === 'tip'" class="course-tip" v-html="wrapped" />
  <div v-else-if="block.type === 'note'" class="course-note" v-html="wrapped" />
  <div v-else-if="block.type === 'error-warn'" class="course-error-warn" v-html="wrapped" />
  <div v-else-if="block.type === 'grammar-box'" class="course-grammar-box" v-html="wrapped" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ContentBlock } from '../../types/lesson'
import { useCourseHtml } from '../../composables/useCourseHtml'

const props = defineProps<{
  block: ContentBlock
}>()

const { wrap } = useCourseHtml()

const wrapped = computed(() => {
  const raw = ('html' in props.block && props.block.html)
    || ('text' in props.block && props.block.text)
    || ''
  return wrap(raw)
})
</script>

<template>
  <ContentBlock
    v-if="isContentBlock"
    :block="(block as ContentBlockType)"
  />
  <ListBlock
    v-else-if="block.type === 'ul' || block.type === 'ol'"
    :block="(block as ListBlockType)"
  />
  <TableBlock
    v-else-if="block.type === 'table'"
    :block="(block as TableBlockType)"
  />
  <DetailsBlock
    v-else-if="block.type === 'details'"
    :block="(block as DetailsBlockType)"
  />
  <p v-else v-html="wrap(fallbackContent)" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type {
  Block,
  ContentBlock as ContentBlockType,
  ListBlock as ListBlockType,
  TableBlock as TableBlockType,
  DetailsBlock as DetailsBlockType
} from '../../types/lesson'
import ContentBlock from './ContentBlock.vue'
import ListBlock from './ListBlock.vue'
import TableBlock from './TableBlock.vue'
import DetailsBlock from './DetailsBlock.vue'
import { useCourseHtml } from '../../composables/useCourseHtml'

const { wrap } = useCourseHtml()

const CONTENT_TYPES = new Set(['p', 'h3', 'h4', 'tip', 'note', 'error-warn', 'grammar-box'])

const props = defineProps<{
  block: Block
}>()

const isContentBlock = computed(() => CONTENT_TYPES.has(props.block.type))

const fallbackContent = computed(() => {
  const b = props.block as unknown as Record<string, unknown>
  return (b.html as string) || (b.text as string) || ''
})
</script>

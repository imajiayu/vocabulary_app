<template>
  <table>
    <thead v-if="block.headers">
      <tr>
        <th v-for="(h, i) in block.headers" :key="i" v-html="wrap(h)" />
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, ri) in block.rows" :key="ri">
        <td v-for="(cell, ci) in row" :key="ci">
          <template v-if="isBilingual(cell)">
            <div class="bi-en" v-html="wrap(cell.en)" />
            <div class="bi-zh" v-html="wrap(cell.zh)" />
          </template>
          <span v-else v-html="wrap(cell as string)" />
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import type { TableBlock, TableCell, BilingualCell } from '../../types/lesson'
import { useCourseHtml } from '../../composables/useCourseHtml'

defineProps<{
  block: TableBlock
}>()

const { wrap } = useCourseHtml()

function isBilingual(cell: TableCell): cell is BilingualCell {
  return typeof cell === 'object' && cell !== null && 'en' in cell && 'zh' in cell
}
</script>

<style scoped>
/* 字体、字号继承 .course-content table（Inter 14px），与表格其他 cell 保持一致 */
.bi-en {
  line-height: 1.55;
  color: var(--color-text-primary);
}

.bi-zh {
  margin-top: 4px;
  font-size: 0.92em;
  color: var(--color-text-secondary);
  line-height: 1.5;
}
</style>

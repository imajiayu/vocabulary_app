<template>
  <div class="word-info">
    <WordDetailsDisplay v-if="!isEditing" :word="props.editData" />
    <WordDetailsEdit v-else :edit-data="props.editData" @update:edit-data="onUpdateEditData" />
  </div>
</template>

<script setup lang="ts">
import WordDetailsDisplay from './WordDetailsDisplay.vue';
import WordDetailsEdit from './WordDetailsEdit.vue';
import type { Word } from '@/shared/types';

interface Props {
  editData?: Word;
  isEditing: boolean;
}

const props = defineProps<Props>();

// 声明一个 emit 事件，用于将数据传递给 WordInfoSection.vue 的父组件
const emit = defineEmits(['update:editData']);

// 当 WordDetailsEdit.vue 触发 update:editData 事件时，这个函数会被调用
const onUpdateEditData = (updatedData: Word) => {
  // 再次触发 update:editData 事件，将新数据传递给上层父组件
  emit('update:editData', updatedData);
};
</script>

<style scoped>
.word-info {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-width: 0;
  width: 100%;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .word-info {
    gap: 1rem;
  }
}

@media (max-width: 480px) {
  .word-info {
    gap: 0.75rem;
  }
}
</style>
<template>
  <div class="word-info">
    <WordDetailsDisplay v-if="!isEditing" :word="props.editData" />
    <WordDetailsEdit v-else :edit-data="props.editData" @update:edit-data="onUpdateEditData" />

    <!-- 关联词面板（仅在非编辑模式且有关联词时显示） -->
    <RelatedWordsPanel
      v-if="!isEditing && relatedWords.length > 0"
      :related-words="relatedWords"
      class="related-words-section"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import WordDetailsDisplay from './WordDetailsDisplay.vue';
import WordDetailsEdit from './WordDetailsEdit.vue';
import RelatedWordsPanel from '../relations/RelatedWordsPanel.vue';
import { useWordEditorStore } from '../stores/wordEditor';
import type { Word } from '@/shared/types';

interface Props {
  editData?: Word;
  isEditing: boolean;
}

const props = defineProps<Props>();

// 获取 store 中的关联词
const store = useWordEditorStore();
const { relatedWords } = storeToRefs(store);

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

.related-words-section {
  margin-top: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border-light);
}

/* 移动端优化 */
@media (max-width: 768px) {
  .word-info {
    gap: 1rem;
  }

  .related-words-section {
    margin-top: 0.25rem;
    padding-top: 0.75rem;
  }
}
</style>
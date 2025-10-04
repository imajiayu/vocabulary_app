<template>
  <div class="actions-sidebar">
    <div class="status-section">
      <div class="status-row">
        <span class="status-label">学习状态</span>
        <span :class="['status-badge', isRemembered ? 'status-remembered' : 'status-learning']">
          {{ isRemembered ? '已掌握' : '学习中' }}
        </span>
      </div>
      <div class="status-row">
        <span class="status-label">难度系数</span>
        <span class="status-value">{{ word?.ease_factor.toFixed(2) }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">添加时间</span>
        <span class="status-value">{{ word?.date_added }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">连续正确</span>
        <span class="status-value">{{ word?.repetition }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">复习间隔</span>
        <span class="status-value">{{ word?.interval }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">下次复习</span>
        <span class="status-value">{{ word?.next_review }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">拼写强度</span>
        <span class="status-value">{{ word?.spell_strength !== null && word?.spell_strength !== undefined ? word.spell_strength.toFixed(2) : '-' }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">下次拼写</span>
        <span class="status-value">{{ word?.spell_next_review }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">单词来源</span>
        <span class="status-value">{{ word?.source }}</span>
      </div>
    </div>

    <div class="normal-actions">
      <template v-if="isEditing">
        <button @click="saveUpdate" class="action-btn save-btn">保存</button>
        <button @click="$emit('cancelEdit')" class="action-btn cancel-btn">取消</button>
      </template>

      <template v-else>
        <button @click="toggleReview" :class="['action-btn', isRemembered ? 'restore-btn' : 'master-btn']">
          {{ isRemembered ? '恢复复习' : '标记掌握' }}
        </button>
        <button @click="resetProgress" :disabled="isForgetButtonUsed" class="action-btn reset-btn">
          {{ isForgetButtonUsed ? '已设为忘记' : '设为忘记' }}
        </button>
        <button @click="$emit('update:isEditing', true)" class="action-btn edit-btn">编辑单词</button>
        <button @click="deleteWord" class="action-btn delete-btn">删除单词</button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Word } from '@/shared/types';
import { api } from '@/shared/api';

interface Props {
  word?: Word;
  isEditing: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  cancelEdit: [];
  wordDeleted: [wordId: number];
  'update:isEditing': [value: boolean];
  wordUpdated: [updatedWord: Word];
  wordForgot: [wordId: number];
}>();

// Single state for forget button - gets disabled after one click
const isForgetButtonUsed = ref(false);

// Store the original word text when editing begins
const originalWordText = ref<string>('');

// Watch for editing state changes to store original word text
watch(() => props.isEditing, (isEditing) => {
  if (isEditing && props.word) {
    originalWordText.value = props.word.word;
  }
}, { immediate: true });

// computed 属性直接使用 props.word，不再需要本地状态
const isRemembered = computed(() => {
  return props.word ? props.word.stop_review : false;
});

const toggleReview = async () => {
  if (!props.word) return;

  const newStatus = !isRemembered.value;

  try {
    const updatedWord = await api.words.updateWord(props.word.id, {
      stop_review: newStatus
    });
    // 直接将更新后的数据发送给父组件
    emit('wordUpdated', updatedWord);
  } catch (error) {
    console.error('Error toggling review:', error);
  }
};

const resetProgress = async () => {
  if (!props.word || isForgetButtonUsed.value) return;

  // Mark button as used immediately when clicked
  isForgetButtonUsed.value = true;

  // 使用本地时间计算明天的日期，避免时区转换问题
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 格式化为 YYYY-MM-DD 格式，基于本地时间
  const nextReview = tomorrow.getFullYear() + '-' +
    String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' +
    String(tomorrow.getDate()).padStart(2, '0');

  try {
    const updatedWord = await api.words.updateWord(props.word.id, {
      repetition: 0,
      interval: 1,
      next_review: nextReview,
      ease_factor: parseFloat(Math.max(1.3, props.word.ease_factor - 0.4).toFixed(2)),
      lapse: 3
    });
    // 直接将更新后的数据发送给父组件
    emit('wordUpdated', updatedWord);
    // 通知父组件单词被设为忘记
    emit('wordForgot', updatedWord.id);
  } catch (error) {
    console.error('Error resetting progress:', error);
  }
};

const deleteWord = async () => {
  if (!props.word) return;

  if (!confirm('确定要删除这个单词吗？')) {
    return;
  }

  try {
    await api.words.deleteWord(props.word.id);
    emit('wordDeleted', props.word.id);
  } catch (error) {
    console.error('Error deleting word:', error);
  }
};

const saveUpdate = async() => {
  if (!props.word) return;

  try {
    // 在API调用前保存当前的word值，因为emit可能会改变props
    const currentWordText = props.word.word;
    const currentDefinition = props.word.definition;

    const updatedWord = await api.words.updateWord(props.word.id, {
      word: currentWordText,
      definition: JSON.stringify(currentDefinition)
    });

    // 检查单词文本是否变化了
    const isWordChanged = originalWordText.value !== currentWordText;

    emit('update:isEditing', false);

    if (isWordChanged) {
      // 如果文本改变了，只更新word文本，保持当前definition，等待WebSocket更新definition
      const wordWithCurrentDefinition = { ...updatedWord, definition: currentDefinition };
      emit('wordUpdated', wordWithCurrentDefinition);
    } else {
      emit('wordUpdated', updatedWord);
    }
  } catch (error) {
    console.error('Error saving word:', error);
  }
}
</script>

<style scoped>
/* CSS部分保持不变 */
.actions-sidebar {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex-shrink: 0;
}

.status-section {
  background-color: #f9fafb;
  border-radius: 0.5rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-remembered {
  background-color: #dcfce7;
  color: #166534;
}

.status-learning {
  background-color: #fef3c7;
  color: #92400e;
}

.status-value {
  font-size: 0.875rem;
  color: #4b5563;
}

.normal-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.action-btn {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: none;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  /* 移动端触摸优化 */
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.save-btn {
  background-color: #10b981;
  color: white;
}

.save-btn:hover {
  background-color: #059669;
}

.cancel-btn {
  background-color: #6b7280;
  color: white;
}

.cancel-btn:hover {
  background-color: #4b5563;
}

/* 各按钮配色 */
.master-btn {
  background-color: #10b981;
  color: white;
}

.master-btn:hover {
  background-color: #059669;
}

.restore-btn {
  background-color: #6b7280;
  color: white;
}

.restore-btn:hover {
  background-color: #4b5563;
}

.reset-btn {
  background-color: #f59e0b;
  color: white;
}

.reset-btn:hover {
  background-color: #d97706;
}

.edit-btn {
  background-color: #3b82f6;
  color: white;
}

.edit-btn:hover {
  background-color: #2563eb;
}

.delete-btn {
  background-color: #dc2626;
  color: white;
}

.delete-btn:hover {
  background-color: #b91c1c;
}

/* 移动端布局优化 */
@media (max-width: 768px) {
  .actions-sidebar {
    gap: 1rem;
  }

  .status-section {
    padding: 0.875rem;
    border-radius: 0.375rem;
  }

  .status-label {
    font-size: 0.8125rem;
  }

  .status-value {
    font-size: 0.8125rem;
  }

  .status-badge {
    padding: 0.1875rem 0.375rem;
    font-size: 0.6875rem;
  }

  .normal-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .action-btn {
    padding: 0.875rem 0.75rem;
    font-size: 0.875rem;
    min-height: 48px;
  }

  .edit-btn,
  .delete-btn {
    grid-column: span 2;
  }

  /* 编辑模式下的按钮保持垂直布局 */
  .normal-actions:has(.save-btn) {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
}

/* 小屏手机进一步优化 */
@media (max-width: 480px) {
  .actions-sidebar {
    gap: 0.875rem;
  }

  .status-section {
    padding: 0.75rem;
  }

  .status-row {
    gap: 0.5rem;
  }

  .status-label {
    font-size: 0.75rem;
  }

  .status-value {
    font-size: 0.75rem;
  }

  .action-btn {
    padding: 1rem 0.75rem;
    font-size: 0.8125rem;
    min-height: 50px;
  }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .status-section {
    padding: 0.5rem;
  }

  .status-row {
    gap: 0.25rem;
  }

  .action-btn {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    min-height: 36px;
  }

  .normal-actions {
    gap: 0.5rem;
  }
}
</style>
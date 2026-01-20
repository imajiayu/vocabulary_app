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
        <span class="status-value">{{ currentWord?.ease_factor.toFixed(2) }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">添加时间</span>
        <span class="status-value">{{ currentWord?.date_added }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">连续正确</span>
        <span class="status-value">{{ currentWord?.repetition }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">复习间隔</span>
        <span class="status-value">{{ currentWord?.interval }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">下次复习</span>
        <span class="status-value">{{ currentWord?.next_review }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">拼写强度</span>
        <span class="status-value">{{ currentWord?.spell_strength !== null && currentWord?.spell_strength !== undefined ? currentWord.spell_strength.toFixed(2) : '-' }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">下次拼写</span>
        <span class="status-value">{{ currentWord?.spell_next_review }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">单词来源</span>
        <span class="status-value">{{ currentWord?.source }}</span>
      </div>
    </div>

    <div class="normal-actions">
      <template v-if="isEditing">
        <button @click="handleSave" :disabled="isSaving" class="action-btn save-btn">
          {{ isSaving ? '保存中...' : '保存' }}
        </button>
        <button @click="store.cancelEdit()" class="action-btn cancel-btn">取消</button>
      </template>

      <template v-else>
        <button @click="toggleReview" :class="['action-btn', isRemembered ? 'restore-btn' : 'master-btn']">
          {{ isRemembered ? '恢复复习' : '标记掌握' }}
        </button>
        <button @click="handleMarkForgot" :disabled="isForgetButtonUsed" class="action-btn reset-btn">
          {{ isForgetButtonUsed ? '已设为忘记' : '设为忘记' }}
        </button>
        <button @click="store.startEdit()" class="action-btn edit-btn">编辑单词</button>
        <button @click="handleDelete" class="action-btn delete-btn">删除单词</button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useWordEditorStore } from '../stores/wordEditor';
import { useSettings } from '@/shared/composables/useSettings';

// 使用 Pinia Store
const store = useWordEditorStore();
const { currentWord, isEditing, isSaving } = storeToRefs(store);

// 设置管理 - 用于获取lapse配置
const { settings: userSettings, loadSettings } = useSettings();

// 组件挂载时加载设置
onMounted(async () => {
  await loadSettings();
});

// Computed property to check if word has been marked as forgotten (lapse > 0)
const isForgetButtonUsed = computed(() => {
  return currentWord.value ? (currentWord.value.lapse ?? 0) > 0 : false;
});

// computed 属性使用 store 中的 currentWord
const isRemembered = computed(() => {
  return currentWord.value ? currentWord.value.stop_review : false;
});

const toggleReview = async () => {
  if (isRemembered.value) {
    await store.restoreReview();
  } else {
    await store.markMastered(false); // 不自动关闭
  }
};

const handleMarkForgot = async () => {
  if (isForgetButtonUsed.value) return;
  const lapseInitialValue = userSettings.value?.learning.lapseInitialValue ?? 3;
  await store.markForgot(lapseInitialValue);
};

const handleDelete = async () => {
  if (!confirm('确定要删除这个单词吗？')) {
    return;
  }
  await store.deleteWord();
};

const handleSave = async () => {
  await store.save();
};
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
  border-radius: var(--radius-full);
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
  background-color: var(--color-success);
  color: white;
}

.save-btn:hover {
  background-color: var(--color-success-hover);
}

.cancel-btn {
  background-color: var(--color-text-secondary);
  color: white;
}

.cancel-btn:hover {
  background-color: #4b5563;
}

/* 各按钮配色 */
.master-btn {
  background-color: var(--color-success);
  color: white;
}

.master-btn:hover {
  background-color: var(--color-success-hover);
}

.restore-btn {
  background-color: var(--color-text-secondary);
  color: white;
}

.restore-btn:hover {
  background-color: #4b5563;
}

.reset-btn {
  background-color: var(--color-edit);
  color: white;
}

.reset-btn:hover {
  background-color: #d97706;
}

.edit-btn {
  background-color: var(--color-primary);
  color: white;
}

.edit-btn:hover {
  background-color: var(--color-primary-hover);
}

.delete-btn {
  background-color: #dc2626;
  color: white;
}

.delete-btn:hover {
  background-color: #b91c1c;
}

/* 移动端布局优化 */
@media (max-width: 480px) {
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
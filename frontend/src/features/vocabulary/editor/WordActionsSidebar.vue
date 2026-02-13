<template>
  <div class="actions-sidebar">
    <!-- Status Card -->
    <div class="status-card">
      <div class="status-header">
        <span class="status-card-label">学习数据</span>
        <span :class="['status-badge', isRemembered ? 'badge-mastered' : 'badge-learning']">
          {{ isRemembered ? '已掌握' : '学习中' }}
        </span>
      </div>

      <div class="status-grid">
        <div class="stat-item">
          <span class="stat-label">难度</span>
          <span class="stat-value stat-number">{{ currentWord?.ease_factor.toFixed(2) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">连续正确</span>
          <span class="stat-value stat-number">{{ currentWord?.repetition }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">复习间隔</span>
          <span class="stat-value stat-number">{{ currentWord?.interval }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">拼写强度</span>
          <span class="stat-value stat-number">{{ currentWord?.spell_strength !== null && currentWord?.spell_strength !== undefined ? currentWord.spell_strength.toFixed(2) : '-' }}</span>
        </div>
      </div>

      <div class="status-dates">
        <div class="date-row">
          <span class="date-label">添加</span>
          <span class="date-value">{{ currentWord?.date_added }}</span>
        </div>
        <div class="date-row">
          <span class="date-label">下次复习</span>
          <span class="date-value">{{ currentWord?.next_review }}</span>
        </div>
        <div class="date-row">
          <span class="date-label">下次拼写</span>
          <span class="date-value">{{ currentWord?.spell_next_review }}</span>
        </div>
        <div class="date-row">
          <span class="date-label">来源</span>
          <span class="date-value">{{ currentWord?.source }}</span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="actions-group">
      <template v-if="isEditing">
        <button @click="handleSave" :disabled="isSaving" class="action-btn btn-primary">
          {{ isSaving ? '保存中...' : '保存' }}
        </button>
        <button @click="store.cancelEdit()" class="action-btn btn-ghost">取消</button>
      </template>

      <template v-else>
        <button v-if="store.mode !== 'mode_lapse'" @click="toggleReview" :class="['action-btn', isRemembered ? 'btn-secondary' : 'btn-success']">
          {{ isRemembered ? '恢复复习' : '标记掌握' }}
        </button>
        <button v-if="store.mode !== 'mode_lapse'" @click="toggleSpell" :class="['action-btn', isSpellStopped ? 'btn-secondary' : 'btn-success']">
          {{ isSpellStopped ? '恢复拼写' : '停止拼写' }}
        </button>
        <button @click="handleMarkForgot" :disabled="isForgetButtonUsed" class="action-btn btn-warning">
          {{ isForgetButtonUsed ? '已设为忘记' : '设为忘记' }}
        </button>
        <button @click="store.startEdit()" class="action-btn btn-outline">编辑单词</button>
        <button @click="handleDelete" class="action-btn btn-danger-ghost">删除单词</button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useWordEditorStore } from '../stores/wordEditor';

// 使用 Pinia Store
const store = useWordEditorStore();
const { currentWord, isEditing, isSaving } = storeToRefs(store);

// Computed property to check if word has been marked as forgotten (lapse > 0)
const isForgetButtonUsed = computed(() => {
  return currentWord.value ? (currentWord.value.lapse ?? 0) > 0 : false;
});

// computed 属性使用 store 中的 currentWord
const isRemembered = computed(() => {
  return currentWord.value ? currentWord.value.stop_review : false;
});

const isSpellStopped = computed(() => {
  return currentWord.value?.stop_spell === 1;
});

const toggleSpell = async () => {
  if (isSpellStopped.value) {
    await store.restoreSpell();
  } else {
    await store.markSpellMastered(false);
  }
};

const toggleReview = async () => {
  if (isRemembered.value) {
    await store.restoreReview();
  } else {
    await store.markMastered(false); // 不自动关闭
  }
};

const handleMarkForgot = async () => {
  if (isForgetButtonUsed.value) return;
  await store.markForgot();
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
/* ═══════════════════════════════════════════════════════════════════════════
   WordActionsSidebar - Editorial Study 状态面板
   ═══════════════════════════════════════════════════════════════════════════ */

.actions-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  flex-shrink: 0;
}

/* ── Status Card ── */
.status-card {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-default);
  border: 1px solid var(--color-border-light);
  overflow: hidden;
}

.status-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border-light);
}

.status-card-label {
  font-family: var(--font-ui);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.status-badge {
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.02em;
}

.badge-mastered {
  background: var(--color-state-success-light);
  color: var(--primitive-olive-700);
}

.badge-learning {
  background: var(--color-state-warning-light);
  color: var(--primitive-gold-700);
}

/* ── Stat Grid ── */
.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--color-border-light);
}

.stat-item:nth-child(odd) {
  border-right: 1px solid var(--color-border-light);
}

.stat-label {
  font-family: var(--font-ui);
  font-size: 10px;
  color: var(--color-text-tertiary);
  margin-bottom: 2px;
}

.stat-value {
  font-family: var(--font-data);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}

/* ── Date Rows ── */
.status-dates {
  padding: var(--space-2) var(--space-4) var(--space-3);
}

.date-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-1) 0;
}

.date-row + .date-row {
  border-top: 1px solid var(--color-border-light);
}

.date-label {
  font-family: var(--font-ui);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.date-value {
  font-family: var(--font-data);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

/* ── Actions ── */
.actions-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.action-btn {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  font-family: var(--font-ui);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: center;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn:focus-visible {
  outline: 2px solid var(--color-brand-primary);
  outline-offset: 2px;
}

.action-btn:active:not(:disabled) {
  transform: scale(0.98);
}

/* ── Button Variants ── */
.btn-primary {
  background: var(--color-brand-primary);
  color: var(--primitive-paper-100);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-brand-primary-hover);
}

.btn-success {
  background: var(--color-state-success);
  color: var(--primitive-paper-100);
}

.btn-success:hover:not(:disabled) {
  background: var(--color-state-success-hover);
}

.btn-secondary {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--control-bg-hover);
}

.btn-warning {
  background: var(--color-state-warning-light);
  color: var(--primitive-gold-700);
  border-color: rgba(184, 134, 11, 0.15);
}

.btn-warning:hover:not(:disabled) {
  background: rgba(184, 134, 11, 0.18);
}

.btn-outline {
  background: transparent;
  color: var(--color-brand-primary);
  border-color: var(--color-brand-primary);
}

.btn-outline:hover:not(:disabled) {
  background: var(--color-brand-primary-light);
}

.btn-danger-ghost {
  background: transparent;
  color: var(--color-state-error);
  border-color: transparent;
}

.btn-danger-ghost:hover:not(:disabled) {
  background: var(--color-state-error-light);
  border-color: rgba(155, 59, 59, 0.15);
}

.btn-ghost {
  background: transparent;
  color: var(--color-text-secondary);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mobile
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .actions-sidebar {
    gap: var(--space-4);
  }

  .status-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .stat-item {
    border-bottom: none;
    padding: var(--space-3) var(--space-1);
  }

  .stat-item:nth-child(odd) {
    border-right: 1px solid var(--color-border-light);
  }

  .stat-item:nth-child(even):not(:last-child) {
    border-right: 1px solid var(--color-border-light);
  }

  .stat-item:last-child {
    border-right: none;
  }

  .status-dates {
    border-top: 1px solid var(--color-border-light);
  }

  .actions-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }

  .btn-outline,
  .btn-danger-ghost {
    grid-column: span 1;
  }

  /* Edit mode: stack vertically */
  .actions-group:has(.btn-primary) {
    display: flex;
    flex-direction: column;
  }

  .action-btn {
    min-height: 42px;
    font-size: var(--font-size-sm);
  }
}

/* ── Landscape ── */
@media (max-height: 500px) and (orientation: landscape) {
  .stat-item {
    padding: var(--space-2) var(--space-1);
  }

  .action-btn {
    min-height: 32px;
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-xs);
  }

  .actions-group {
    gap: var(--space-1);
  }
}
</style>
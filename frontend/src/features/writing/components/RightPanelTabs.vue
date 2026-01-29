<template>
  <div class="right-panel-tabs">
    <div class="tab-headers">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-header"
        :class="{ active: modelValue === tab.id }"
        @click="$emit('update:modelValue', tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="tab-content">
      <slot :name="modelValue" />
    </div>
  </div>
</template>

<script setup lang="ts">
export interface TabItem {
  id: string
  label: string
}

defineProps<{
  tabs: TabItem[]
  modelValue: string
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<style scoped>
.right-panel-tabs {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(0, 0, 0, 0.2);
}

/* ── Tab Headers ── */
.tab-headers {
  display: flex;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(59, 130, 246, 0.1);
  flex-shrink: 0;
}

.tab-header {
  flex: 1;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--primitive-ink-400);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.tab-header:hover {
  color: var(--primitive-paper-300);
  background: rgba(250, 247, 242, 0.03);
}

.tab-header.active {
  color: var(--primitive-azure-400);
}

.tab-header.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 16px;
  right: 16px;
  height: 2px;
  background: var(--primitive-azure-500);
  border-radius: 1px;
}

/* ── Tab Content ── */
.tab-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  /* 自定义滚动条 */
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.3) transparent;
}

.tab-content::-webkit-scrollbar {
  width: 6px;
}

.tab-content::-webkit-scrollbar-track {
  background: transparent;
}

.tab-content::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.3);
  border-radius: 3px;
}

.tab-content::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.5);
}

/* ── Mobile: 取消独立滚动 ── */
@media (max-width: 768px) {
  .right-panel-tabs {
    height: auto;
  }

  .tab-content {
    overflow-y: visible;
    flex: none;
  }
}
</style>

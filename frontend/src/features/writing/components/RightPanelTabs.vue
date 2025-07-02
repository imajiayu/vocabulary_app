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
  background: rgba(0, 0, 0, 0.15);
}

/* ── Tab Headers ── */
.tab-headers {
  display: flex;
  background: rgba(0, 0, 0, 0.18);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.tab-header {
  flex: 1;
  padding: 11px 16px;
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 600;
  color: rgba(250, 247, 242, 0.35);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.tab-header:hover {
  color: rgba(250, 247, 242, 0.55);
  background: rgba(255, 255, 255, 0.02);
}

.tab-header.active {
  color: rgba(250, 247, 242, 0.85);
}

.tab-header.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 20%;
  right: 20%;
  height: 2px;
  background: var(--primitive-azure-500);
  border-radius: 1px 1px 0 0;
}

/* ── Tab Content ── */
.tab-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.06) transparent;
}

.tab-content::-webkit-scrollbar {
  width: 4px;
}

.tab-content::-webkit-scrollbar-track {
  background: transparent;
}

.tab-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
}

.tab-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.12);
}

/* ── Mobile ── */
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

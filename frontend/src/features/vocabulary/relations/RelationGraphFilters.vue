<template>
  <div class="control-group">
    <label>关系类型:</label>
    <div class="relation-filters">
      <label class="checkbox-label">
        <input type="checkbox" v-model="localFilters.synonym" @change="emitChange" />
        同义词
      </label>
      <label class="checkbox-label">
        <input type="checkbox" v-model="localFilters.antonym" @change="emitChange" />
        反义词
      </label>
      <label class="checkbox-label">
        <input type="checkbox" v-model="localFilters.root" @change="emitChange" />
        词根
      </label>
      <label class="checkbox-label">
        <input type="checkbox" v-model="localFilters.confused" @change="emitChange" />
        易混淆
      </label>
      <label class="checkbox-label">
        <input type="checkbox" v-model="localFilters.topic" @change="emitChange" />
        主题
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { RelationFilters } from './useRelationGraph'

interface Props {
  filters: RelationFilters
}

interface Emits {
  (e: 'update:filters', filters: RelationFilters): void
  (e: 'change'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const localFilters = reactive<RelationFilters>({ ...props.filters })

watch(
  () => props.filters,
  (newFilters) => {
    Object.assign(localFilters, newFilters)
  },
  { deep: true }
)

function emitChange() {
  emit('update:filters', { ...localFilters })
  emit('change')
}
</script>

<style scoped>
.control-group {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: white;
  border-radius: var(--radius-md);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.control-group label {
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  font-size: 14px;
}

.relation-filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-secondary);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
  font-weight: normal;
}

.checkbox-label:hover {
  background: var(--color-bg-tertiary);
}

.checkbox-label input[type="checkbox"] {
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}
</style>

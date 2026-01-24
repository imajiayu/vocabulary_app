<template>
  <Teleport to="body">
    <template v-if="show">
      <div class="context-menu-backdrop" @click="emit('close')"></div>
      <div
        class="context-menu"
        :style="{ left: x + 'px', top: y + 'px' }"
        @click.stop
      >
        <div v-if="type === 'edge'" class="menu-item menu-item--danger" @click="handleDelete">
          <BaseIcon name="Trash2" size="sm" />
          <span>删除关系</span>
        </div>
        <div v-if="type === 'node'" class="menu-item" @click="handleAddRelation">
          <BaseIcon name="Plus" size="sm" />
          <span>添加关系</span>
        </div>
      </div>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import type { GraphNode } from '@/shared/api'
import { BaseIcon } from '@/shared/components/base'

interface EdgeData {
  source: string
  target: string
  label: { formatter: string }
}

interface Props {
  show: boolean
  type: 'node' | 'edge' | ''
  x: number
  y: number
  nodeData?: GraphNode | null
  edgeData?: EdgeData | null
}

interface Emits {
  (e: 'close'): void
  (e: 'deleteEdge', data: { sourceId: number; targetId: number; relationType: string }): void
  (e: 'addRelation', node: GraphNode): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

function handleDelete() {
  if (props.edgeData) {
    emit('deleteEdge', {
      sourceId: parseInt(props.edgeData.source),
      targetId: parseInt(props.edgeData.target),
      relationType: props.edgeData.label.formatter
    })
  }
  emit('close')
}

function handleAddRelation() {
  if (props.nodeData) {
    emit('addRelation', props.nodeData)
  }
  emit('close')
}
</script>

<style scoped>
.context-menu-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9998;
}

.context-menu {
  position: fixed;
  z-index: 9999;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-default);
  box-shadow: var(--shadow-lg);
  padding: var(--space-1);
  min-width: 150px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.menu-item:hover {
  background: var(--color-bg-tertiary);
}

.menu-item--danger {
  color: var(--color-state-error);
}

.menu-item--danger:hover {
  background: rgba(239, 68, 68, 0.1);
}
</style>

<template>
  <Teleport to="body">
    <template v-if="show">
      <div class="context-menu-backdrop" @click="emit('close')"></div>
      <div
        class="context-menu"
        :style="{ left: x + 'px', top: y + 'px' }"
        @click.stop
      >
        <div v-if="type === 'edge'" class="menu-item" @click="handleDelete">
          <span>🗑️</span>
          <span>删除关系</span>
        </div>
        <div v-if="type === 'node'" class="menu-item" @click="handleAddRelation">
          <span>➕</span>
          <span>添加关系</span>
        </div>
      </div>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import type { GraphNode } from '@/shared/api'

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
  background: white;
  border-radius: var(--radius-default);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 4px;
  min-width: 150px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
  font-size: 14px;
  color: #0f172a;
}

.menu-item:hover {
  background: #f1f5f9;
}

.menu-item span:first-child {
  font-size: 16px;
}
</style>

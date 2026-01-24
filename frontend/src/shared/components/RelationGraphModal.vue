<template>
  <Teleport to="body">
    <div v-if="show" class="relation-graph-modal">
      <!-- Backdrop -->
      <div class="modal-overlay" @click="handleClose"></div>

      <!-- Modal content -->
      <div class="modal-content">
        <div class="graph-wrapper">
          <!-- Close button -->
          <button class="close-btn" @click="handleClose" aria-label="关闭">
            <BaseIcon name="X" size="md" />
          </button>

          <!-- Controls bar -->
          <div class="controls-bar">
            <RelationGraphFilters
              :filters="graph.filters.value"
              @update:filters="(f) => Object.assign(graph.filters.value, f)"
              @change="graph.applyFilters"
            />

            <RelationGraphSearch
              :search-word="graph.searchWord.value"
              :nodes="graph.fullGraphData.value.nodes"
              @update:search-word="(v) => graph.searchWord.value = v"
              @select="handleSearchSelect"
            />

            <div class="control-group">
              <BaseButton
                :variant="graph.showAllNodes.value ? 'primary' : 'secondary'"
                size="sm"
                @click="graph.toggleShowAllNodes"
              >
                <template #icon>
                  <BaseIcon :name="graph.showAllNodes.value ? 'EyeOff' : 'Eye'" size="sm" />
                </template>
                {{ graph.showAllNodes.value ? '隐藏全部节点' : '展示所有节点' }}
              </BaseButton>
            </div>

            <div class="stats">
              <span>节点: {{ graph.graphData.value.nodes.length }}</span>
              <span>关系: {{ graph.graphData.value.edges.length }}</span>
            </div>
          </div>

          <!-- Chart canvas -->
          <RelationGraphCanvas
            ref="canvasRef"
            :graph-data="graph.graphData.value"
            :center-word-id="graph.centerWordId.value"
            :search-word="graph.searchWord.value"
            :loading="graph.loading.value"
            :error="graph.error.value"
            @node-click="handleNodeClick"
            @context-menu="handleContextMenu"
          />
        </div>

        <!-- Context menu -->
        <RelationGraphContextMenu
          :show="contextMenu.show"
          :type="contextMenu.type"
          :x="contextMenu.x"
          :y="contextMenu.y"
          :node-data="contextMenu.type === 'node' ? contextMenu.nodeData : null"
          :edge-data="contextMenu.type === 'edge' ? contextMenu.edgeData : null"
          @close="handleCloseContextMenu"
          @delete-edge="handleDeleteEdge"
          @add-relation="handleShowAddDialog"
        />

        <!-- Add relation dialog -->
        <AddRelationDialog
          :show="addDialog.show"
          :source-node="addDialog.sourceNode"
          :all-nodes="graph.fullGraphData.value.nodes"
          @cancel="handleCancelAddDialog"
          @confirm="handleConfirmAddRelation"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import type { GraphNode } from '@/shared/api'
import { useRelationGraph } from '@/features/vocabulary/relations/useRelationGraph'
import RelationGraphFilters from '@/features/vocabulary/relations/RelationGraphFilters.vue'
import RelationGraphSearch from '@/features/vocabulary/relations/RelationGraphSearch.vue'
import RelationGraphCanvas from '@/features/vocabulary/relations/RelationGraphCanvas.vue'
import RelationGraphContextMenu from '@/features/vocabulary/relations/RelationGraphContextMenu.vue'
import AddRelationDialog from '@/features/vocabulary/relations/AddRelationDialog.vue'
import { BaseButton, BaseIcon } from '@/shared/components/base'

interface Props {
  show: boolean
}

interface Emits {
  (e: 'update:show', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Composable for graph data management
const graph = useRelationGraph()

// Canvas ref for resetting chart state
const canvasRef = ref<InstanceType<typeof RelationGraphCanvas>>()

// Context menu state
const contextMenu = reactive({
  show: false,
  type: '' as 'node' | 'edge' | '',
  x: 0,
  y: 0,
  nodeData: null as GraphNode | null,
  edgeData: null as { source: string; target: string; label: { formatter: string } } | null
})

// Add relation dialog state
const addDialog = reactive({
  show: false,
  sourceNode: null as GraphNode | null
})

// Handlers
function handleClose() {
  emit('update:show', false)
}

function handleSearchSelect(node: GraphNode) {
  graph.focusOnWord(node)
}

function handleNodeClick(node: GraphNode) {
  graph.focusOnWord(node)
}

function handleContextMenu(data: {
  type: 'node' | 'edge'
  x: number
  y: number
  data: GraphNode | { source: string; target: string; label: { formatter: string } }
}) {
  contextMenu.show = true
  contextMenu.type = data.type
  contextMenu.x = data.x
  contextMenu.y = data.y

  if (data.type === 'node') {
    contextMenu.nodeData = data.data as GraphNode
    contextMenu.edgeData = null
  } else {
    contextMenu.edgeData = data.data as { source: string; target: string; label: { formatter: string } }
    contextMenu.nodeData = null
  }
}

function handleCloseContextMenu() {
  contextMenu.show = false
  canvasRef.value?.resetChartState()
}

function handleDeleteEdge(data: { sourceId: number; targetId: number; relationType: string }) {
  graph.deleteRelation(data.sourceId, data.targetId, data.relationType)
}

function handleShowAddDialog(node: GraphNode) {
  addDialog.show = true
  addDialog.sourceNode = node
}

function handleCancelAddDialog() {
  addDialog.show = false
  addDialog.sourceNode = null
  canvasRef.value?.resetChartState()
}

function handleConfirmAddRelation(data: { targetWord: string; relationType: string }) {
  if (!data.targetWord || !addDialog.sourceNode) {
    graph.error.value = '请输入目标单词'
    setTimeout(() => { graph.error.value = '' }, 3000)
    return
  }

  const targetNode = graph.findNodeByWord(data.targetWord)
  if (!targetNode) {
    graph.error.value = `未找到单词: ${data.targetWord}`
    setTimeout(() => { graph.error.value = '' }, 3000)
    return
  }

  if (targetNode.id === addDialog.sourceNode.id) {
    graph.error.value = '不能与自己建立关系'
    setTimeout(() => { graph.error.value = '' }, 3000)
    return
  }

  graph.addRelation(addDialog.sourceNode.id, targetNode.id, data.relationType)
  addDialog.show = false
  addDialog.sourceNode = null
}

// Watch for modal show/hide
watch(
  () => props.show,
  async (newShow) => {
    if (newShow) {
      if (!graph.hasData.value) {
        await graph.fetchGraphData()
      } else {
        graph.applyFilters()
      }
    } else {
      graph.reset()
    }
  }
)
</script>

<style scoped>
.relation-graph-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal-content {
  position: relative;
  width: 95vw;
  height: 95vh;
  background: white;
  border-radius: var(--radius-md);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1;
}

.graph-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-tertiary);
  position: relative;
}

.close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border: none;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-sm);
  z-index: 1000;
  color: var(--color-text-secondary);
}

.close-btn:hover {
  background: var(--color-bg-tertiary);
  transform: scale(1.05);
  box-shadow: var(--shadow-md);
  color: var(--color-text-primary);
}

.controls-bar {
  background: linear-gradient(to bottom, var(--color-surface-elevated), var(--color-bg-secondary));
  padding: var(--space-4) var(--space-5);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: center;
  z-index: 10;
  position: relative;
  border-bottom: 1px solid var(--color-border-light);
}

.control-group {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.stats {
  display: flex;
  gap: var(--space-5);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
  padding: var(--space-2) var(--space-4);
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
}

.stats span {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
</style>

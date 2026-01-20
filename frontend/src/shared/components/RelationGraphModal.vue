<template>
  <Teleport to="body">
    <div v-if="show" class="relation-graph-modal">
      <!-- Backdrop -->
      <div class="modal-overlay" @click="handleClose"></div>

      <!-- Modal content -->
      <div class="modal-content">
        <div class="graph-wrapper">
          <!-- Close button -->
          <button class="close-btn" @click="handleClose">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
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
              <button
                @click="graph.toggleShowAllNodes"
                class="show-all-btn"
                :class="{ active: graph.showAllNodes.value }"
              >
                {{ graph.showAllNodes.value ? '隐藏全部节点' : '展示所有节点' }}
              </button>
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
  background: #f5f5f5;
  position: relative;
}

.close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border: none;
  background: white;
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.close-btn:hover {
  background: #f1f5f9;
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.close-btn svg {
  color: var(--color-text-secondary);
  width: 20px;
  height: 20px;
  transition: color 0.2s;
}

.close-btn:hover svg {
  color: #334155;
}

.controls-bar {
  background: linear-gradient(to bottom, #ffffff, #fafafa);
  padding: 16px 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  z-index: 10;
  position: relative;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.control-group {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: white;
  border-radius: var(--radius-md);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.show-all-btn {
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-default);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  background: white;
  color: #667eea;
  border: 1px solid #e0e7ff;
}

.show-all-btn:hover {
  background: #f5f7ff;
  border-color: #c7d2fe;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.2);
}

.show-all-btn:active {
  transform: translateY(0);
}

.show-all-btn.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-color: transparent;
}

.show-all-btn.active:hover {
  background: linear-gradient(135deg, #5568d3, #6a3f8f);
}

.stats {
  display: flex;
  gap: 20px;
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 500;
  padding: 8px 16px;
  background: white;
  border-radius: var(--radius-md);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.stats span {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>

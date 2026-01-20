<template>
  <section id="relations" class="settings-section">
    <h1 class="section-title">单词关联</h1>
    <p class="section-description">查看和管理单词间的关系网络</p>

    <div class="settings-group">
      <div class="relation-list">
        <!-- 同义词 -->
        <div class="relation-row">
          <span class="relation-name">同义词</span>
          <span class="relation-count">{{ relationStats.synonym || 0 }} 条</span>
          <div class="relation-actions">
            <button class="btn-relation-action btn-clear-small" @click="clearSingleRelation('synonym')" :disabled="clearingType === 'synonym'">
              {{ clearingType === 'synonym' ? '清空中...' : '清空' }}
            </button>
          </div>
        </div>

        <!-- 反义词 -->
        <div class="relation-row">
          <span class="relation-name">反义词</span>
          <span class="relation-count">{{ relationStats.antonym || 0 }} 条</span>
          <div class="relation-actions">
            <button class="btn-relation-action btn-clear-small" @click="clearSingleRelation('antonym')" :disabled="clearingType === 'antonym'">
              {{ clearingType === 'antonym' ? '清空中...' : '清空' }}
            </button>
          </div>
        </div>

        <!-- 词根 -->
        <div class="relation-row">
          <span class="relation-name">词根</span>
          <span class="relation-count">{{ relationStats.root || 0 }} 条</span>
          <div class="relation-actions">
            <button class="btn-relation-action btn-clear-small" @click="clearSingleRelation('root')" :disabled="clearingType === 'root'">
              {{ clearingType === 'root' ? '清空中...' : '清空' }}
            </button>
          </div>
        </div>

        <!-- 易混淆 -->
        <div class="relation-row">
          <span class="relation-name">易混淆</span>
          <span class="relation-count">{{ relationStats.confused || 0 }} 条</span>
          <div class="relation-actions">
            <button class="btn-relation-action btn-clear-small" @click="clearSingleRelation('confused')" :disabled="clearingType === 'confused'">
              {{ clearingType === 'confused' ? '清空中...' : '清空' }}
            </button>
          </div>
        </div>

        <!-- 主题 -->
        <div class="relation-row">
          <span class="relation-name">主题</span>
          <span class="relation-count">{{ relationStats.topic || 0 }} 条</span>
          <div class="relation-actions">
            <button class="btn-relation-action btn-clear-small" @click="clearSingleRelation('topic')" :disabled="clearingType === 'topic'">
              {{ clearingType === 'topic' ? '清空中...' : '清空' }}
            </button>
          </div>
        </div>

        <!-- 总计 -->
        <div class="relation-row relation-row-total">
          <span class="relation-name">总计</span>
          <span class="relation-count">{{ relationStats.total || 0 }} 条</span>
          <div class="relation-actions">
            <button class="btn-relation-action btn-view-graph desktop-only" @click="viewRelationGraph">
              🕸️ 查看关系图
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 关系图浮窗 -->
    <RelationGraphModal v-model:show="showGraphModal" />
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/shared/api'
import RelationGraphModal from '@/shared/components/RelationGraphModal.vue'
import { logger } from '@/shared/utils/logger'

const showGraphModal = ref(false)
const clearingType = ref<string | null>(null)

const relationStats = ref({
  synonym: 0,
  antonym: 0,
  root: 0,
  confused: 0,
  topic: 0,
  total: 0
})

const loadRelationStats = async () => {
  try {
    const data = await api.relations.getStats()
    relationStats.value = data
  } catch (e: unknown) {
    logger.error('Failed to load relation stats:', e)
  }
}

const clearSingleRelation = async (relationType: string) => {
  const typeNames: Record<string, string> = {
    synonym: '同义词',
    antonym: '反义词',
    root: '词根',
    confused: '易混淆',
    topic: '主题'
  }

  if (!confirm(`确定要清空所有${typeNames[relationType] || relationType}关系吗？此操作不可撤销。`)) {
    return
  }

  clearingType.value = relationType

  try {
    await api.relations.clear({
      relation_types: [relationType]
    })
    await loadRelationStats()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    logger.error('清空失败:', message)
  } finally {
    clearingType.value = null
  }
}

const viewRelationGraph = () => {
  showGraphModal.value = true
}

onMounted(async () => {
  await loadRelationStats()
})
</script>

<style scoped>
.settings-section {
  margin-bottom: 64px;
}

.section-title {
  font-size: 32px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 8px 0;
}

.section-description {
  font-size: 16px;
  color: var(--color-text-secondary);
  margin: 0 0 32px 0;
}

.settings-group {
  background: white;
  border-radius: var(--radius-xl);
  padding: 32px;
  margin-bottom: 24px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.relation-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.relation-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 16px 20px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
  gap: 16px;
}

.relation-row:hover {
  background: #f1f5f9;
  border-color: rgba(102, 126, 234, 0.2);
}

.relation-row-total {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
}

.relation-row-total:hover {
  background: linear-gradient(135deg, #5a6dd8, #6a4190);
}

.relation-row-total .relation-name,
.relation-row-total .relation-count {
  color: white;
}

.relation-name {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  min-width: 70px;
  flex-shrink: 0;
  text-align: left;
}

.relation-count {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  padding: 4px 8px;
  background: white;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  flex-shrink: 0;
  text-align: left;
  margin-left: -4px;
}

.relation-row-total .relation-count {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.relation-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}

.btn-relation-action {
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-default);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-relation-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-clear-small {
  background: var(--color-delete);
  color: white;
}

.btn-clear-small:hover:not(:disabled) {
  background: #dc2626;
  transform: translateY(-2px);
}

.btn-view-graph {
  background: white;
  color: #667eea;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.btn-view-graph:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

@media (max-width: 480px) {
  .settings-group {
    padding: 20px 16px;
  }

  .relation-row {
    padding: 12px;
    flex-wrap: wrap;
  }

  .relation-name {
    min-width: 60px;
  }

  .relation-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .desktop-only {
    display: none !important;
  }

  .section-title {
    font-size: 28px;
  }
}
</style>

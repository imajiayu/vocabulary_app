<template>
  <section id="relations" class="settings-section">
    <h1 class="section-title">单词关联</h1>
    <p class="section-description">生成和管理单词间的关系网络</p>

    <div class="settings-group">
      <div class="relation-list">
        <!-- 同义词 -->
        <div class="relation-row">
          <span class="relation-name">同义词</span>
          <span class="relation-count">{{ relationStats.synonym || 0 }} 条</span>

          <!-- Progress Bar -->
          <div class="progress-container" :class="{ 'progress-visible': progressMap.synonym.isGenerating }">
            <div v-if="progressMap.synonym.isGenerating" class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: progressMap.synonym.percent + '%' }"
              ></div>
            </div>
            <div v-if="progressMap.synonym.isGenerating" class="progress-text">
              {{ progressMap.synonym.percent.toFixed(0) }}% -
              {{ progressMap.synonym.current }}/{{ progressMap.synonym.total }} -
              {{ progressMap.synonym.message }}
            </div>
          </div>

          <div class="relation-actions">
            <button
              class="btn-relation-action"
              :class="progressMap.synonym.isGenerating ? 'btn-stop-small' : 'btn-generate-small'"
              @click="progressMap.synonym.isGenerating ? stopSingleRelation('synonym') : generateSingleRelation('synonym')"
              :disabled="progressMap.synonym.isClearing"
            >
              {{ progressMap.synonym.isGenerating ? '停止' : '生成' }}
            </button>
            <button class="btn-relation-action btn-clear-small" @click="clearSingleRelation('synonym')" :disabled="progressMap.synonym.isGenerating || progressMap.synonym.isClearing">
              {{ progressMap.synonym.isClearing ? '清空中...' : '清空' }}
            </button>
          </div>
        </div>

        <!-- 反义词 -->
        <div class="relation-row">
          <span class="relation-name">反义词</span>
          <span class="relation-count">{{ relationStats.antonym || 0 }} 条</span>

          <!-- Progress Bar -->
          <div class="progress-container" :class="{ 'progress-visible': progressMap.antonym.isGenerating }">
            <div v-if="progressMap.antonym.isGenerating" class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: progressMap.antonym.percent + '%' }"
              ></div>
            </div>
            <div v-if="progressMap.antonym.isGenerating" class="progress-text">
              {{ progressMap.antonym.percent.toFixed(0) }}% -
              {{ progressMap.antonym.current }}/{{ progressMap.antonym.total }} -
              {{ progressMap.antonym.message }}
            </div>
          </div>

          <div class="relation-actions">
            <button
              class="btn-relation-action"
              :class="progressMap.antonym.isGenerating ? 'btn-stop-small' : 'btn-generate-small'"
              @click="progressMap.antonym.isGenerating ? stopSingleRelation('antonym') : generateSingleRelation('antonym')"
              :disabled="progressMap.antonym.isClearing"
            >
              {{ progressMap.antonym.isGenerating ? '停止' : '生成' }}
            </button>
            <button class="btn-relation-action btn-clear-small" @click="clearSingleRelation('antonym')" :disabled="progressMap.antonym.isGenerating || progressMap.antonym.isClearing">
              {{ progressMap.antonym.isClearing ? '清空中...' : '清空' }}
            </button>
          </div>
        </div>

        <!-- 词根 -->
        <div class="relation-row">
          <span class="relation-name">词根</span>
          <span class="relation-count">{{ relationStats.root || 0 }} 条</span>

          <!-- Progress Bar -->
          <div class="progress-container" :class="{ 'progress-visible': progressMap.root.isGenerating }">
            <div v-if="progressMap.root.isGenerating" class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: progressMap.root.percent + '%' }"
              ></div>
            </div>
            <div v-if="progressMap.root.isGenerating" class="progress-text">
              {{ progressMap.root.percent.toFixed(0) }}% -
              {{ progressMap.root.current }}/{{ progressMap.root.total }} -
              {{ progressMap.root.message }}
            </div>
          </div>

          <div class="relation-actions">
            <button
              class="btn-relation-action"
              :class="progressMap.root.isGenerating ? 'btn-stop-small' : 'btn-generate-small'"
              @click="progressMap.root.isGenerating ? stopSingleRelation('root') : generateSingleRelation('root')"
              :disabled="progressMap.root.isClearing"
            >
              {{ progressMap.root.isGenerating ? '停止' : '生成' }}
            </button>
            <button class="btn-relation-action btn-clear-small" @click="clearSingleRelation('root')" :disabled="progressMap.root.isGenerating || progressMap.root.isClearing">
              {{ progressMap.root.isClearing ? '清空中...' : '清空' }}
            </button>
          </div>
        </div>

        <!-- 易混淆 -->
        <div class="relation-row">
          <span class="relation-name">易混淆</span>
          <span class="relation-count">{{ relationStats.confused || 0 }} 条</span>

          <!-- Progress Bar -->
          <div class="progress-container" :class="{ 'progress-visible': progressMap.confused.isGenerating }">
            <div v-if="progressMap.confused.isGenerating" class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: progressMap.confused.percent + '%' }"
              ></div>
            </div>
            <div v-if="progressMap.confused.isGenerating" class="progress-text">
              {{ progressMap.confused.percent.toFixed(0) }}% -
              {{ progressMap.confused.current }}/{{ progressMap.confused.total }} -
              {{ progressMap.confused.message }}
            </div>
          </div>

          <div class="relation-actions">
            <button
              class="btn-relation-action"
              :class="progressMap.confused.isGenerating ? 'btn-stop-small' : 'btn-generate-small'"
              @click="progressMap.confused.isGenerating ? stopSingleRelation('confused') : generateSingleRelation('confused')"
              :disabled="progressMap.confused.isClearing"
            >
              {{ progressMap.confused.isGenerating ? '停止' : '生成' }}
            </button>
            <button class="btn-relation-action btn-clear-small" @click="clearSingleRelation('confused')" :disabled="progressMap.confused.isGenerating || progressMap.confused.isClearing">
              {{ progressMap.confused.isClearing ? '清空中...' : '清空' }}
            </button>
          </div>
        </div>

        <!-- 主题 -->
        <div class="relation-row">
          <span class="relation-name">主题</span>
          <span class="relation-count">{{ relationStats.topic || 0 }} 条</span>

          <!-- Progress Bar -->
          <div class="progress-container" :class="{ 'progress-visible': progressMap.topic.isGenerating }">
            <div v-if="progressMap.topic.isGenerating" class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: progressMap.topic.percent + '%' }"
              ></div>
            </div>
            <div v-if="progressMap.topic.isGenerating" class="progress-text">
              {{ progressMap.topic.percent.toFixed(0) }}% -
              {{ progressMap.topic.current }}/{{ progressMap.topic.total }} -
              {{ progressMap.topic.message }}
            </div>
          </div>

          <div class="relation-actions">
            <button
              class="btn-relation-action"
              :class="progressMap.topic.isGenerating ? 'btn-stop-small' : 'btn-generate-small'"
              @click="progressMap.topic.isGenerating ? stopSingleRelation('topic') : generateSingleRelation('topic')"
              :disabled="progressMap.topic.isClearing"
            >
              {{ progressMap.topic.isGenerating ? '停止' : '生成' }}
            </button>
            <button class="btn-relation-action btn-clear-small" @click="clearSingleRelation('topic')" :disabled="progressMap.topic.isGenerating || progressMap.topic.isClearing">
              {{ progressMap.topic.isClearing ? '清空中...' : '清空' }}
            </button>
          </div>
        </div>

        <!-- 总计 -->
        <div class="relation-row relation-row-total">
          <span class="relation-name">总计</span>
          <span class="relation-count">{{ relationStats.total || 0 }} 条</span>
          <div class="progress-container"></div>
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
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '@/shared/api'
import RelationGraphModal from '@/shared/components/RelationGraphModal.vue'
import { logger } from '@/shared/utils/logger'

const showGraphModal = ref(false)

// 关系管理相关状态
const relationStats = ref({
  synonym: 0,
  antonym: 0,
  root: 0,
  confused: 0,
  topic: 0,
  total: 0
})

// Progress tracking for each relation type
interface ProgressState {
  current: number
  total: number
  percent: number
  message: string
  isGenerating: boolean
  isClearing: boolean
}

const progressMap = ref<Record<string, ProgressState>>({
  synonym: { current: 0, total: 0, percent: 0, message: '', isGenerating: false, isClearing: false },
  antonym: { current: 0, total: 0, percent: 0, message: '', isGenerating: false, isClearing: false },
  root: { current: 0, total: 0, percent: 0, message: '', isGenerating: false, isClearing: false },
  confused: { current: 0, total: 0, percent: 0, message: '', isGenerating: false, isClearing: false },
  topic: { current: 0, total: 0, percent: 0, message: '', isGenerating: false, isClearing: false }
})

// 轮询定时器
let pollingTimer: ReturnType<typeof setInterval> | null = null
const POLLING_INTERVAL = 1000 // 1秒轮询一次

// 关系管理函数
const loadRelationStats = async () => {
  try {
    const data = await api.relations.getStats()
    relationStats.value = data
  } catch (e: any) {
    logger.error('Failed to load relation stats:', e)
  }
}

// 轮询进度更新
const pollProgress = async () => {
  // 检查是否有任何正在生成的任务
  const generatingTypes = Object.keys(progressMap.value).filter(
    type => progressMap.value[type].isGenerating
  )

  if (generatingTypes.length === 0) {
    // 没有正在生成的任务，停止轮询
    stopPolling()
    return
  }

  // 获取所有进度
  try {
    const allProgress = await api.relations.getAllGenerationProgress()

    for (const type of generatingTypes) {
      const progress = allProgress[type]

      if (progress) {
        progressMap.value[type].current = progress.current
        progressMap.value[type].total = progress.total
        progressMap.value[type].percent = progress.percent
        progressMap.value[type].message = progress.message

        // 检查是否完成或出错
        if (progress.status === 'completed' || progress.status === 'error') {
          progressMap.value[type].isGenerating = false
          // 刷新统计
          await loadRelationStats()
        }
      } else {
        // 没有进度数据，可能已完成
        const status = await api.relations.getGenerationStatus(type)
        if (!status.is_running) {
          progressMap.value[type].isGenerating = false
          await loadRelationStats()
        }
      }
    }
  } catch (e: any) {
    logger.error('Failed to poll progress:', e)
  }
}

// 启动轮询
const startPolling = () => {
  if (pollingTimer) return // 已经在轮询
  pollingTimer = setInterval(pollProgress, POLLING_INTERVAL)
}

// 停止轮询
const stopPolling = () => {
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
}

// 检查所有关系类型的生成状态
const checkAllGenerationStatus = async () => {
  const types = ['synonym', 'antonym', 'root', 'confused', 'topic']
  let hasRunningTask = false

  for (const type of types) {
    try {
      const status = await api.relations.getGenerationStatus(type)
      if (status.is_running) {
        // 如果正在运行，设置为生成中状态
        progressMap.value[type].isGenerating = true
        progressMap.value[type].message = '正在生成中...'
        hasRunningTask = true
      }
    } catch (e) {
      logger.error(`Failed to check status for ${type}:`, e)
    }
  }

  // 如果有正在运行的任务，启动轮询
  if (hasRunningTask) {
    startPolling()
  }
}

const generateSingleRelation = async (relationType: string) => {
  try {
    progressMap.value[relationType].isGenerating = true
    progressMap.value[relationType].current = 0
    progressMap.value[relationType].total = 0
    progressMap.value[relationType].percent = 0
    progressMap.value[relationType].message = '启动生成任务...'

    await api.relations.generate(relationType)

    // 启动轮询
    startPolling()
  } catch (e: any) {
    logger.error('生成失败:', e.message)
    progressMap.value[relationType].isGenerating = false
  }
}

const stopSingleRelation = async (relationType: string) => {
  try {
    await api.relations.stopGeneration(relationType)

    // 停止后立即设置为非生成状态
    progressMap.value[relationType].isGenerating = false
    progressMap.value[relationType].message = '已停止'

    // 重新加载统计以获取最新的关系数量
    await loadRelationStats()
  } catch (e: any) {
    logger.error('停止失败:', e.message)
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

  progressMap.value[relationType].isClearing = true

  try {
    await api.relations.clear({
      relation_types: [relationType]
    })

    // 重新加载统计
    await loadRelationStats()
  } catch (e: any) {
    logger.error('清空失败:', e.message)
  } finally {
    progressMap.value[relationType].isClearing = false
  }
}

const viewRelationGraph = () => {
  showGraphModal.value = true
}

// Get relation type display name
const getRelationTypeName = (type: string): string => {
  const names: Record<string, string> = {
    synonym: '同义词',
    antonym: '反义词',
    root: '词根',
    confused: '易混淆',
    topic: '主题'
  }
  return names[type] || type
}

onMounted(async () => {
  // Load initial data
  await loadRelationStats()

  // 检查是否有正在运行的生成任务（会自动启动轮询）
  await checkAllGenerationStatus()
})

// Clean up when component is unmounted
onUnmounted(() => {
  stopPolling()
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
  color: #64748b;
  margin: 0 0 32px 0;
}

.settings-group {
  background: white;
  border-radius: 20px;
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
  background: #f8fafc;
  border-radius: 12px;
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
  color: #64748b;
  padding: 4px 8px;
  background: white;
  border-radius: 6px;
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
  border-radius: 8px;
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

.btn-generate-small {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-generate-small:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-stop-small {
  background: #f59e0b;
  color: white;
}

.btn-stop-small:hover:not(:disabled) {
  background: #d97706;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.btn-clear-small {
  background: #ef4444;
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

/* 进度条样式 */
.progress-container {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-container:not(.progress-visible) {
  opacity: 0;
  visibility: hidden;
}

.progress-bar {
  width: 100%;
  height: 16px;
  background: #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  transition: width 0.3s ease;
  border-radius: 8px;
}

.progress-text {
  font-size: 11px;
  color: #666;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 768px) {
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

  .progress-container {
    min-width: 0;
    max-width: 100%;
    width: 100%;
    order: 3;
  }

  .progress-text {
    white-space: normal;
    word-break: break-all;
    font-size: 10px;
  }

  .relation-actions {
    order: 4;
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

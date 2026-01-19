<template>
  <div class="question-practice">
    <!-- 左侧固定区域 -->
    <div class="left-panel">
      <!-- 问题标题 -->
      <div class="question-header">
        <h2 class="question-title">{{ props.selectQuestion?.question_text }}</h2>
      </div>

      <!-- 笔记输入框 - 扩大占据更多空间 -->
      <div class="notes-container">
        <textarea class="notes-input" placeholder="临时笔记" v-model="notes"></textarea>
      </div>

      <!-- 语音练习区域 - 移除外围容器 -->
      <VoicePractice :question="selectQuestion" @new-record="handleNewRecord"
        @temporary-record="handleTemporaryRecord" />
    </div>

    <!-- 右侧记录列表区域 -->
    <div class="right-panel">
      <div class="records-header">
        <h3 class="records-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3H21V21H3V3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round" />
            <path d="M9 9H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M9 15H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          练习记录
        </h3>
        <div class="records-count" v-if="records.length > 0">
          {{ records.length }} 条记录
        </div>
      </div>

      <div class="records-content">
        <RecordsList :records="sortedRecords" :loading="loadingRecords" :temporary-record="temporaryRecord"
          @delete-record="handleDeleteRecord" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { speakingLogger } from '@/shared/utils/logger'
import { Question, SpeakingRecord } from '@/shared/types'
import RecordsList from './RecordsList.vue'
import VoicePractice from './VoicePractice.vue'
import { api } from '@/shared/api'

const props = defineProps<{
  selectQuestion: Question | null
}>()

const records = ref<SpeakingRecord[]>([])
const loadingRecords = ref(false)
const notes = ref('')
const temporaryRecord = ref<Partial<SpeakingRecord> | null>(null)

// 按时间倒序排列记录（最新的在前面）
const sortedRecords = computed(() => {
  if (!Array.isArray(records.value)) {
    return []
  }
  return [...records.value].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
})

// 获取记录列表
const fetchRecords = async () => {
  if (!props.selectQuestion?.id) return

  loadingRecords.value = true
  try {
    const result = await api.speaking.getRecords(props.selectQuestion.id)
    // 处理API返回的数据格式 {records: [...], total: number}
    if (result && typeof result === 'object' && 'records' in result && Array.isArray(result.records)) {
      records.value = result.records
    } else if (Array.isArray(result)) {
      records.value = result
    } else {
      speakingLogger.error('API返回的记录数据格式不正确:', result)
      records.value = []
    }
  } catch (error) {
    speakingLogger.error('获取记录失败:', error)
    records.value = []
  } finally {
    loadingRecords.value = false
  }
}

// 删除记录
const handleDeleteRecord = async (recordId: number) => {
  try {
    // 先从UI中移除
    const recordIndex = records.value.findIndex(r => r.id === recordId)
    if (recordIndex > -1) {
      records.value.splice(recordIndex, 1)
    }

    // 调用删除API
    await api.speaking.deleteRecord(recordId)
  } catch (error) {
    speakingLogger.error('删除记录失败:', error)
    // 如果删除失败，重新获取记录列表
    await fetchRecords()
  }
}

// 处理新记录
const handleNewRecord = (newRecord: SpeakingRecord) => {
  records.value.push(newRecord)
}

// 处理临时记录
const handleTemporaryRecord = (record: Partial<SpeakingRecord> | null) => {
  temporaryRecord.value = record
}

// 监听选中题目变化
watch(() => props.selectQuestion, (newQuestion) => {
  if (newQuestion) {
    fetchRecords()
    notes.value = '' // 切换题目时清空笔记
    temporaryRecord.value = null // 切换题目时清空临时记录
  } else {
    records.value = []
    notes.value = ''
    temporaryRecord.value = null
  }
}, { immediate: true })

onMounted(() => {
  if (props.selectQuestion) {
    fetchRecords()
  }
})
</script>

<style scoped>
.question-practice {
  width: 100%;
  height: 100vh;
  display: flex;
  gap: 24px;
  padding: 20px;
  box-sizing: border-box;
  background: none;
}

/* 左侧面板 */
.left-panel {
  width: 400px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.question-header {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.question-icon {
  color: #a855f7;
  margin-bottom: 12px;
  display: flex;
  justify-content: center;
}

.question-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.5;
  text-align: left;
  white-space: pre-line;
}

.notes-container {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notes-input {
  width: 100%;
  min-height: 120px;
  /* 减少最小高度为VoicePractice让出空间 */
  max-height: 200px;
  /* 减少最大高度 */
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  color: #374151;
  background: white;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.3s ease;
  box-sizing: border-box;
}

.notes-input:focus {
  outline: none;
  border-color: #a855f7;
  box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.1);
}

.notes-input::placeholder {
  color: #9ca3af;
}

/* 右侧面板 */
.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.records-header {
  padding: 20px 20px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(248, 250, 252, 0.8);
}

.records-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 8px;
}

.records-count {
  font-size: 14px;
  color: #6b7280;
  background: rgba(168, 85, 247, 0.1);
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: 500;
}

.records-content {
  flex: 1;
  padding: 20px;
  overflow: auto;
}

/* 移动端适配 */
@media (max-width: 1024px) {
  .question-practice {
    flex-direction: column;
    padding: 8px; /* 减少padding */
    gap: 12px; /* 减少gap */
    height: auto; /* 移动端使用自动高度 */
    min-height: calc(100vh - 120px); /* 减去顶部空间 */
  }

  .left-panel {
    width: 100%;
    flex-shrink: 1;
  }

  .notes-container {
    padding: 16px;
  }

  .notes-input {
    min-height: 80px;
    max-height: 120px;
  }

  .right-panel {
    flex: 1;
    min-height: 400px;
  }
}

@media (max-width: 768px) {
  .question-practice {
    padding: 4px; /* 进一步减少padding */
    gap: 8px; /* 进一步减少gap */
    min-height: calc(100vh - 120px); /* 统一减去的空间 */
  }

  .question-header,
  .notes-container {
    padding: 16px;
    border-radius: 12px;
  }

  .question-title {
    font-size: 15px;
  }

  .records-header {
    padding: 16px;
  }

  .records-title {
    font-size: 16px;
  }

  .records-content {
    padding: 16px;
  }
}

@media (max-width: 480px) {
  .question-practice {
    padding: 2px; /* 小屏幕更少的padding */
    gap: 6px;
    min-height: calc(100vh - 100px); /* 小屏幕优化空间使用 */
  }

  .notes-input {
    min-height: 60px;
    max-height: 100px;
  }

  .question-header,
  .notes-container {
    padding: 12px; /* 小屏幕减少内部padding */
    border-radius: 10px;
  }
}
</style>
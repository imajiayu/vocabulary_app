<template>
  <div class="records-list">
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>正在加载记录...</p>
    </div>

    <div v-else-if="records.length === 0 && !temporaryRecord" class="empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 15L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M12 9L12 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12 C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2"/>
        </svg>
      </div>
      <p>暂无练习记录</p>
      <span>开始你的第一次练习吧！</span>
    </div>

    <div v-else class="records-container">
      <div class="records-scroll" ref="scrollContainer">
        <!-- 临时记录 (置顶) -->
        <RecordItem
          v-if="temporaryRecord"
          key="temporary-record"
          :record="temporaryRecord as SpeakingRecord"
          :is-temporary="true"
          @delete="() => {}"
        />
        <!-- 正式记录 -->
        <RecordItem
          v-for="record in records"
          :key="record.id || `record-${record.created_at}`"
          :record="record"
          :is-temporary="false"
          @delete="$emit('deleteRecord', record.id)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { SpeakingRecord } from '@/shared/types'
import RecordItem from './RecordItem.vue'

const props = defineProps<{
  records: SpeakingRecord[]
  loading: boolean
  temporaryRecord?: Partial<SpeakingRecord> | null
}>()

const emit = defineEmits<{
  deleteRecord: [recordId: number]
}>()

const scrollContainer = ref<HTMLElement>()

// 当有新记录时滚动到底部（新记录会被添加到数组末尾）
watch(() => props.records.length, async (newLength, oldLength) => {
  if (newLength > oldLength && scrollContainer.value) {
    await nextTick()
    scrollContainer.value.scrollTo({
      top: scrollContainer.value.scrollHeight,
      behavior: 'smooth'
    })
  }
})
</script>

<style scoped>
.records-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.loading-state, .empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #6b7280;
  gap: 16px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top: 3px solid #a855f7;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.empty-icon {
  color: #d1d5db;
  opacity: 0.7;
}

.empty-state p {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.empty-state span {
  font-size: 14px;
  opacity: 0.8;
}

.records-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.records-scroll {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.records-scroll::-webkit-scrollbar {
  width: 6px;
}

.records-scroll::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.records-scroll::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #a855f7, #3b82f6);
  border-radius: 3px;
}

.records-scroll::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #9333ea, #2563eb);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
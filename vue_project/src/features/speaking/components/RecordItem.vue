<!-- RecordItem.vue -->
<template>
  <div class="record-item" :class="{ 'temporary': isTemporary }">
    <div class="record-header">
      <div class="record-time">
        {{ isTemporary ? '当前练习' : formatTime(record.created_at) }}
      </div>
      <div class="header-badges">
        <div v-if="isTemporary" class="temporary-badge">
          临时记录
        </div>
      </div>
      <button
        v-if="!isTemporary"
        class="delete-btn"
        @click="$emit('delete')"
        :disabled="!record.id"
        title="删除记录"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- 显示音频、转录和AI反馈 -->
    <RecordContent :record="record" :is-practicing="false" />

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SpeakingRecord } from '@/shared/types'
import RecordContent from './RecordContent.vue'

const props = defineProps<{
  record: SpeakingRecord
  isTemporary?: boolean
}>()

defineEmits<{
  delete: []
}>()


const formatTime = (timeStr: string) => {
  const date = new Date(timeStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  
  return date.toLocaleDateString('zh-CN', { 
    month: 'numeric', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.record-item {
  position: relative;
}

.record-item.temporary {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(59, 130, 246, 0.05));
  border: 1px solid rgba(168, 85, 247, 0.2);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 8px;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding: 0 4px;
}

.header-badges {
  display: flex;
  gap: 6px;
  align-items: center;
}

.record-time {
  font-size: 11px;
  color: #6b7280;
  font-weight: 500;
}

.record-item.temporary .record-time {
  color: #a855f7;
  font-weight: 600;
}

.temporary-badge {
  font-size: 10px;
  background: linear-gradient(135deg, #a855f7, #3b82f6);
  color: white;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 600;
}

.delete-btn {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
}

.delete-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  opacity: 1;
}

.delete-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

</style>
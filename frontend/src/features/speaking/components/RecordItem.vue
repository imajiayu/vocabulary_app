<template>
  <div class="record-item" :class="{ 'is-temporary': isTemporary, 'is-saving': isSaving }">
    <!-- 记录头部 -->
    <div class="record-header">
      <div class="header-left">
        <div class="time-indicator" :class="{ active: isTemporary }">
          <svg v-if="isTemporary" class="live-icon" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4" fill="currentColor"/>
          </svg>
          <svg v-else class="clock-icon" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
            <path d="M12 6V12L16 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="record-time">{{ isTemporary ? '当前会话' : isSaving ? '保存中...' : formatTime(record.created_at) }}</span>
      </div>

      <div class="header-right">
        <span v-if="isTemporary" class="live-badge">
          <span class="badge-dot"></span>
          实时
        </span>
        <button
          v-if="!isTemporary"
          class="delete-btn"
          @click="$emit('delete')"
          :disabled="!record.id || isSaving"
          title="Delete record"
        >
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M3 6H5H21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 记录内容 -->
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

const isSaving = computed(() => props.record.id < 0)

const formatTime = (timeStr: string) => {
  // DB column is TIMESTAMP WITHOUT TIME ZONE — Supabase returns no 'Z' suffix,
  // so JS would interpret it as local time. Force UTC interpretation.
  const utcStr = timeStr.endsWith('Z') || timeStr.includes('+') ? timeStr : timeStr + 'Z'
  const date = new Date(utcStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.record-item {
  background: rgba(250, 247, 242, 0.03);
  border: 1px solid rgba(250, 247, 242, 0.08);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all 0.2s ease;
}

.record-item:hover:not(.is-temporary) {
  background: rgba(250, 247, 242, 0.05);
  border-color: rgba(250, 247, 242, 0.12);
}

.record-item.is-temporary {
  background: linear-gradient(
    135deg,
    rgba(184, 134, 11, 0.08) 0%,
    rgba(153, 107, 61, 0.04) 100%
  );
  border-color: rgba(184, 134, 11, 0.25);
  box-shadow: 0 0 30px rgba(184, 134, 11, 0.1);
}

.record-item.is-saving {
  opacity: 0.75;
  animation: savingPulse 1.5s ease-in-out infinite;
}

@keyframes savingPulse {
  0%, 100% { opacity: 0.75; }
  50% { opacity: 0.55; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   记录头部
   ═══════════════════════════════════════════════════════════════════════════ */

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(250, 247, 242, 0.06);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.time-indicator {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primitive-ink-400);
}

.time-indicator.active {
  color: var(--primitive-gold-500);
}

.live-icon {
  width: 14px;
  height: 14px;
  animation: livePulse 1.5s ease-in-out infinite;
}

@keyframes livePulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
}

.clock-icon {
  width: 16px;
  height: 16px;
}

.record-time {
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  color: var(--primitive-ink-400);
}

.is-temporary .record-time {
  color: var(--primitive-gold-400);
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.live-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(184, 134, 11, 0.2);
  border-radius: var(--radius-full);
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--primitive-gold-400);
}

.badge-dot {
  width: 6px;
  height: 6px;
  background: var(--primitive-gold-500);
  border-radius: 50%;
  animation: badgePulse 1.5s ease-in-out infinite;
}

@keyframes badgePulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.delete-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--primitive-ink-500);
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0;
}

.record-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn svg {
  width: 16px;
  height: 16px;
}

.delete-btn:hover:not(:disabled) {
  background: rgba(155, 59, 59, 0.15);
  color: var(--primitive-brick-400);
}

.delete-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .record-header {
    padding: 10px 14px;
  }

  .time-indicator {
    width: 22px;
    height: 22px;
  }

  .record-time {
    font-size: 11px;
  }

  .live-badge {
    padding: 3px 8px;
    font-size: 10px;
  }

  .delete-btn {
    opacity: 1;
  }
}
</style>

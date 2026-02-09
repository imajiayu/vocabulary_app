<template>
  <div class="records-list">
    <!-- 加载状态 -->
    <div v-if="loading" class="state-container loading-state">
      <div class="loading-visual">
        <div class="loading-ring"></div>
        <div class="loading-ring"></div>
        <div class="loading-ring"></div>
      </div>
      <p class="state-text">加载中...</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="records.length === 0 && !temporaryRecord" class="state-container empty-state">
      <div class="empty-visual">
        <svg viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="36" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4"/>
          <circle cx="40" cy="40" r="8" fill="currentColor" opacity="0.3"/>
          <path d="M40 24V32M40 48V56M24 40H32M48 40H56" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="state-title">暂无录音</p>
      <p class="state-hint">你的练习记录将显示在这里</p>
    </div>

    <!-- 记录列表 -->
    <div v-else class="records-scroll" ref="scrollContainer">
      <!-- 临时记录 (置顶) -->
      <RecordItem
        v-if="temporaryRecord"
        key="temporary-record"
        :record="temporaryRecord as SpeakingRecord"
        :is-temporary="true"
        @delete="() => {}"
      />

      <!-- 分隔线 -->
      <div v-if="temporaryRecord && records.length > 0" class="records-divider">
        <span class="divider-line"></span>
        <span class="divider-text">历史记录</span>
        <span class="divider-line"></span>
      </div>

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

defineEmits<{
  deleteRecord: [recordId: number]
}>()

const scrollContainer = ref<HTMLElement>()

// 当有新记录时滚动到底部
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

/* ═══════════════════════════════════════════════════════════════════════════
   状态容器
   ═══════════════════════════════════════════════════════════════════════════ */

.state-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
  gap: 16px;
}

/* 加载状态 */
.loading-visual {
  position: relative;
  width: 60px;
  height: 60px;
}

.loading-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40px;
  height: 40px;
  margin: -20px 0 0 -20px;
  border: 2px solid transparent;
  border-top-color: var(--primitive-gold-500);
  border-radius: 50%;
  animation: loadingSpin 1.2s linear infinite;
}

.loading-ring:nth-child(2) {
  width: 50px;
  height: 50px;
  margin: -25px 0 0 -25px;
  animation-delay: 0.15s;
  opacity: 0.6;
}

.loading-ring:nth-child(3) {
  width: 60px;
  height: 60px;
  margin: -30px 0 0 -30px;
  animation-delay: 0.3s;
  opacity: 0.3;
}

@keyframes loadingSpin {
  to { transform: rotate(360deg); }
}

.state-text {
  font-family: var(--font-ui);
  font-size: 14px;
  color: var(--primitive-ink-400);
  margin: 0;
}

/* 空状态 */
.empty-visual {
  width: 80px;
  height: 80px;
  color: var(--primitive-ink-500);
  opacity: 0.6;
}

.empty-visual svg {
  width: 100%;
  height: 100%;
}

.state-title {
  font-family: var(--font-ui);
  font-size: 16px;
  font-weight: 600;
  color: var(--primitive-paper-300);
  margin: 0;
}

.state-hint {
  font-family: var(--font-serif);
  font-size: 14px;
  color: var(--primitive-ink-400);
  margin: 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   记录滚动区域
   ═══════════════════════════════════════════════════════════════════════════ */

.records-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-right: 4px;
}

/* 自定义滚动条 */
.records-scroll::-webkit-scrollbar {
  width: 6px;
}

.records-scroll::-webkit-scrollbar-track {
  background: rgba(250, 247, 242, 0.05);
  border-radius: 3px;
}

.records-scroll::-webkit-scrollbar-thumb {
  background: rgba(250, 247, 242, 0.2);
  border-radius: 3px;
  transition: background 0.2s ease;
}

.records-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(250, 247, 242, 0.3);
}

/* ═══════════════════════════════════════════════════════════════════════════
   分隔线
   ═══════════════════════════════════════════════════════════════════════════ */

.records-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(250, 247, 242, 0.15) 50%,
    transparent 100%
  );
}

.divider-text {
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--primitive-ink-400);
  white-space: nowrap;
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .state-container {
    padding: 30px 16px;
  }

  .loading-visual {
    width: 50px;
    height: 50px;
  }

  .empty-visual {
    width: 64px;
    height: 64px;
  }

  .state-title {
    font-size: 15px;
  }

  .state-hint {
    font-size: 13px;
  }

  .records-scroll {
    gap: 12px;
    /* 移动端：取消独立滚动，让内容撑开页面 */
    overflow-y: visible;
    flex: none;
  }
}
</style>

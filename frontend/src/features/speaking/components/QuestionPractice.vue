<template>
  <div class="studio-workspace" :class="{ 'is-recording': isRecordingActive }">
    <!-- 主录音区域 -->
    <div class="main-stage">
      <!-- 题目展示卡片 -->
      <div class="question-card">
        <div class="card-accent"></div>
        <div class="card-content">
          <span class="card-label">题目</span>
          <h2 class="question-text">{{ props.selectQuestion?.question_text }}</h2>
        </div>
        <div class="card-decoration">
          <svg viewBox="0 0 100 100" class="quote-mark">
            <text x="50" y="75" text-anchor="middle" font-size="80" fill="currentColor">"</text>
          </svg>
        </div>
      </div>

      <!-- 笔记输入区 -->
      <div class="notes-panel">
        <div class="panel-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <span>笔记</span>
        </div>
        <textarea
          class="notes-textarea"
          placeholder="录音前记下你的想法..."
          v-model="notes"
        ></textarea>
      </div>

      <!-- 录音控制台 -->
      <VoicePractice
        :question="selectQuestion"
        @new-record="handleNewRecord"
        @temporary-record="handleTemporaryRecord"
      />
    </div>

    <!-- 录音历史面板 -->
    <div class="history-panel">
      <div class="panel-chrome">
        <div class="chrome-header">
          <div class="header-title">
            <div class="pulse-dot" :class="{ active: temporaryRecord }"></div>
            <span>录音历史</span>
          </div>
          <div class="record-counter" v-if="records.length > 0">
            <span class="counter-value">{{ records.length }}</span>
            <span class="counter-label">次</span>
          </div>
        </div>
        <div class="chrome-content">
          <RecordsList
            :records="sortedRecords"
            :loading="loadingRecords"
            :temporary-record="temporaryRecord"
            @delete-record="handleDeleteRecord"
          />
        </div>
      </div>
    </div>

    <!-- 移动端底部录音控制 -->
    <div class="mobile-controls" v-if="false">
      <!-- 预留移动端特殊控制 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
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

// 录音状态追踪
const isRecordingActive = computed(() => {
  return temporaryRecord.value !== null
})

// 按时间倒序排列记录（最新的在前面）
const sortedRecords = computed(() => {
  if (!Array.isArray(records.value)) {
    return []
  }
  return [...records.value].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
})

// 获取记录列表（使用 Supabase 直接查询）
const fetchRecords = async () => {
  if (!props.selectQuestion?.id) return

  loadingRecords.value = true
  try {
    const result = await api.speaking.getRecordsDirect(props.selectQuestion.id)
    if (result && typeof result === 'object' && 'records' in result && Array.isArray(result.records)) {
      records.value = result.records
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

// 删除记录 (使用 Supabase 直接写入)
const handleDeleteRecord = async (recordId: number) => {
  try {
    const recordIndex = records.value.findIndex(r => r.id === recordId)
    if (recordIndex > -1) {
      records.value.splice(recordIndex, 1)
    }
    await api.speaking.deleteRecordDirect(recordId)
  } catch (error) {
    speakingLogger.error('删除记录失败:', error)
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
    notes.value = ''
    temporaryRecord.value = null
  } else {
    records.value = []
    notes.value = ''
    temporaryRecord.value = null
  }
}, { immediate: true })
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Studio Workspace - 录音工作室风格
   ═══════════════════════════════════════════════════════════════════════════ */

.studio-workspace {
  width: 100%;
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 420px;
  gap: 0;
  background: linear-gradient(
    135deg,
    var(--primitive-ink-900) 0%,
    var(--primitive-ink-800) 50%,
    #1a1f2e 100%
  );
  position: relative;
  overflow: hidden;
}

/* 背景装饰 */
.studio-workspace::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(ellipse 80% 50% at 20% 40%, rgba(184, 134, 11, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse 60% 40% at 80% 60%, rgba(153, 107, 61, 0.06) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

/* 录音时的环境光效 */
.studio-workspace.is-recording::before {
  background:
    radial-gradient(ellipse 80% 50% at 20% 40%, rgba(155, 59, 59, 0.12) 0%, transparent 50%),
    radial-gradient(ellipse 60% 40% at 80% 60%, rgba(155, 59, 59, 0.08) 0%, transparent 50%);
  animation: ambientPulse 2s ease-in-out infinite;
}

@keyframes ambientPulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   主舞台区域
   ═══════════════════════════════════════════════════════════════════════════ */

.main-stage {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 32px;
  overflow-y: auto;
}

/* ═══════════════════════════════════════════════════════════════════════════
   题目卡片
   ═══════════════════════════════════════════════════════════════════════════ */

.question-card {
  position: relative;
  background: linear-gradient(
    135deg,
    rgba(250, 247, 242, 0.06) 0%,
    rgba(250, 247, 242, 0.02) 100%
  );
  border: 1px solid rgba(184, 134, 11, 0.2);
  border-radius: var(--radius-xl);
  padding: 28px 32px;
  overflow: hidden;
}

.card-accent {
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(
    180deg,
    var(--primitive-gold-400) 0%,
    var(--primitive-copper-500) 100%
  );
  border-radius: 4px 0 0 4px;
}

.card-content {
  position: relative;
  z-index: 2;
}

.card-label {
  display: inline-block;
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--primitive-gold-400);
  margin-bottom: 12px;
  padding: 4px 10px;
  background: rgba(184, 134, 11, 0.15);
  border-radius: var(--radius-sm);
}

.question-text {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 500;
  line-height: 1.6;
  color: var(--primitive-paper-100);
  white-space: pre-line;
}

.card-decoration {
  position: absolute;
  top: 12px;
  right: 20px;
  opacity: 0.08;
  pointer-events: none;
}

.quote-mark {
  width: 60px;
  height: 60px;
  color: var(--primitive-gold-400);
}

/* ═══════════════════════════════════════════════════════════════════════════
   笔记面板
   ═══════════════════════════════════════════════════════════════════════════ */

.notes-panel {
  background: rgba(250, 247, 242, 0.03);
  border: 1px solid rgba(250, 247, 242, 0.08);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: border-color 0.3s ease, background 0.3s ease;
}

.notes-panel:focus-within {
  border-color: rgba(184, 134, 11, 0.3);
  background: rgba(250, 247, 242, 0.05);
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(250, 247, 242, 0.06);
  color: var(--primitive-paper-500);
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.panel-header svg {
  opacity: 0.6;
}

.notes-textarea {
  width: 100%;
  min-height: 100px;
  max-height: 160px;
  padding: 16px;
  border: none;
  background: transparent;
  color: var(--primitive-paper-200);
  font-family: var(--font-serif);
  font-size: 15px;
  line-height: 1.6;
  resize: vertical;
  box-sizing: border-box;
}

.notes-textarea::placeholder {
  color: var(--primitive-ink-400);
  font-style: italic;
}

.notes-textarea:focus {
  outline: none;
}

/* ═══════════════════════════════════════════════════════════════════════════
   历史记录面板
   ═══════════════════════════════════════════════════════════════════════════ */

.history-panel {
  position: relative;
  z-index: 1;
  background: rgba(0, 0, 0, 0.25);
  border-left: 1px solid rgba(250, 247, 242, 0.08);
  display: flex;
  flex-direction: column;
}

.panel-chrome {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chrome-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(250, 247, 242, 0.08);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 600;
  color: var(--primitive-paper-200);
  letter-spacing: 0.02em;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primitive-ink-500);
  transition: background 0.3s ease;
}

.pulse-dot.active {
  background: var(--primitive-brick-500);
  animation: pulseDot 1.5s ease-in-out infinite;
}

@keyframes pulseDot {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(155, 59, 59, 0.4);
  }
  50% {
    transform: scale(1.1);
    box-shadow: 0 0 0 6px rgba(155, 59, 59, 0);
  }
}

.record-counter {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(184, 134, 11, 0.15);
  border-radius: var(--radius-full);
}

.counter-value {
  font-family: var(--font-data);
  font-size: 16px;
  font-weight: 700;
  color: var(--primitive-gold-400);
}

.counter-label {
  font-family: var(--font-ui);
  font-size: 11px;
  color: var(--primitive-gold-500);
  text-transform: lowercase;
}

.chrome-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

/* ═══════════════════════════════════════════════════════════════════════════
   平板适配 (768px - 1024px)
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 1024px) {
  .studio-workspace {
    grid-template-columns: 1fr 340px;
  }

  .main-stage {
    padding: 24px;
  }

  .question-card {
    padding: 24px 28px;
  }

  .question-text {
    font-size: 20px;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端适配 (< 768px)
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .studio-workspace {
    display: flex;
    flex-direction: column;
    min-height: auto;
    overflow: visible;
    /* 隐藏滚动条但保持滚动功能 */
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .studio-workspace::-webkit-scrollbar {
    display: none;
  }

  .main-stage {
    padding: 16px;
    gap: 16px;
    order: 1;
    overflow: visible;
  }

  .question-card {
    padding: 20px 24px;
    border-radius: var(--radius-lg);
  }

  .card-label {
    font-size: 10px;
    padding: 3px 8px;
  }

  .question-text {
    font-size: 18px;
    line-height: 1.5;
  }

  .quote-mark {
    width: 40px;
    height: 40px;
  }

  .notes-panel {
    border-radius: var(--radius-md);
  }

  .notes-textarea {
    min-height: 80px;
    max-height: 120px;
    padding: 12px;
    font-size: 14px;
  }

  .history-panel {
    order: 2;
    border-left: none;
    border-top: 1px solid rgba(250, 247, 242, 0.08);
    /* 移除高度限制，让内容自然撑开 */
    max-height: none;
    flex-shrink: 0;
    /* 底部留出导航栏空间 */
    padding-bottom: 80px;
  }

  .chrome-header {
    padding: 16px;
  }

  .header-title {
    font-size: 13px;
  }

  .chrome-content {
    padding: 12px;
    overflow: visible;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   小屏手机适配 (< 480px)
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 480px) {
  .main-stage {
    padding: 12px;
    gap: 12px;
  }

  .question-card {
    padding: 16px 20px;
  }

  .question-text {
    font-size: 16px;
  }

  .card-decoration {
    display: none;
  }

  .panel-header {
    padding: 10px 12px;
    font-size: 11px;
  }

  .notes-textarea {
    min-height: 60px;
    max-height: 100px;
    padding: 10px;
    font-size: 13px;
  }

  .history-panel {
    /* 移除高度限制 */
    max-height: none;
  }

  .chrome-header {
    padding: 12px;
  }

  .record-counter {
    padding: 4px 10px;
  }

  .counter-value {
    font-size: 14px;
  }

  .chrome-content {
    padding: 10px;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   横屏适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-height: 500px) and (orientation: landscape) {
  .studio-workspace {
    grid-template-columns: 1fr 300px;
    min-height: 100vh;
  }

  .main-stage {
    padding: 12px 16px;
    gap: 12px;
  }

  .question-card {
    padding: 12px 16px;
  }

  .question-text {
    font-size: 15px;
  }

  .notes-textarea {
    min-height: 50px;
    max-height: 80px;
  }

  .history-panel {
    max-height: none;
  }

  .chrome-header {
    padding: 12px 16px;
  }
}
</style>

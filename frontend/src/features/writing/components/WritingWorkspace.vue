<template>
  <div class="writing-workspace">
    <!-- Header with timer -->
    <header class="workspace-header">
      <TimerDisplay
        v-if="isTimerActive"
        :timer="timer"
      />

      <div class="header-actions">
        <span v-if="wordCount > 0" class="word-count">{{ wordCount }} 词</span>
      </div>
    </header>

    <!-- 题目栏 - 紧凑横跨展示 -->
    <div class="prompt-bar">
      <div class="prompt-badge">
        <span class="task-type" :class="{ 't1': prompt.task_type === 1, 't2': prompt.task_type === 2 }">
          Task {{ prompt.task_type }}
        </span>
        <span class="time-limit">{{ prompt.task_type === 1 ? '20' : '40' }}min</span>
      </div>
      <p class="prompt-text">{{ prompt.prompt_text }}</p>
      <button
        v-if="prompt.image_url"
        class="image-trigger"
        @click="showImageModal = true"
      >
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
          <path d="M21 15L16 10L5 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>查看图表</span>
      </button>
    </div>

    <!-- 图片弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showImageModal" class="image-modal" @click="showImageModal = false">
          <img :src="prompt.image_url || ''" alt="Task 1 Chart" @click.stop />
          <button class="close-modal" @click="showImageModal = false">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- 主工作区 -->
    <div class="workspace-main">
      <!-- Start Session State -->
      <div v-if="pageState === 'prompt_selected'" class="start-session">
        <div class="start-content">
          <div class="start-icon">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
              <path d="M12 6V12L16 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <h2 class="start-title">准备好了吗？</h2>
          <p class="start-desc">
            Task {{ prompt.task_type }} - {{ prompt.task_type === 1 ? '20' : '40' }} 分钟
          </p>
          <button class="start-btn" @click="handleStartSession">
            开始写作
          </button>
        </div>
      </div>

      <!-- Writing State -->
      <div v-else-if="pageState === 'writing'" class="writing-area">
        <div class="editor-column">
          <EssayEditor
            v-model="essayContent"
            :disabled="false"
            :highlights="currentHighlights"
            @word-count="handleWordCount"
          />
          <div class="submit-bar">
            <button
              class="submit-btn"
              :disabled="!canSubmit"
              @click="handleSubmitEssay"
            >
              {{ isSubmitting ? '提交中...' : '提交作文' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Feedback / Revision / Completed State - 双栏布局 -->
      <div v-else-if="showRightPanel" class="feedback-area">
        <!-- 左侧：编辑器（固定，不滚动） -->
        <div class="editor-column">
          <EssayEditor
            v-model="essayContent"
            :disabled="!isRevising"
            :highlights="currentHighlights"
            @word-count="handleWordCount"
            @highlight-click="handleHighlightClick"
          />
          <!-- 只在 feedback_1 且非修改模式时显示"开始修改"按钮 -->
          <div v-if="pageState === 'feedback_1' && !isRevising" class="revision-bar">
            <button class="revision-btn" @click="startRevision">
              开始修改
            </button>
          </div>
          <!-- 修改模式时显示提交按钮 -->
          <div v-else-if="isRevising" class="submit-bar">
            <button
              class="submit-btn"
              :disabled="!canSubmit"
              @click="handleSubmitRevision"
            >
              {{ isSubmitting ? '提交中...' : '提交终稿' }}
            </button>
          </div>
        </div>

        <!-- 右侧：Tab 面板 -->
        <div class="right-panel-column">
          <RightPanelTabs
            v-model="activeTab"
            :tabs="rightPanelTabs"
          >
            <template #feedback>
              <FeedbackPanel
                :feedback="currentFeedback"
                :loading="isFeedbackLoading"
                :scores="finalScores"
                :show-scores="pageState === 'completed'"
                :show-diff="pageState === 'completed' && versions.length >= 2"
                :diff-old-text="versions.length >= 2 ? versions[0].content : undefined"
                :diff-new-text="versions.length >= 2 ? versions[1].content : undefined"
                @issue-click="handleIssueClick"
                @request-suggestion="handleRequestSuggestion"
              />
            </template>
            <template #notes>
              <PromptNotes
                :notes="prompt.notes"
                :prompt-id="prompt.id"
                @save="handleSavePromptNotes"
              />
            </template>
            <template #chat>
              <PostFinalChat
                ref="chatRef"
                :essay-context="latestEssay"
                @ask="handleAskQuestion"
              />
            </template>
          </RightPanelTabs>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type {
  WritingPrompt,
  WritingFeedback,
  WritingScores,
  WritingVersion,
  WritingIssue,
  HighlightRegion
} from '@/shared/types/writing'
import { useWritingContext, useWritingTimer } from '../composables'
import { WritingApi } from '@/shared/api/writing'
import { TASK_TIME_LIMITS } from '@/shared/types/writing'
import TimerDisplay from './TimerDisplay.vue'
import EssayEditor from './EssayEditor.vue'
import FeedbackPanel from './FeedbackPanel.vue'
import RightPanelTabs, { type TabItem } from './RightPanelTabs.vue'
import PromptNotes from './PromptNotes.vue'
import PostFinalChat from './PostFinalChat.vue'

const props = defineProps<{
  prompt: WritingPrompt
}>()

const context = useWritingContext()

// Timer
const timer = useWritingTimer({
  timeLimit: TASK_TIME_LIMITS[props.prompt.task_type],
  onTimeUp: () => {
    // Optionally auto-submit or show warning
  }
})

// Local state
const essayContent = ref('')
const wordCount = ref(0)
const showImageModal = ref(false)
const isSubmitting = ref(false)
const isFeedbackLoading = ref(false)
const isRevising = ref(false)
const currentFeedback = ref<WritingFeedback | null>(null)
const finalScores = ref<WritingScores | null>(null)
const highlightedIssueId = ref<string | null>(null)
const activeTab = ref('feedback')
const chatRef = ref<InstanceType<typeof PostFinalChat> | null>(null)

// 右侧面板 Tab 配置
const rightPanelTabs: TabItem[] = [
  { id: 'feedback', label: '反馈' },
  { id: 'notes', label: '笔记' },
  { id: 'chat', label: 'AI 聊天' }
]

// Computed
const pageState = computed(() => context.pageState.value)
const versions = computed(() => context.versions.value)

const isTimerActive = computed(() => {
  return pageState.value === 'writing' || isRevising.value
})

// 是否显示右侧面板（feedback_1、revision、completed 状态）
const showRightPanel = computed(() => {
  return pageState.value === 'feedback_1' || pageState.value === 'completed'
})

const canSubmit = computed(() => {
  return essayContent.value.trim().length > 50 && !isSubmitting.value
})

const currentHighlights = computed((): HighlightRegion[] => {
  // 修改模式下不显示高亮 - 位置信息会因编辑而失效
  if (!currentFeedback.value || isRevising.value) return []
  return currentFeedback.value.issues.map(issue => ({
    start: issue.location.start,
    end: issue.location.end,
    type: issue.type,
    issueId: issue.id
  }))
})

const latestEssay = computed(() => {
  if (versions.value.length === 0) return essayContent.value
  return versions.value[versions.value.length - 1].content
})

// Actions
async function handleStartSession() {
  await context.startSession()
  timer.start()
}

function handleWordCount(count: number) {
  wordCount.value = count
}

async function handleSubmitEssay() {
  if (!canSubmit.value) return

  isSubmitting.value = true
  timer.pause()

  try {
    // Create version
    const version = await context.submitVersion(essayContent.value)
    if (!version) throw new Error('Failed to create version')

    // Get AI feedback
    isFeedbackLoading.value = true
    context.setPageState('feedback_1')

    const feedback = await WritingApi.getInitialFeedback(
      props.prompt.prompt_text,
      essayContent.value,
      props.prompt.task_type,
      props.prompt.image_url || undefined
    )

    currentFeedback.value = feedback
    await context.updateVersionFeedback(version.id, feedback)
  } catch (error) {
    console.error('Submit essay failed:', error)
    alert('提交失败，请重试')
    context.setPageState('writing')
    timer.resume()
  } finally {
    isSubmitting.value = false
    isFeedbackLoading.value = false
  }
}

function startRevision() {
  isRevising.value = true
  timer.resume()
}

/**
 * 提交终稿 (V2)
 * V2改动：并行获取修订反馈和最终评分，然后合并
 */
async function handleSubmitRevision() {
  if (!canSubmit.value) return

  isSubmitting.value = true
  timer.pause()

  try {
    const previousVersion = versions.value[0] // V1
    const version = await context.submitVersion(essayContent.value)
    if (!version) throw new Error('Failed to create version')

    isFeedbackLoading.value = true
    context.setPageState('completed')

    // 并行调用：获取修订反馈 + 最终评分
    const [revisionResult, scoresResult] = await Promise.all([
      WritingApi.getRevisionFeedback(
        props.prompt.prompt_text,
        previousVersion.content,
        essayContent.value,
        props.prompt.task_type
      ),
      WritingApi.getFinalScores(
        props.prompt.prompt_text,
        essayContent.value,
        props.prompt.task_type
      )
    ])

    // 合并反馈：使用修订反馈的 issues 和 improvement，加上评分反馈的 summary
    const combinedFeedback: WritingFeedback = {
      issues: revisionResult.issues,
      improvement: revisionResult.improvement,
      summary: scoresResult.feedback.summary
    }

    currentFeedback.value = combinedFeedback
    finalScores.value = scoresResult.scores

    // 保存到数据库
    await context.updateVersionFeedback(version.id, combinedFeedback)
    await context.updateVersionScores(version.id, scoresResult.scores)
    await context.completeSession(timer.getElapsedSeconds())

    isRevising.value = false
  } catch (error) {
    console.error('Submit revision failed:', error)
    alert('提交失败，请重试')
    // 回退状态
    context.setPageState('feedback_1')
    timer.resume()
  } finally {
    isSubmitting.value = false
    isFeedbackLoading.value = false
  }
}

function handleHighlightClick(issueId: string) {
  highlightedIssueId.value = issueId
}

function handleIssueClick(issue: WritingIssue) {
  highlightedIssueId.value = issue.id
  // Scroll to issue location in editor (handled by EssayEditor)
}

async function handleRequestSuggestion(issue: WritingIssue) {
  if (issue.suggestion) return // Already has suggestion

  try {
    // Get context around the issue
    const start = Math.max(0, issue.location.start - 50)
    const end = Math.min(essayContent.value.length, issue.location.end + 50)
    const context = essayContent.value.substring(start, end)

    const suggestion = await WritingApi.getIssueSuggestion(issue, context)

    // Update the issue with suggestion
    if (currentFeedback.value) {
      currentFeedback.value = {
        ...currentFeedback.value,
        issues: currentFeedback.value.issues.map(i =>
          i.id === issue.id ? { ...i, suggestion } : i
        )
      }
    }
  } catch (error) {
    console.error('Get suggestion failed:', error)
    alert('获取建议失败，请重试')
  }
}

/**
 * 保存题目笔记
 * V2改动：笔记从 session 级别改为 prompt 级别
 */
async function handleSavePromptNotes(promptId: number, notes: string) {
  await context.updatePromptNotes(promptId, notes)
}

async function handleAskQuestion(question: string, selectedText?: string) {
  try {
    const answer = await WritingApi.askQuestion(question, latestEssay.value, selectedText)
    return answer
  } catch (error) {
    console.error('Ask question failed:', error)
    throw error
  }
}

// Initialize from existing session
onMounted(() => {
  restoreFromSession()
})

// Watch for session changes (e.g., when resuming an in-progress session)
watch(() => context.currentSession.value, (newSession) => {
  if (newSession) {
    restoreFromSession()
  }
}, { immediate: false })

function restoreFromSession() {
  if (!context.currentSession.value) return

  if (versions.value.length > 0) {
    const lastVersion = versions.value[versions.value.length - 1]
    essayContent.value = lastVersion.content

    if (lastVersion.feedback) {
      currentFeedback.value = lastVersion.feedback
    }
    if (lastVersion.scores) {
      finalScores.value = lastVersion.scores
    }
  }
}
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Writing Workspace - 新布局
   桌面端：题目横跨顶部 + 编辑器/反馈两栏（仅反馈滚动）
   移动端：垂直堆叠，所有模块不独立滚动，页面整体滚动
   ═══════════════════════════════════════════════════════════════════════════ */

.writing-workspace {
  width: 100%;
  height: 100vh; /* 固定视口高度，页面不滚动 */
  display: flex;
  flex-direction: column;
  background: linear-gradient(
    180deg,
    var(--primitive-ink-900) 0%,
    var(--primitive-ink-800) 100%
  );
  overflow: hidden; /* 阻止页面整体滚动 */
}

/* ═══════════════════════════════════════════════════════════════════════════
   Header
   ═══════════════════════════════════════════════════════════════════════════ */

.workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(59, 130, 246, 0.15);
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.word-count {
  font-size: 14px;
  color: var(--primitive-ink-400);
  padding: 6px 12px;
  background: rgba(250, 247, 242, 0.05);
  border-radius: var(--radius-sm);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Prompt Bar - 紧凑横跨展示
   ═══════════════════════════════════════════════════════════════════════════ */

.prompt-bar {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 24px;
  background: rgba(0, 0, 0, 0.25);
  border-bottom: 1px solid rgba(59, 130, 246, 0.12);
  flex-shrink: 0;
}

.prompt-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.task-type {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.task-type.t1 {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.task-type.t2 {
  background: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

.time-limit {
  font-size: 10px;
  color: var(--primitive-ink-400);
  font-weight: 500;
}

.prompt-bar .prompt-text {
  flex: 1;
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--primitive-paper-300);
  /* 限制最大高度，超出显示省略 */
  max-height: 4.8em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.image-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: var(--radius-sm);
  color: var(--primitive-azure-400);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.image-trigger svg {
  width: 14px;
  height: 14px;
}

.image-trigger:hover {
  background: rgba(59, 130, 246, 0.2);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Image Modal
   ═══════════════════════════════════════════════════════════════════════════ */

.image-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.9);
  z-index: 300;
  padding: 40px;
}

.image-modal img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--radius-md);
}

.close-modal {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(250, 247, 242, 0.1);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-modal svg {
  width: 20px;
  height: 20px;
}

.close-modal:hover {
  background: rgba(250, 247, 242, 0.2);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Workspace
   ═══════════════════════════════════════════════════════════════════════════ */

.workspace-main {
  flex: 1;
  display: flex;
  min-height: 0; /* 重要：允许flex子元素收缩 */
  overflow: hidden; /* 阻止溢出 */
}

/* ═══════════════════════════════════════════════════════════════════════════
   Start Session
   ═══════════════════════════════════════════════════════════════════════════ */

.start-session {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.start-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.start-icon {
  width: 80px;
  height: 80px;
  margin-bottom: 24px;
  color: var(--primitive-azure-400);
  opacity: 0.8;
}

.start-icon svg {
  width: 100%;
  height: 100%;
}

.start-title {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 600;
  color: var(--primitive-paper-200);
}

.start-desc {
  margin: 0 0 32px;
  font-size: 16px;
  color: var(--primitive-ink-400);
}

.start-btn {
  padding: 14px 32px;
  font-size: 16px;
  font-weight: 600;
  background: var(--primitive-azure-500);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.start-btn:hover {
  background: var(--primitive-azure-600);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Writing Area - 单栏编辑
   ═══════════════════════════════════════════════════════════════════════════ */

.writing-area {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.writing-area .editor-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Feedback Area - 双栏布局
   ═══════════════════════════════════════════════════════════════════════════ */

.feedback-area {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

/* 编辑器列 - 固定高度，内部编辑器可滚动 */
.editor-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* 右侧面板列 - Tab 面板 */
.right-panel-column {
  width: 400px;
  flex-shrink: 0;
  border-left: 1px solid rgba(59, 130, 246, 0.1);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Submit / Revision Bars
   ═══════════════════════════════════════════════════════════════════════════ */

.submit-bar,
.revision-bar {
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(59, 130, 246, 0.1);
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.submit-btn {
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  background: var(--primitive-azure-500);
  border: none;
  border-radius: var(--radius-sm);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submit-btn:hover:not(:disabled) {
  background: var(--primitive-azure-600);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.revision-btn {
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  background: rgba(250, 247, 242, 0.1);
  border: 1px solid rgba(250, 247, 242, 0.2);
  border-radius: var(--radius-sm);
  color: var(--primitive-paper-200);
  cursor: pointer;
  transition: all 0.2s ease;
}

.revision-btn:hover {
  background: rgba(250, 247, 242, 0.15);
}


/* ═══════════════════════════════════════════════════════════════════════════
   平板适配 (768px - 1024px)
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 1024px) {
  .right-panel-column {
    width: 340px;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端适配 (< 768px) - 所有模块不独立滚动，页面整体滚动
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .writing-workspace {
    min-height: auto;
    height: auto;
  }

  .workspace-header {
    padding: 10px 16px;
  }

  /* 题目栏 - 移动端垂直排列 */
  .prompt-bar {
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px;
  }

  .prompt-badge {
    flex-direction: row;
    gap: 10px;
  }

  .prompt-bar .prompt-text {
    max-height: none;
    -webkit-line-clamp: unset;
    display: block;
    font-size: 13px;
  }

  .image-trigger {
    align-self: flex-start;
  }

  /* 主工作区 - 垂直堆叠 */
  .workspace-main {
    flex-direction: column;
    flex: none;
    min-height: auto;
  }

  /* Writing Area */
  .writing-area {
    flex: none;
    flex-direction: column;
    min-height: auto;
  }

  .writing-area .editor-column {
    flex: none;
    min-height: auto;
  }

  /* Feedback Area - 垂直堆叠，不独立滚动 */
  .feedback-area {
    flex: none;
    flex-direction: column;
    min-height: auto;
  }

  .editor-column {
    flex: none;
    min-height: auto;
  }

  .right-panel-column {
    width: 100%;
    border-left: none;
    border-top: 1px solid rgba(59, 130, 246, 0.1);
    /* 底部留出导航栏空间 */
    padding-bottom: 80px;
  }

  /* Start Session */
  .start-session {
    padding: 40px 20px;
  }

  .start-icon {
    width: 60px;
    height: 60px;
  }

  .start-title {
    font-size: 24px;
  }

  .start-desc {
    font-size: 14px;
  }

  /* Image Modal */
  .image-modal {
    padding: 20px;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   小屏手机适配 (< 480px)
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 480px) {
  .workspace-header {
    padding: 8px 12px;
  }

  .prompt-bar {
    padding: 12px;
    gap: 10px;
  }

  .task-type {
    font-size: 10px;
    padding: 3px 8px;
  }

  .prompt-bar .prompt-text {
    font-size: 12px;
    line-height: 1.5;
  }

  .submit-bar,
  .revision-bar {
    padding: 12px;
  }

  .submit-btn,
  .revision-btn {
    padding: 10px 20px;
    font-size: 13px;
  }

  .start-btn {
    padding: 12px 24px;
    font-size: 14px;
  }
}
</style>

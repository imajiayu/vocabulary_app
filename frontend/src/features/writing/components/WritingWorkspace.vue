<template>
  <div class="writing-workspace">
    <!-- 非工作区状态：顶部显示题目栏 -->
    <header v-if="!showWorkspace && (isTimerActive || wordCount > 0)" class="workspace-header">
      <TimerDisplay
        v-if="isTimerActive"
        :timer="timer"
      />

      <div class="header-actions">
        <span v-if="wordCount > 0" class="word-count">{{ wordCount }} 词</span>
      </div>
    </header>

    <PromptBar
      v-if="pageState === 'prompt_selected'"
      :prompt="prompt"
      @show-image="showImageModal = true"
    />

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
      <!-- Loading State (session check) -->
      <div v-if="pageState === 'prompt_selected' && isSessionLoading" class="start-session">
        <div class="start-content">
          <div class="session-loader">
            <div class="loader-ring"></div>
          </div>
          <p class="loader-text">检查会话...</p>
        </div>
      </div>

      <!-- Start Session State -->
      <div v-else-if="pageState === 'prompt_selected'" class="start-session">
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

      <!-- Outline State -->
      <OutlineEditor
        v-else-if="pageState === 'outline'"
        :initial-outline="currentSession?.outline || ''"
        :ask-handler="handleOutlineAskWrapper"
        :edit-handler="handleOutlineEditWrapper"
        :prompt="prompt"
        @save="handleSaveOutline"
        @show-image="showImageModal = true"
      />

      <!-- Writing / Feedback / Revision / Completed - 双栏布局 -->
      <div v-else-if="showWorkspace" class="workspace-area">
        <div class="editor-column">
          <!-- 编辑器顶栏：题目 + 状态 -->
          <PromptBar
            :prompt="prompt"
            compact
            @show-image="showImageModal = true"
          >
            <template #trailing>
              <TimerDisplay v-if="isTimerActive" :timer="timer" />
              <span v-if="wordCount > 0" class="word-count">{{ wordCount }} 词</span>
            </template>
          </PromptBar>
          <EssayEditor
            v-model="essayContent"
            :disabled="!isEditorEditable"
            :feedback="inlineFeedback"
            @word-count="handleWordCount"
            @text-selected="handleTextSelected"
          />
          <div v-if="pageState === 'writing'" class="submit-bar">
            <button class="submit-btn" :disabled="!canSubmit" @click="handleSubmitDraft">
              {{ isSubmitting ? '提交中...' : '提交初稿' }}
            </button>
          </div>
          <div v-else-if="pageState === 'feedback'" class="revision-bar">
            <button
              class="revision-btn"
              :disabled="isFeedbackLoading"
              @click="startRevision"
            >{{ isFeedbackLoading ? '分析中...' : '开始修改' }}</button>
          </div>
          <div v-else-if="isRevising" class="submit-bar">
            <button class="submit-btn" :disabled="!canSubmit" @click="handleSubmitFinal">
              {{ isSubmitting ? '提交中...' : '提交终稿' }}
            </button>
          </div>
          <div v-else-if="pageState === 'completed' && !hasInProgressSession" class="revision-bar">
            <button class="restart-btn" @click="handleRestart">
              重新练习
            </button>
          </div>
        </div>

        <!-- 右侧：上下分栏 -->
        <div class="right-panel-column">
          <!-- 上半部分：大纲/笔记切换 -->
          <div class="right-panel-top">
            <RightPanelTabs v-model="activeTab" :tabs="rightPanelTabs">
              <template #outline>
                <div class="outline-tab">
                  <div
                    v-if="currentSession?.outline"
                    class="outline-rendered markdown-content"
                    v-html="renderedOutline"
                  ></div>
                  <div v-else class="outline-empty">
                    <p>暂无大纲</p>
                  </div>
                </div>
              </template>
              <template #notes>
                <PromptNotes
                  :notes="prompt.notes"
                  :prompt-id="prompt.id"
                  @save="handleSavePromptNotes"
                />
              </template>
              <template #feedback>
                <div class="feedback-tab">
                  <template v-for="(para, index) in draftParagraphs" :key="index">
                    <p class="para-feedback-original fb-original">{{ para }}</p>
                    <div
                      v-if="currentSession?.feedback?.[index]"
                      class="para-feedback-improved fb-improved markdown-content"
                      v-html="formatMarkdown(currentSession.feedback[index].improved)"
                    ></div>
                    <p
                      v-if="currentSession?.feedback?.[index]"
                      class="para-feedback-notes fb-notes"
                    >{{ currentSession.feedback[index].notes }}</p>
                  </template>
                </div>
              </template>
              <template #scores>
                <div class="scores-tab">
                  <ScoreSummary
                    v-if="currentSession?.scores"
                    :scores="currentSession.scores"
                    :summary="scoreSummary"
                  />
                </div>
              </template>
            </RightPanelTabs>
          </div>
          <!-- 下半部分：AI 聊天（始终可见） -->
          <div class="right-panel-bottom">
            <AiChatPanel
              ref="chatRef"
              :ask-handler="handleAskQuestion"
              :edit-handler="handleEditText"
              :support-edit="true"
              @replace="handleReplace"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { WritingPrompt } from '@/shared/types/writing'
import { useWritingContext, useWritingTimer } from '../composables'
import { TASK_TIME_LIMITS } from '@/shared/types/writing'
import { editWritingText, askWritingQuestion } from '@/shared/services/writing-ai'
import { formatMarkdown } from '@/shared/utils/markdown'
import { logger } from '@/shared/utils/logger'
import PromptBar from './PromptBar.vue'
import TimerDisplay from './TimerDisplay.vue'
import EssayEditor, { type TextSelection } from './EssayEditor.vue'
import OutlineEditor from './OutlineEditor.vue'
import RightPanelTabs, { type TabItem } from './RightPanelTabs.vue'
import PromptNotes from './PromptNotes.vue'
import AiChatPanel from './AiChatPanel.vue'
import ScoreSummary from './ScoreSummary.vue'

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
const activeTab = ref('outline')
const chatRef = ref<InstanceType<typeof AiChatPanel> | null>(null)
const selectionContext = ref<TextSelection | null>(null)
const scoreSummary = ref<string | null>(null)

// 右侧面板 Tab 配置（AI 聊天始终展示在下方，不再作为 tab）
const rightPanelTabs = computed<TabItem[]>(() => {
  const tabs: TabItem[] = [
    { id: 'outline', label: '大纲' },
    { id: 'notes', label: '笔记' }
  ]
  if (currentSession.value?.feedback?.length) {
    tabs.push({ id: 'feedback', label: '反馈' })
  }
  if (currentSession.value?.scores) {
    tabs.push({ id: 'scores', label: '评分' })
  }
  return tabs
})

// Computed
const pageState = computed(() => context.pageState.value)
const currentSession = computed(() => context.currentSession.value)
const isSessionLoading = computed(() => context.sessionChecking.value)

const hasInProgressSession = computed(() => {
  return context.promptSessions.value.some(s => s.status !== 'completed')
})

const isTimerActive = computed(() => {
  return pageState.value === 'writing' || isRevising.value
})

const showWorkspace = computed(() => {
  return ['writing', 'feedback', 'revision', 'completed'].includes(pageState.value)
})

const isEditorEditable = computed(() => {
  return pageState.value === 'writing' || isRevising.value
})

const inlineFeedback = computed(() => {
  if (isEditorEditable.value) return null
  if (pageState.value === 'completed') return null
  return currentSession.value?.feedback || null
})

const canSubmit = computed(() => {
  return essayContent.value.trim().length > 50 && !isSubmitting.value
})

const latestEssay = computed(() => {
  if (currentSession.value?.final_content) return currentSession.value.final_content
  if (currentSession.value?.draft_content) return currentSession.value.draft_content
  return essayContent.value
})

const renderedOutline = computed(() => {
  return formatMarkdown(currentSession.value?.outline || '')
})

const draftParagraphs = computed(() => {
  const draft = currentSession.value?.draft_content || ''
  return draft.split('\n\n').filter(p => p.trim().length > 0)
})

// Actions
async function handleStartSession() {
  await context.startSession()
}

async function handleRestart() {
  essayContent.value = ''
  wordCount.value = 0
  scoreSummary.value = null
  isRevising.value = false
  activeTab.value = 'outline'
  timer.reset()
  await context.startSession()
}

function handleWordCount(count: number) {
  wordCount.value = count
}

async function handleSaveOutline(outline: string) {
  await context.saveOutline(outline)
  timer.start()
}

async function handleOutlineAskWrapper(question: string, selectedText?: string) {
  return await context.handleOutlineAsk(question, selectedText)
}

async function handleOutlineEditWrapper(selectedText: string, instruction: string) {
  return await context.handleOutlineEdit(selectedText, instruction)
}

async function handleSubmitDraft() {
  if (!canSubmit.value) return

  isSubmitting.value = true
  isFeedbackLoading.value = true
  timer.pause()

  try {
    await context.submitDraft(essayContent.value)
  } catch (error) {
    logger.error('Submit draft failed:', error)
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
  context.setPageState('revision')
  context.updateSession({ status: 'revision' })
  activeTab.value = 'feedback'
  timer.resume()
}

async function handleSubmitFinal() {
  if (!canSubmit.value) return

  isSubmitting.value = true
  isFeedbackLoading.value = true
  timer.pause()

  try {
    const result = await context.submitFinal(essayContent.value, timer.getElapsedSeconds())
    if (result) {
      scoreSummary.value = result.summary
    }
    isRevising.value = false
    activeTab.value = 'scores'
  } catch (error) {
    logger.error('Submit final failed:', error)
    alert('提交失败，请重试')
    context.setPageState('revision')
    timer.resume()
  } finally {
    isSubmitting.value = false
    isFeedbackLoading.value = false
  }
}

async function handleSavePromptNotes(promptId: number, notes: string) {
  await context.updatePromptNotes(promptId, notes)
}

function handleTextSelected(selection: TextSelection) {
  selectionContext.value = selection
  chatRef.value?.setSelectedText(selection.text)
}

function handleReplace(newText: string) {
  const ctx = selectionContext.value
  if (!ctx) return

  if (ctx.source === 'original' || ctx.source === 'textarea') {
    // Replace in essayContent
    const oldText = ctx.text
    const idx = essayContent.value.indexOf(oldText)
    if (idx !== -1) {
      essayContent.value =
        essayContent.value.substring(0, idx) +
        newText +
        essayContent.value.substring(idx + oldText.length)
    }
  } else if (ctx.source === 'improved') {
    // Replace in feedback[paragraphIndex].improved
    const feedback = currentSession.value?.feedback
    if (feedback && feedback[ctx.paragraphIndex]) {
      const oldText = ctx.text
      const improved = feedback[ctx.paragraphIndex].improved
      const idx = improved.indexOf(oldText)
      if (idx !== -1) {
        feedback[ctx.paragraphIndex].improved =
          improved.substring(0, idx) +
          newText +
          improved.substring(idx + oldText.length)
        // Persist the updated feedback
        context.updateSession({ feedback: [...feedback] })
      }
    }
  }

  selectionContext.value = null
}

async function handleEditText(selectedText: string, instruction: string) {
  return await editWritingText(selectedText, instruction, latestEssay.value)
}

async function handleAskQuestion(question: string, selectedText?: string) {
  try {
    return await askWritingQuestion(question, latestEssay.value, selectedText)
  } catch (error) {
    logger.error('Ask question failed:', error)
    throw error
  }
}

// Initialize from existing session
onMounted(() => {
  restoreFromSession()
})

// Watch for session changes
watch(() => context.currentSession.value, (newSession) => {
  if (newSession) {
    restoreFromSession()
  }
}, { immediate: false })

function restoreFromSession() {
  if (!currentSession.value) return

  const session = currentSession.value

  // Restore essay content based on state
  if (session.status === 'revision' || session.status === 'completed') {
    // In revision or completed, show final or draft content
    essayContent.value = session.final_content || session.draft_content || ''
    if (session.status === 'revision') {
      isRevising.value = true
    }
    if (session.status === 'completed' && session.scores) {
      activeTab.value = 'scores'
    }
  } else if (session.status === 'feedback') {
    essayContent.value = session.draft_content || ''
  } else if (session.status === 'writing') {
    essayContent.value = session.draft_content || ''
  }
}
</script>

<style src="@/shared/styles/markdown-content.css"></style>
<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Writing Workspace — "Midnight Scholar"
   Deep charcoal canvas with warm amber accents and cream writing surfaces
   ═══════════════════════════════════════════════════════════════════════════ */

.writing-workspace {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    /* Subtle paper grain texture */
    url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.015'/%3E%3C/svg%3E"),
    linear-gradient(175deg, #151921 0%, #1a1f2e 40%, #1c2333 100%);
  overflow: hidden;
  color: var(--primitive-paper-300);
}

/* ═══════════ Header ═══════════ */

.workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  background: rgba(0, 0, 0, 0.25);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  backdrop-filter: blur(12px);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.word-count {
  font-family: var(--font-data);
  font-size: 12px;
  font-weight: 500;
  color: rgba(250, 247, 242, 0.5);
  padding: 5px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-full);
  letter-spacing: 0.03em;
  font-variant-numeric: tabular-nums;
}

/* ═══════════ Image Modal ═══════════ */

.image-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.92);
  backdrop-filter: blur(20px);
  z-index: 300;
  padding: 40px;
}

.image-modal img {
  max-width: 90%;
  max-height: 85vh;
  object-fit: contain;
  border-radius: var(--radius-md);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
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
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-modal svg {
  width: 18px;
  height: 18px;
}

.close-modal:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}
.modal-enter-active img {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-leave-active img {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from img {
  transform: scale(0.92);
}

/* ═══════════ Main Workspace ═══════════ */

.workspace-main {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

/* ═══════════ Session Loader ═══════════ */

.session-loader {
  margin-bottom: 20px;
}

.loader-ring {
  width: 36px;
  height: 36px;
  border: 2px solid rgba(255, 255, 255, 0.06);
  border-top-color: var(--primitive-gold-400);
  border-radius: 50%;
  animation: loaderSpin 0.8s linear infinite;
}

@keyframes loaderSpin {
  to { transform: rotate(360deg); }
}

.loader-text {
  margin: 0;
  font-family: var(--font-ui);
  font-size: 13px;
  color: rgba(250, 247, 242, 0.35);
  letter-spacing: 0.02em;
}

/* ═══════════ Start Session ═══════════ */

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
  animation: startFadeIn 0.5s ease-out;
}

@keyframes startFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.start-icon {
  width: 72px;
  height: 72px;
  margin-bottom: 28px;
  color: var(--primitive-gold-400);
  opacity: 0.7;
}

.start-icon svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 2px 12px rgba(221, 165, 32, 0.2));
}

.start-title {
  margin: 0 0 8px;
  font-family: var(--font-serif);
  font-size: 26px;
  font-weight: 600;
  color: var(--primitive-paper-200);
  letter-spacing: -0.01em;
}

.start-desc {
  margin: 0 0 36px;
  font-family: var(--font-data);
  font-size: 13px;
  color: rgba(250, 247, 242, 0.4);
  letter-spacing: 0.05em;
}

.start-btn {
  padding: 14px 36px;
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 600;
  background: linear-gradient(135deg, var(--primitive-azure-500), var(--primitive-azure-600));
  border: none;
  border-radius: var(--radius-default);
  color: white;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  letter-spacing: 0.02em;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.25);
}

.start-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(59, 130, 246, 0.35);
  filter: brightness(1.08);
}

.start-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

/* ═══════════ Workspace Area (双栏) ═══════════ */

.workspace-area {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.editor-column {
  flex: 6;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.right-panel-column {
  flex: 4;
  min-width: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ── 右侧上下分栏 ── */

.right-panel-top {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.right-panel-bottom {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* ═══════════ Submit / Revision Bars ═══════════ */

.submit-bar,
.revision-bar {
  padding: 14px 20px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
}

.submit-btn {
  padding: 10px 24px;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  background: linear-gradient(135deg, var(--primitive-azure-500), var(--primitive-azure-600));
  border: none;
  border-radius: var(--radius-sm);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.02em;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
}

.submit-btn:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
}

.submit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}

.revision-btn {
  padding: 10px 24px;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-sm);
  color: var(--primitive-paper-300);
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.02em;
}

.revision-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--primitive-paper-200);
}

.revision-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.restart-btn {
  padding: 10px 24px;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-sm);
  color: var(--primitive-paper-300);
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.02em;
}

.restart-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--primitive-paper-200);
}

/* ═══════════ Outline Tab ═══════════ */

.outline-tab {
  height: 100%;
  overflow-y: auto;
  padding: 20px;
}

.outline-rendered {
  font-family: var(--font-serif);
  font-size: 13px;
  line-height: 1.85;
  color: rgba(250, 247, 242, 0.65);
}

.outline-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.outline-empty p {
  margin: 0;
  font-size: 13px;
  color: rgba(250, 247, 242, 0.3);
  font-style: italic;
}

/* ═══════════ Scores Tab ═══════════ */

.scores-tab {
  height: 100%;
  overflow-y: auto;
  padding: 20px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
}

.scores-tab::-webkit-scrollbar {
  width: 4px;
}

.scores-tab::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

/* ═══════════ Feedback Tab (read-only) ═══════════ */

.feedback-tab {
  height: 100%;
  overflow-y: auto;
  padding: 20px;
  user-select: none;
  -webkit-user-select: none;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
}

.feedback-tab::-webkit-scrollbar {
  width: 4px;
}

.feedback-tab::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

/* feedback styles: inherits from markdown-content.css (.para-feedback-*) */
.fb-original,
.fb-improved,
.fb-notes {
  font-size: 13px;
}

/* ═══════════ Tablet (768px - 1024px) ═══════════ */

@media (max-width: 1024px) {
  .editor-column {
    flex: 5;
  }

  .right-panel-column {
    flex: 5;
  }
}

/* ═══════════ Mobile (< 768px) ═══════════ */

@media (max-width: 768px) {
  .writing-workspace {
    min-height: auto;
    height: auto;
  }

  .workspace-header {
    padding: 10px 16px;
  }

  .workspace-main {
    flex-direction: column;
    flex: none;
    min-height: auto;
  }

  .workspace-area {
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
    flex: none;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding-bottom: 80px;
  }

  .right-panel-top,
  .right-panel-bottom {
    flex: none;
    overflow-y: visible;
  }

  .right-panel-top {
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .start-session {
    padding: 40px 20px;
  }

  .start-icon {
    width: 56px;
    height: 56px;
  }

  .start-title {
    font-size: 22px;
  }

  .start-desc {
    font-size: 12px;
  }

  .image-modal {
    padding: 16px;
  }

  .image-modal img {
    max-width: 100%;
    max-height: 80vh;
  }
}

</style>

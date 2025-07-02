<template>
  <div
    class="prompt-item"
    :class="{
      'is-selected': isSelected,
      'is-expanded': isExpanded,
      'is-task-1': prompt.task_type === 1,
      'is-task-2': prompt.task_type === 2
    }"
  >
    <!-- Prompt Header (clickable) -->
    <div class="prompt-header" @click="handleClick">
      <!-- Task Type Badge -->
      <span class="task-badge">
        {{ prompt.task_type === 1 ? 'T1' : 'T2' }}
      </span>

      <!-- Prompt Text (full, no truncation) -->
      <div class="prompt-text">
        {{ prompt.prompt_text }}
      </div>

      <!-- Expand indicator for prompts with sessions -->
      <svg
        v-if="hasSessions"
        class="expand-chevron"
        :class="{ 'is-open': isExpanded }"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>

      <!-- Action Buttons - appear on hover -->
      <div class="action-buttons" @click.stop>
        <!-- Move Button -->
        <div class="move-dropdown">
          <button class="action-btn move-btn" @click="toggleMoveMenu" title="移动到文件夹">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <!-- Dropdown Menu -->
          <div v-if="showMoveMenu" class="move-menu">
            <button
              v-if="prompt.folder_id !== null"
              class="move-menu-item"
              @click="handleMove(null)"
            >
              未分类
            </button>
            <button
              v-for="folder in availableFolders"
              :key="folder.id"
              class="move-menu-item"
              @click="handleMove(folder.id)"
            >
              {{ folder.name }}
            </button>
            <div v-if="availableFolders.length === 0 && prompt.folder_id === null" class="move-menu-empty">
              暂无文件夹
            </div>
          </div>
        </div>

        <!-- Delete Button -->
        <button class="action-btn delete-btn" @click="handleDelete" title="删除">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M3 6H5H21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Sessions List (expanded for prompts with sessions) -->
    <Transition name="sessions-expand">
      <div v-if="isExpanded && sessions.length > 0" class="sessions-list" @click.stop>
        <div
          v-for="session in sessions"
          :key="session.id"
          class="session-row"
          :class="{ 'is-active': context.currentSession.value?.id === session.id }"
          @click="handleToggleSession(session.id)"
        >
          <span class="session-status" :class="'status-' + session.status">
            {{ SESSION_STATUS_LABELS[session.status] }}
          </span>
          <span class="session-date">{{ formatSessionDate(session.created_at) }}</span>
          <span v-if="session.scores" class="session-score">{{ session.scores.overall }}</span>
          <button class="session-delete" @click.stop="handleDeleteSession(session.id)" title="删除记录">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M6 6L18 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { WritingPrompt } from '@/shared/types/writing'
import { SESSION_STATUS_LABELS } from '@/shared/types/writing'
import { useWritingContext } from '../composables'

const props = defineProps<{
  prompt: WritingPrompt
}>()

const context = useWritingContext()

// Local state
const showMoveMenu = ref(false)
const isExpanded = ref(false)

// Computed
const isSelected = computed(() => {
  return context.selectedPrompt.value?.id === props.prompt.id
})

const sessions = computed(() => {
  return context.allSessions.value.get(props.prompt.id) || []
})

const hasSessions = computed(() => sessions.value.length > 0)

const availableFolders = computed(() => {
  return context.folders.value.filter(f => f.id !== props.prompt.folder_id)
})

// Click handler: different behavior based on whether prompt has sessions
function handleClick() {
  if (hasSessions.value) {
    // Has sessions: toggle expand/collapse the session list
    isExpanded.value = !isExpanded.value
    // When collapsing, if current session belongs to this prompt, deselect it
    if (!isExpanded.value && context.currentSession.value) {
      const currentPromptId = context.currentSession.value.prompt_id
      if (currentPromptId === props.prompt.id) {
        context.deselectSession()
      }
    }
  } else {
    // No sessions: toggle select/deselect prompt (original behavior)
    context.selectPrompt(props.prompt)
  }
}

// Toggle session selection: click to select, click again to deselect
function handleToggleSession(sessionId: number) {
  if (context.currentSession.value?.id === sessionId) {
    // Already selected, deselect
    context.deselectSession()
  } else {
    // Select this session (also sets selectedPrompt internally)
    context.selectSession(sessionId)
  }
}

function handleDelete() {
  context.deletePrompt(props.prompt.id)
}

function toggleMoveMenu() {
  showMoveMenu.value = !showMoveMenu.value
}

async function handleMove(folderId: number | null) {
  showMoveMenu.value = false
  await context.movePrompt(props.prompt.id, folderId)
}

function handleDeleteSession(sessionId: number) {
  context.deleteSession(sessionId)
}

function formatSessionDate(dateStr: string): string {
  const d = new Date(dateStr)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = d.getHours().toString().padStart(2, '0')
  const minutes = d.getMinutes().toString().padStart(2, '0')
  return `${month}/${day} ${hours}:${minutes}`
}

// 点击外部关闭菜单
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.move-dropdown')) {
    showMoveMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.prompt-item {
  position: relative;
  border-radius: var(--radius-sm);
  background: rgba(250, 247, 242, 0.02);
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.prompt-item:hover {
  background: rgba(250, 247, 242, 0.05);
  border-color: rgba(250, 247, 242, 0.08);
}

.prompt-item.is-selected {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.25);
}

.prompt-item.is-expanded {
  background: rgba(59, 130, 246, 0.06);
  border-color: rgba(59, 130, 246, 0.15);
}

/* ── Prompt Header ── */
.prompt-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
}

/* ── Task Badge ── */
.task-badge {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 20px;
  margin-top: 1px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 4px;
  text-transform: uppercase;
}

.is-task-1 .task-badge {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.is-task-2 .task-badge {
  background: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

/* ── Prompt Text (full display, no truncation) ── */
.prompt-text {
  flex: 1;
  font-size: 13px;
  line-height: 1.5;
  color: var(--primitive-paper-300);
  word-break: break-word;
}

.prompt-item.is-selected .prompt-text,
.prompt-item.is-expanded .prompt-text {
  color: var(--primitive-paper-200);
}

/* ── Expand Chevron ── */
.expand-chevron {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  color: var(--primitive-ink-400);
  transition: transform 0.2s ease, color 0.2s ease;
}

.expand-chevron.is-open {
  transform: rotate(180deg);
  color: var(--primitive-azure-400);
}

/* ── Action Buttons ── */
.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 4px;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.prompt-item:hover .action-buttons {
  opacity: 1;
  pointer-events: auto;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--radius-sm);
  background: rgba(250, 247, 242, 0.1);
  color: var(--primitive-paper-400);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn svg {
  width: 12px;
  height: 12px;
}

.action-btn:hover {
  background: rgba(250, 247, 242, 0.15);
  color: var(--primitive-paper-200);
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: var(--primitive-brick-400);
}

/* ── Move Dropdown ── */
.move-dropdown {
  position: relative;
}

.move-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 100;
  min-width: 120px;
  margin-top: 4px;
  padding: 4px;
  background: var(--primitive-ink-800);
  border: 1px solid rgba(250, 247, 242, 0.1);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.move-menu-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--primitive-paper-300);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.move-menu-item:hover {
  background: rgba(250, 247, 242, 0.1);
  color: var(--primitive-paper-200);
}

.move-menu-empty {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--primitive-ink-400);
  text-align: center;
}

/* ── Sessions List ── */
.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 12px 8px;
  border-top: 1px solid rgba(250, 247, 242, 0.06);
}

.session-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.session-row:hover {
  background: rgba(250, 247, 242, 0.05);
}

.session-row.is-active {
  background: rgba(59, 130, 246, 0.12);
}

.session-status {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}

.session-status.status-outline,
.session-status.status-writing {
  background: rgba(251, 191, 36, 0.12);
  color: #fbbf24;
}

.session-status.status-feedback,
.session-status.status-revision {
  background: rgba(59, 130, 246, 0.12);
  color: #60a5fa;
}

.session-status.status-completed {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}

.session-date {
  flex: 1;
  font-size: 11px;
  font-family: var(--font-mono);
  color: rgba(250, 247, 242, 0.4);
}

.session-score {
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--primitive-gold-400);
}

.session-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: rgba(250, 247, 242, 0.3);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
}

.session-delete svg {
  width: 10px;
  height: 10px;
}

.session-row:hover .session-delete {
  opacity: 1;
  pointer-events: auto;
}

.session-delete:hover {
  background: rgba(239, 68, 68, 0.2);
  color: var(--primitive-brick-400);
}

/* ── Sessions Expand Transition ── */
.sessions-expand-enter-active,
.sessions-expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.sessions-expand-enter-from,
.sessions-expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.sessions-expand-enter-to,
.sessions-expand-leave-from {
  opacity: 1;
  max-height: 400px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mobile Adjustments
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .prompt-header {
    padding: 10px;
    gap: 8px;
  }

  .task-badge {
    width: 24px;
    height: 18px;
    font-size: 9px;
  }

  .prompt-text {
    font-size: 12px;
    line-height: 1.45;
  }

  /* Always show action buttons on mobile */
  .action-buttons {
    opacity: 1;
    pointer-events: auto;
    margin-left: 4px;
  }

  .action-btn {
    width: 28px;
    height: 28px;
    background: transparent;
  }

  .action-btn svg {
    width: 14px;
    height: 14px;
  }

  /* Move menu adjustments for mobile */
  .move-menu {
    min-width: 140px;
  }

  .move-menu-item {
    padding: 10px 12px;
    font-size: 13px;
  }

  /* Disable hover effects on mobile */
  .prompt-item:hover {
    background: rgba(250, 247, 242, 0.02);
    border-color: transparent;
  }

  .prompt-item:active {
    background: rgba(59, 130, 246, 0.08);
  }

  .prompt-item.is-selected:hover {
    background: rgba(59, 130, 246, 0.1);
  }

  .prompt-item.is-expanded:hover {
    background: rgba(59, 130, 246, 0.06);
  }
}
</style>

<template>
  <div
    class="prompt-item"
    :class="{
      'is-selected': isSelected,
      'is-task-1': prompt.task_type === 1,
      'is-task-2': prompt.task_type === 2
    }"
    @click="handleSelect"
  >
    <!-- Task Type Badge -->
    <span class="task-badge">
      {{ prompt.task_type === 1 ? 'T1' : 'T2' }}
    </span>

    <!-- Prompt Text -->
    <div class="prompt-text">
      {{ truncatedText }}
    </div>

    <!-- Action Buttons - appear on hover -->
    <div class="action-buttons">
      <!-- Move Button -->
      <div class="move-dropdown" @click.stop>
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
      <button class="action-btn delete-btn" @click.stop="handleDelete" title="删除">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M3 6H5H21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { WritingPrompt } from '@/shared/types/writing'
import { useWritingContext } from '../composables'

const props = defineProps<{
  prompt: WritingPrompt
}>()

const context = useWritingContext()

// Local state
const showMoveMenu = ref(false)

// Computed
const isSelected = computed(() => {
  return context.selectedPrompt.value?.id === props.prompt.id
})

const truncatedText = computed(() => {
  const text = props.prompt.prompt_text
  if (text.length > 80) {
    return text.substring(0, 80) + '...'
  }
  return text
})

// 可移动到的文件夹（排除当前所在的文件夹）
const availableFolders = computed(() => {
  return context.folders.value.filter(f => f.id !== props.prompt.folder_id)
})

// Actions
function handleSelect() {
  context.selectPrompt(props.prompt)
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
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: rgba(250, 247, 242, 0.02);
  border: 1px solid transparent;
  cursor: pointer;
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

/* ── Task Badge ── */
.task-badge {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 20px;
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

/* ── Prompt Text ── */
.prompt-text {
  flex: 1;
  font-size: 13px;
  line-height: 1.5;
  color: var(--primitive-paper-300);
  word-break: break-word;
}

.prompt-item.is-selected .prompt-text {
  color: var(--primitive-paper-200);
}

/* ── Action Buttons ── */
.action-buttons {
  display: none;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
}

.prompt-item:hover .action-buttons {
  display: flex;
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

/* ═══════════════════════════════════════════════════════════════════════════
   Mobile Adjustments
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 480px) {
  .prompt-item {
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
    display: flex;
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
}
</style>

<template>
  <div class="folder-item" :class="{ 'is-expanded': isExpanded }">
    <!-- Folder Header -->
    <div class="folder-header" @click="toggleExpand">
      <div class="folder-info">
        <svg class="folder-icon" viewBox="0 0 24 24" fill="none">
          <path
            v-if="isExpanded"
            d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            v-else
            d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="currentColor"
            fill-opacity="0.1"
          />
        </svg>
        <span v-if="!isEditing" class="folder-name">{{ folder.name }}</span>
        <input
          v-else
          ref="editInputRef"
          v-model="editName"
          type="text"
          class="folder-edit-input"
          @keyup.enter="saveEdit"
          @keyup.escape="cancelEdit"
          @blur="saveEdit"
        />
      </div>
      <!-- Right side: Count/Expand OR Actions -->
      <div class="folder-right">
        <!-- Default: count + expand icon -->
        <div class="folder-meta">
          <span class="folder-count">{{ prompts.length }}</span>
          <svg class="expand-icon" viewBox="0 0 24 24" fill="none">
            <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <!-- Hover: action buttons -->
        <div class="folder-actions">
          <button class="action-btn" @click.stop="startEdit" title="重命名">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="action-btn action-btn--danger" @click.stop="handleDelete" title="删除">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M3 6H5H21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Folder Content (Prompts) -->
    <Transition name="expand">
      <div v-if="isExpanded && prompts.length > 0" class="folder-content">
        <PromptItem
          v-for="prompt in prompts"
          :key="`prompt-${prompt.id}`"
          :prompt="prompt"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import type { WritingFolder, WritingPrompt } from '@/shared/types/writing'
import { useWritingContext } from '../composables'
import PromptItem from './PromptItem.vue'

const props = defineProps<{
  folder: WritingFolder
  prompts: WritingPrompt[]
}>()

const context = useWritingContext()

// Local state
const isExpanded = ref(false)
const isEditing = ref(false)
const editName = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)

// Toggle expansion
function toggleExpand() {
  if (!isEditing.value) {
    isExpanded.value = !isExpanded.value
  }
}

// Edit operations
function startEdit() {
  editName.value = props.folder.name
  isEditing.value = true
  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

async function saveEdit() {
  if (!isEditing.value) return

  const newName = editName.value.trim()
  if (newName && newName !== props.folder.name) {
    try {
      await context.updateFolder(props.folder.id, newName)
    } catch {
      // Error handled by context
    }
  }
  isEditing.value = false
}

function cancelEdit() {
  isEditing.value = false
  editName.value = ''
}

// Delete
function handleDelete() {
  context.deleteFolder(props.folder.id)
}
</script>

<style scoped>
.folder-item {
  position: relative;
  border-radius: var(--radius-md);
  background: rgba(250, 247, 242, 0.03);
  border: 1px solid rgba(250, 247, 242, 0.05);
  transition: all 0.2s ease;
}

.folder-item:hover {
  background: rgba(250, 247, 242, 0.05);
  border-color: rgba(250, 247, 242, 0.1);
}

.folder-item.is-expanded {
  background: rgba(59, 130, 246, 0.05);
  border-color: rgba(59, 130, 246, 0.15);
}

/* ── Header ── */
.folder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
}

.folder-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.folder-icon {
  width: 18px;
  height: 18px;
  color: var(--primitive-azure-400);
  flex-shrink: 0;
}

.folder-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--primitive-paper-200);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.folder-edit-input {
  flex: 1;
  min-width: 0;
  padding: 2px 6px;
  background: rgba(250, 247, 242, 0.1);
  border: 1px solid var(--primitive-azure-500);
  border-radius: var(--radius-sm);
  color: var(--primitive-paper-200);
  font-size: 14px;
  font-weight: 500;
}

.folder-edit-input:focus {
  outline: none;
}

/* ── Right side container ── */
.folder-right {
  position: relative;
  display: grid;
  align-items: center;
  flex-shrink: 0;
  height: 24px;
}

/* Stack both layers in the same grid cell */
.folder-meta,
.folder-actions {
  grid-area: 1 / 1;
  display: flex;
  align-items: center;
  height: 100%;
  transition: opacity 0.15s ease;
}

.folder-meta {
  gap: 8px;
  opacity: 1;
}

.folder-count {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--primitive-ink-400);
  background: rgba(250, 247, 242, 0.05);
  border-radius: 10px;
}

.expand-icon {
  width: 16px;
  height: 16px;
  color: var(--primitive-ink-400);
  transition: transform 0.2s ease;
}

.folder-item.is-expanded .expand-icon {
  transform: rotate(180deg);
}

/* ── Actions - overlaid on same cell ── */
.folder-actions {
  gap: 4px;
  opacity: 0;
  pointer-events: none;
}

/* Hover: crossfade meta → actions */
.folder-item:hover .folder-meta {
  opacity: 0;
  pointer-events: none;
}

.folder-item:hover .folder-actions {
  opacity: 1;
  pointer-events: auto;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--radius-sm);
  background: rgba(250, 247, 242, 0.1);
  color: var(--primitive-paper-400);
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn svg {
  width: 12px;
  height: 12px;
}

.action-btn:hover {
  background: rgba(250, 247, 242, 0.15);
}

.action-btn--danger:hover {
  background: rgba(239, 68, 68, 0.15);
  color: var(--primitive-brick-400);
}

/* ── Content ── */
.folder-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 8px 8px;
}

/* ── Expand Transition ── */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mobile Adjustments
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .folder-header {
    padding: 12px;
    gap: 10px;
  }

  .folder-icon {
    width: 16px;
    height: 16px;
  }

  .folder-name {
    font-size: 13px;
  }

  /* On mobile: show both meta and actions, no stacking */
  .folder-right {
    display: flex;
    gap: 8px;
    height: auto;
  }

  .folder-meta,
  .folder-actions {
    grid-area: auto;
    opacity: 1;
    pointer-events: auto;
  }

  .folder-count {
    min-width: 18px;
    height: 18px;
    font-size: 10px;
  }

  .expand-icon {
    display: none; /* Hide expand icon on mobile, tap to expand */
  }

  /* Keep meta visible on mobile hover */
  .folder-item:hover .folder-meta {
    opacity: 1;
    pointer-events: auto;
  }

  .action-btn {
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
  }

  .action-btn svg {
    width: 14px;
    height: 14px;
  }

  /* Disable hover effects on mobile */
  .folder-item:hover {
    background: rgba(250, 247, 242, 0.03);
    border-color: rgba(250, 247, 242, 0.05);
  }

  .folder-item:active {
    background: rgba(59, 130, 246, 0.08);
  }

  .folder-content {
    padding: 4px 6px 6px;
  }
}
</style>

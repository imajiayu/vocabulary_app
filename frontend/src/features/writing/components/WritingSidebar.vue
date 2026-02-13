<template>
  <div class="writing-sidebar-wrapper">
    <!-- Mobile overlay backdrop -->
    <Transition name="backdrop">
      <div
        v-if="props.expanded && isMobile"
        class="sidebar-backdrop"
        @click="toggleSidebar"
      />
    </Transition>

    <!-- Mobile floating trigger -->
    <Transition name="trigger">
      <button
        v-if="isMobile && !props.expanded"
        class="mobile-trigger"
        @click="toggleSidebar"
        aria-label="打开题目目录"
      >
        <svg class="trigger-icon" viewBox="0 0 24 24" fill="none">
          <path d="M4 6H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M4 12H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M4 18H14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span class="trigger-label">题目</span>
      </button>
    </Transition>

    <!-- Desktop pull tab -->
    <Teleport to="body">
      <button
        v-if="!isMobile"
        class="desktop-tab"
        :class="{
          'is-open': props.expanded,
          'is-nav-expanded': props.navExpanded
        }"
        @click="toggleSidebar"
        aria-label="切换侧边栏"
      >
        <svg v-if="!props.expanded" class="tab-icon" viewBox="0 0 24 24" fill="none">
          <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg v-else class="tab-icon" viewBox="0 0 24 24" fill="none">
          <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </Teleport>

    <!-- Main Sidebar Panel -->
    <aside
      class="sidebar-panel"
      :class="{
        'is-expanded': props.expanded,
        'is-nav-expanded': props.navExpanded,
        'is-mobile': isMobile
      }"
    >
      <!-- Header -->
      <header class="sidebar-header">
        <div class="header-title-group">
          <svg class="header-icon" viewBox="0 0 24 24" fill="none">
            <path d="M12 19L19 12L22 15L15 22L12 19Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M18 13L16.5 5.5L2 2L5.5 16.5L13 18L18 13Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
          <h2 class="header-title">题目库</h2>
        </div>
        <div class="header-actions">
          <button
            class="header-btn header-btn--primary"
            @click="showPromptEditor = true"
            :disabled="data.loading.value"
            title="新建题目"
          >
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 5V19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M5 12H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
          <button
            class="header-btn"
            @click="showFolderInput = true"
            :disabled="data.loading.value"
            title="新建文件夹"
          >
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 11V17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M9 14H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </header>

      <!-- New folder input -->
      <div v-if="showFolderInput" class="new-folder-input">
        <input
          ref="folderInputRef"
          v-model="newFolderName"
          type="text"
          placeholder="文件夹名称"
          @keyup.enter="createFolder"
          @keyup.escape="cancelFolderInput"
        />
        <button class="btn-confirm" @click="createFolder">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="btn-cancel" @click="cancelFolderInput">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <!-- Content area -->
      <div class="sidebar-body">
        <Loading v-if="data.loading.value" />
        <nav v-else class="prompt-nav" aria-label="题目导航">
          <!-- 文件夹列表 -->
          <FolderItem
            v-for="folder in data.folders.value"
            :key="`folder-${folder.id}`"
            :folder="folder"
            :prompts="data.promptsByFolder.value.get(folder.id) || []"
          />

          <!-- 未分类题目 -->
          <div v-if="uncategorizedPrompts.length > 0" class="uncategorized-section">
            <div class="section-header">
              <span class="section-title">未分类</span>
              <span class="section-count">{{ uncategorizedPrompts.length }}</span>
            </div>
            <div class="prompt-list">
              <PromptItem
                v-for="prompt in uncategorizedPrompts"
                :key="`prompt-${prompt.id}`"
                :prompt="prompt"
              />
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="isEmpty" class="empty-state">
            <div class="empty-visual">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 19L19 12L22 15L15 22L12 19Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                <path d="M18 13L16.5 5.5L2 2L5.5 16.5L13 18L18 13Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              </svg>
            </div>
            <p class="empty-text">暂无题目</p>
            <p class="empty-hint">点击 + 创建新题目</p>
          </div>
        </nav>
      </div>

      <!-- Mobile close handle -->
      <button
        v-if="isMobile"
        class="mobile-close-handle"
        @click="toggleSidebar"
        aria-label="关闭目录"
      >
        <span class="handle-bar"></span>
      </button>
    </aside>

    <!-- Prompt Editor Modal -->
    <PromptEditor
      v-if="showPromptEditor"
      :folders="data.folders.value"
      @save="handlePromptSave"
      @cancel="showPromptEditor = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useBreakpoint } from '@/shared/composables/useBreakpoint'
import Loading from '@/shared/components/feedback/Loading.vue'
import FolderItem from './FolderItem.vue'
import PromptItem from './PromptItem.vue'
import PromptEditor from './PromptEditor.vue'
import type { WritingPrompt, CreatePromptPayload } from '@/shared/types/writing'
import { useWritingContext } from '../composables'

const props = defineProps<{
  expanded: boolean
  navExpanded?: boolean
}>()

const emit = defineEmits<{
  (e: 'prompt-selected', prompt: WritingPrompt | null): void
  (e: 'sidebar-expanded', expanded: boolean): void
}>()

// 使用从 HomePage 注入的 Writing Context
const context = useWritingContext()

// 为了保持与原有代码兼容，创建 data 别名
const data = {
  loading: context.loading,
  folders: context.folders,
  prompts: context.prompts,
  selectedPrompt: context.selectedPrompt,
  expandedFolders: context.expandedFolders,
  promptsByFolder: context.promptsByFolder,
  createFolder: context.createFolder,
  updateFolder: context.updateFolder,
  deleteFolder: context.deleteFolder,
  toggleFolder: context.toggleFolder,
  createPrompt: context.createPrompt,
  updatePrompt: context.updatePrompt,
  deletePrompt: context.deletePrompt,
  movePrompt: context.movePrompt,
  selectPrompt: (prompt: WritingPrompt | null) => {
    context.selectPrompt(prompt)
    emit('prompt-selected', prompt)
  },
  loadData: context.loadData
}

// Local state
const { isMobile } = useBreakpoint()
const showFolderInput = ref(false)
const showPromptEditor = ref(false)
const newFolderName = ref('')
const folderInputRef = ref<HTMLInputElement | null>(null)

// Computed
const uncategorizedPrompts = computed(() => {
  return data.promptsByFolder.value.get(null) || []
})

const isEmpty = computed(() => {
  return data.folders.value.length === 0 && data.prompts.value.length === 0
})

// Sidebar toggle
function toggleSidebar() {
  const newExpandedState = !props.expanded

  if (newExpandedState) {
    data.loadData()
    emit('sidebar-expanded', newExpandedState)
  } else {
    setTimeout(() => {
      emit('sidebar-expanded', newExpandedState)
    }, 50)
  }
}

// Folder operations
async function createFolder() {
  if (!newFolderName.value.trim()) return

  try {
    await data.createFolder(newFolderName.value.trim())
    cancelFolderInput()
  } catch {
    alert('创建文件夹失败')
  }
}

function cancelFolderInput() {
  showFolderInput.value = false
  newFolderName.value = ''
}

// Prompt operations
async function handlePromptSave(payload: CreatePromptPayload) {
  try {
    await data.createPrompt(payload)
    showPromptEditor.value = false
  } catch {
    alert('创建题目失败')
  }
}

// Watch for folder input focus
watch(showFolderInput, (show) => {
  if (show) {
    nextTick(() => {
      folderInputRef.value?.focus()
    })
  }
})

// Watch for sidebar expansion
watch(() => props.expanded, (newExpanded) => {
  if (newExpanded) {
    data.loadData()
  }
})

// Lifecycle
onMounted(async () => {
  await nextTick()

  if (props.expanded) {
    setTimeout(() => data.loadData(), 400)
  }
})

// Expose methods
defineExpose({
  loadData: data.loadData,
  toggleSidebar
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Dark Studio Sidebar
   ═══════════════════════════════════════════════════════════════════════════ */

.writing-sidebar-wrapper {
  position: relative;
  z-index: 100;
}

/* ── Backdrop Overlay ── */
.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 140;
}

.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Sidebar Panel
   ═══════════════════════════════════════════════════════════════════════════ */

.sidebar-panel {
  position: fixed;
  top: 0;
  left: 48px;
  width: 320px;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;

  background: linear-gradient(
    180deg,
    rgba(26, 31, 46, 0.98) 0%,
    rgba(20, 24, 36, 0.98) 100%
  );
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);

  border-right: 1px solid rgba(59, 130, 246, 0.15);
  box-shadow:
    4px 0 24px rgba(0, 0, 0, 0.3),
    inset 1px 0 0 rgba(250, 247, 242, 0.05);

  transform: translateX(-100%);
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
              left 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 100;
}

.sidebar-panel.is-expanded {
  transform: translateX(0);
}

.sidebar-panel.is-nav-expanded {
  left: 280px;
}

/* ── Desktop Pull Tab ── */
.desktop-tab {
  position: fixed;
  top: 50%;
  left: calc(48px - 20px);
  transform: translateY(-50%);

  display: flex;
  align-items: center;
  justify-content: center;

  width: 40px;
  height: 40px;
  padding: 0;

  background: linear-gradient(
    135deg,
    var(--primitive-azure-500),
    var(--primitive-azure-600)
  );
  border: none;
  border-radius: 50%;
  box-shadow:
    0 4px 16px rgba(59, 130, 246, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);

  cursor: pointer;
  transition: left 0.4s cubic-bezier(0.22, 1, 0.36, 1),
              background 0.3s ease,
              box-shadow 0.3s ease,
              transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 200;
}

.desktop-tab.is-open {
  left: calc(48px + 320px - 20px);
  background: rgba(250, 247, 242, 0.1);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

/* Nav 展开时的位置调整 */
.desktop-tab.is-nav-expanded {
  left: calc(280px - 20px);
}

.desktop-tab.is-nav-expanded.is-open {
  left: calc(280px + 320px - 20px);
}

.desktop-tab:hover {
  transform: translateY(-50%) scale(1.08);
  box-shadow:
    0 6px 24px rgba(59, 130, 246, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.desktop-tab:active {
  transform: translateY(-50%) scale(0.96);
}

.desktop-tab.is-open:hover {
  background: rgba(250, 247, 242, 0.15);
}

.tab-icon {
  width: 18px;
  height: 18px;
  color: white;
  transition: all 0.3s ease;
}

.desktop-tab.is-open .tab-icon {
  color: var(--primitive-paper-300);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Header Section
   ═══════════════════════════════════════════════════════════════════════════ */

.sidebar-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;

  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(59, 130, 246, 0.15);
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  width: 20px;
  height: 20px;
  color: var(--primitive-azure-400);
}

.header-title {
  margin: 0;
  font-family: var(--font-ui);
  font-size: 16px;
  font-weight: 600;
  color: var(--primitive-paper-200);
  letter-spacing: 0.02em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(250, 247, 242, 0.1);
  border-radius: var(--radius-md);
  background: rgba(250, 247, 242, 0.05);
  color: var(--primitive-paper-400);
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-btn svg {
  width: 16px;
  height: 16px;
}

.header-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: rgba(250, 247, 242, 0.1);
}

.header-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.header-btn--primary {
  color: var(--primitive-azure-400);
}

.header-btn--primary:hover:not(:disabled) {
  border-color: rgba(59, 130, 246, 0.3);
  background: rgba(59, 130, 246, 0.15);
}

/* ── New Folder Input ── */
.new-folder-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(59, 130, 246, 0.1);
}

.new-folder-input input {
  flex: 1;
  padding: 8px 12px;
  background: rgba(250, 247, 242, 0.05);
  border: 1px solid rgba(250, 247, 242, 0.1);
  border-radius: var(--radius-sm);
  color: var(--primitive-paper-200);
  font-size: 14px;
}

.new-folder-input input:focus {
  outline: none;
  border-color: var(--primitive-azure-500);
}

.new-folder-input input::placeholder {
  color: var(--primitive-ink-400);
}

.btn-confirm,
.btn-cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-confirm {
  background: var(--primitive-azure-500);
  color: white;
}

.btn-confirm:hover {
  background: var(--primitive-azure-600);
}

.btn-cancel {
  background: rgba(250, 247, 242, 0.1);
  color: var(--primitive-paper-400);
}

.btn-cancel:hover {
  background: rgba(250, 247, 242, 0.15);
}

.btn-confirm svg,
.btn-cancel svg {
  width: 16px;
  height: 16px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Body / Content Area
   ═══════════════════════════════════════════════════════════════════════════ */

.sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 12px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.sidebar-body::-webkit-scrollbar {
  display: none;
}

.prompt-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Uncategorized Section ── */
.uncategorized-section {
  margin-top: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  color: var(--primitive-ink-400);
}

.section-title {
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-count {
  font-size: 11px;
  padding: 2px 6px;
  background: rgba(250, 247, 242, 0.1);
  border-radius: 10px;
}

.prompt-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ── Empty State ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-visual {
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
  color: var(--primitive-azure-500);
  opacity: 0.5;
}

.empty-visual svg {
  width: 100%;
  height: 100%;
}

.empty-text {
  margin: 0 0 8px;
  font-family: var(--font-ui);
  font-size: 15px;
  font-weight: 500;
  color: var(--primitive-paper-400);
}

.empty-hint {
  margin: 0;
  font-size: 13px;
  color: var(--primitive-ink-400);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mobile Styles
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .sidebar-panel {
    left: auto;
    right: 0;
    top: auto;
    bottom: 0;
    width: 100%;
    height: 75vh;
    height: 75dvh;
    max-height: calc(100vh - 60px);
    max-height: calc(100dvh - 60px);

    border-radius: 24px 24px 0 0;
    border-right: none;
    border-top: 1px solid rgba(59, 130, 246, 0.2);

    transform: translateY(100%);
    transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);

    padding-bottom: calc(env(safe-area-inset-bottom) + 8px);
    z-index: 150;
  }

  .sidebar-panel.is-expanded {
    transform: translateY(0);
  }

  .sidebar-panel.is-nav-expanded {
    left: auto;
  }

  .sidebar-header {
    padding: 12px 16px;
    padding-top: 8px;
  }

  .sidebar-body {
    padding: 12px 12px 80px;
  }

  .desktop-tab {
    display: none;
  }
}

/* ── Mobile Floating Trigger ── */
.mobile-trigger {
  display: none;
}

@media (max-width: 768px) {
  .mobile-trigger {
    position: fixed;
    bottom: calc(88px + env(safe-area-inset-bottom));
    right: 16px;

    display: flex;
    align-items: center;
    gap: 8px;

    padding: 12px 16px;

    background: linear-gradient(
      135deg,
      var(--primitive-azure-500),
      var(--primitive-azure-600)
    );
    border: none;
    border-radius: 24px;
    box-shadow:
      0 4px 20px rgba(59, 130, 246, 0.4),
      0 8px 32px rgba(0, 0, 0, 0.2);

    cursor: pointer;
    z-index: 149;

    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .mobile-trigger:active {
    transform: scale(0.95);
  }

  .trigger-icon {
    width: 18px;
    height: 18px;
    color: white;
  }

  .trigger-label {
    font-family: var(--font-ui);
    font-size: 14px;
    font-weight: 600;
    color: white;
  }

  .trigger-enter-active,
  .trigger-leave-active {
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .trigger-enter-from,
  .trigger-leave-to {
    opacity: 0;
    transform: translateY(20px) scale(0.8);
  }
}

/* ── Mobile Close Handle ── */
.mobile-close-handle {
  display: none;
}

@media (max-width: 768px) {
  .mobile-close-handle {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);

    display: flex;
    align-items: center;
    justify-content: center;

    width: 100px;
    height: 28px;
    padding: 0;

    background: transparent;
    border: none;
    cursor: pointer;
  }

  .handle-bar {
    width: 40px;
    height: 4px;
    background: rgba(250, 247, 242, 0.3);
    border-radius: 2px;
    transition: all 0.2s ease;
  }

  .mobile-close-handle:active .handle-bar {
    width: 32px;
    background: rgba(250, 247, 242, 0.5);
  }
}
</style>

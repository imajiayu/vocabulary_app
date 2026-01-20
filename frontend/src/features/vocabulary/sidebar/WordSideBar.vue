<template>
  <div class="sidebar-container">
    <div class="word-list">
      <div class="word-list-inner scrollbar-light" ref="wordListInnerRef">
        <transition-group name="word-list" tag="div">
          <div
            v-for="(w, index) in displayedWords"
            :key="w.id"
            class="word-item"
            :style="{ color: getWordColor(index) }"
            @click="() => openModal(w)"
            @mouseenter="(e) => handleMouseEnter(e, w)"
            @mouseleave="handleMouseLeave"
            @mousemove="handleMouseMove"
          >
            {{ w.word }}
          </div>
        </transition-group>
      </div>
    </div>

    <WordTooltip
      v-if="!isMobile && tooltipWord"
      :word="tooltipWord"
      :visible="showTooltip"
      :position="tooltipPosition"
    />

    <teleport to="body">
      <WordEditorModal />
      <div v-if="wordEditorStore.isOpen" class="modal-overlay" @click="wordEditorStore.close()"></div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { Word } from '@/shared/types'
import WordEditorModal from '@/features/vocabulary/editor/WordEditorModal.vue'
import WordTooltip from '@/features/vocabulary/grid/WordTooltip.vue'
import { useTimerPause } from '@/shared/composables/useTimerPause'
import { useWordEditorStore } from '@/features/vocabulary/stores/wordEditor'

const wordListInnerRef = ref<HTMLDivElement | null>(null)

interface Props {
  words: Word[],
  rememberHistory: Map<number, boolean>,
  mode?: string // 复习模式，如 'mode_lapse', 'mode_review', 'mode_spelling'
}

const emit = defineEmits<{
  sidebarWordChange: [finalWord: Word];
  wordDeleted: [wordId: number];
  wordForgot: [wordId: number];
  wordMastered: [wordId: number];
}>();

const props = defineProps<Props>()

// Word Editor Store
const wordEditorStore = useWordEditorStore()

// 使用全局计时器暂停管理
const { requestPause, releasePause } = useTimerPause()

// Tooltip 相关状态
const showTooltip = ref(false)
const tooltipPosition = ref({ x: 0, y: 0 })
const tooltipWord = ref<Word | undefined>(undefined)
const isMobile = ref(false)

const openModal = (word: Word) => {
  // 打开 modal 时请求暂停计时器
  requestPause()

  // 使用 store 打开模态框，传入 mode
  wordEditorStore.open(word, false, props.mode || '')

  // 注册回调：模态框关闭时
  wordEditorStore.onClose((finalWord: Word | undefined) => {
    if (finalWord) {
      emit('sidebarWordChange', finalWord)
    }
    releasePause()
  })

  // 注册回调：单词删除时
  wordEditorStore.onWordDeleted((wordId: number) => {
    emit('wordDeleted', wordId)
  })

  // 注册回调：单词被标记为忘记
  wordEditorStore.onWordForgot((wordId: number) => {
    emit('wordForgot', wordId)
  })

  // 注册回调：单词被标记为掌握
  wordEditorStore.onWordMastered((wordId: number) => {
    emit('wordMastered', wordId)
  })
}

const wordHeight = 40
const maxVisible = ref(0)
const containerHeight = ref(0)

// 可见单词索引
const visibleStartIndex = ref(0)
const visibleEndIndex = ref(0)

const displayedWords = computed(() => {
  return props.words.filter(word => props.rememberHistory.has(word.id))
})

const updateMaxVisible = () => {
  containerHeight.value = window.innerHeight * 0.5
  maxVisible.value = Math.floor(containerHeight.value / wordHeight)
}

// 监听滚动，实时计算可视区索引
const onScroll = () => {
  const el = wordListInnerRef.value
  if (!el) return

  const scrollTop = el.scrollTop
  const viewHeight = el.clientHeight

  visibleStartIndex.value = Math.floor(scrollTop / wordHeight)
  visibleEndIndex.value = Math.min(
    displayedWords.value.length - 1,
    Math.floor((scrollTop + viewHeight) / wordHeight) - 1
  )
}

// 滚动到底部
const scrollToBottom = async () => {
  await nextTick()
  const el = wordListInnerRef.value
  if (el) {
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }
}

// 监听 displayedWords
watch(
  displayedWords,
  async (newWords, oldWords) => {
    if (newWords.length > (oldWords?.length || 0)) {
      await scrollToBottom()
    }
  },
  { flush: 'post' }
)

// 监听 rememberHistory
watch(
  () => props.rememberHistory,
  async (newHistory, oldHistory) => {
    if (newHistory.size > (oldHistory?.size || 0)) {
      setTimeout(() => scrollToBottom(), 50)
    }
  },
  { deep: true, flush: 'post' }
)

// 检测是否为移动端
const checkMobile = () => {
  isMobile.value = !window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

// 处理鼠标进入事件
const handleMouseEnter = (e: MouseEvent, word: Word) => {
  if (isMobile.value) return

  tooltipWord.value = word
  tooltipPosition.value = { x: e.clientX, y: e.clientY }
  showTooltip.value = true
}

// 处理鼠标移动事件
const handleMouseMove = (e: MouseEvent) => {
  if (isMobile.value) return

  tooltipPosition.value = { x: e.clientX, y: e.clientY }
}

// 处理鼠标离开事件
const handleMouseLeave = () => {
  showTooltip.value = false
  tooltipWord.value = undefined
}

onMounted(() => {
  updateMaxVisible()
  setTimeout(() => scrollToBottom(), 100)
  wordListInnerRef.value?.addEventListener('scroll', onScroll)
  window.addEventListener('resize', updateMaxVisible)
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  wordListInnerRef.value?.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', updateMaxVisible)
  window.removeEventListener('resize', checkMobile)
})

const getWordColor = (index: number) => {
  const remembered = props.rememberHistory.get(displayedWords.value[index].id)

  let start = visibleStartIndex.value
  let end = visibleEndIndex.value

  if (displayedWords.value.length <= maxVisible.value) {
    start = 0
    end = displayedWords.value.length - 1
  }

  let opacity = 0.5

  if (displayedWords.value.length < end - start + 1)
    return `rgba(0, 128, 0, 1)`;
  if (index >= start && index <= end) {
    const visibleCount = end - start + 1
    const relativeIndex = index - start
    opacity = visibleCount > 1
      ? 0.5 + 0.5 * (relativeIndex / (visibleCount - 1))
      : 1
  }

  return remembered
    ? `rgba(0, 128, 0, ${opacity})`
    : `rgba(255, 0, 0, ${opacity})`
}
</script>



<style scoped>
.sidebar-container {
  position: fixed;
  top: 48px;
  /* 从 TopBar 下面开始 */
  left: 0;
  width: 150px;
  height: calc(50vh - 48px);
  /* 高度减去 TopBar */
  background-color: rgba(255, 255, 255, 0.1);
  border: none;
  overflow: hidden;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  z-index: 999;
}

.word-list {
  flex: 1;
  overflow: hidden;
  /* 外层不滚动 */
  display: flex;
  flex-direction: column;
}

.word-list-inner {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
}

/* 每个单词元素 */
.word-item {
  cursor: pointer;
  padding: 0.5rem;
  font-size: 1rem;
  user-select: none;
  transition: transform 0.3s ease, opacity 0.3s ease;
  min-height: 40px;
  /* 确保最小高度 */
  display: flex;
  align-items: center;
  border-radius: var(--radius-xs);
}

/* hover效果 */
.word-item:hover {
  transform: scale(1.05);
  opacity: 1 !important;
  background-color: rgba(255, 255, 255, 0.1);
}

/* 动画 */
.word-list-enter-from,
.word-list-leave-to {
  transform: translateY(20px);
  opacity: 0;
}

.word-list-enter-active,
.word-list-leave-active {
  transition: all 0.3s ease;
}

.word-list-move {
  transition: transform 0.3s ease;
}

/* 移动端适配 */
@media (max-width: 480px) {
  .sidebar-container {
    left: auto;
    right: 0;
    width: 50vw;
    height: calc(30vh - 48px); /* 缩短高度：50vh -> 30vh */
    background-color: transparent;
    border: none;
    padding: 0.5rem;
  }

  .word-list {
    width: 100%;
    height: 100%;
  }

  .word-list-inner {
    width: 100%;
    height: 100%;
    padding-right: 4px;
  }

  .word-item {
    font-size: 0.9rem;
    padding: 0.4rem 0.6rem;
    text-align: right;
    justify-content: flex-end;
    width: auto; /* 改为auto，让宽度自适应文字 */
    align-self: flex-end; /* 靠右对齐 */
    box-sizing: border-box;
  }

  .word-list-inner {
    display: flex;
    flex-direction: column;
    align-items: flex-end; /* 确保子元素靠右 */
  }
}

/* Modal wrapper & overlay */
.modal-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  /* 保证在最顶层 */
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.4);
}
</style>
<template>
  <div class="sidebar-container">
    <div class="word-list">
      <div class="word-list-inner" ref="wordListInnerRef">
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
      <WordDetailModal
        :word="selectedWord"
        :is-open="isModalOpen"
        :mode="mode"
        @close="handleCloseModal"
        @request-close="closeModal"
        @word-deleted="handleWordDeleted"
        @word-forgot="handleWordForgot"
        @word-mastered="handleWordMastered"
      />
      <div v-if="isModalOpen" class="modal-overlay" @click="closeModal"></div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { Word } from '@/shared/types'
import WordDetailModal from '@/features/vocabulary/components/WordDetailModal.vue'
import WordTooltip from '@/features/vocabulary/components/WordTooltip.vue'
import { useTimerPause } from '@/shared/composables/useTimerPause'

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

const selectedWordId = ref<number | undefined>(undefined)
const isModalOpen = ref(false)
const cachedSelectedWord = ref<Word | undefined>(undefined)

// 使用全局计时器暂停管理
const { requestPause, releasePause } = useTimerPause()

// Tooltip 相关状态
const showTooltip = ref(false)
const tooltipPosition = ref({ x: 0, y: 0 })
const tooltipWord = ref<Word | undefined>(undefined)
const isMobile = ref(false)

// 计算属性：优先使用缓存的单词，避免从队列删除后modal立即关闭
const selectedWord = computed(() => {
  if (selectedWordId.value === undefined) return undefined

  // 先尝试从 props.words 中找到单词
  const wordFromProps = props.words.find(w => w.id === selectedWordId.value)

  // 如果找到了，更新缓存并返回
  if (wordFromProps) {
    cachedSelectedWord.value = wordFromProps
    return wordFromProps
  }

  // 如果在 props.words 中找不到（比如从队列中删除了），返回缓存的单词
  // 这样 modal 不会因为单词被删除而立即关闭
  return cachedSelectedWord.value
})

const openModal = (word: Word) => {
  selectedWordId.value = word.id
  cachedSelectedWord.value = word
  isModalOpen.value = true
  // 打开 modal 时请求暂停计时器
  requestPause()
}

// 关闭modal的方法（由按钮/遮罩层调用）
const closeModal = () => {
  isModalOpen.value = false
  // 关闭 modal 时释放暂停请求
  releasePause()
}

// WordDetailModal的@close事件处理（由watch触发）
const handleCloseModal = (finalWord: Word | undefined) => {
  selectedWordId.value = undefined
  cachedSelectedWord.value = undefined // 清空缓存
  // 仿照VocabularyManagementPage的handleCloseModal方法
  // 将完整的finalWord对象传递给父组件，而不是只传递id
  if (finalWord) {
    emit('sidebarWordChange', finalWord)
  }
  // 关闭 modal 时释放暂停请求
  releasePause()
}

const handleWordDeleted = (wordId: number) => {
  // 关闭modal
  isModalOpen.value = false
  selectedWordId.value = undefined
  // 通知父组件单词已被删除
  emit('wordDeleted', wordId)
  // 关闭 modal 时释放暂停请求
  releasePause()
}

const handleWordForgot = (wordId: number) => {
  // 转发 wordForgot 事件给父组件
  emit('wordForgot', wordId)
}

const handleWordMastered = (wordId: number) => {
  // 转发 wordMastered 事件给父组件
  emit('wordMastered', wordId)
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
  /* 内层允许垂直滚动 */
  scrollbar-width: thin;
  /* Firefox 显示细滚动条 */
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
  /* Firefox 滚动条颜色 */
  padding-right: 8px;
  /* 为滚动条留出空间 */
  /* 移除 scroll-behavior: smooth 避免与JS滚动冲突 */
}

/* 自定义滚动条样式 */
.word-list-inner::-webkit-scrollbar {
  width: 6px;
}

.word-list-inner::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.word-list-inner::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.word-list-inner::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
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
  border-radius: 4px;
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
@media (max-width: 768px) {
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
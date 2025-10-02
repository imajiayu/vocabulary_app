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
          >
            {{ w.word }}
          </div>
        </transition-group>
      </div>
    </div>

    <teleport to="body">
      <div v-if="isModalOpen" class="modal-wrapper">
        <div class="modal-overlay" @click="() => handleCloseModal(selectedWord?.id ?? 0)"></div>
        <WordDetailModal
          v-model:word="selectedWord"
          :is-open="isModalOpen"
          @close="handleCloseModal"
        />
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { Word } from '@/shared/types'
import WordDetailModal from '@/features/vocabulary/components/WordDetailModal.vue'

const wordListInnerRef = ref<HTMLDivElement | null>(null)

interface Props {
  words: Word[],
  rememberHistory: Map<number, boolean>
}

const emit = defineEmits<{
  sidebarWordChange: [wordId: number];
}>();

const props = defineProps<Props>()

const selectedWord = ref<Word | undefined>(undefined)
const isModalOpen = ref(false)

const openModal = (word: Word) => {
  selectedWord.value = word
  isModalOpen.value = true
}

const handleCloseModal = (wordId: number) => {
  isModalOpen.value = false
  selectedWord.value = undefined
  emit('sidebarWordChange', wordId)
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

onMounted(() => {
  updateMaxVisible()
  setTimeout(() => scrollToBottom(), 100)
  wordListInnerRef.value?.addEventListener('scroll', onScroll)
  window.addEventListener('resize', updateMaxVisible)
})

onUnmounted(() => {
  wordListInnerRef.value?.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', updateMaxVisible)
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
  z-index: 100;
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
    height: calc(50vh - 48px);
    background-color: transparent;
    border: none;
    padding: 0;
  }

  .word-item {
    font-size: 0.9rem;
    padding: 0.4rem;
    text-align: right;
    justify-content: flex-end;
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
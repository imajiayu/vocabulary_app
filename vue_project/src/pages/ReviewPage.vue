<template>
  <div class="app-container with-topbar">
    <WordSideBar v-if="displayIndex <= displayTotal" :words="sidebarWords"
      :remember-history="wordResults" @sidebar-word-change="sidebarWordChange" @word-deleted="handleSidebarWordDeleted"
      @word-forgot="handleWordForgot" @word-mastered="handleWordMastered" />

    <!-- 顶部栏 -->
    <TopBar show-home-button show-management-button show-stats-button>

      <template #center>
        <!-- lapse模式进度条 -->
        <div v-if="mode === 'mode_lapse'" class="progress-bar-container">
          <ProgressBar :progress="Math.abs(progress)" :fill-color="progress < 0 ? '#ff4d4f' : '#52c41a'"
            :text="`${Math.round(progress)}%`" />
        </div>
      </template>

      <template #right>
        <span v-if="displayIndex <= displayTotal && displayIndex > 0 && displayTotal > 0" class="progress-text">
          {{ displayIndex }} / {{ displayTotal }}
        </span>
      </template>
    </TopBar>

    <!-- 主内容区域 -->
    <main class="main-content">
      <!-- 加载状态 -->
      <LoadingComponent v-if="isLoading && !currentWord" :text="loadingText" />

      <!-- 复习完成 -->
      <div v-else-if="!currentWord && !isLoading" class="completion-message">
        <div class="completion-content">
          <div class="icon">🎉</div>
          <h2>恭喜完成！</h2>
          <p v-if="mode === 'mode_lapse'">所有遗忘单词已复习完成</p>
          <p v-else>当前批次复习完成</p>
        </div>
      </div>

      <!-- 复习/拼写组件 -->
      <component v-else-if="currentWord" :is="currentComponent" :key="mode" :word="currentWord" :audio-type="audioType"
        @result="handleResult" @skip="handleSkip" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useReviewStore } from '@/features/vocabulary/stores/review'
import type { ReviewMode, WordResult } from '@/features/vocabulary/stores/review'
import type { Word } from '@/shared/types'
import { api } from '@/shared/api'
import { useWordManagementWebSocket, WebSocketEvents } from '@/shared/services/websocket'
import WordReview from '@/features/vocabulary/components/WordReview.vue'
import WordSpelling from '@/features/vocabulary/components/WordSpelling.vue'
import TopBar from '@/shared/components/layout/TopBar.vue'
import LoadingComponent from '@/shared/components/ui/Loading.vue'
import ProgressBar from '@/shared/components/ui/ProgressBar.vue'
import WordSideBar from '@/shared/components/ui/WordSideBar.vue'

// Props
interface RouteProps {
  mode?: string
  limit?: number
}

const props = withDefaults(defineProps<RouteProps>(), {
  mode: 'mode_review',
  limit: 50
})

const sidebarWordChange = (finalWord: Word) => {
  // 直接使用modal返回的最终数据更新队列
  // 使用splice方法触发Vue的响应式更新
  const index = reviewStore.wordQueue.findIndex(w => w.id === finalWord.id);
  if (index !== -1) {
    reviewStore.wordQueue.splice(index, 1, finalWord);
  }
};

const handleWordForgot = (wordId: number) => {
  // 单词被设为忘记，更新wordResults为未记住（红色）
  wordResults.value.set(wordId, false);
};

const handleSidebarWordDeleted = (wordId: number) => {
  // 从wordQueue中移除被删除的单词
  const index = reviewStore.wordQueue.findIndex(w => w.id === wordId);
  if (index !== -1) {
    reviewStore.wordQueue.splice(index, 1);
    // 从wordResults中移除记录
    wordResults.value.delete(wordId);
    // 如果删除的是当前索引之前的单词，需要调整currentIndex
    if (index < currentIndex.value) {
      reviewStore.currentIndex = Math.max(0, currentIndex.value - 1);
    }
  }
};

const handleWordMastered = (wordId: number) => {
  // 如果是lapse模式，从队列中移除单词
  if (mode.value === 'mode_lapse') {
    if (reviewStore.wordQueue.length === 0) return;

    const currentWordIndex = currentIndex.value % reviewStore.wordQueue.length;
    const wordIndex = reviewStore.wordQueue.findIndex(w => w.id === wordId);

    if (wordIndex !== -1) {
      reviewStore.wordQueue.splice(wordIndex, 1);

      // 如果队列还有单词且当前索引超出范围，重置索引并重新排序
      if (reviewStore.wordQueue.length > 0 && currentIndex.value >= reviewStore.wordQueue.length) {
        reviewStore.currentIndex = 0;
        // 重新排序队列（根据shuffle状态）
        reviewStore.wordQueue = reviewStore.sortByLapse(reviewStore.wordQueue, shuffle.value);
      }

      // 标记单词为已记住（绿色）
      wordResults.value.set(wordId, true);
    }
  } else {
    // 非lapse模式，只标记为已记住
    wordResults.value.set(wordId, true);
  }
};

// 路由和存储
const route = useRoute()
const reviewStore = useReviewStore()

// 从store解构响应式状态
const {
  currentWord,
  mode,
  audioType,
  isLoading,
  totalWords,
  currentIndex,
  progress,
  wordResults,
  shuffle
} = storeToRefs(reviewStore)

// 本地状态
const loadingText = ref('加载中...')

// 计算属性
const displayIndex = computed(() => {
  if (mode.value === 'mode_lapse') {
    return reviewStore.wordQueue.length === 0 ? 0 : (currentIndex.value % reviewStore.wordQueue.length) + 1
  }
  // For non-lapse modes, only show index if we have a current word
  return currentWord.value ? Math.max(1, currentIndex.value + 1) : 0
})

const displayTotal = computed(() => {
  if (mode.value === 'mode_lapse') {
    return reviewStore.wordQueue.length
  }
  // For non-lapse modes, only show total if we have a current word
  return currentWord.value ? totalWords.value : 0
})

const currentComponent = computed(() => {
  return mode.value === 'mode_spelling' ? WordSpelling : WordReview
})

// 为WordSidebar准备的单词列表（确保响应式更新）
const sidebarWords = computed(() => {
  return reviewStore.wordQueue.slice(0, currentIndex.value)
})

// 方法
const initializeFromRoute = async () => {
  try {
    loadingText.value = '初始化复习...'

    // 检查是否需要恢复进度
    const shouldResume = route.query.resume === 'true'

    if (shouldResume) {
      loadingText.value = '恢复学习进度...'

      reviewStore.reset()
      const restored = await reviewStore.restoreFromProgress()

      if (restored) {
        console.log('Progress restored successfully')
        return // 恢复成功，直接返回
      } else {
        console.log('Failed to restore progress, falling back to normal initialization')
        // 恢复失败，继续正常初始化流程
      }
    } else {
      reviewStore.reset()
    }

    // 正常初始化流程
    // 解析路由模式
    const routeMode = props.mode || 'mode_review'
    let reviewMode: ReviewMode = 'mode_review'

    if (['mode_lapse', 'mode_spelling', 'mode_review'].includes(routeMode)) {
      reviewMode = routeMode as ReviewMode
    }

    // 设置参数
    reviewStore.settings.totalLimit = props.limit

    // 切换模式并加载数据
    if (mode.value !== reviewMode) {
      await reviewStore.switchMode(reviewMode)
    } else if (reviewStore.wordQueue.length === 0) {
      // 即使是同一模式，也要确保 shuffle 状态是最新的（特别是 lapse 模式）
      await reviewStore.initializeShuffle()
      await reviewStore.loadWords(true)
    }

  } catch (error) {
    console.error('初始化失败:', error)
    loadingText.value = '加载失败，请重试'
  }
}

const handleResult = async (result: any) => {
  if (!currentWord.value) return

  try {
    const wordResult: WordResult = {
      is_spelling: mode.value === 'mode_spelling',
      remembered: result.remembered,
      ...(mode.value === 'mode_spelling'
        ? { spelling_data: result.spellingData }
        : { elapsed_time: result.elapsedTime }
      )
    }

    reviewStore.submitResult(currentWord.value.id, wordResult)
  } catch (error) {
    console.error('提交结果失败:', error)
  }
}

const handleSkip = async () => {
  if (!currentWord.value) return

  try {
    reviewStore.stopReviewWord(currentWord.value.id)
  } catch (error) {
    console.error('停止复习单词失败:', error)
  }
}

// WebSocket 连接和事件处理
const { connect, onWordUpdated, off } = useWordManagementWebSocket()

// WebSocket事件回调 - 用于更新队列中的单词（特别是编辑单词后收到的definition）
const wordUpdatedCallback = (data: { id: number; definition: any }) => {
  const wordId = data.id;
  const definition = data.definition;

  // 更新队列中的单词
  const index = reviewStore.wordQueue.findIndex(w => w.id === wordId);
  if (index !== -1) {
    reviewStore.wordQueue.splice(index, 1, { ...reviewStore.wordQueue[index], definition });
  }
}

// 监听路由变化
watch(() => route.query, async () => {
  if (route.name === 'review') {
    await initializeFromRoute()
  }
})

// 生命周期
onMounted(async () => {
  await initializeFromRoute()

  // 建立WebSocket连接并监听单词更新
  try {
    await connect()
    // 监听单词更新事件（用于更新队列，特别是编辑单词后的definition）
    onWordUpdated(wordUpdatedCallback)
  } catch (error) {
    console.error('[ReviewPage] WebSocket connection failed:', error)
  }
})

onUnmounted(() => {
  // 清理WebSocket事件监听器
  try {
    off(WebSocketEvents.WORD_UPDATED, wordUpdatedCallback)
  } catch (error) {
    console.error('[ReviewPage] Error removing WebSocket listeners:', error)
  }
})
</script>

<style scoped>
/* ReviewPage 容器 - 应用全局背景 */
.app-container {
  min-height: 100vh;
  min-height: -webkit-fill-available;
  overflow-x: hidden;
  /* 明确应用全局背景样式 */
  background: var(--gradient-background);
  background-attachment: scroll;
  background-repeat: no-repeat;
  background-size: 100% auto;
  /* 确保背景能覆盖包括padding在内的所有区域 */
  box-sizing: border-box;
}

/* 桌面端使用flex布局避免滚动条 */
@media (min-width: 769px) {
  .app-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background-size: 100% 100vh;
  }

  /* 桌面端重写with-topbar的padding，使用flex布局代替 */
  .app-container.with-topbar {
    padding-top: 0 !important;
  }

  .main-content {
    margin-top: 48px;
    flex: 1;
    overflow-y: auto;
  }

  /* 桌面端WordReview组件顶部额外间距 */
  .main-content :deep(.word-review-container .content-area) {
    padding-top: 4rem !important;
  }
}

.main-content {
    max-width: 72rem;
    margin: 0 auto;
    padding: 1.5rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    /* 确保背景透明，显示app-container的背景 */
    background: transparent;
}

/* TopBar中的进度条容器样式 */
.progress-bar-container {
  /* 让ProgressBar组件自己控制样式，只设置基本容器属性 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-text {
  font-size: 12px;
  font-weight: 600;
  color: #000;
}

.completion-message {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 2em;
}

.completion-content {
  text-align: center;
  max-width: 400px;
}

.completion-content .icon {
  font-size: 4em;
  margin-bottom: 0.5em;
}

.completion-content h2 {
  color: #333;
  margin-bottom: 0.5em;
}

.completion-content p {
  color: #666;
  margin-bottom: 1.5em;
  line-height: 1.6;
}

/* 移动端适配 - 恢复原始布局 */
@media (max-width: 768px) {
  /* 移动端恢复原来的布局方式 */
  .app-container {
    height: auto !important;
    display: block !important;
    min-height: 100vh;
    overflow-x: hidden;
    overflow-y: auto;
    background-size: 100% auto !important;
  }

  .app-container.with-topbar {
    padding-top: 48px !important;
  }

  .main-content {
    margin-top: 0 !important;
    flex: none !important;
    overflow-y: visible !important;
    min-height: auto !important;
  }

  .progress-text {
    font-size: 11px;
  }

  .bottom-loading {
    bottom: 10px;
    padding: 0.4em 0.8em;
    font-size: 0.8em;
  }
}
</style>
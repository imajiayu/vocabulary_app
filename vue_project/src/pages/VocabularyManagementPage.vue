<template>
    <div class="app-container with-topbar">
        <!-- Loading State -->
        <Loading v-if="isLoading" text="加载中..." />

        <!-- Main Content -->
        <template v-else>
            <!-- Header -->
            <TopBar show-home-button show-stats-button>
                <template #center>
                    <span class="title">单词管理</span>
                </template>
                <template #right>
                    <!-- WebSocket连接状态指示器 -->
                    <div class="connection-status" :class="{ 'connected': isConnected, 'disconnected': !isConnected }">
                        <div class="status-dot"></div>
                        <span class="status-text">{{ isConnected ? '已连接' : '未连接' }}</span>
                    </div>
                </template>
            </TopBar>

            <!-- Main Content -->
            <main class="main-content">
                <div class="top-controls">
                    <!-- 添加单词表单 -->
                    <div class="control-item">
                        <WordInsertForm @word-inserted="handleWordInserted" />
                    </div>

                    <!-- 搜索和筛选 -->
                    <div class="control-item">
                        <SearchAndFilter
                            :search-query="searchQuery"
                            :filter-status="filterStatus"
                            :stats="stats"
                            :source-filter="sourceFilter"
                            :all-words="words"
                            :source-counts="sourceCounts"
                            @search-change="searchQuery = $event"
                            @filter-change="filterStatus = $event"
                            @source-change="sourceFilter = $event" />
                    </div>
                </div>
                <!-- 单词网格 -->
                <div class="words-section">
                    <!-- 批量加载进度指示器 -->
                    <div v-if="hasMoreWords || isLoadingMore" class="loading-progress">
                        <div class="progress-info">
                            <span class="progress-text">
                                已加载 {{ loadedWords }}/{{ totalWords }} 个单词
                            </span>
                            <div class="loading-spinner-small"></div>
                        </div>
                        <div class="progress-bar">
                            <div
                                class="progress-fill"
                                :style="{ width: totalWords > 0 ? `${(loadedWords / totalWords) * 100}%` : '0%' }"
                            ></div>
                        </div>
                    </div>

                    <!-- 释义加载进度指示器 -->
                    <div v-if="definitionQueueSize > 0" class="definition-loading-progress">
                        <div class="progress-info">
                            <span class="progress-text">
                                正在填充单词释义，剩余单词：{{ definitionQueueSize }}
                            </span>
                            <div class="loading-spinner-small"></div>
                        </div>
                    </div>

                    <WordGrid
                        ref="wordGridRef"
                        :words="words"
                        :search-query="searchQuery"
                        :filter-status="filterStatus"
                        :source-filter="sourceFilter"
                        :source-counts="sourceCounts"
                        @show-detail="handleShowDetail"
                        @batch-delete="handleBatchDelete" />
                </div>
            </main>

            <!-- 详情弹窗 -->
            <WordDetailModal :word="selectedWord" :is-open="isModalOpen" @close="handleCloseModal"
                @request-close="() => isModalOpen = false" @word-deleted="handleWordDeleted" />
        </template>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import WordInsertForm from '@/features/vocabulary/components/WordInsertForm.vue';
import SearchAndFilter from '@/features/vocabulary/components/SearchAndFilter.vue';
import WordGrid from '@/features/vocabulary/components/WordGrid.vue';
import WordDetailModal from '@/features/vocabulary/components/WordDetailModal.vue';
import Loading from '@/shared/components/ui/Loading.vue'
import TopBar from '@/shared/components/layout/TopBar.vue';
import type { Word, SourceCounts } from '@/shared/types';
import { useWordStats } from '@/shared/composables/useWordStats';
import { useSourceSelectionReadOnly } from '@/shared/composables/useSourceSelection';
import { useWordManagementWebSocket, WebSocketEvents } from '@/shared/services/websocket';
import { api } from '@/shared/api';
import { useSettings } from '@/shared/composables/useSettings';

const words = ref<Word[]>([]);
const searchQuery = ref('');
const filterStatus = ref('all');
const sourceFilter = ref<'all' | 'IELTS' | 'GRE'>('all'); // 新增来源筛选
const selectedWord = ref<Word | undefined>();
const isModalOpen = ref(false);
const isLoading = ref(true);
const sourceCounts = ref<SourceCounts | null>(null); // 存储源计数
const wordGridRef = ref<InstanceType<typeof WordGrid>>(); // WordGrid 组件引用

// 使用全局设置管理
const { loadSettings } = useSettings();

// 分批加载相关状态
const batchSize = ref(200); // 每批加载单词数量，从settings读取
const totalWords = ref(0);
const loadedWords = ref(0);
const isLoadingMore = ref(false);
const hasMoreWords = ref(true);
const shouldStopLoading = ref(false); // 控制是否停止后台加载

// 释义加载队列大小
const definitionQueueSize = ref(0);

// Use read-only composable to get WordIndex selection
const { currentSource, initializeFromData } = useSourceSelectionReadOnly();

// 使用 word stats composable
const { allStats, ieltsStats, greStats } = useWordStats(words);

// 首先根据来源筛选的单词已通过 useWordStats composable 处理

// 统计数据 - 基于来源筛选后的结果 (使用 composable)
const stats = computed(() => {
    if (sourceFilter.value === 'all') {
        return allStats.value;
    } else if (sourceFilter.value === 'IELTS') {
        return ieltsStats.value;
    } else {
        return greStats.value;
    }
});

// 判断单词是否已掌握的辅助函数
const isWordRemembered = (word: Word): boolean => {
    return word.stop_review === 1 || word.ease_factor >= 3.0;
};

// 动态更新sourceCounts的辅助函数
const updateSourceCounts = () => {
    if (!sourceCounts.value) return;

    const counts = sourceCounts.value.source_counts;

    // 重新计算所有统计
    const allWords = words.value;
    const ieltsWords = allWords.filter(w => w.source === 'IELTS');
    const greWords = allWords.filter(w => w.source === 'GRE');

    // 更新all统计
    counts.all.total = allWords.length;
    counts.all.remembered = allWords.filter(isWordRemembered).length;
    counts.all.unremembered = counts.all.total - counts.all.remembered;

    // 更新IELTS统计
    counts.IELTS.total = ieltsWords.length;
    counts.IELTS.remembered = ieltsWords.filter(isWordRemembered).length;
    counts.IELTS.unremembered = counts.IELTS.total - counts.IELTS.remembered;

    // 更新GRE统计
    counts.GRE.total = greWords.length;
    counts.GRE.remembered = greWords.filter(isWordRemembered).length;
    counts.GRE.unremembered = counts.GRE.total - counts.GRE.remembered;
};

// 分批加载单词的函数
const loadWordsBatch = async (offset: number = 0): Promise<boolean> => {
    try {
        isLoadingMore.value = offset > 0; // 只有加载后续批次时才显示加载更多状态

        const response = await api.words.getWordsPaginated(batchSize.value, offset);

        if (offset === 0) {
            // 首次加载，替换所有数据
            words.value = response.words;
            totalWords.value = response.total;
            // 保存首次请求返回的计数
            if (response.counts) {
                sourceCounts.value = response.counts;
            }
        } else {
            // 后续批次，追加数据
            words.value.push(...response.words);
        }

        loadedWords.value = words.value.length;
        hasMoreWords.value = response.has_more;

        return response.has_more;
    } catch (error) {
        console.error('Failed to load words batch:', error);
        return false;
    } finally {
        isLoadingMore.value = false;
    }
};

// 自动加载后续批次的函数
const loadRemainingBatches = async () => {
    let offset = batchSize.value;
    let hasMore = hasMoreWords.value;

    while (hasMore && !shouldStopLoading.value) {
        // 等待一小段时间，避免过于频繁的请求
        await new Promise(resolve => setTimeout(resolve, 100));

        // 再次检查是否应该停止加载
        if (shouldStopLoading.value) {
            break;
        }

        hasMore = await loadWordsBatch(offset);
        offset += batchSize.value;
    }
};

// 初始化加载数据
onMounted(async () => {
    try {
        // Initialize source filter to sync with WordIndex selection (read-only)
        await initializeFromData();

        // Set initial source filter based on WordIndex selection
        if (currentSource.value) {
            sourceFilter.value = currentSource.value;
        }

        // 从settings加载批次大小（使用缓存）
        try {
            const settings = await loadSettings();
            batchSize.value = settings.management.wordsLoadBatchSize;
        } catch (error) {
            console.error('Failed to load wordsLoadBatchSize from settings, using default 200:', error);
        }

        // 加载第一批单词
        await loadWordsBatch(0);

        // 在背景中异步加载剩余的单词
        if (hasMoreWords.value) {
            // 不等待这个函数完成，让它在后台运行
            loadRemainingBatches();
        }

        // 建立WebSocket连接并监听单词更新
        try {
            await connect()
            // 监听单词更新事件（用于更新列表，特别是新增单词的definition）
            onWordUpdated(wordUpdatedCallback)
            console.log('[WordManagement] WebSocket connected')
        } catch (error) {
            console.error('[WordManagement] WebSocket connection failed:', error)
        }
    } catch (error) {
        console.error('Failed to load initial words batch:', error);
    } finally {
        isLoading.value = false;
    }
});

// 显示详情
const handleShowDetail = (word: Word) => {
    selectedWord.value = word;
    isModalOpen.value = true;
};

const handleCloseModal = (finalWord: Word | undefined) => {
    isModalOpen.value = false;

    // Modal关闭时返回最终的完整数据，直接更新列表
    if (finalWord) {
        const index = words.value.findIndex(w => w.id === finalWord.id);
        if (index !== -1) {
            const oldWord = words.value[index];
            const newWord = finalWord;

            // 检查是否状态发生了变化（掌握状态）
            const oldRemembered = isWordRemembered(oldWord);
            const newRemembered = isWordRemembered(newWord);

            words.value[index] = newWord;

            // 如果掌握状态发生变化，更新计数
            if (oldRemembered !== newRemembered) {
                updateSourceCounts();
            }
        }
    }
};

const handleWordDeleted = (wordId: number) => {
    // 1. 关闭模态框
    isModalOpen.value = false;

    // 2. 在本地 words 数组中找到并移除该单词
    const index = words.value.findIndex(w => w.id === wordId);
    if (index !== -1) {
        words.value.splice(index, 1);
        // 更新计数
        updateSourceCounts();
    }
};

const handleWordInserted = (word: Word) => {
    words.value.unshift(word);
    // 更新计数
    updateSourceCounts();
    // 标记为新增单词，使其显示在最前面
    wordGridRef.value?.addNewWordId(word.id);
};

const handleBatchDelete = (wordIds: number[]) => {
    // 从本地words数组中批量移除这些单词
    words.value = words.value.filter(w => !wordIds.includes(w.id));
    // 更新计数
    updateSourceCounts();
};

// 使用统一的WebSocket服务
const { connect, isConnected, onWordUpdated, off } = useWordManagementWebSocket()

// WebSocket事件回调 - 用于更新列表中的单词（特别是新增单词收到的definition）
const wordUpdatedCallback = (data: { id: number; definition: any; queue_size?: number }) => {
    const wordId = data.id;
    const definition = data.definition;

    // 更新队列大小
    if (typeof data.queue_size === 'number') {
        definitionQueueSize.value = data.queue_size;
    }

    // 更新列表中的单词
    const index = words.value.findIndex(w => w.id === wordId);
    if (index !== -1) {
        words.value[index] = { ...words.value[index], definition };
    }
}

onUnmounted(() => {
    // 停止后台加载
    shouldStopLoading.value = true;

    // 清理WebSocket事件监听器
    try {
        off(WebSocketEvents.WORD_UPDATED, wordUpdatedCallback)
        console.log('[WordManagement] WebSocket event listeners removed')
    } catch (error) {
        console.error('[WordManagement] Error removing WebSocket listeners:', error)
    }
})
</script>

<style scoped>
.main-content {
    max-width: 72rem;
    margin: 0 auto;
    padding: 2rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: calc(100vh - 60px); /* 减去 TopBar 高度 */
    box-sizing: border-box;
}

.top-controls {
    display: flex;
    gap: 1rem;
    /* 左右间距 */
    margin-bottom: 0;
}

.control-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: stretch;
    /* 子元素高度拉伸 */
}

/* 统一内部控件高度 */
.control-item>* {
    flex: 1;
}

.words-section {
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    padding: 1.5rem;
}

/* 批量加载进度指示器 */
.loading-progress {
    padding: 1rem;
    padding-bottom: 1.5rem;
}

/* 释义加载进度指示器 */
.definition-loading-progress {
    padding: 1rem;
    padding-bottom: 1.5rem;
    background: #fef3c7;
    border-radius: 0.5rem;
    border: 1px solid #fbbf24;
    margin-bottom: 1rem;
}

.progress-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
}

.definition-loading-progress .progress-info {
    margin-bottom: 0;
}

.progress-text {
    font-size: 0.875rem;
    color: #374151;
    font-weight: 500;
}

.definition-loading-progress .progress-text {
    color: #92400e;
}

.loading-spinner-small {
    width: 1rem;
    height: 1rem;
    border: 2px solid #e5e7eb;
    border-top: 2px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.definition-loading-progress .loading-spinner-small {
    border: 2px solid #fbbf24;
    border-top: 2px solid #f59e0b;
}

.progress-bar {
    width: 100%;
    height: 0.5rem;
    background: #e5e7eb;
    border-radius: 0.25rem;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #1d4ed8);
    border-radius: 0.25rem;
    transition: width 0.3s ease;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

/* 移动端全面适配 */
@media (max-width: 768px) {
    .main-content {
        padding: 1rem 0.75rem;
        gap: 1rem;
        min-height: calc(100vh - 48px); /* 调整 TopBar 高度 */
    }

    .connection-status {
        font-size: 0.6875rem;
        padding: 0.1875rem 0.5rem;
        gap: 0.375rem;
    }

    .status-dot {
        width: 0.375rem;
        height: 0.375rem;
    }

    .top-controls {
        flex-direction: column;
        gap: 1rem;
    }

    .words-section {
        padding: 1rem;
        border-radius: 0.5rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .loading-progress {
        margin-top: 1rem;
        padding: 0.75rem;
    }

    .definition-loading-progress {
        padding: 0.75rem;
        margin-bottom: 0.75rem;
    }

    .progress-text {
        font-size: 0.8rem;
    }
}

/* 小屏手机进一步优化 */
@media (max-width: 480px) {
    .main-content {
        padding: 0.875rem 0.5rem;
        gap: 0.875rem;
    }

    .top-controls {
        gap: 0.875rem;
    }

    .words-section {
        padding: 0.875rem;
        border-radius: 0.375rem;
    }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
    .main-content {
        padding: 0.75rem;
        gap: 0.75rem;
        min-height: calc(100vh - 40px);
    }

    .words-section {
        padding: 0.75rem;
    }
}

/* WebSocket连接状态指示器 */
.connection-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 500;
    transition: all 0.3s ease;
}

.connection-status.connected {
    background-color: rgba(16, 185, 129, 0.1);
    color: #059669;
}

.connection-status.disconnected {
    background-color: rgba(239, 68, 68, 0.1);
    color: #dc2626;
}

.status-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    transition: background-color 0.3s ease;
}

.connected .status-dot {
    background-color: #10b981;
    animation: pulse 2s infinite;
}

.disconnected .status-dot {
    background-color: #ef4444;
}

.status-text {
    white-space: nowrap;
}

@keyframes pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.5;
    }
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}
</style>
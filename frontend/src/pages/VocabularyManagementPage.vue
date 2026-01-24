<template>
    <PageLayout
        with-topbar
        show-top-bar
        show-home-button
        show-stats-button
        max-width="72rem"
        content-class="management-content"
    >
        <template #topbar-center>
            <span class="title">单词管理</span>
        </template>

        <!-- Loading State -->
        <Loading v-if="isLoading" text="加载中..." />

        <!-- Main Content -->
        <template v-else>
                <div class="top-controls">
                    <!-- 添加单词表单 -->
                    <div class="control-item">
                        <WordInsertForm @word-inserted="handleWordInserted" @batch-word-inserted="handleBatchWordInserted" />
                    </div>

                    <!-- 搜索和筛选 -->
                    <div class="control-item">
                        <SearchFilter
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

            <!-- 详情弹窗 - 使用 store 管理状态 -->
            <WordEditorModal />
        </template>
    </PageLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import WordInsertForm from '@/features/vocabulary/editor/WordInsertForm.vue';
import SearchFilter from '@/features/vocabulary/grid/SearchFilter.vue';
import WordGrid from '@/features/vocabulary/grid/WordGrid.vue';
import WordEditorModal from '@/features/vocabulary/editor/WordEditorModal.vue';
import Loading from '@/shared/components/feedback/Loading.vue'
import PageLayout from '@/shared/components/layout/PageLayout.vue';
import type { Word, SourceCounts } from '@/shared/types';
import { useWordStats } from '@/shared/composables/useWordStats';
import { useSourceSelectionReadOnly } from '@/shared/composables/useSourceSelection';
import { api } from '@/shared/api';
import { useSettings } from '@/shared/composables/useSettings';
import { useWordEditorStore } from '@/features/vocabulary/stores/wordEditor';
import { logger } from '@/shared/utils/logger';

const words = ref<Word[]>([]);
const searchQuery = ref('');
const filterStatus = ref('all');
const sourceFilter = ref<string>('all'); // 新增来源筛选

// Word Editor Store
const wordEditorStore = useWordEditorStore();
const isLoading = ref(true);
const sourceCounts = ref<SourceCounts | undefined>(undefined); // 存储源计数
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
    return word.stop_review === 1;
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
        logger.error('Failed to load words batch:', error);
        return false;
    } finally {
        isLoadingMore.value = false;
    }
};

// 并行加载所有剩余批次（按顺序即时插入）
const loadRemainingBatches = async () => {
    if (!hasMoreWords.value || shouldStopLoading.value) return;

    isLoadingMore.value = true;

    try {
        // 计算所有需要请求的 offset
        const offsets: number[] = [];
        for (let offset = batchSize.value; offset < totalWords.value; offset += batchSize.value) {
            offsets.push(offset);
        }

        if (offsets.length === 0) {
            hasMoreWords.value = false;
            return;
        }

        // 缓存乱序到达的批次，等待按顺序插入
        const pendingBatches = new Map<number, Word[]>();
        let nextExpectedOffset = batchSize.value;

        // 尝试将缓存中的批次按顺序插入
        const flushPendingBatches = () => {
            while (pendingBatches.has(nextExpectedOffset)) {
                words.value.push(...pendingBatches.get(nextExpectedOffset)!);
                pendingBatches.delete(nextExpectedOffset);
                nextExpectedOffset += batchSize.value;
            }
            loadedWords.value = words.value.length;
        };

        // 并发请求，完成时按顺序插入
        await Promise.all(
            offsets.map(async (offset) => {
                const response = await api.words.getWordsPaginated(batchSize.value, offset);

                if (shouldStopLoading.value) return;

                if (offset === nextExpectedOffset) {
                    // 正好是期望的下一批，直接追加
                    words.value.push(...response.words);
                    nextExpectedOffset += batchSize.value;
                    loadedWords.value = words.value.length;
                    // 检查缓存中是否有后续批次可以插入
                    flushPendingBatches();
                } else {
                    // 不是期望的下一批，先缓存
                    pendingBatches.set(offset, response.words);
                }
            })
        );

        // 最终确保所有缓存都已插入
        flushPendingBatches();
        hasMoreWords.value = false;
    } catch (error) {
        logger.error('Failed to load remaining batches:', error);
    } finally {
        isLoadingMore.value = false;
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
            logger.error('Failed to load wordsLoadBatchSize from settings, using default 200:', error);
        }

        // 加载第一批单词
        await loadWordsBatch(0);

        // 在背景中异步加载剩余的单词
        if (hasMoreWords.value) {
            // 不等待这个函数完成，让它在后台运行
            loadRemainingBatches();
        }
    } catch (error) {
        logger.error('Failed to load initial words batch:', error);
    } finally {
        isLoading.value = false;
    }
});

// 显示详情 - 使用 store.open() 打开模态框
const handleShowDetail = (word: Word) => {
    wordEditorStore.open(word);

    // 注册回调：模态框关闭时更新列表
    wordEditorStore.onClose((finalWord: Word | undefined) => {
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
    });

    // 注册回调：单词删除时更新列表
    wordEditorStore.onWordDeleted((wordId: number) => {
        const index = words.value.findIndex(w => w.id === wordId);
        if (index !== -1) {
            words.value.splice(index, 1);
            updateSourceCounts();
        }
    });

    // 注册回调：单词更新时更新列表
    wordEditorStore.onWordUpdated((updatedWord: Word) => {
        const index = words.value.findIndex(w => w.id === updatedWord.id);
        if (index !== -1) {
            const oldWord = words.value[index];
            const oldRemembered = isWordRemembered(oldWord);
            const newRemembered = isWordRemembered(updatedWord);

            words.value[index] = updatedWord;

            if (oldRemembered !== newRemembered) {
                updateSourceCounts();
            }
        }
    });
};

const handleWordInserted = async (word: Word) => {
    words.value.unshift(word);
    // 更新计数
    updateSourceCounts();
    // 标记为新增单词，使其显示在最前面
    wordGridRef.value?.addNewWordId(word.id);

    // 新增单词后，异步获取释义
    try {
        const updatedWord = await api.words.fetchDefinition(word.id);
        // 更新列表中的单词
        const index = words.value.findIndex(w => w.id === word.id);
        if (index !== -1) {
            words.value[index] = updatedWord;
        }
    } catch (error) {
        logger.error('Failed to fetch definition for new word:', error);
    }
};

// 批量插入单词后并行获取释义
const handleBatchWordInserted = async (insertedWords: Word[]) => {
    // 先将所有单词添加到列表（无释义状态）
    insertedWords.forEach(word => {
        words.value.unshift(word);
        wordGridRef.value?.addNewWordId(word.id);
    });
    updateSourceCounts();

    if (insertedWords.length === 0) return;

    // 并行获取所有单词的释义
    await Promise.all(
        insertedWords.map(async (word) => {
            try {
                const updatedWord = await api.words.fetchDefinition(word.id);
                // 获取完成后立即更新对应单词
                const index = words.value.findIndex(w => w.id === word.id);
                if (index !== -1) {
                    words.value[index] = updatedWord;
                }
            } catch (error) {
                logger.error(`Failed to fetch definition for word ${word.word}:`, error);
            }
        })
    );
};

const handleBatchDelete = (wordIds: number[]) => {
    // 从本地words数组中批量移除这些单词
    words.value = words.value.filter(w => !wordIds.includes(w.id));
    // 更新计数
    updateSourceCounts();
};

onUnmounted(() => {
    // 停止后台加载
    shouldStopLoading.value = true;
})
</script>

<style scoped>
/* PageLayout 已提供基础布局，这里只需要页面特有样式 */

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

.progress-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
}

.progress-text {
    font-size: 0.875rem;
    color: var(--color-text-primary);
    font-weight: 500;
}

.loading-spinner-small {
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--color-border-medium);
    border-top: 2px solid var(--color-primary);
    border-radius: var(--radius-full);
    animation: spin 1s linear infinite;
}

.progress-bar {
    width: 100%;
    height: 0.5rem;
    background: var(--color-border-medium);
    border-radius: 0.25rem;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: var(--gradient-primary);
    border-radius: 0.25rem;
    transition: width 0.3s ease;
}

/* spin animation defined in animations.css */

/* 移动端适配 */
@media (max-width: 480px) {
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

    .progress-text {
        font-size: 0.8rem;
    }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
    .words-section {
        padding: 0.75rem;
    }
}
</style>
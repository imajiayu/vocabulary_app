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
        <template #topbar-right>
            <button class="button" @click="handleFixDefinitions" :disabled="isLoading || hasMoreWords || isLoadingMore || defProgress.isActive.value">
                修复释义
            </button>
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

                    <!-- 释义获取进度指示器 -->
                    <div v-if="defProgress.isActive.value" class="loading-progress">
                        <div class="progress-info">
                            <span class="progress-text">
                                {{ defProgress.label.value }} {{ defProgress.current.value }}/{{ defProgress.total.value }}
                                <template v-if="defProgress.failedCount.value > 0">
                                    （失败 {{ defProgress.failedCount.value }}）
                                </template>
                            </span>
                            <div class="loading-spinner-small"></div>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" :style="{ width: `${defProgress.progress.value}%` }"></div>
                        </div>
                    </div>

                    <WordGrid
                        ref="wordGridRef"
                        :words="words"
                        :search-query="searchQuery"
                        :filter-status="filterStatus"
                        :source-filter="sourceFilter"
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
import type { Word } from '@/shared/types';
import { useWordStats } from '@/shared/composables/useWordStats';
import { useSourceSelectionReadOnly } from '@/shared/composables/useSourceSelection';
import { api } from '@/shared/api';
import { useSettings } from '@/shared/composables/useSettings';
import { useWordEditorStore } from '@/features/vocabulary/stores/wordEditor';
import { logger } from '@/shared/utils/logger';
import { concurrentMap } from '@/shared/utils/concurrent';
import { useDefinitionProgress } from '@/features/vocabulary/editor/composables';

const words = ref<Word[]>([]);
const defProgress = useDefinitionProgress();

// O(1) word lookup by id — rebuilt lazily when words array changes
let _wordIndexMap: Map<number, number> | null = null
let _wordIndexVersion = 0
function getWordIndex(wordId: number): number {
  // Rebuild map when words array has been mutated
  const currentVersion = words.value.length
  if (!_wordIndexMap || _wordIndexVersion !== currentVersion) {
    _wordIndexMap = new Map()
    words.value.forEach((w, i) => _wordIndexMap!.set(w.id, i))
    _wordIndexVersion = currentVersion
  }
  return _wordIndexMap.get(wordId) ?? -1
}
function invalidateWordIndex() { _wordIndexMap = null }
const searchQuery = ref('');
const filterStatus = ref('all');
const sourceFilter = ref<string>('all'); // 新增来源筛选

// Word Editor Store
const wordEditorStore = useWordEditorStore();
const isLoading = ref(true);
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

// 分批加载单词的函数
const loadWordsBatch = async (offset: number = 0): Promise<boolean> => {
    try {
        isLoadingMore.value = offset > 0; // 只有加载后续批次时才显示加载更多状态

        const response = await api.words.getWordsPaginatedDirect(batchSize.value, offset);

        if (offset === 0) {
            // 首次加载，替换所有数据
            words.value = response.words;
            totalWords.value = response.total;
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

// 并行加载所有剩余批次（并发限制 + 重试 + 按顺序插入）
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

        // 并发请求（限制 4 并发，每批最多重试 2 次，指数退避 500/1000ms）
        const batchResults = await concurrentMap(
            offsets,
            async (offset) => {
                const response = await api.words.getWordsPaginatedDirect(batchSize.value, offset);
                return { offset, words: response.words };
            },
            4,
            { retries: 2, retryDelay: 500 },
        );

        if (shouldStopLoading.value) return;

        // 按 offset 顺序插入（concurrentMap 已保序）
        for (const result of batchResults) {
            if (result) {
                words.value.push(...result.words);
                loadedWords.value = words.value.length;
            }
        }

        hasMoreWords.value = false;
    } catch (error) {
        logger.error('Failed to load remaining batches:', error);
    } finally {
        isLoadingMore.value = false;
    }
};

// 桌面端隐藏页面滚动条
const isDesktop = window.matchMedia('(min-width: 769px)').matches

onMounted(async () => {
    if (isDesktop) document.documentElement.classList.add('hide-scrollbar')
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
            const index = getWordIndex(finalWord.id);
            if (index !== -1) {
                words.value[index] = finalWord;
            }
        }
    });

    // 注册回调：单词删除时更新列表
    wordEditorStore.onWordDeleted((wordId: number) => {
        const index = getWordIndex(wordId);
        if (index !== -1) {
            words.value.splice(index, 1);
            invalidateWordIndex();
        }
    });

    // 注册回调：单词更新时更新列表
    wordEditorStore.onWordUpdated((updatedWord: Word) => {
        const index = getWordIndex(updatedWord.id);
        if (index !== -1) {
            words.value[index] = updatedWord;
        }
    });
};

const handleWordInserted = async (word: Word) => {
    words.value.unshift(word);
    // 标记为新增单词，使其显示在最前面
    wordGridRef.value?.addNewWordId(word.id);

    // 新增单词后，异步获取释义
    invalidateWordIndex();
    defProgress.start(1, '获取释义');
    try {
        const updatedWord = await api.words.fetchDefinition(word.id);
        defProgress.increment();
        // 更新列表中的单词
        const index = getWordIndex(word.id);
        if (index !== -1) {
            words.value[index] = updatedWord;
        }
    } catch (error) {
        defProgress.incrementFailed();
        logger.error('Failed to fetch definition for new word:', error);
    } finally {
        defProgress.reset();
    }
};

// 批量插入单词后并发获取释义（受 definitionFetchThreads 设置限制）
const handleBatchWordInserted = async (insertedWords: Word[]) => {
    // 先将所有单词添加到列表（无释义状态）
    insertedWords.forEach(word => {
        words.value.unshift(word);
        wordGridRef.value?.addNewWordId(word.id);
    });

    invalidateWordIndex();
    if (insertedWords.length === 0) return;

    // 读取并发数设置（settings 已在 onMounted 中加载并缓存）
    let threads = 3;
    try {
        const settings = await loadSettings();
        threads = settings.management.definitionFetchThreads;
    } catch {
        // 使用默认值
    }

    // 池模式并发获取释义
    defProgress.start(insertedWords.length, '获取释义');
    await concurrentMap(insertedWords, async (word) => {
        try {
            const updatedWord = await api.words.fetchDefinition(word.id);
            defProgress.increment();
            const index = getWordIndex(word.id);
            if (index !== -1) {
                words.value[index] = updatedWord;
            }
            return updatedWord;
        } catch {
            defProgress.incrementFailed();
        }
    }, threads);
    defProgress.reset();
};

// 修复释义：找出 definition 为空的单词并批量获取
const handleFixDefinitions = async () => {
    const isEmptyDefinition = (def: Word['definition']) =>
        !def || (typeof def === 'object' && (!def.definitions || def.definitions.length === 0));

    const emptyWords = words.value.filter(w => isEmptyDefinition(w.definition));

    if (emptyWords.length === 0) {
        alert('所有单词均已有释义，无需修复。');
        return;
    }

    let threads = 3;
    try {
        const settings = await loadSettings();
        threads = settings.management.definitionFetchThreads;
    } catch {
        // 使用默认值
    }

    defProgress.start(emptyWords.length, '修复释义');
    await concurrentMap(emptyWords, async (word) => {
        try {
            const updatedWord = await api.words.fetchDefinition(word.id);
            defProgress.increment();
            const index = getWordIndex(word.id);
            if (index !== -1) {
                words.value[index] = updatedWord;
            }
            return updatedWord;
        } catch {
            defProgress.incrementFailed();
        }
    }, threads);
    defProgress.reset();
};

const handleBatchDelete = (wordIds: number[]) => {
    // 从本地words数组中批量移除这些单词
    words.value = words.value.filter(w => !wordIds.includes(w.id));
    invalidateWordIndex();
};

onUnmounted(() => {
    document.documentElement.classList.remove('hide-scrollbar')
    // 停止后台加载
    shouldStopLoading.value = true;
})
</script>

<style scoped>
/* PageLayout 已提供基础布局，这里只需要页面特有样式 */

.top-controls {
    display: flex;
    gap: var(--space-4);
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
    background: var(--color-surface-card);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    border: 1px solid var(--color-border-light);
    padding: var(--space-6);
}

/* 批量加载进度指示器 */
.loading-progress {
    padding: var(--space-4);
    padding-bottom: var(--space-6);
}

.progress-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-3);
}

.progress-text {
    font-family: var(--font-ui);
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
}

.loading-spinner-small {
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--color-border-light);
    border-top: 2px solid var(--color-brand-primary);
    border-radius: var(--radius-full);
    animation: spin 1s linear infinite;
}

.progress-bar {
    width: 100%;
    height: 0.5rem;
    background: var(--color-border-light);
    border-radius: var(--radius-full);
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: var(--gradient-primary);
    border-radius: var(--radius-full);
    transition: width 0.3s ease;
}

/* spin animation defined in animations.css */

/* 移动端适配 */
@media (max-width: 768px) {
    .top-controls {
        flex-direction: column;
        gap: var(--space-4);
    }

    .words-section {
        padding: var(--space-4);
        border-radius: var(--radius-default);
    }

    .loading-progress {
        margin-top: var(--space-4);
        padding: var(--space-3);
    }

    .progress-text {
        font-size: var(--font-size-xs);
    }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
    .words-section {
        padding: var(--space-3);
    }
}
</style>
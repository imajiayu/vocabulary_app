<template>
    <div class="section-header">
        <div class="header-row">
            <h2 class="section-title">单词列表</h2>

            <div class="header-controls">
                <!-- 批量操作按钮（仅在选择模式下且有选中时显示） -->
                <button
                    v-if="isSelectionMode && selectedWordIds.size > 0"
                    class="batch-toggle-btn"
                    :class="batchToggleButtonClass"
                    @click="handleBatchToggleReview"
                    :disabled="isBatchOperating || !canBatchToggle">
                    <span class="btn-text">{{ batchToggleButtonText }}</span>
                </button>

                <button
                    v-if="isSelectionMode && selectedWordIds.size > 0"
                    class="batch-delete-btn"
                    @click="handleBatchDelete"
                    :disabled="isBatchOperating">
                    <Trash2 class="btn-icon" />
                    <span class="btn-text">删除 ({{ selectedWordIds.size }})</span>
                </button>

                <!-- 多选按钮 -->
                <button
                    class="multi-select-btn"
                    :class="{ 'active': isSelectionMode }"
                    @click="toggleSelectionMode">
                    <CheckSquare v-if="isSelectionMode" class="btn-icon" />
                    <Square v-else class="btn-icon" />
                    <span class="btn-text">{{ isSelectionMode ? '取消' : '多选' }}</span>
                </button>

                <div class="sort-controls-integrated">
                    <button
                        class="sort-field-btn active"
                        @click="toggleSortField">
                        <span>{{ getSortFieldName(sortFields[sortFieldIndex]) }}</span>
                    </button>
                    <button
                        class="sort-order-btn"
                        :class="{ 'ascending': sortOrderIndex === 0, 'descending': sortOrderIndex === 1 }"
                        @click="toggleSortOrder">
                        <ChevronUp v-if="sortOrderIndex === 0" class="sort-icon" />
                        <ChevronDown v-else class="sort-icon" />
                    </button>
                </div>

                <div class="word-count">
                    共 {{ getDisplayCount() }} 个
                </div>
            </div>
        </div>
    </div>

    <div class="word-grid">
        <div v-for="word in visibleWords" :key="word.id"
            :class="['word-item', { animating: animatingIds.has(word.id) }]">
            <WordCard
                :word="word"
                :is-selection-mode="isSelectionMode"
                :is-selected="selectedWordIds.has(word.id)"
                @toggle-selection="handleToggleSelection"
                @show-detail="$emit('showDetail', $event)" />
        </div>
        <div ref="sentinelRef" class="load-sentinel"></div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import WordCard from './WordCard.vue';
import { ChevronUp, ChevronDown, Square, CheckSquare, Trash2 } from 'lucide-vue-next';
import type { Word } from '@/shared/types';
import { api } from '@/shared/api';
import { logger } from '@/shared/utils/logger';

const log = logger.create('WordGrid');

interface Props {
    words: Word[];
    searchQuery: string;
    filterStatus: string;
    sourceFilter: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    showDetail: [word: Word];
    batchDelete: [ids: number[]];
}>();

const animatingIds = ref(new Set<number>());

// 增量渲染
const RENDER_BATCH = 100;
const renderCount = ref(RENDER_BATCH);
const sentinelRef = ref<HTMLDivElement | null>(null);
let observer: IntersectionObserver | null = null;

// 多选模式相关
const isSelectionMode = ref(false);
const selectedWordIds = ref(new Set<number>());
const isBatchOperating = ref(false);

const sortOrders = ['asc', 'desc'];

// 循环排序相关的响应式数据
const sortFields = ['word', 'ease_factor', 'date_added'];
const sortFieldIndex = ref(0); // 0/1/2 分别对应 sortFields 数组的索引
const sortOrderIndex = ref(0); // 0 升序，1 降序
const hasUserSorted = ref(false); // 用户是否主动切换过排序
const newWordIds = ref(new Set<number>()); // 新增单词的 ID 集合

// 首先根据来源筛选
const filteredBySourceWords = computed(() => {
    if (props.sourceFilter === 'all') {
        return props.words;
    }
    return props.words.filter(word => word.source === props.sourceFilter);
});

const filteredWords = computed(() => {
    return filteredBySourceWords.value.filter(word => {
        const isRemembered = word.stop_review === 1;

        // 状态过滤
        if (props.filterStatus === 'remembered' && !isRemembered) return false;
        if (props.filterStatus === 'unremembered' && isRemembered) return false;

        // 搜索过滤
        if (props.searchQuery) {
            const query = props.searchQuery.trim().toLowerCase();
            const isChinese = /[\u4e00-\u9fa5]/.test(query);

            if (isChinese) {
                return word.definition.definitions?.join('\n').includes(query);
            } else {
                return word.word.toLowerCase().includes(query);
            }
        }
        return true;
    });
});

const sortedWords = computed(() => {
    let wordsToSort = [...filteredWords.value];

    // Special sorting for search results first
    if (props.searchQuery) {
        const query = props.searchQuery.trim().toLowerCase();
        const isChinese = /[\u4e00-\u9fa5]/.test(query);
        wordsToSort.sort((a, b) => {
            const aText = isChinese ? a.definition.definitions?.join('\n').toLowerCase() : a.word.toLowerCase();
            const bText = isChinese ? b.definition.definitions?.join('\n').toLowerCase() : b.word.toLowerCase();
            const aStartsWith = aText?.startsWith(query);
            const bStartsWith = bText?.startsWith(query);
            if (aStartsWith && !bStartsWith) return -1;
            if (!aStartsWith && bStartsWith) return 1;
            return 0;
        });
        return wordsToSort; // Return immediately after applying search-specific sorting
    }

    // 分离新增单词和其他单词
    const newWords: Word[] = [];
    const existingWords: Word[] = [];

    wordsToSort.forEach(word => {
        if (newWordIds.value.has(word.id)) {
            newWords.push(word);
        } else {
            existingWords.push(word);
        }
    });

    // Sort based on the circular buttons' state
    // Note: 保持原始顺序（新添加的单词在前），排序仅在用户主动切换时生效
    if (!hasUserSorted.value) {
        return wordsToSort; // 用户未主动排序时，保持原始顺序（新添加的在前）
    }

    const sortField = sortFields[sortFieldIndex.value];
    if (sortField) {
        // 只对非新增单词排序
        let sorted = existingWords.sort((a, b) => {
            switch (sortField) {
                case 'word':
                    return a.word.localeCompare(b.word);
                case 'ease_factor':
                    // 修正熟练度排序逻辑：升序应该先展示高熟练度的单词
                    return b.ease_factor - a.ease_factor;
                case 'date_added': {
                    // 先按日期排序
                    const dateCompare = new Date(a.date_added).getTime() - new Date(b.date_added).getTime();
                    // 日期相同时按 id 排序
                    if (dateCompare !== 0) return dateCompare;
                    return a.id - b.id;
                }
                default:
                    return 0;
            }
        });

        const sortOrder = sortOrders[sortOrderIndex.value];
        if (sortOrder === 'desc') {
            sorted = sorted.reverse();
        }

        // 新增单词始终在最前面
        return [...newWords, ...sorted];
    }

    return wordsToSort;
});

const visibleWords = computed(() => sortedWords.value.slice(0, renderCount.value));

// 当 sortedWords 变化时（筛选/搜索/排序）重置 renderCount
watch(sortedWords, () => {
  renderCount.value = RENDER_BATCH;
});

onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting && renderCount.value < sortedWords.value.length) {
      renderCount.value = Math.min(renderCount.value + RENDER_BATCH, sortedWords.value.length);
    }
  });
  if (sentinelRef.value) observer.observe(sentinelRef.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});

// 当 sentinel DOM 出现时重新 observe
watch(sentinelRef, (el) => {
  if (el && observer) observer.observe(el);
});

const toggleSortField = () => {
    hasUserSorted.value = true; // 标记用户已主动排序
    newWordIds.value.clear(); // 清空新增单词标记
    if (sortFieldIndex.value < sortFields.length - 1) {
        sortFieldIndex.value += 1;
    } else {
        sortFieldIndex.value = 0; // 循环回第一个字段
    }
};

const toggleSortOrder = () => {
    hasUserSorted.value = true; // 标记用户已主动排序
    newWordIds.value.clear(); // 清空新增单词标记
    sortOrderIndex.value = sortOrderIndex.value === 0 ? 1 : 0;
};

// 添加新单词ID（供父组件调用）
const addNewWordId = (wordId: number) => {
    newWordIds.value.add(wordId);
};

// 暴露方法给父组件
defineExpose({
    addNewWordId
});

// 辅助函数，用于获取排序字段的中文名称
const getSortFieldName = (field: string) => {
    switch (field) {
        case 'word': return '字母';
        case 'ease_factor': return '熟练度';
        case 'date_added': return '日期';
        default: return '排序';
    }
};

const getDisplayCount = () => filteredWords.value.length;

// 多选模式切换
const toggleSelectionMode = () => {
    isSelectionMode.value = !isSelectionMode.value;
    if (!isSelectionMode.value) {
        // 退出多选模式时清空选择
        selectedWordIds.value.clear();
    }
};

// 切换单词选择状态
const handleToggleSelection = (wordId: number) => {
    if (selectedWordIds.value.has(wordId)) {
        selectedWordIds.value.delete(wordId);
    } else {
        selectedWordIds.value.add(wordId);
    }
};

// 批量操作按钮状态
const selectedWords = computed(() => {
    return props.words.filter(word => selectedWordIds.value.has(word.id));
});

const allStopReviewTrue = computed(() => {
    return selectedWords.value.length > 0 && selectedWords.value.every(word => word.stop_review === 1);
});

const allStopReviewFalse = computed(() => {
    return selectedWords.value.length > 0 && selectedWords.value.every(word => word.stop_review === 0);
});

const canBatchToggle = computed(() => {
    return allStopReviewTrue.value || allStopReviewFalse.value;
});

const batchToggleButtonText = computed(() => {
    if (allStopReviewTrue.value) {
        return `恢复复习 (${selectedWordIds.value.size})`;
    } else if (allStopReviewFalse.value) {
        return `标记掌握 (${selectedWordIds.value.size})`;
    } else {
        return `状态不一致 (${selectedWordIds.value.size})`;
    }
});

const batchToggleButtonClass = computed(() => {
    if (allStopReviewTrue.value) {
        return 'restore';
    } else if (allStopReviewFalse.value) {
        return 'master';
    } else {
        return 'mixed';
    }
});

// 批量切换复习状态处理
const handleBatchToggleReview = async () => {
    if (selectedWordIds.value.size === 0 || !canBatchToggle.value) return;

    const newStatus = allStopReviewFalse.value ? 1 : 0;
    const action = newStatus === 1 ? '标记掌握' : '恢复复习';

    isBatchOperating.value = true;
    try {
        const idsToUpdate = Array.from(selectedWordIds.value);
        const updatedWords = await api.words.batchUpdateDirect(idsToUpdate, { stop_review: newStatus });

        // 更新本地单词数据
        updatedWords.forEach(updatedWord => {
            const index = props.words.findIndex(w => w.id === updatedWord.id);
            if (index !== -1) {
                Object.assign(props.words[index], updatedWord);
            }
        });

        // 清空选择并退出多选模式
        selectedWordIds.value.clear();
        isSelectionMode.value = false;
    } catch (error) {
        log.error('Batch toggle review failed:', error);
        alert(`批量${action}失败，请稍后重试`);
    } finally {
        isBatchOperating.value = false;
    }
};

// 批量删除处理
const handleBatchDelete = async () => {
    if (selectedWordIds.value.size === 0) return;

    const confirmMessage = `确定要删除选中的 ${selectedWordIds.value.size} 个单词吗？此操作不可恢复。`;
    if (!confirm(confirmMessage)) return;

    isBatchOperating.value = true;
    try {
        const idsToDelete = Array.from(selectedWordIds.value);
        await api.words.batchDeleteDirect(idsToDelete);

        // 通知父组件批量删除成功
        emit('batchDelete', idsToDelete);

        // 清空选择并退出多选模式
        selectedWordIds.value.clear();
        isSelectionMode.value = false;
    } catch (error) {
        log.error('Batch delete failed:', error);
        alert('批量删除失败，请稍后重试');
    } finally {
        isBatchOperating.value = false;
    }
};
</script>

<style scoped>
.word-grid-container {
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    padding: 1.5rem;
}

.section-header {
    margin-bottom: 1rem;
}

.header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
}

.section-title {
    margin: 0;
    flex-shrink: 0;
}

.header-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: nowrap;
    margin-left: auto;
}

/* 方案一：一体化排序控件 */
.sort-controls-integrated {
    position: relative;
    display: inline-flex;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-medium);
    border-radius: 0.75rem;
    overflow: hidden;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    transition: box-shadow 0.2s ease;
}

.sort-controls-integrated:hover {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.sort-field-btn {
    padding: 0.75rem 1rem;
    border: none;
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    position: relative;
    min-width: 80px;
    justify-content: center;
    outline: none;
    -webkit-tap-highlight-color: transparent;
}

.sort-field-btn:hover:not(.active) {
    background: var(--color-border-medium);
    color: var(--color-text-primary);
}

.sort-field-btn.active {
    background: var(--color-primary);
    color: white;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.sort-order-btn {
    padding: 0.75rem;
    border: none;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
    border-left: 1px solid var(--color-border-medium);
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 48px;
    position: relative;
    outline: none;
    -webkit-tap-highlight-color: transparent;
}

.sort-order-btn::before {
    content: '';
    position: absolute;
    left: 0;
    top: 25%;
    height: 50%;
    width: 1px;
    background: var(--color-border-medium);
    transition: background-color 0.2s ease;
}

.sort-order-btn:hover:not(:disabled):not(.ascending):not(.descending) {
    background: var(--color-border-medium);
    color: var(--color-text-primary);
}

.sort-order-btn.ascending {
    background: var(--color-success);
    color: white;
}

.sort-order-btn.ascending:hover {
    background: var(--color-success-hover);
}

.sort-order-btn.ascending::before {
    background: transparent;
}

.sort-order-btn.descending {
    background: var(--color-edit);
    color: white;
}

.sort-order-btn.descending:hover {
    background: var(--color-processing-dark);
}

.sort-order-btn.descending::before {
    background: transparent;
}

.sort-order-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: transparent;
}

.sort-order-btn:disabled:hover {
    background: transparent;
    color: var(--color-text-secondary);
}

.sort-icon {
    width: 0.875rem;
    height: 0.875rem;
    transition: transform 0.2s ease;
}

.sort-field-btn.active .sort-icon,
.sort-order-btn.ascending .sort-icon,
.sort-order-btn.descending .sort-icon {
    transform: scale(1.05);
}

.word-count {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    flex-shrink: 0;
    padding: 0.5rem 0.75rem;
    white-space: nowrap;
}

/* 移动端优化 */
@media (max-width: 768px) {
    .header-controls {
        gap: 0.375rem;
    }

    .multi-select-btn,
    .batch-delete-btn {
        padding: 0.5rem 0.75rem;
        font-size: 0.8125rem;
    }

    .btn-text {
        display: inline;
    }

    .sort-field-btn {
        padding: 0.5rem 0.75rem;
        min-width: 60px;
        font-size: 0.8125rem;
    }

    .sort-order-btn {
        padding: 0.5rem;
        min-width: 40px;
    }

    .word-count {
        padding: 0.5rem;
        font-size: 0.8125rem;
    }

    .btn-icon {
        width: 0.875rem;
        height: 0.875rem;
    }

    .sort-icon {
        width: 0.75rem;
        height: 0.75rem;
    }
}

/* 超小屏幕优化 */
@media (max-width: 768px) {
    .header-row {
        gap: 0.5rem;
    }

    .header-controls {
        gap: 0.25rem;
    }

    .section-title {
        font-size: 1.125rem;
    }

    .multi-select-btn,
    .batch-toggle-btn,
    .batch-delete-btn {
        padding: 0.5rem;
        min-width: auto;
    }

    .btn-text {
        display: none;
    }

    .sort-field-btn {
        padding: 0.5rem;
        min-width: 48px;
        font-size: 0.75rem;
    }

    .sort-order-btn {
        padding: 0.5rem;
        min-width: 36px;
    }

    .word-count {
        padding: 0.5rem;
        font-size: 0.75rem;
    }
}

.word-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 0.5rem 0;
}

.word-item {
    transition: all 0.3s ease;
}

.word-item.animating {
    transform: scale(1.1);
    z-index: 10;
}

.empty-text {
    width: 100%;
    text-align: center;
    color: var(--color-text-muted);
    padding: 1rem 0;
}

/* 多选按钮样式 */
.multi-select-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-medium);
    border-radius: 0.75rem;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
    -webkit-tap-highlight-color: transparent;
}

.multi-select-btn:hover {
    background: var(--color-border-medium);
    color: var(--color-text-primary);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.multi-select-btn.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
}

.multi-select-btn.active:hover {
    background: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
}

/* 批量切换复习状态按钮样式 */
.batch-toggle-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: 1px solid;
    border-radius: 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
    -webkit-tap-highlight-color: transparent;
}

.batch-toggle-btn.master {
    background: var(--color-success);
    border-color: var(--color-success-hover);
    color: white;
}

.batch-toggle-btn.master:hover:not(:disabled) {
    background: var(--color-success-hover);
    box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);
}

.batch-toggle-btn.restore {
    background: var(--color-edit);
    border-color: var(--color-processing-dark);
    color: white;
}

.batch-toggle-btn.restore:hover:not(:disabled) {
    background: var(--color-processing-dark);
    box-shadow: 0 4px 6px -1px rgba(245, 158, 11, 0.3);
}

.batch-toggle-btn.mixed {
    background: var(--color-text-tertiary);
    border-color: var(--color-text-secondary);
    color: white;
}

.batch-toggle-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* 批量删除按钮样式 */
.batch-delete-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--color-delete);
    border: 1px solid var(--color-recording-dark);
    border-radius: 0.75rem;
    color: white;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
    -webkit-tap-highlight-color: transparent;
}

.batch-delete-btn:hover:not(:disabled) {
    background: var(--color-recording-dark);
    box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.3);
}

.batch-delete-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-icon {
    width: 1rem;
    height: 1rem;
}

.load-sentinel {
    width: 100%;
    height: 1px;
}
</style>
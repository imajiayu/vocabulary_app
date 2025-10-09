<template>
    <div class="section-header">
        <h2 class="section-title">单词列表</h2>

        <div class="right-controls">
            <!-- 排序控件和单词数量 -->
            <div class="sort-controls-group">
                <!-- 批量删除按钮（仅在选择模式下且有选中时显示） -->
                <button
                    v-if="isSelectionMode && selectedWordIds.size > 0"
                    class="batch-delete-btn"
                    @click="handleBatchDelete"
                    :disabled="isDeletingBatch">
                    <Trash2 class="btn-icon" />
                    <span>删除 ({{ selectedWordIds.size }})</span>
                </button>

                <!-- 多选按钮 -->
                <button
                    class="multi-select-btn"
                    :class="{ 'active': isSelectionMode }"
                    @click="toggleSelectionMode">
                    <CheckSquare v-if="isSelectionMode" class="btn-icon" />
                    <Square v-else class="btn-icon" />
                    <span>{{ isSelectionMode ? '取消多选' : '多选' }}</span>
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
                    共 {{ getDisplayCount() }} 个单词
                </div>
            </div>
        </div>
    </div>

    <div class="word-grid">
        <div v-for="word in sortedWords" :key="word.id"
            :class="['word-item', { animating: animatingIds.has(word.id) }]">
            <WordCard
                :word="word"
                :is-selection-mode="isSelectionMode"
                :is-selected="selectedWordIds.has(word.id)"
                @toggle-review="handleToggleReview"
                @reset="handleReset"
                @toggle-selection="handleToggleSelection"
                @show-detail="$emit('showDetail', $event)" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import WordCard from './WordCard.vue';
import { ChevronUp, ChevronDown, Square, CheckSquare, Trash2 } from 'lucide-vue-next';
import type { Word } from '@/shared/types';
import { api } from '@/shared/api';

interface Props {
    words: Word[];
    searchQuery: string;
    filterStatus: string;
    sourceFilter: 'all' | 'IELTS' | 'GRE';
    // 新增：预计算的源计数，用于显示稳定的总数
    sourceCounts?: any;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    toggleReview: [id: number, status: boolean];
    reset: [id: number];
    showDetail: [word: Word];
    batchDelete: [ids: number[]];
}>();

const animatingIds = ref(new Set<number>());

// 多选模式相关
const isSelectionMode = ref(false);
const selectedWordIds = ref(new Set<number>());
const isDeletingBatch = ref(false);

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
        const isRemembered = word.stop_review === 1 || word.ease_factor >= 3.0;

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

const handleToggleReview = async (id: number, status: boolean) => {
    animatingIds.value.add(id);
    emit('toggleReview', id, status);
    setTimeout(() => {
        animatingIds.value.delete(id);
    }, 300);
};

const handleReset = async (id: number) => {
    animatingIds.value.add(id);
    emit('reset', id);
    setTimeout(() => {
        animatingIds.value.delete(id);
    }, 300);
};

// 辅助函数，用于获取排序字段的中文名称
const getSortFieldName = (field: string) => {
    switch (field) {
        case 'word': return '字母';
        case 'ease_factor': return '熟练度';
        case 'date_added': return '日期';
        default: return '排序';
    }
};

// 获取要显示的单词数量
const getDisplayCount = () => {
    // 如果有搜索查询，显示实际筛选后的数量
    if (props.searchQuery && props.searchQuery.trim()) {
        return filteredWords.value.length;
    }

    // 如果有预计算的计数，根据当前筛选条件使用对应的计数
    if (props.sourceCounts?.source_counts) {
        const counts = props.sourceCounts.source_counts;
        let sourceStats;

        if (props.sourceFilter === 'all') {
            sourceStats = counts.all;
        } else if (props.sourceFilter === 'IELTS') {
            sourceStats = counts.IELTS;
        } else {
            sourceStats = counts.GRE;
        }

        if (props.filterStatus === 'all') {
            return sourceStats.total;
        } else if (props.filterStatus === 'remembered') {
            return sourceStats.remembered;
        } else {
            return sourceStats.unremembered;
        }
    }

    // 后备方案：使用动态计算的结果
    return filteredWords.value.length;
};

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

// 批量删除处理
const handleBatchDelete = async () => {
    if (selectedWordIds.value.size === 0) return;

    const confirmMessage = `确定要删除选中的 ${selectedWordIds.value.size} 个单词吗？此操作不可恢复。`;
    if (!confirm(confirmMessage)) return;

    isDeletingBatch.value = true;
    try {
        const idsToDelete = Array.from(selectedWordIds.value);
        await api.words.batchDelete(idsToDelete);

        // 通知父组件批量删除成功
        emit('batchDelete', idsToDelete);

        // 清空选择并退出多选模式
        selectedWordIds.value.clear();
        isSelectionMode.value = false;
    } catch (error) {
        console.error('Batch delete failed:', error);
        alert('批量删除失败，请稍后重试');
    } finally {
        isDeletingBatch.value = false;
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
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.right-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-left: auto;
    flex-wrap: wrap;
}

.sort-controls-group {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
}

/* 方案一：一体化排序控件 */
.sort-controls-integrated {
    position: relative;
    display: inline-flex;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
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
    color: #64748b;
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
    background: #e2e8f0;
    color: #475569;
}

.sort-field-btn.active {
    background: #3b82f6;
    color: white;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.sort-order-btn {
    padding: 0.75rem;
    border: none;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s ease;
    border-left: 1px solid #e2e8f0;
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
    background: #e2e8f0;
    transition: background-color 0.2s ease;
}

.sort-order-btn:hover:not(:disabled):not(.ascending):not(.descending) {
    background: #e2e8f0;
    color: #475569;
}

.sort-order-btn.ascending {
    background: #10b981;
    color: white;
}

.sort-order-btn.ascending:hover {
    background: #059669;
}

.sort-order-btn.ascending::before {
    background: transparent;
}

.sort-order-btn.descending {
    background: #f59e0b;
    color: white;
}

.sort-order-btn.descending:hover {
    background: #d97706;
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
    color: #64748b;
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
    color: #6b7280;
    flex-shrink: 0;
    padding: 0.5rem 0;
    min-width: 100px;
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
    color: #9ca3af;
    padding: 1rem 0;
}

/* 多选按钮样式 */
.multi-select-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    color: #64748b;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
    -webkit-tap-highlight-color: transparent;
}

.multi-select-btn:hover {
    background: #e2e8f0;
    color: #475569;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.multi-select-btn.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
}

.multi-select-btn.active:hover {
    background: #2563eb;
    border-color: #2563eb;
}

/* 批量删除按钮样式 */
.batch-delete-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #ef4444;
    border: 1px solid #dc2626;
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
    background: #dc2626;
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
</style>
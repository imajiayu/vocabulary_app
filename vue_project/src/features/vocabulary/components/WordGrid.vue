<template>
    <div class="section-header">
        <h2 class="section-title">单词列表</h2>

        <div class="right-controls">
            <!-- 排序控件和单词数量 -->
            <div class="sort-controls-group">
                <div class="sort-controls-integrated">
                    <button 
                        class="sort-field-btn" 
                        :class="{ 'active': sortFieldIndex !== -1 }"
                        @click="toggleSortField">
                        <span>{{ sortFieldIndex === -1 ? '默认' : getSortFieldName(sortFields[sortFieldIndex]) }}</span>
                    </button>
                    <button 
                        class="sort-order-btn" 
                        :class="{ 'active': sortOrderIndex !== -1 && sortFieldIndex !== -1 }"
                        :disabled="sortFieldIndex === -1"
                        @click="toggleSortOrder">
                        <ChevronUp v-if="sortOrderIndex === 0" class="sort-icon" />
                        <ChevronDown v-else-if="sortOrderIndex === 1" class="sort-icon" />
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
            <WordCard :word="word" @toggle-review="handleToggleReview" @reset="handleReset"
                @show-detail="$emit('showDetail', $event)" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import WordCard from './WordCard.vue';
import { ChevronUp, ChevronDown } from 'lucide-vue-next';
import type { Word } from '@/shared/types';

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
}>();

const animatingIds = ref(new Set<number>());

const sortOrders = ['asc', 'desc'];

// 循环排序相关的响应式数据
const sortFields = ['word', 'ease_factor', 'date_added'];
const sortFieldIndex = ref(-1); // -1 表示无排序，0/1/2 分别对应 sortFields 数组的索引
const sortOrderIndex = ref(-1); // -1 表示默认（无状态），0 升序，1 降序

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

    // Sort based on the circular buttons' state
    const sortField = sortFields[sortFieldIndex.value];
    if (sortField) {
        let sorted = wordsToSort.sort((a, b) => {
            switch (sortField) {
                case 'word':
                    return a.word.localeCompare(b.word);
                case 'ease_factor':
                    // 修正熟练度排序逻辑：升序应该先展示高熟练度的单词
                    return b.ease_factor - a.ease_factor;
                case 'date_added':
                    return new Date(a.date_added).getTime() - new Date(b.date_added).getTime();
                default:
                    return 0;
            }
        });

        const sortOrder = sortOrders[sortOrderIndex.value];
        if (sortOrder === 'desc') {
            return sorted.reverse();
        }
        return sorted;
    }

    return wordsToSort;
});

const toggleSortField = () => {
    if (sortFieldIndex.value === -1) {
        sortFieldIndex.value = 0; // 从默认到第一个排序字段
        sortOrderIndex.value = 0; // 默认升序
    } else if (sortFieldIndex.value < sortFields.length - 1) {
        sortFieldIndex.value += 1;
        sortOrderIndex.value = 0; // 切换字段时，重置为升序
    } else {
        sortFieldIndex.value = -1; // 循环回默认
        sortOrderIndex.value = -1; // 重置升降序
    }
};

const toggleSortOrder = () => {
    if (sortFieldIndex.value === -1) return; // 没有字段时不可切换

    sortOrderIndex.value = sortOrderIndex.value === 0 ? 1 : 0;
};

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

.sort-order-btn:hover:not(:disabled):not(.active) {
    background: #e2e8f0;
    color: #475569;
}

.sort-order-btn.active {
    background: #1e40af;
    color: white;
}

.sort-order-btn.active::before {
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
.sort-order-btn.active .sort-icon {
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
</style>
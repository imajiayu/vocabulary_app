<template>
  <div class="search-filter-container">
    <!-- 来源筛选 tabs -->
    <SwitchTab
      :model-value="sourceFilter"
      :tabs="sourceTabs"
      container-class="secondary-theme"
      :show-indicator="true"
      @change="handleSourceChange"
    />

    <!-- 搜索框 -->
    <div class="search-box">
      <SearchIcon class="search-icon" />
      <input
        :value="searchQuery"
        @input="$emit('searchChange', ($event.target as HTMLInputElement).value)"
        type="text"
        placeholder="输入单词或中文释义..."
        class="search-input"
      />
      <button v-if="searchQuery.trim()" @click="$emit('searchChange', '')" class="clear-button" type="button">
        ×
      </button>
    </div>
    
    <!-- 筛选按钮 -->
    <SwitchTab
      :model-value="filterStatus"
      :tabs="filterTabs"
      container-class="filter-theme"
      :show-indicator="true"
      @change="handleFilterChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Search as SearchIcon } from 'lucide-vue-next';
import { useWordStats, type Word } from '@/shared/composables/useWordStats';
import SwitchTab from '@/shared/components/ui/SwitchTab.vue';
import type { SourceCounts } from '@/shared/types';

interface Stats {
  total: number;
  remembered: number;
  unremembered: number;
}

interface Props {
  searchQuery: string;
  filterStatus: string;
  stats: Stats;
  sourceFilter: 'all' | 'IELTS' | 'GRE';
  // 新增：原始单词数据，用于计算各来源的统计（保留作为后备）
  allWords?: Array<{ source: string; stop_review?: number; ease_factor: number; }>;
  // 新增：预计算的源计数
  sourceCounts?: SourceCounts | null;
}

const props = defineProps<Props>();

// 将 allWords 转换为 ref 以使用 composable
const wordsRef = computed(() => (props.allWords || []) as Word[]);

// 使用 word stats composable
const { allStats, ieltsStats, greStats } = useWordStats(wordsRef);

const emit = defineEmits<{
  searchChange: [value: string];
  filterChange: [status: string];
  sourceChange: [source: 'all' | 'IELTS' | 'GRE'];
}>();

// 来源选项卡数据
const sourceTabs = computed(() => {
  // 如果有预计算的计数，使用它们
  if (props.sourceCounts?.source_counts) {
    const counts = props.sourceCounts.source_counts;
    return [
      { value: 'all', label: `全部 ${counts.all.total}` },
      { value: 'IELTS', label: `IELTS ${counts.IELTS.total}` },
      { value: 'GRE', label: `GRE ${counts.GRE.total}` }
    ];
  }

  // 后备方案：使用动态计算的结果
  return [
    { value: 'all', label: `全部 ${allStats.value.total}` },
    { value: 'IELTS', label: `IELTS ${ieltsStats.value.total}` },
    { value: 'GRE', label: `GRE ${greStats.value.total}` }
  ];
});

// 筛选选项卡数据
const filterTabs = computed(() => {
  // 如果有预计算的计数，根据当前选择的来源使用相应的计数
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

    return [
      { value: 'all', label: `全部 ${sourceStats.total}` },
      { value: 'unremembered', label: `学习中 ${sourceStats.unremembered}` },
      { value: 'remembered', label: `已掌握 ${sourceStats.remembered}` }
    ];
  }

  // 后备方案：使用动态计算的结果
  return [
    { value: 'all', label: `全部 ${props.stats.total}` },
    { value: 'unremembered', label: `学习中 ${props.stats.unremembered}` },
    { value: 'remembered', label: `已掌握 ${props.stats.remembered}` }
  ];
});

// 处理来源切换
const handleSourceChange = (source: string) => {
  emit('sourceChange', source as 'all' | 'IELTS' | 'GRE');
};

// 处理筛选切换
const handleFilterChange = (status: string) => {
  emit('filterChange', status);
};
</script>

<style scoped>
.search-filter-container {
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
}


.search-box {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  width: 1.25rem;
  height: 1.25rem;
}

.search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.75rem 2.5rem 0.75rem 2.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  height: 100%;
  font-size: 16px; /* 防止移动端自动缩放 */
  -webkit-appearance: none;
  -webkit-tap-highlight-color: transparent;
}

.search-input:focus {
  outline: none;
  box-shadow: 0 0 0 2px #3b82f6;
  border-color: transparent;
}

.clear-button {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 1rem;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1;
  /* 移动端触摸优化 */
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.clear-button:hover {
  background-color: #f3f4f6;
  color: #6b7280;
}

/* 移动端响应式适配 */
@media (max-width: 768px) {
  .search-filter-container {
    padding: 1rem;
    border-radius: 0.5rem;
    gap: 0.875rem;
  }

  .search-box {
    height: 48px;
  }

  .search-input {
    height: 48px;
    padding: 0.875rem 2.5rem;
  }

  .search-icon {
    width: 1.125rem;
    height: 1.125rem;
    left: 0.875rem;
  }

  .clear-button {
    right: 0.25rem;
    width: 2rem;
    height: 2rem;
    min-width: 44px;
    min-height: 44px;
  }
}

/* 小屏手机进一步优化 */
@media (max-width: 480px) {
  .search-filter-container {
    padding: 0.875rem;
    border-radius: 0.375rem;
    gap: 0.75rem;
  }

  .search-box {
    height: 50px;
  }

  .search-input {
    height: 50px;
    padding: 1rem 2.5rem 1rem 2.25rem;
  }

  .search-icon {
    width: 1rem;
    height: 1rem;
    left: 0.75rem;
  }

  .clear-button {
    right: 0.5rem;
    width: 2.25rem;
    height: 2.25rem;
    min-width: 2.25rem;
    min-height: 2.25rem;
  }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .search-filter-container {
    padding: 0.75rem;
    gap: 0.625rem;
  }

  .search-box {
    height: 36px;
  }

  .search-input {
    height: 36px;
    padding: 0.5rem 2rem 0.5rem 2rem;
  }

  .search-icon {
    width: 1rem;
    height: 1rem;
    left: 0.5rem;
  }

  .clear-button {
    right: 0.25rem;
    width: 1.5rem;
    height: 1.5rem;
    min-width: 1.5rem;
    min-height: 1.5rem;
  }
}

</style>
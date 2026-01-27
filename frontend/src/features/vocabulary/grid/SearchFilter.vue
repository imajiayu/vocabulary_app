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
      <div class="input-with-clear">
        <input
          :value="searchQuery"
          @input="$emit('searchChange', ($event.target as HTMLInputElement).value)"
          type="text"
          placeholder="输入单词或中文释义..."
          class="search-input"
        />
        <button
          v-if="searchQuery.trim()"
          @click="$emit('searchChange', '')"
          class="clear-button"
          type="button"
        >
          ×
        </button>
      </div>
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
import { computed, onMounted } from 'vue';
import { useWordStats, type Word } from '@/shared/composables/useWordStats';
import SwitchTab from '@/shared/components/controls/SwitchTab.vue';
import type { SourceCounts } from '@/shared/types';
import { useSourceSelectionReadOnly } from '@/shared/composables/useSourceSelection';

interface Stats {
  total: number;
  remembered: number;
  unremembered: number;
}

interface Props {
  searchQuery: string;
  filterStatus: string;
  stats: Stats;
  sourceFilter: string;  // 改为动态字符串
  // 新增：原始单词数据，用于计算各来源的统计（保留作为后备）
  allWords?: Array<{ source: string; stop_review?: number; ease_factor: number; }>;
  // 新增：预计算的源计数
  sourceCounts?: SourceCounts | null;
}

const props = defineProps<Props>();

// 使用 source selection composable 获取 availableSources
const { availableSources, initializeFromData } = useSourceSelectionReadOnly();

onMounted(async () => {
  await initializeFromData();
});

// 将 allWords 转换为 ref 以使用 composable（仅用于后备方案）
const wordsRef = computed(() => (props.allWords || []) as Word[]);

// 使用 word stats composable（仅用于后备方案）
const { allStats } = useWordStats(wordsRef);

const emit = defineEmits<{
  searchChange: [value: string];
  filterChange: [status: string];
  sourceChange: [source: string];
}>();

// 来源选项卡数据 - 动态生成
const sourceTabs = computed(() => {
  // 如果有预计算的计数，使用它们
  if (props.sourceCounts?.source_counts) {
    const counts = props.sourceCounts.source_counts;
    const tabs = [
      { value: 'all', label: `全部 ${counts.all.total}` }
    ];

    // 使用 availableSources 的顺序来生成 tabs (和 WordInsertForm 一致)
    if (availableSources.value && availableSources.value.length > 0) {
      availableSources.value.forEach(source => {
        if (counts[source]) {
          tabs.push({
            value: source,
            label: `${source} ${counts[source].total}`
          });
        }
      });
    } else {
      // 降级方案：使用 Object.keys (但这不保证顺序)
      Object.keys(counts).forEach(source => {
        if (source !== 'all') {
          tabs.push({
            value: source,
            label: `${source} ${counts[source].total}`
          });
        }
      });
    }

    return tabs;
  }

  // 后备方案：基于 allWords 动态计算每个 source 的数量
  const tabs = [
    { value: 'all', label: `全部 ${allStats.value.total}` }
  ];

  // 使用 availableSources 的顺序
  if (availableSources.value && availableSources.value.length > 0) {
    availableSources.value.forEach(source => {
      // 从 allWords 中计算该 source 的数量
      const count = wordsRef.value.filter(w => w.source === source).length;
      tabs.push({
        value: source,
        label: `${source} ${count}`
      });
    });
  }

  return tabs;
});

// 筛选选项卡数据
const filterTabs = computed(() => {
  // 如果有预计算的计数，根据当前选择的来源使用相应的计数
  if (props.sourceCounts?.source_counts) {
    const counts = props.sourceCounts.source_counts;
    let sourceStats;

    if (props.sourceFilter === 'all') {
      sourceStats = counts.all;
    } else {
      // 动态获取对应 source 的统计
      sourceStats = counts[props.sourceFilter] || counts.all;
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
  emit('sourceChange', source);
};

// 处理筛选切换
const handleFilterChange = (status: string) => {
  emit('filterChange', status);
};
</script>

<style scoped>
.search-filter-container {
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  height: 100%;
}

.search-box {
  flex: 1;
}

.input-with-clear {
  position: relative;
  display: flex;
  align-items: center;
  height: 2.75rem;
}

.search-input {
  flex: 1;
  width: 100%;
  box-sizing: border-box;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  border: 1px solid var(--color-border-medium);
  border-radius: 0.5rem;
  transition: all 0.2s;
  height: 100%;
  font-size: 16px;
  -webkit-appearance: none;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
}

.search-input:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-primary);
  border-color: transparent;
}

.clear-button {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1rem;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.clear-button:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

/* 移动端响应式适配 */
@media (max-width: 480px) {
  .search-filter-container {
    padding: var(--space-4);
    border-radius: var(--radius-md);
    gap: var(--space-3);
  }

  .input-with-clear {
    height: 48px;
  }

  .search-input {
    height: 48px;
    padding: 0.875rem 2.5rem 0.875rem 1rem;
  }

  .clear-button {
    right: 0.25rem;
    width: 2rem;
    height: 2rem;
    min-width: 44px;
    min-height: 44px;
  }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .search-filter-container {
    padding: var(--space-3);
    gap: var(--space-2);
  }

  .input-with-clear {
    height: 36px;
  }

  .search-input {
    height: 36px;
    padding: 0.5rem 2rem 0.5rem 0.75rem;
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
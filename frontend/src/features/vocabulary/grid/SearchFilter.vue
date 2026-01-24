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
      <BaseInput
        :model-value="searchQuery"
        @update:model-value="$emit('searchChange', $event)"
        placeholder="输入单词或中文释义..."
      >
        <template #prefix>
          <BaseIcon name="Search" size="sm" color="muted" />
        </template>
        <template #suffix>
          <button
            v-if="searchQuery.trim()"
            @click="$emit('searchChange', '')"
            class="clear-button"
            type="button"
          >
            <BaseIcon name="X" size="xs" />
          </button>
        </template>
      </BaseInput>
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
import { BaseInput, BaseIcon } from '@/shared/components/base';

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

.clear-button {
  background: none;
  border: none;
  color: var(--color-text-muted);
  padding: var(--space-1);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
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

  .clear-button {
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
}
</style>
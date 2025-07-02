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
  sourceFilter: string;
  allWords?: Array<{ source: string; stop_review?: number; ease_factor: number; }>;
}

const props = defineProps<Props>();

// 使用 source selection composable 获取 availableSources
const { availableSources, initializeFromData } = useSourceSelectionReadOnly();

onMounted(async () => {
  await initializeFromData();
});

const wordsRef = computed(() => (props.allWords || []) as Word[]);
const { allStats } = useWordStats(wordsRef);

const emit = defineEmits<{
  searchChange: [value: string];
  filterChange: [status: string];
  sourceChange: [source: string];
}>();

// 来源选项卡数据 - 基于 allWords 动态计算
const sourceTabs = computed(() => {
  const tabs = [
    { value: 'all', label: `全部 ${allStats.value.total}` }
  ];

  if (availableSources.value && availableSources.value.length > 0) {
    availableSources.value.forEach(source => {
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
const filterTabs = computed(() => [
  { value: 'all', label: `全部 ${props.stats.total}` },
  { value: 'unremembered', label: `学习中 ${props.stats.unremembered}` },
  { value: 'remembered', label: `已掌握 ${props.stats.remembered}` }
]);

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
  background: var(--color-surface-card);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--color-border-light);
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
  border-radius: var(--radius-default);
  transition: all var(--transition-fast);
  height: 100%;
  font-size: 16px;
  background: var(--color-surface-card);
  -webkit-appearance: none;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-brand-primary);
  box-shadow: 0 0 0 3px rgba(153, 107, 61, 0.12);
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
  transition: all var(--transition-fast);
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
@media (max-width: 768px) {
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
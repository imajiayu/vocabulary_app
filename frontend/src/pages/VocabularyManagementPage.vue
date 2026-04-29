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
            <div class="view-toggle-bar">
                <button
                    class="view-toggle-btn"
                    :class="{ active: viewMode === 'grid' }"
                    @click="switchView('grid')">
                    <LayoutGrid class="view-icon" />
                    <span>卡片</span>
                </button>
                <button
                    class="view-toggle-btn"
                    :class="{ active: viewMode === 'table' }"
                    @click="switchView('table')">
                    <TableIcon class="view-icon" />
                    <span>表格</span>
                </button>
            </div>
            <button v-if="viewMode === 'grid'" class="button" @click="handleOpenLoadAdjustment" :disabled="isLoading || hasMoreWords || isLoadingMore">
                负荷调整
            </button>
            <button v-if="viewMode === 'grid'" class="button" @click="handleFixDefinitions" :disabled="isLoading || hasMoreWords || isLoadingMore || defProgress.isActive.value">
                修复释义
            </button>
        </template>

        <!-- Loading State -->
        <Loading v-if="isLoading" text="加载中..." />

        <!-- Main Content -->
        <template v-else>
            <!-- 进度指示器（两种模式共享） -->
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

            <div v-if="defProgress.showFailureSummary.value" class="failure-summary">
                <div class="failure-header">
                    <span class="failure-text">
                        {{ defProgress.failedWords.value.length }} 个单词释义获取失败
                    </span>
                    <button class="failure-dismiss" @click="defProgress.dismiss()">✕</button>
                </div>
                <div class="failure-words">
                    {{ defProgress.failedWords.value.join('、') }}
                </div>
            </div>

            <!-- ===== 卡片模式 ===== -->
            <template v-if="viewMode === 'grid'">
                <div class="top-controls">
                    <div class="control-item">
                        <WordInsertForm @word-inserted="handleWordInserted" @batch-word-inserted="handleBatchWordInserted" />
                    </div>
                    <div class="control-item">
                        <SearchFilter
                            :source="filters.source.value"
                            :search="filters.search.value"
                            :review-status="filters.reviewStatus.value"
                            :spell-status="filters.spellStatus.value"
                            :review-counts="filters.reviewCounts.value"
                            :spell-counts="filters.spellCounts.value"
                            :advanced-filter-count="filters.activeAdvancedFilterCount.value"
                            :advanced-expanded="advancedExpanded"
                            :all-words="words"
                            @update:source="filters.source.value = $event"
                            @update:search="filters.search.value = $event"
                            @update:review-status="filters.reviewStatus.value = $event as any"
                            @update:spell-status="filters.spellStatus.value = $event as any"
                            @toggle-advanced="advancedExpanded = !advancedExpanded" />
                    </div>
                </div>

                <AdvancedFilterPanel
                    :expanded="advancedExpanded"
                    :lapse-only="filters.lapseOnly.value"
                    :overdue-only="filters.overdueOnly.value"
                    :lapse-counts="filters.lapseCounts.value"
                    :overdue-counts="filters.overdueCounts.value"
                    :ease-preset="filters.easePreset.value"
                    :date-added-preset="filters.dateAddedPreset.value"
                    :date-added-custom="filters.dateAddedCustom.value"
                    :last-review-preset="filters.lastReviewPreset.value"
                    :has-active-advanced-filters="filters.activeAdvancedFilterCount.value > 0"
                    @update:lapse-only="filters.lapseOnly.value = $event"
                    @update:overdue-only="filters.overdueOnly.value = $event"
                    @update:ease-preset="filters.easePreset.value = $event"
                    @update:date-added-preset="filters.dateAddedPreset.value = $event"
                    @update:date-added-custom="filters.dateAddedCustom.value = $event"
                    @update:last-review-preset="filters.lastReviewPreset.value = $event"
                    @reset-advanced="filters.resetAdvancedFilters()"
                    @close="advancedExpanded = false" />

                <div class="words-section">
                    <WordGrid
                        ref="wordGridRef"
                        :words="words"
                        :filtered-words="filters.filteredWords.value"
                        :search-query="filters.search.value"
                        @show-detail="handleShowDetail"
                        @batch-delete="handleBatchDelete" />
                </div>
            </template>

            <!-- ===== 表格模式 ===== -->
            <template v-else>
                <ConditionFilterBar
                    :conditions="tableFilters.conditions.value"
                    v-model:logic-mode="tableFilters.logicMode.value"
                    :filtered-count="tableFilters.filteredWords.value.length"
                    :total-count="words.length"
                    @add-condition="tableFilters.addCondition()"
                    @remove-condition="tableFilters.removeCondition($event)"
                    @update-condition="tableFilters.updateCondition($event.id, $event.partial)"
                    @clear-all="tableFilters.clearAll()" />

                <WordTable
                    ref="wordTableRef"
                    :filtered-words="tableFilters.filteredWords.value"
                    :all-words="words"
                    :all-words-loaded="!hasMoreWords"
                    :available-sources="availableSources"
                    @saved="handleTableRowSaved"
                    @word-added="handleTableWordAdded"
                    @batch-delete="handleBatchDelete"
                    @dirty-change="tableDirtyCount = $event" />
            </template>

            <!-- 详情弹窗 - 使用 store 管理状态 -->
            <WordEditorModal />

            <!-- 负荷调整弹窗 -->
            <LoadAdjustmentModal ref="loadAdjustmentRef" />
        </template>
    </PageLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useBreakpoint } from '@/shared/composables/useBreakpoint';
import WordInsertForm from '@/features/vocabulary/editor/WordInsertForm.vue';
import SearchFilter from '@/features/vocabulary/grid/SearchFilter.vue';
import AdvancedFilterPanel from '@/features/vocabulary/grid/AdvancedFilterPanel.vue';
import ConditionFilterBar from '@/features/vocabulary/grid/ConditionFilterBar.vue';
import WordGrid from '@/features/vocabulary/grid/WordGrid.vue';
import WordTable from '@/features/vocabulary/grid/WordTable.vue';
import { LayoutGrid, Table as TableIcon } from 'lucide-vue-next';
import WordEditorModal from '@/features/vocabulary/editor/WordEditorModal.vue';
import LoadAdjustmentModal from '@/features/vocabulary/editor/LoadAdjustmentModal.vue';
import Loading from '@/shared/components/feedback/Loading.vue'
import PageLayout from '@/shared/components/layout/PageLayout.vue';
import type { Word, SourceLang } from '@/shared/types';
import { normalizeWordText } from '@/shared/config/sourceLanguage';
import { useSourceSelectionReadOnly } from '@/shared/composables/useSourceSelection';
import { useWordFilters } from '@/features/vocabulary/grid/useWordFilters';
import { useConditionFilters } from '@/features/vocabulary/grid/useConditionFilters';
import { api } from '@/shared/api';
import { useSettings } from '@/shared/composables/useSettings';
import { useWordEditorStore } from '@/features/vocabulary/stores/wordEditor';
import { logger } from '@/shared/utils/logger';
import { concurrentMap } from '@/shared/utils/concurrent';
import { useDefinitionProgress } from '@/features/vocabulary/editor/composables';
import { getCurrentUserId } from '@/shared/composables/useAuth';
import * as wordsCache from '@/features/vocabulary/cache/wordsCache';

const words = ref<Word[]>([]);
const defProgress = useDefinitionProgress();
const filters = useWordFilters(words);
const tableFilters = useConditionFilters(words);
const advancedExpanded = ref(false);

// O(1) word lookup by id — rebuilt lazily when words array changes
let _wordIndexMap: Map<number, number> | null = null
let _wordIndexVersion = 0
function getWordIndex(wordId: number): number {
  const currentVersion = words.value.length
  if (!_wordIndexMap || _wordIndexVersion !== currentVersion) {
    _wordIndexMap = new Map()
    words.value.forEach((w, i) => _wordIndexMap!.set(w.id, i))
    _wordIndexVersion = currentVersion
  }
  return _wordIndexMap.get(wordId) ?? -1
}
function invalidateWordIndex() { _wordIndexMap = null }

// Word Editor Store
const wordEditorStore = useWordEditorStore();
const isLoading = ref(true);
const wordGridRef = ref<InstanceType<typeof WordGrid>>();
const wordTableRef = ref<InstanceType<typeof WordTable>>();
const loadAdjustmentRef = ref<InstanceType<typeof LoadAdjustmentModal>>();

// 视图模式：卡片网格 vs Excel 表格编辑
const viewMode = ref<'grid' | 'table'>('grid');
const tableDirtyCount = ref(0);

const switchView = (mode: 'grid' | 'table') => {
    if (mode === viewMode.value) return;
    if (viewMode.value === 'table' && tableDirtyCount.value > 0) {
        if (!confirm(`表格中有 ${tableDirtyCount.value} 项未保存的变更，切换视图将丢弃，是否继续？`)) {
            return;
        }
    }
    viewMode.value = mode;
};

// 表格视图保存某一行后，同步回 words 数组
const handleTableRowSaved = (updatedWord: Word) => {
    const index = getWordIndex(updatedWord.id);
    if (index !== -1) {
        words.value[index] = updatedWord;
    }
    syncCacheUpsert(updatedWord);
};

// 表格视图新增单词
const handleTableWordAdded = async (word: Word) => {
    words.value.unshift(word);
    invalidateWordIndex();
    syncCacheUpsert(word);

    defProgress.start(1, '获取释义');
    try {
        const updatedWord = await api.words.fetchDefinition(word.id);
        defProgress.increment();
        const index = getWordIndex(word.id);
        if (index !== -1) {
            words.value[index] = updatedWord;
        }
        wordTableRef.value?.syncWord(updatedWord);
        syncCacheUpsert(updatedWord);
    } catch (error) {
        defProgress.incrementFailed(word.word);
        logger.error('Failed to fetch definition for new word:', error);
    } finally {
        defProgress.finish();
    }
};

// 使用全局设置管理
const { settings, loadSettings } = useSettings();

// 分批加载相关状态
const batchSize = ref(200);
const totalWords = ref(0);
const loadedWords = ref(0);
const isLoadingMore = ref(false);
const hasMoreWords = ref(true);
const shouldStopLoading = ref(false);

// Use read-only composable to get WordIndex selection
const { currentSource, availableSources: sourcesFromSelection, initializeFromData } = useSourceSelectionReadOnly();

const availableSources = computed(() => {
    const fromSelection = sourcesFromSelection.value ?? []
    if (fromSelection.length > 0) return fromSelection
    const sources = new Set(words.value.map(w => w.source).filter(Boolean))
    return [...sources]
})

// 分批加载单词的函数
const loadWordsBatch = async (offset: number = 0): Promise<boolean> => {
    try {
        isLoadingMore.value = offset > 0;

        const response = await api.words.getWordsPaginatedDirect(batchSize.value, offset);

        if (offset === 0) {
            words.value = response.words;
            totalWords.value = response.total;
        } else {
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

// 并行加载所有剩余批次
const loadRemainingBatches = async () => {
    if (!hasMoreWords.value || shouldStopLoading.value) return;
    isLoadingMore.value = true;

    try {
        const offsets: number[] = [];
        for (let offset = batchSize.value; offset < totalWords.value; offset += batchSize.value) {
            offsets.push(offset);
        }

        if (offsets.length === 0) {
            hasMoreWords.value = false;
            return;
        }

        const slots: (Word[] | null)[] = new Array(offsets.length).fill(null);
        let drainIndex = 0;

        const drainReady = () => {
            while (drainIndex < slots.length && slots[drainIndex] !== null) {
                words.value.push(...slots[drainIndex]!);
                slots[drainIndex] = null;
                drainIndex++;
                loadedWords.value = words.value.length;
            }
        };

        await concurrentMap(
            offsets,
            async (offset) => {
                if (shouldStopLoading.value) return;
                const response = await api.words.getWordsPaginatedDirect(batchSize.value, offset);
                const slotIndex = (offset - batchSize.value) / batchSize.value;
                slots[slotIndex] = response.words;
                drainReady();
            },
            4,
            { retries: 2, retryDelay: 500 },
        );

        drainReady();
        hasMoreWords.value = false;
    } catch (error) {
        logger.error('Failed to load remaining batches:', error);
    } finally {
        isLoadingMore.value = false;
    }
};

// 桌面端隐藏页面滚动条
const { isDesktop } = useBreakpoint()

// 缓存同步辅助：getCurrentUserId 在未登录时抛错，统一兜底
const safeUserId = (): string | null => {
    try { return getCurrentUserId() } catch { return null }
}

// reconcile 期间收集用户的本地变更，fullReload 落地前回放，避免远端快照覆盖 in-flight mutation
type DirtyOp = { kind: 'upsert', word: Word } | { kind: 'delete' }
let pendingDirty: Map<number, DirtyOp> | null = null

const syncCacheUpsert = (...updated: Word[]) => {
    const uid = safeUserId(); if (uid) wordsCache.upsertWords(uid, updated)
    if (pendingDirty) {
        for (const w of updated) pendingDirty.set(w.id, { kind: 'upsert', word: w })
    }
}
const syncCacheDelete = (...ids: number[]) => {
    const uid = safeUserId(); if (uid) wordsCache.deleteWords(uid, ids)
    if (pendingDirty) {
        for (const id of ids) pendingDirty.set(id, { kind: 'delete' })
    }
}

// 把 reconcile 期间累积的本地变更应用到一份远端快照上
const applyPendingDirty = (snapshot: Word[]): Word[] => {
    if (!pendingDirty || pendingDirty.size === 0) return snapshot
    const result: Word[] = [];
    const seen = new Set<number>();
    for (const w of snapshot) {
        const op = pendingDirty.get(w.id);
        if (op?.kind === 'delete') continue;       // 用户已删除
        if (op?.kind === 'upsert') {
            result.push(op.word);                  // 用户最新版本
        } else {
            result.push(w);
        }
        seen.add(w.id);
    }
    // 用户在 reconcile 期间新增、但远端快照里还没有的词
    for (const [id, op] of pendingDirty) {
        if (op.kind !== 'upsert' || seen.has(id)) continue;
        result.push(op.word);
    }
    return result;
};

// 服务端 ORDER BY word 用 PG default collation；前端用 locale-aware Collator 与之对齐
// （JS 默认 < 比较按 UTF-16 code unit，对 Cyrillic / 带变音字符与 PG 行为不一致）
const wordCollator = new Intl.Collator(undefined, { sensitivity: 'variant' })

// 后台校验本地缓存指纹，按差异选择"什么都不做 / 增量 / 全量重拉"
// 全程在 await 边界检查 shouldStopLoading：用户离开页面后立即放弃，不写缓存
const reconcileWithRemote = async (userId: string, localFp: wordsCache.WordsFingerprint) => {
    pendingDirty = new Map();
    try {
        const remote = await api.words.getWordsFingerprintDirect();
        if (shouldStopLoading.value) return;
        if (wordsCache.fingerprintEqual(localFp, remote)) return;

        // 全量重拉：先在本地数组里收集完，再 swap，避免 UI 闪烁
        const fullReload = async () => {
            const firstResp = await api.words.getWordsPaginatedDirect(batchSize.value, 0);
            if (shouldStopLoading.value) return;
            const collected: Word[] = [...firstResp.words];

            if (firstResp.has_more) {
                const offsets: number[] = [];
                for (let offset = batchSize.value; offset < firstResp.total; offset += batchSize.value) {
                    offsets.push(offset);
                }
                const slots: (Word[] | null)[] = new Array(offsets.length).fill(null);
                await concurrentMap(
                    offsets,
                    async (offset) => {
                        if (shouldStopLoading.value) return;
                        const r = await api.words.getWordsPaginatedDirect(batchSize.value, offset);
                        slots[(offset - batchSize.value) / batchSize.value] = r.words;
                    },
                    4,
                    { retries: 2, retryDelay: 500 },
                );
                if (shouldStopLoading.value) return;
                for (const s of slots) if (s) collected.push(...s);
            }

            // 应用 reconcile 启动至此用户已发生的本地变更，避免远端快照吞掉 in-flight mutation
            const merged = applyPendingDirty(collected);

            words.value = merged;
            totalWords.value = merged.length;
            loadedWords.value = merged.length;
            hasMoreWords.value = false;
            invalidateWordIndex();
            wordsCache.save(userId, words.value);
        };

        // count 一致 + remote 有新增/更新 → 尝试增量同步
        // 注意：count 净相等不等价于"只有更新无删除"（远端可能同时发生 N 个删除 + N 个新增），
        // 因此增量同步后再算一次本地 fingerprint 与 remote 比对，不一致就降级到全量重拉
        if (
            localFp.count === remote.count &&
            remote.maxUpdatedAt &&
            localFp.maxUpdatedAt &&
            remote.maxUpdatedAt > localFp.maxUpdatedAt
        ) {
            // localFp.maxUpdatedAt 在此分支必非空：count 相等 && remote.maxUpdatedAt 非空 → count > 0
            // → 本地至少有一条 word，updated_at NOT NULL → localFp.maxUpdatedAt 非空
            const sinceWords = await api.words.getWordsSinceDirect(localFp.maxUpdatedAt);
            if (shouldStopLoading.value) return;
            if (sinceWords.length === 0) {
                // count 相同但 maxUpdatedAt 不一致却拉不到 since 之后的更新 → 异常，全量兜底
                return fullReload();
            }

            const indexMap = new Map<number, number>();
            words.value.forEach((w, i) => indexMap.set(w.id, i));
            let inserted = false;
            for (const w of sinceWords) {
                // 用户已经在本地把这条删/改了，远端旧版本不能覆盖
                const dirty = pendingDirty?.get(w.id);
                if (dirty?.kind === 'delete') continue;
                if (dirty?.kind === 'upsert') continue;

                const idx = indexMap.get(w.id);
                if (idx !== undefined) {
                    words.value[idx] = w;
                } else {
                    words.value.push(w);
                    inserted = true;
                }
            }
            // 与服务端 ORDER BY word 对齐（locale-aware Collator，处理 Cyrillic / diacritic）
            if (inserted) {
                words.value.sort((a, b) => wordCollator.compare(a.word, b.word));
                totalWords.value = words.value.length;
                loadedWords.value = words.value.length;
            }
            invalidateWordIndex();

            // 校验：增量后的本地 fingerprint 必须与 remote 一致；否则说明发生了 "删+加" 之类的扭曲
            // 期间产生的 pendingDirty 也会让 fingerprint 不一致 → 降级 fullReload，由 fullReload 内的 applyPendingDirty 兜回
            const postFp = wordsCache.computeFingerprint(words.value);
            if (!wordsCache.fingerprintEqual(postFp, remote)) {
                return fullReload();
            }
            wordsCache.save(userId, words.value);
            return;
        }

        return fullReload();
    } finally {
        pendingDirty = null;
    }
};

onMounted(async () => {
    if (isDesktop.value) document.documentElement.classList.add('hide-scrollbar')
    try {
        await initializeFromData();

        if (currentSource.value) {
            filters.source.value = currentSource.value;
        }

        try {
            const settings = await loadSettings();
            batchSize.value = settings.management.wordsLoadBatchSize;
        } catch (error) {
            logger.error('Failed to load wordsLoadBatchSize from settings, using default 200:', error);
        }

        const userId = safeUserId();
        const cached = userId ? wordsCache.load(userId) : null;

        if (userId && cached && cached.words.length > 0) {
            // 缓存命中：立即渲染，后台校验
            words.value = cached.words;
            totalWords.value = cached.fingerprint.count;
            loadedWords.value = cached.fingerprint.count;
            hasMoreWords.value = false;
            invalidateWordIndex();
            isLoading.value = false;

            reconcileWithRemote(userId, cached.fingerprint).catch(error => {
                logger.error('Failed to reconcile words cache:', error);
            });
            return;
        }

        // 缓存未命中：渐进式全量加载（第一批后即可交互，剩余在后台拉完写缓存）
        await loadWordsBatch(0);

        if (hasMoreWords.value) {
            loadRemainingBatches()
                .then(() => {
                    // 仅在真正跑完时落盘，避免 onUnmounted 触发的中途停止把残缺快照写入缓存
                    if (userId && !shouldStopLoading.value && !hasMoreWords.value) {
                        wordsCache.save(userId, words.value);
                    }
                })
                .catch(error => logger.error('Failed to save words cache after background load:', error));
        } else if (userId) {
            wordsCache.save(userId, words.value);
        }
    } catch (error) {
        logger.error('Failed to load initial words batch:', error);
    } finally {
        isLoading.value = false;
    }
});

// 打开负荷调整
const handleOpenLoadAdjustment = () => {
    loadAdjustmentRef.value?.open(filters.source.value)
}

// 显示详情 - 使用 store.open() 打开模态框
const handleShowDetail = (word: Word) => {
    wordEditorStore.open(word);

    const customSources = settings.value?.sources?.customSources as Record<string, SourceLang> | undefined
    const lang: SourceLang = customSources?.[word.source || ''] ?? 'en'
    wordEditorStore.setDuplicateChecker(async (wordText, excludeId) => {
        const normalized = normalizeWordText(wordText, lang)
        if (!hasMoreWords.value) {
            return words.value.some(w =>
                w.id !== excludeId && w.word.normalize('NFC').toLowerCase() === normalized
            )
        }
        return api.words.checkWordExistsDirect(wordText, excludeId, lang)
    });

    wordEditorStore.onClose((finalWord: Word | undefined) => {
        if (finalWord) {
            const index = getWordIndex(finalWord.id);
            if (index !== -1) {
                words.value[index] = finalWord;
            }
            syncCacheUpsert(finalWord);
        }
    });

    wordEditorStore.onWordDeleted((wordId: number) => {
        const index = getWordIndex(wordId);
        if (index !== -1) {
            words.value.splice(index, 1);
            invalidateWordIndex();
        }
        syncCacheDelete(wordId);
    });

    wordEditorStore.onWordUpdated((updatedWord: Word) => {
        const index = getWordIndex(updatedWord.id);
        if (index !== -1) {
            words.value[index] = updatedWord;
        }
        wordTableRef.value?.syncWord(updatedWord);
        syncCacheUpsert(updatedWord);
    });
};

const handleWordInserted = async (word: Word) => {
    words.value.unshift(word);
    wordGridRef.value?.addNewWordId(word.id);

    invalidateWordIndex();
    syncCacheUpsert(word);

    defProgress.start(1, '获取释义');
    try {
        const updatedWord = await api.words.fetchDefinition(word.id);
        defProgress.increment();
        const index = getWordIndex(word.id);
        if (index !== -1) {
            words.value[index] = updatedWord;
        }
        if (wordEditorStore.isOpen && wordEditorStore.currentWord?.id === word.id) {
            wordEditorStore.updateCurrentWord(updatedWord);
        }
        syncCacheUpsert(updatedWord);
    } catch (error) {
        defProgress.incrementFailed(word.word);
        logger.error('Failed to fetch definition for new word:', error);
    } finally {
        defProgress.finish();
    }
};

const handleBatchWordInserted = async (insertedWords: Word[]) => {
    insertedWords.forEach(word => {
        words.value.unshift(word);
        wordGridRef.value?.addNewWordId(word.id);
    });

    invalidateWordIndex();
    if (insertedWords.length === 0) return;
    syncCacheUpsert(...insertedWords);

    let threads = 3;
    try {
        const settings = await loadSettings();
        threads = settings.management.definitionFetchThreads;
    } catch {
        // 使用默认值
    }

    const fetched: Word[] = [];
    defProgress.start(insertedWords.length, '获取释义');
    await concurrentMap(insertedWords, async (word) => {
        try {
            const updatedWord = await api.words.fetchDefinition(word.id);
            defProgress.increment();
            const index = getWordIndex(word.id);
            if (index !== -1) {
                words.value[index] = updatedWord;
            }
            if (wordEditorStore.isOpen && wordEditorStore.currentWord?.id === word.id) {
                wordEditorStore.updateCurrentWord(updatedWord);
            }
            fetched.push(updatedWord);
            return updatedWord;
        } catch {
            defProgress.incrementFailed(word.word);
        }
    }, threads);
    if (fetched.length > 0) syncCacheUpsert(...fetched);
    defProgress.finish();
};

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

    const fetched: Word[] = [];
    defProgress.start(emptyWords.length, '修复释义');
    await concurrentMap(emptyWords, async (word) => {
        try {
            const updatedWord = await api.words.fetchDefinition(word.id);
            defProgress.increment();
            const index = getWordIndex(word.id);
            if (index !== -1) {
                words.value[index] = updatedWord;
            }
            if (wordEditorStore.isOpen && wordEditorStore.currentWord?.id === word.id) {
                wordEditorStore.updateCurrentWord(updatedWord);
            }
            fetched.push(updatedWord);
            return updatedWord;
        } catch {
            defProgress.incrementFailed(word.word);
        }
    }, threads);
    if (fetched.length > 0) syncCacheUpsert(...fetched);
    defProgress.finish();
};

const handleBatchDelete = (wordIds: number[]) => {
    words.value = words.value.filter(w => !wordIds.includes(w.id));
    invalidateWordIndex();
    syncCacheDelete(...wordIds);
};

onUnmounted(() => {
    document.documentElement.classList.remove('hide-scrollbar')
    shouldStopLoading.value = true;
})
</script>

<style scoped>
.top-controls {
    display: flex;
    align-items: stretch;
    gap: var(--space-4);
    margin-bottom: 0;
}

.control-item {
    flex: 1;
    display: flex;
}

.control-item > * {
    flex: 1;
}

.words-section {
    background: var(--color-surface-card);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    border: 1px solid var(--color-border-light);
    padding: var(--space-6);
}

/* 视图切换（现在在 topbar 内） */
.view-toggle-bar {
    display: inline-flex;
    align-items: center;
    gap: 0;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-medium);
    border-radius: var(--radius-sm);
    padding: 2px;
}
.view-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    background: transparent;
    border: none;
    border-radius: var(--radius-xs);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    font-family: var(--font-ui);
    cursor: pointer;
    transition: var(--transition-fast);
}
.view-toggle-btn:hover {
    color: var(--color-text-primary);
}
.view-toggle-btn.active {
    background: var(--color-surface-card);
    color: var(--color-brand-primary);
    box-shadow: var(--shadow-sm);
}
.view-icon {
    width: 14px;
    height: 14px;
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

/* 释义获取失败摘要 */
.failure-summary {
    padding: var(--space-4);
    padding-bottom: var(--space-6);
    border-bottom: 1px solid var(--color-border-light);
}

.failure-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2);
}

.failure-text {
    font-family: var(--font-ui);
    font-size: var(--font-size-sm);
    color: var(--color-danger);
    font-weight: var(--font-weight-medium);
}

.failure-dismiss {
    background: none;
    border: none;
    color: var(--color-text-tertiary);
    cursor: pointer;
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-sm);
    border-radius: var(--radius-xs);
    line-height: 1;
}

.failure-dismiss:hover {
    color: var(--color-text-primary);
    background: var(--color-surface-hover);
}

.failure-words {
    font-family: var(--font-serif);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    line-height: 1.6;
    word-break: break-word;
}

/* 移动端适配 */
@media (max-width: 768px) {
    .top-controls {
        flex-direction: column;
        align-items: stretch;
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

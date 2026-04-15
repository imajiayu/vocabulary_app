<template>
    <div class="word-table-wrapper">
        <div class="table-toolbar">
            <div class="toolbar-left">
                <span class="word-count">共 {{ filteredWords.length }} 个</span>
                <span v-if="dirtyIds.length > 0" class="dirty-badge">
                    {{ dirtyIds.length }} 项待保存
                </span>
                <span v-if="failedIds.size > 0" class="failed-badge">
                    {{ failedIds.size }} 项失败
                </span>
            </div>
            <div class="toolbar-right">
                <button
                    class="reset-btn"
                    :disabled="dirtyIds.length === 0 || saving"
                    @click="resetAll">
                    撤销全部
                </button>
                <button
                    class="save-btn"
                    :disabled="dirtyIds.length === 0 || saving"
                    @click="saveAll">
                    <Loader2 v-if="saving" class="btn-icon spin" />
                    <Save v-else class="btn-icon" />
                    <span>{{ saving ? '保存中…' : `保存 ${dirtyIds.length} 项` }}</span>
                </button>
            </div>
        </div>

        <div class="table-scroll">
            <table class="word-table">
                <thead>
                    <tr>
                        <th class="col-word sticky-col">单词</th>
                        <th class="col-phonetic">音标 (US)</th>
                        <th class="col-phonetic">音标 (UK)</th>
                        <th class="col-defs">
                            释义
                            <span class="th-hint">每条之间用空行分隔</span>
                        </th>
                        <th class="col-examples">
                            例句
                            <span class="th-hint">英 / 中 各占一行，组间用空行分隔</span>
                        </th>
                        <th class="col-flag">停止复习</th>
                        <th class="col-flag">停止拼写</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="word in visibleWords"
                        :key="word.id"
                        :class="rowClass(word.id)">
                        <td class="col-word sticky-col">
                            <input
                                v-model="getDraft(word).word"
                                type="text"
                                class="cell-input"
                                :class="{ 'cell-dirty': isCellDirty(word.id, 'word') }"
                                :readonly="savingIds.has(word.id)" />
                        </td>
                        <td class="col-phonetic">
                            <input
                                v-model="getDraft(word).phoneticUs"
                                type="text"
                                class="cell-input mono"
                                :class="{ 'cell-dirty': isCellDirty(word.id, 'phoneticUs') }"
                                :readonly="savingIds.has(word.id)" />
                        </td>
                        <td class="col-phonetic">
                            <input
                                v-model="getDraft(word).phoneticUk"
                                type="text"
                                class="cell-input mono"
                                :class="{ 'cell-dirty': isCellDirty(word.id, 'phoneticUk') }"
                                :readonly="savingIds.has(word.id)" />
                        </td>
                        <td class="col-defs">
                            <button
                                type="button"
                                class="cell-preview"
                                :class="{ 'cell-dirty': isCellDirty(word.id, 'definitionsText') }"
                                :disabled="savingIds.has(word.id)"
                                @click="openCellEditor(word, 'definitionsText')">
                                <span v-if="getDraft(word).definitionsText" class="preview-text">{{ getDraft(word).definitionsText }}</span>
                                <span v-else class="preview-empty">点击编辑</span>
                            </button>
                        </td>
                        <td class="col-examples">
                            <button
                                type="button"
                                class="cell-preview"
                                :class="{ 'cell-dirty': isCellDirty(word.id, 'examplesText') }"
                                :disabled="savingIds.has(word.id)"
                                @click="openCellEditor(word, 'examplesText')">
                                <span v-if="getDraft(word).examplesText" class="preview-text">{{ getDraft(word).examplesText }}</span>
                                <span v-else class="preview-empty">点击编辑</span>
                            </button>
                        </td>
                        <td class="col-flag">
                            <label
                                class="cell-checkbox-wrapper"
                                :class="{ 'cell-dirty': isCellDirty(word.id, 'stop_review') }">
                                <input
                                    type="checkbox"
                                    class="cell-checkbox"
                                    :checked="getDraft(word).stop_review === 1"
                                    :disabled="savingIds.has(word.id)"
                                    @change="setFlag(word.id, 'stop_review', ($event.target as HTMLInputElement).checked)" />
                            </label>
                        </td>
                        <td class="col-flag">
                            <label
                                class="cell-checkbox-wrapper"
                                :class="{ 'cell-dirty': isCellDirty(word.id, 'stop_spell') }">
                                <input
                                    type="checkbox"
                                    class="cell-checkbox"
                                    :checked="getDraft(word).stop_spell === 1"
                                    :disabled="savingIds.has(word.id)"
                                    @change="setFlag(word.id, 'stop_spell', ($event.target as HTMLInputElement).checked)" />
                            </label>
                        </td>
                    </tr>
                </tbody>
            </table>
            <div ref="sentinelRef" class="load-sentinel"></div>
        </div>

        <!-- 单元格编辑弹窗 -->
        <div v-if="editingCell" class="cell-modal-backdrop" @mousedown.self="closeCellEditor">
            <div class="cell-modal">
                <div class="cell-modal-header">
                    <div class="cell-modal-title">
                        <span class="cell-modal-field">{{ CELL_EDITOR_META[editingCell.field].label }}</span>
                        <span class="cell-modal-word">{{ editingCell.wordText }}</span>
                    </div>
                    <button type="button" class="cell-modal-close" @click="closeCellEditor">✕</button>
                </div>
                <textarea
                    ref="modalTextareaRef"
                    v-model="editingCellValue"
                    class="cell-modal-textarea"
                    rows="14"
                    @keydown.esc="closeCellEditor"
                    @keydown.meta.enter="commitCellEditor"
                    @keydown.ctrl.enter="commitCellEditor" />
                <div class="cell-modal-footer">
                    <span class="cell-modal-hint">{{ CELL_EDITOR_META[editingCell.field].hint }}</span>
                    <div class="cell-modal-actions">
                        <button type="button" class="reset-btn" @click="closeCellEditor">取消</button>
                        <button type="button" class="save-btn" @click="commitCellEditor">确定</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { Save, Loader2 } from 'lucide-vue-next';
import type { Word, DefinitionObject } from '@/shared/types';
import type { UpdateWordPayload } from '@/shared/api/words';
import { applyBoldToDefinition, stripBoldFromDefinition } from '@/shared/utils/definition';
import { api } from '@/shared/api';
import { concurrentMap } from '@/shared/utils/concurrent';
import { logger } from '@/shared/utils/logger';

const log = logger.create('WordTable');

interface Props {
    filteredWords: Word[];
    searchQuery?: string;
}
const props = defineProps<Props>();

const emit = defineEmits<{
    saved: [word: Word];
    dirtyChange: [count: number];
}>();

interface RowDraft {
    word: string;
    phoneticUs: string;
    phoneticUk: string;
    definitionsText: string;
    examplesText: string;
    stop_review: number;
    stop_spell: number;
}

function serializeDefinitions(arr: string[] | undefined): string {
    return (arr ?? []).join('\n\n');
}

function parseDefinitions(text: string): string[] {
    return text.split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean);
}

function serializeExamples(examples: { en: string; zh: string }[] | undefined): string {
    if (!examples?.length) return '';
    return examples
        .map(e => {
            const en = (e.en ?? '').trim();
            const zh = (e.zh ?? '').trim();
            return zh ? `${en}\n${zh}` : en;
        })
        .join('\n\n');
}

function parseExamples(text: string): { en: string; zh: string }[] {
    return text
        .split(/\n\s*\n+/)
        .map(group => group.replace(/\s+$/, ''))
        .filter(Boolean)
        .map(group => {
            const lines = group.split('\n');
            const en = (lines[0] ?? '').trim();
            const zh = lines.slice(1).join('\n').trim();
            return { en, zh };
        })
        .filter(p => p.en || p.zh);
}

function wordToDraft(word: Word): RowDraft {
    const def = word.definition || ({} as DefinitionObject);
    const stripped = stripBoldFromDefinition(def);
    return {
        word: word.word,
        phoneticUs: stripped.phonetic?.us ?? '',
        phoneticUk: stripped.phonetic?.uk ?? '',
        definitionsText: serializeDefinitions(stripped.definitions),
        examplesText: serializeExamples(stripped.examples),
        stop_review: word.stop_review ?? 0,
        stop_spell: word.stop_spell ?? 0,
    };
}

const draftsMap = new Map<number, RowDraft>();
const originalsMap = new Map<number, RowDraft>();
const draftsVersion = ref(0);

function getDraft(word: Word): RowDraft {
    let d = draftsMap.get(word.id);
    if (!d) {
        const init = wordToDraft(word);
        d = reactive({ ...init }) as RowDraft;
        draftsMap.set(word.id, d);
        originalsMap.set(word.id, { ...init });
        draftsVersion.value++;
    }
    return d;
}

function refreshDraftFromWord(word: Word): void {
    const init = wordToDraft(word);
    const existing = draftsMap.get(word.id);
    if (existing) Object.assign(existing, init);
    else draftsMap.set(word.id, reactive({ ...init }) as RowDraft);
    originalsMap.set(word.id, { ...init });
    draftsVersion.value++;
}

function isCellDirty(id: number, field: keyof RowDraft): boolean {
    void draftsVersion.value;
    const d = draftsMap.get(id);
    const o = originalsMap.get(id);
    if (!d || !o) return false;
    return d[field] !== o[field];
}

function isDirty(id: number): boolean {
    const d = draftsMap.get(id);
    const o = originalsMap.get(id);
    if (!d || !o) return false;
    return (
        d.word !== o.word ||
        d.phoneticUs !== o.phoneticUs ||
        d.phoneticUk !== o.phoneticUk ||
        d.definitionsText !== o.definitionsText ||
        d.examplesText !== o.examplesText ||
        d.stop_review !== o.stop_review ||
        d.stop_spell !== o.stop_spell
    );
}

const dirtyIds = computed<number[]>(() => {
    void draftsVersion.value;
    const ids: number[] = [];
    for (const id of draftsMap.keys()) {
        if (isDirty(id)) ids.push(id);
    }
    return ids;
});

watch(dirtyIds, ids => emit('dirtyChange', ids.length), { immediate: true });

function setFlag(id: number, key: 'stop_review' | 'stop_spell', checked: boolean): void {
    const d = draftsMap.get(id);
    if (d) d[key] = checked ? 1 : 0;
}

function buildPatch(id: number): Partial<UpdateWordPayload> {
    const d = draftsMap.get(id)!;
    const o = originalsMap.get(id)!;
    const patch: Partial<UpdateWordPayload> = {};
    if (d.word !== o.word) patch.word = d.word.trim();
    if (d.stop_review !== o.stop_review) patch.stop_review = d.stop_review;
    if (d.stop_spell !== o.stop_spell) patch.stop_spell = d.stop_spell;

    const defChanged =
        d.phoneticUs !== o.phoneticUs ||
        d.phoneticUk !== o.phoneticUk ||
        d.definitionsText !== o.definitionsText ||
        d.examplesText !== o.examplesText;

    if (defChanged) {
        const wordText = (patch.word ?? d.word).trim();
        const phonetic: DefinitionObject['phonetic'] = {};
        const us = d.phoneticUs.trim();
        const uk = d.phoneticUk.trim();
        if (us) phonetic.us = us;
        if (uk) phonetic.uk = uk;

        const definition: DefinitionObject = {
            phonetic: us || uk ? phonetic : undefined,
            definitions: parseDefinitions(d.definitionsText),
            examples: parseExamples(d.examplesText),
        };
        patch.definition = applyBoldToDefinition(definition, wordText);
    }
    return patch;
}

const saving = ref(false);
const savingIds = reactive(new Set<number>());
const failedIds = reactive(new Set<number>());

async function saveAll(): Promise<void> {
    if (dirtyIds.value.length === 0 || saving.value) return;
    const ids = [...dirtyIds.value];
    saving.value = true;
    failedIds.clear();

    const items = ids.map(id => ({ id, patch: buildPatch(id) }));

    await concurrentMap(
        items,
        async ({ id, patch }) => {
            savingIds.add(id);
            try {
                const updated = await api.words.updateWordDirect(id, patch);
                refreshDraftFromWord(updated);
                emit('saved', updated);
                return updated;
            } catch (err) {
                failedIds.add(id);
                log.error(`保存单词 ${id} 失败:`, err);
                throw err;
            } finally {
                savingIds.delete(id);
            }
        },
        4,
        { retries: 1 },
    );

    saving.value = false;
    if (failedIds.size > 0) {
        alert(`${failedIds.size} 个单词保存失败，已保留在表格中以便重试。`);
    }
}

function resetAll(): void {
    if (dirtyIds.value.length === 0) return;
    if (!confirm(`确定撤销 ${dirtyIds.value.length} 项变更？`)) return;
    for (const id of dirtyIds.value) {
        const d = draftsMap.get(id);
        const o = originalsMap.get(id);
        if (d && o) Object.assign(d, o);
    }
    failedIds.clear();
    draftsVersion.value++;
}

function rowClass(id: number): Record<string, boolean> {
    void draftsVersion.value;
    return {
        'row-failed': failedIds.has(id),
        'row-saving': savingIds.has(id),
    };
}

// 单元格编辑弹窗
type EditableLongField = 'definitionsText' | 'examplesText';

const CELL_EDITOR_META: Record<EditableLongField, { label: string; hint: string }> = {
    definitionsText: { label: '释义', hint: '每条之间用一空行分隔。' },
    examplesText: { label: '例句', hint: '每组「英文 ↵ 中文」，组与组用空行分隔；中文可省略。' },
};

const editingCell = ref<{ wordId: number; field: EditableLongField; wordText: string } | null>(null);
const editingCellValue = ref('');
const modalTextareaRef = ref<HTMLTextAreaElement | null>(null);

function openCellEditor(word: Word, field: EditableLongField): void {
    if (savingIds.has(word.id)) return;
    const draft = getDraft(word);
    editingCellValue.value = draft[field];
    editingCell.value = { wordId: word.id, field, wordText: draft.word || word.word };
    nextTick(() => modalTextareaRef.value?.focus());
}

function closeCellEditor(): void {
    editingCell.value = null;
    editingCellValue.value = '';
}

function commitCellEditor(): void {
    if (!editingCell.value) return;
    const { wordId, field } = editingCell.value;
    const draft = draftsMap.get(wordId);
    if (draft) draft[field] = editingCellValue.value;
    closeCellEditor();
}

// 增量渲染
const RENDER_BATCH = 100;
const renderCount = ref(RENDER_BATCH);
const sentinelRef = ref<HTMLDivElement | null>(null);
let observer: IntersectionObserver | null = null;

const visibleWords = computed(() =>
    props.filteredWords.slice(0, renderCount.value),
);

watch(
    () => [props.filteredWords.length, props.searchQuery],
    () => {
        renderCount.value = RENDER_BATCH;
    },
);

onMounted(() => {
    observer = new IntersectionObserver(entries => {
        if (
            entries[0]?.isIntersecting &&
            renderCount.value < props.filteredWords.length
        ) {
            renderCount.value = Math.min(
                renderCount.value + RENDER_BATCH,
                props.filteredWords.length,
            );
        }
    });
    if (sentinelRef.value) observer.observe(sentinelRef.value);

    window.addEventListener('beforeunload', handleBeforeUnload);
});

onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
    window.removeEventListener('beforeunload', handleBeforeUnload);
});

function handleBeforeUnload(e: BeforeUnloadEvent): void {
    if (dirtyIds.value.length > 0) {
        e.preventDefault();
        e.returnValue = '';
    }
}

// 父组件保存其他途径（如 modal）后调用此方法同步 draft
function syncWord(updated: Word): void {
    if (draftsMap.has(updated.id)) {
        refreshDraftFromWord(updated);
    }
}

defineExpose({
    syncWord,
    hasUnsaved: () => dirtyIds.value.length > 0,
});
</script>

<style scoped>
.word-table-wrapper {
    background: var(--color-surface-card);
    border: 1px solid var(--color-border-medium);
    border-radius: var(--radius-default);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
}

.table-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border-medium);
    gap: var(--space-3);
    flex-wrap: wrap;
}

.toolbar-left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
}
.toolbar-right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
}

.word-count {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
}
.dirty-badge {
    font-size: var(--font-size-sm);
    color: var(--color-edit);
    background: var(--color-edit-light);
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
}
.failed-badge {
    font-size: var(--font-size-sm);
    color: var(--color-delete);
    background: var(--color-delete-light);
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
}

.save-btn, .reset-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: var(--transition-fast);
    border: 1px solid transparent;
}
.save-btn {
    background: var(--button-primary-bg);
    color: var(--button-primary-text);
}
.save-btn:not(:disabled):hover {
    background: var(--button-primary-bg-hover);
}
.reset-btn {
    background: transparent;
    color: var(--color-text-secondary);
    border-color: var(--color-border-medium);
}
.reset-btn:not(:disabled):hover {
    background: var(--button-ghost-bg-hover);
    color: var(--color-text-primary);
}
.save-btn:disabled, .reset-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-icon {
    width: 14px;
    height: 14px;
}
.btn-icon-sm {
    width: 16px;
    height: 16px;
}
.spin {
    animation: spin 0.9s linear infinite;
}
@keyframes spin {
    to { transform: rotate(360deg); }
}

.table-scroll {
    overflow: auto;
    max-height: calc(100vh - 280px);
}

.word-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
}

.word-table thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    font-weight: var(--font-weight-semibold);
    text-align: left;
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--color-border-medium);
    white-space: nowrap;
    font-family: var(--font-ui);
}

.th-hint {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    font-weight: var(--font-weight-normal);
    margin-top: 2px;
}

.word-table tbody td {
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--color-border-light);
    vertical-align: top;
}

.sticky-col {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--color-surface-card);
}
.word-table thead th.sticky-col {
    z-index: 3;
    background: var(--color-bg-secondary);
}

.col-word { min-width: 140px; max-width: 180px; }
.col-phonetic { min-width: 120px; }
.col-defs { min-width: 220px; max-width: 320px; }
.col-examples { min-width: 280px; max-width: 420px; }
.col-flag { width: 70px; text-align: center; }

.cell-input {
    width: 100%;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-xs);
    padding: var(--space-1) var(--space-2);
    font-family: var(--font-ui);
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
    box-sizing: border-box;
    transition: var(--transition-fast);
}
.cell-input:hover {
    border-color: var(--color-border-medium);
}
.cell-input:focus {
    outline: none;
    border-color: var(--input-border-focus);
    background: var(--color-surface-card);
    box-shadow: 0 0 0 3px var(--color-brand-primary-light);
}
.cell-input.mono {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
}
.cell-input[readonly] {
    color: var(--color-text-secondary);
    cursor: not-allowed;
}

.cell-preview {
    width: 100%;
    min-height: 48px;
    max-height: 96px;
    overflow: hidden;
    text-align: left;
    background: transparent;
    border: 1px dashed var(--color-border-medium);
    border-radius: var(--radius-xs);
    padding: var(--space-1) var(--space-2);
    font-family: var(--font-ui);
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: var(--transition-fast);
    display: block;
    box-sizing: border-box;
}
.cell-preview:hover:not(:disabled) {
    background: var(--color-bg-secondary);
    border-style: solid;
}
.cell-preview:disabled {
    cursor: not-allowed;
    opacity: 0.6;
}
.cell-preview .preview-text {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.4;
}
.cell-preview .preview-empty {
    color: var(--color-text-muted);
    font-style: italic;
}

.cell-checkbox-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-1);
    border: 1px solid transparent;
    border-radius: var(--radius-xs);
}
.cell-checkbox {
    width: 16px;
    height: 16px;
    accent-color: var(--color-brand-primary);
    cursor: pointer;
    margin: 0;
}
.cell-checkbox:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

/* Cell 级 dirty 标记（边框高亮 + 微背景） */
.cell-input.cell-dirty,
.cell-preview.cell-dirty,
.cell-checkbox-wrapper.cell-dirty {
    border-color: var(--color-brand-primary);
    background: var(--color-edit-light);
}

.row-failed .sticky-col {
    box-shadow: inset 3px 0 0 var(--color-state-error);
}
.row-saving td {
    opacity: 0.6;
}

/* 单元格编辑弹窗 */
.cell-modal-backdrop {
    position: fixed;
    inset: 0;
    background: var(--color-overlay-modal);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
}
.cell-modal {
    background: var(--color-surface-card);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    width: min(640px, 100%);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.cell-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border-medium);
    background: var(--color-bg-secondary);
}
.cell-modal-title {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
}
.cell-modal-field {
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    font-size: var(--font-size-base);
}
.cell-modal-word {
    font-family: var(--font-mono);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
}
.cell-modal-close {
    background: transparent;
    border: none;
    color: var(--color-text-secondary);
    font-size: var(--font-size-lg);
    cursor: pointer;
    padding: 0 var(--space-1);
    line-height: 1;
}
.cell-modal-close:hover {
    color: var(--color-text-primary);
}
.cell-modal-textarea {
    flex: 1;
    width: 100%;
    border: none;
    padding: var(--space-4);
    font-family: var(--font-ui);
    font-size: var(--font-size-base);
    line-height: 1.6;
    color: var(--color-text-primary);
    background: var(--color-surface-card);
    resize: none;
    box-sizing: border-box;
    outline: none;
}
.cell-modal-textarea:focus {
    background: var(--color-surface-elevated);
}
.cell-modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--color-border-medium);
    background: var(--color-bg-secondary);
    gap: var(--space-3);
}
.cell-modal-hint {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
}
.cell-modal-actions {
    display: flex;
    gap: var(--space-2);
}

.load-sentinel {
    height: 1px;
}

@media (max-width: 768px) {
    .table-scroll {
        max-height: calc(100vh - 240px);
    }
    .col-defs, .col-examples {
        min-width: 200px;
    }
}
</style>

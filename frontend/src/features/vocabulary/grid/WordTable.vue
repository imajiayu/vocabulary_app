<template>
    <div class="word-table-wrapper">
        <!-- Sticky toolbar -->
        <div class="table-toolbar" ref="toolbarRef">
            <div class="toolbar-left">
                <span class="word-count">共 {{ filteredWords.length }} 个</span>
                <span v-if="selectedIds.size > 0" class="selected-badge">
                    已选 {{ selectedIds.size }} 项
                </span>
                <span v-if="dirtyIds.length > 0" class="dirty-badge">
                    {{ dirtyIds.length }} 项待保存
                </span>
                <span v-if="failedIds.size > 0" class="failed-badge">
                    {{ failedIds.size }} 项失败
                </span>
                <span v-if="duplicateCount > 0" class="duplicate-badge">
                    {{ duplicateCount }} 项重复
                </span>
            </div>
            <div class="toolbar-right">
                <button
                    v-if="selectedIds.size > 0"
                    class="delete-btn"
                    @click="handleBatchDelete">
                    <Trash2 class="btn-icon" />
                    <span>删除 {{ selectedIds.size }} 项</span>
                </button>
                <button class="add-btn" @click="addNewRow">
                    <Plus class="btn-icon" />
                    <span>新增</span>
                </button>
                <div class="columns-toggle-wrapper">
                    <button class="columns-btn" @click="showColumnsPopover = !showColumnsPopover">
                        <ColumnsIcon class="btn-icon" />
                        <span>列</span>
                    </button>
                    <div v-if="showColumnsPopover" class="columns-popover" @click.stop>
                        <label
                            v-for="col in COLUMN_DEFS"
                            :key="col.key"
                            class="column-check-item"
                        >
                            <input
                                type="checkbox"
                                :checked="visibleColumns.has(col.key)"
                                @change="toggleColumn(col.key)"
                            />
                            <span>{{ col.label }}</span>
                        </label>
                    </div>
                </div>
                <button
                    class="reset-btn"
                    :disabled="dirtyIds.length === 0 || saving"
                    @click="resetAll">
                    撤销全部
                </button>
                <button
                    class="save-btn"
                    :disabled="(dirtyIds.length === 0 && newRows.length === 0) || saving"
                    @click="saveAll">
                    <Loader2 v-if="saving" class="btn-icon spin" />
                    <Save v-else class="btn-icon" />
                    <span>{{ saving ? '保存中…' : `保存` }}</span>
                </button>
            </div>
        </div>

        <!-- Table with horizontal scroll only -->
        <div class="table-scroll">
            <table class="word-table">
                <thead>
                    <tr>
                        <th class="col-checkbox sticky-col-check">
                            <input
                                type="checkbox"
                                class="header-checkbox"
                                :checked="isAllSelected"
                                :indeterminate.prop="isIndeterminate"
                                @change="toggleSelectAll"
                            />
                        </th>
                        <template v-for="col in visibleColumnDefs" :key="col.key">
                            <th :class="[`col-${col.key}`, { 'sticky-col': col.key === 'word' }]">
                                {{ col.label }}
                                <span v-if="col.hint" class="th-hint">{{ col.hint }}</span>
                            </th>
                        </template>
                    </tr>
                </thead>
                <tbody>
                    <!-- New rows (unsaved) -->
                    <tr v-for="nr in newRows" :key="nr.tempId" class="row-new">
                        <td class="col-checkbox sticky-col-check">
                            <button class="new-row-cancel" @click="removeNewRow(nr.tempId)" title="取消">✕</button>
                        </td>
                        <template v-for="col in visibleColumnDefs" :key="col.key">
                            <td :class="[`col-${col.key}`, { 'sticky-col': col.key === 'word' }]">
                                <template v-if="col.key === 'word'">
                                    <input
                                        :ref="(el: any) => { if (el) newRowWordRefs.set(nr.tempId, el) }"
                                        v-model="nr.word"
                                        type="text"
                                        class="cell-input"
                                        :class="{ 'cell-error': nr.duplicateState === 'duplicate' }"
                                        placeholder="输入单词..."
                                        @blur="checkNewRowDuplicate(nr)"
                                        @keydown.enter="saveNewRow(nr)"
                                    />
                                </template>
                                <template v-else-if="col.key === 'source'">
                                    <select v-model="nr.source" class="cell-input">
                                        <option v-for="s in availableSources" :key="s" :value="s">{{ s }}</option>
                                    </select>
                                </template>
                                <template v-else>
                                    <span class="preview-empty">—</span>
                                </template>
                            </td>
                        </template>
                    </tr>

                    <!-- Existing rows -->
                    <tr v-for="word in visibleWords"
                        :key="word.id"
                        :class="rowClass(word.id)">
                        <td class="col-checkbox sticky-col-check">
                            <input
                                type="checkbox"
                                class="cell-checkbox"
                                :checked="selectedIds.has(word.id)"
                                @change="toggleSelect(word.id)"
                            />
                        </td>
                        <template v-for="col in visibleColumnDefs" :key="col.key">
                            <td :class="[`col-${col.key}`, { 'sticky-col': col.key === 'word' }]">
                                <!-- Text input columns -->
                                <template v-if="col.render === 'input'">
                                    <input
                                        v-model="getDraft(word)[col.draftKey!]"
                                        :type="col.inputType ?? 'text'"
                                        :step="col.inputType === 'number' ? 'any' : undefined"
                                        class="cell-input"
                                        :class="{
                                            'cell-dirty': isCellDirty(word.id, col.draftKey!),
                                            'cell-error': col.key === 'word' && duplicateIds.has(word.id),
                                            mono: col.mono,
                                        }"
                                        :readonly="savingIds.has(word.id) || col.readonly"
                                        @blur="col.key === 'word' ? checkWordDuplicate(word) : undefined"
                                    />
                                </template>
                                <!-- Modal editor (definitions, examples) -->
                                <template v-else-if="col.render === 'preview'">
                                    <button
                                        type="button"
                                        class="cell-preview"
                                        :class="{ 'cell-dirty': isCellDirty(word.id, col.draftKey!) }"
                                        :disabled="savingIds.has(word.id)"
                                        @click="openCellEditor(word, col.draftKey! as EditableLongField)">
                                        <span v-if="getDraft(word)[col.draftKey!]" class="preview-text">{{ getDraft(word)[col.draftKey!] }}</span>
                                        <span v-else class="preview-empty">点击编辑</span>
                                    </button>
                                </template>
                                <!-- Checkbox columns -->
                                <template v-else-if="col.render === 'checkbox'">
                                    <label
                                        class="cell-checkbox-wrapper"
                                        :class="{ 'cell-dirty': isCellDirty(word.id, col.draftKey!) }">
                                        <input
                                            type="checkbox"
                                            class="cell-checkbox"
                                            :checked="getDraft(word)[col.draftKey!] === 1"
                                            :disabled="savingIds.has(word.id)"
                                            @change="setFlag(word.id, col.draftKey!, ($event.target as HTMLInputElement).checked)"
                                        />
                                    </label>
                                </template>
                                <!-- Read-only display -->
                                <template v-else-if="col.render === 'readonly'">
                                    <span class="cell-readonly">{{ formatValue(word, col) }}</span>
                                </template>
                            </td>
                        </template>
                    </tr>
                </tbody>
            </table>
            <div ref="sentinelRef" class="load-sentinel"></div>
        </div>

        <!-- Cell editor modal -->
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

        <!-- Columns popover backdrop (invisible click-away) -->
        <div v-if="showColumnsPopover" class="popover-backdrop" @click="showColumnsPopover = false"></div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Save, Loader2, Plus, Trash2, Columns as ColumnsIcon } from 'lucide-vue-next'
import type { Word, DefinitionObject } from '@/shared/types'
import type { UpdateWordPayload } from '@/shared/api/words'
import { applyBoldToDefinition, stripBoldFromDefinition } from '@/shared/utils/definition'
import { api } from '@/shared/api'
import { concurrentMap } from '@/shared/utils/concurrent'
import { logger } from '@/shared/utils/logger'

const log = logger.create('WordTable')

// ── Column definitions ──────────────────────────────────────

interface ColumnDef {
    key: string
    label: string
    draftKey?: string
    render: 'input' | 'preview' | 'checkbox' | 'readonly'
    inputType?: string
    mono?: boolean
    readonly?: boolean
    hint?: string
    defaultVisible: boolean
    editable: boolean
}

const COLUMN_DEFS: ColumnDef[] = [
    { key: 'word', label: '单词', draftKey: 'word', render: 'input', defaultVisible: true, editable: true },
    { key: 'phoneticUs', label: '音标 US', draftKey: 'phoneticUs', render: 'input', mono: true, defaultVisible: true, editable: true },
    { key: 'phoneticUk', label: '音标 UK', draftKey: 'phoneticUk', render: 'input', mono: true, defaultVisible: false, editable: true },
    { key: 'definitionsText', label: '释义', draftKey: 'definitionsText', render: 'preview', hint: '每条之间用空行分隔', defaultVisible: true, editable: true },
    { key: 'examplesText', label: '例句', draftKey: 'examplesText', render: 'preview', hint: '英/中各占一行，组间空行分隔', defaultVisible: true, editable: true },
    { key: 'source', label: '来源', render: 'readonly', defaultVisible: true, editable: false },
    { key: 'stop_review', label: '停止复习', draftKey: 'stop_review', render: 'checkbox', defaultVisible: true, editable: true },
    { key: 'stop_spell', label: '停止拼写', draftKey: 'stop_spell', render: 'checkbox', defaultVisible: true, editable: true },
    { key: 'ease_factor', label: '熟练度', draftKey: 'ease_factor', render: 'input', inputType: 'number', defaultVisible: true, editable: true },
    { key: 'date_added', label: '添加日期', render: 'readonly', defaultVisible: true, editable: false },
    { key: 'next_review', label: '下次复习', draftKey: 'next_review', render: 'input', inputType: 'date', defaultVisible: true, editable: true },
    { key: 'interval', label: '间隔(天)', draftKey: 'interval', render: 'input', inputType: 'number', defaultVisible: false, editable: true },
    { key: 'repetition', label: '重复次数', draftKey: 'repetition', render: 'input', inputType: 'number', defaultVisible: false, editable: true },
    { key: 'lapse', label: '遗忘标记', draftKey: 'lapse', render: 'checkbox', defaultVisible: false, editable: true },
    { key: 'spell_strength', label: '拼写强度', draftKey: 'spell_strength', render: 'input', inputType: 'number', defaultVisible: false, editable: true },
    { key: 'spell_next_review', label: '下次拼写', draftKey: 'spell_next_review', render: 'input', inputType: 'date', defaultVisible: false, editable: true },
    { key: 'last_review', label: '上次复习', render: 'readonly', defaultVisible: false, editable: false },
    { key: 'last_spell', label: '上次拼写', render: 'readonly', defaultVisible: false, editable: false },
    { key: 'remember_count', label: '记住次数', render: 'readonly', defaultVisible: false, editable: false },
    { key: 'forget_count', label: '忘记次数', render: 'readonly', defaultVisible: false, editable: false },
    { key: 'avg_elapsed_time', label: '平均用时(ms)', render: 'readonly', defaultVisible: false, editable: false },
]

// ── Props & Emits ───────────────────────────────────────────

interface Props {
    filteredWords: Word[]
    allWords: Word[]
    searchQuery?: string
    allWordsLoaded?: boolean
    availableSources?: readonly string[]
}
const props = withDefaults(defineProps<Props>(), {
    allWordsLoaded: false,
    availableSources: () => ['IELTS'],
})

const emit = defineEmits<{
    saved: [word: Word]
    dirtyChange: [count: number]
    wordAdded: [word: Word]
    batchDelete: [wordIds: number[]]
}>()

// ── Column visibility ───────────────────────────────────────

const STORAGE_KEY = 'word-table-visible-columns'
const showColumnsPopover = ref(false)

function loadVisibleColumns(): Set<string> {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) return new Set(JSON.parse(stored))
    } catch { /* use defaults */ }
    return new Set(COLUMN_DEFS.filter(c => c.defaultVisible).map(c => c.key))
}

const visibleColumns = ref(loadVisibleColumns())

function toggleColumn(key: string) {
    const next = new Set(visibleColumns.value)
    if (next.has(key)) {
        if (next.size <= 1) return
        next.delete(key)
    } else {
        next.add(key)
    }
    visibleColumns.value = next
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
}

const visibleColumnDefs = computed(() =>
    COLUMN_DEFS.filter(c => visibleColumns.value.has(c.key))
)

// ── Row selection ───────────────────────────────────────────

const selectedIds = reactive(new Set<number>())

const isAllSelected = computed(() =>
    props.filteredWords.length > 0 && props.filteredWords.every(w => selectedIds.has(w.id))
)

const isIndeterminate = computed(() =>
    selectedIds.size > 0 && !isAllSelected.value
)

function toggleSelect(id: number) {
    if (selectedIds.has(id)) selectedIds.delete(id)
    else selectedIds.add(id)
}

function toggleSelectAll() {
    if (isAllSelected.value) {
        selectedIds.clear()
    } else {
        props.filteredWords.forEach(w => selectedIds.add(w.id))
    }
}

async function handleBatchDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`确定删除选中的 ${selectedIds.size} 个单词？此操作不可撤销。`)) return

    const ids = [...selectedIds]
    try {
        await api.words.batchDeleteDirect(ids)
        ids.forEach(id => {
            draftsMap.delete(id)
            originalsMap.delete(id)
            selectedIds.delete(id)
            duplicateIds.delete(id)
        })
        draftsVersion.value++
        emit('batchDelete', ids)
    } catch (err) {
        log.error('批量删除失败:', err)
        alert('批量删除失败，请重试。')
    }
}

// ── Draft system (expanded) ─────────────────────────────────

interface RowDraft {
    word: string
    phoneticUs: string
    phoneticUk: string
    definitionsText: string
    examplesText: string
    stop_review: number
    stop_spell: number
    ease_factor: string
    next_review: string
    interval: string
    repetition: string
    lapse: number
    spell_strength: string
    spell_next_review: string
    [key: string]: string | number
}

function serializeDefinitions(arr: string[] | undefined): string {
    return (arr ?? []).join('\n\n')
}

function parseDefinitions(text: string): string[] {
    return text.split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean)
}

function serializeExamples(examples: { en: string; zh: string }[] | undefined): string {
    if (!examples?.length) return ''
    return examples
        .map(e => {
            const en = (e.en ?? '').trim()
            const zh = (e.zh ?? '').trim()
            return zh ? `${en}\n${zh}` : en
        })
        .join('\n\n')
}

function parseExamples(text: string): { en: string; zh: string }[] {
    return text
        .split(/\n\s*\n+/)
        .map(group => group.replace(/\s+$/, ''))
        .filter(Boolean)
        .map(group => {
            const lines = group.split('\n')
            const en = (lines[0] ?? '').trim()
            const zh = lines.slice(1).join('\n').trim()
            return { en, zh }
        })
        .filter(p => p.en || p.zh)
}

function wordToDraft(word: Word): RowDraft {
    const def = word.definition || ({} as DefinitionObject)
    const stripped = stripBoldFromDefinition(def)
    return {
        word: word.word,
        phoneticUs: stripped.phonetic?.us ?? '',
        phoneticUk: stripped.phonetic?.uk ?? '',
        definitionsText: serializeDefinitions(stripped.definitions),
        examplesText: serializeExamples(stripped.examples),
        stop_review: word.stop_review ?? 0,
        stop_spell: word.stop_spell ?? 0,
        ease_factor: String(word.ease_factor ?? ''),
        next_review: word.next_review ?? '',
        interval: String(word.interval ?? ''),
        repetition: String(word.repetition ?? ''),
        lapse: word.lapse ?? 0,
        spell_strength: word.spell_strength != null ? String(word.spell_strength) : '',
        spell_next_review: word.spell_next_review ?? '',
    }
}

const draftsMap = new Map<number, RowDraft>()
const originalsMap = new Map<number, RowDraft>()
const draftsVersion = ref(0)

function getDraft(word: Word): RowDraft {
    let d = draftsMap.get(word.id)
    if (!d) {
        const init = wordToDraft(word)
        d = reactive({ ...init }) as RowDraft
        draftsMap.set(word.id, d)
        originalsMap.set(word.id, { ...init })
        draftsVersion.value++
    }
    return d
}

function refreshDraftFromWord(word: Word): void {
    const init = wordToDraft(word)
    const existing = draftsMap.get(word.id)
    if (existing) Object.assign(existing, init)
    else draftsMap.set(word.id, reactive({ ...init }) as RowDraft)
    originalsMap.set(word.id, { ...init })
    draftsVersion.value++
}

function isCellDirty(id: number, field: string): boolean {
    void draftsVersion.value
    const d = draftsMap.get(id)
    const o = originalsMap.get(id)
    if (!d || !o) return false
    return d[field] !== o[field]
}

const DRAFT_KEYS = COLUMN_DEFS.filter(c => c.draftKey).map(c => c.draftKey!)

function isDirty(id: number): boolean {
    const d = draftsMap.get(id)
    const o = originalsMap.get(id)
    if (!d || !o) return false
    return DRAFT_KEYS.some(k => d[k] !== o[k])
}

const dirtyIds = computed<number[]>(() => {
    void draftsVersion.value
    const ids: number[] = []
    for (const id of draftsMap.keys()) {
        if (isDirty(id)) ids.push(id)
    }
    return ids
})

watch(dirtyIds, ids => emit('dirtyChange', ids.length), { immediate: true })

function setFlag(id: number, key: string, checked: boolean): void {
    const d = draftsMap.get(id)
    if (d) d[key] = checked ? 1 : 0
}

function buildPatch(id: number): Partial<UpdateWordPayload> {
    const d = draftsMap.get(id)!
    const o = originalsMap.get(id)!
    const patch: Partial<UpdateWordPayload> = {}

    if (d.word !== o.word) patch.word = d.word.trim()
    if (d.stop_review !== o.stop_review) patch.stop_review = d.stop_review as number
    if (d.stop_spell !== o.stop_spell) patch.stop_spell = d.stop_spell as number
    if (d.lapse !== o.lapse) patch.lapse = d.lapse as number

    if (d.ease_factor !== o.ease_factor) {
        const v = parseFloat(d.ease_factor as string)
        if (!isNaN(v)) patch.ease_factor = v
    }
    if (d.next_review !== o.next_review) {
        patch.next_review = (d.next_review as string) || undefined
    }
    if (d.interval !== o.interval) {
        const v = parseInt(d.interval as string)
        if (!isNaN(v)) patch.interval = v
    }
    if (d.repetition !== o.repetition) {
        const v = parseInt(d.repetition as string)
        if (!isNaN(v)) patch.repetition = v
    }
    if (d.spell_strength !== o.spell_strength) {
        const v = parseFloat(d.spell_strength as string)
        if (!isNaN(v)) patch.spell_strength = v
    }
    if (d.spell_next_review !== o.spell_next_review) {
        patch.spell_next_review = (d.spell_next_review as string) || undefined
    }

    const defChanged =
        d.phoneticUs !== o.phoneticUs ||
        d.phoneticUk !== o.phoneticUk ||
        d.definitionsText !== o.definitionsText ||
        d.examplesText !== o.examplesText

    if (defChanged) {
        const wordText = (patch.word ?? d.word).trim()
        const phonetic: DefinitionObject['phonetic'] = {}
        const us = (d.phoneticUs as string).trim()
        const uk = (d.phoneticUk as string).trim()
        if (us) phonetic.us = us
        if (uk) phonetic.uk = uk

        const definition: DefinitionObject = {
            phonetic: us || uk ? phonetic : undefined,
            definitions: parseDefinitions(d.definitionsText as string),
            examples: parseExamples(d.examplesText as string),
        }
        patch.definition = applyBoldToDefinition(definition, wordText)
    }
    return patch
}

function formatValue(word: Word, col: ColumnDef): string {
    const raw = (word as unknown as Record<string, unknown>)[col.key]
    if (raw == null) return '—'
    return String(raw)
}

// ── Save / Reset ────────────────────────────────────────────

const saving = ref(false)
const savingIds = reactive(new Set<number>())
const failedIds = reactive(new Set<number>())

async function saveAll(): Promise<void> {
    if (saving.value) return

    saving.value = true
    failedIds.clear()

    // Save new rows first
    for (const nr of [...newRows.value]) {
        if (!nr.word.trim()) continue
        if (nr.duplicateState === 'duplicate') continue
        try {
            const created = await api.words.createWordDirect(nr.word.trim(), nr.source)
            removeNewRow(nr.tempId)
            emit('wordAdded', created)
        } catch (err) {
            log.error('新增单词失败:', err)
            nr.duplicateState = 'error'
        }
    }

    // Save dirty existing rows
    const ids = [...dirtyIds.value].filter(id => !duplicateIds.has(id))
    if (ids.length > 0) {
        const items = ids.map(id => ({ id, patch: buildPatch(id) }))

        await concurrentMap(
            items,
            async ({ id, patch }) => {
                savingIds.add(id)
                try {
                    const updated = await api.words.updateWordDirect(id, patch)
                    refreshDraftFromWord(updated)
                    emit('saved', updated)
                    return updated
                } catch (err) {
                    failedIds.add(id)
                    log.error(`保存单词 ${id} 失败:`, err)
                    throw err
                } finally {
                    savingIds.delete(id)
                }
            },
            4,
            { retries: 1 },
        )
    }

    saving.value = false
    if (failedIds.size > 0) {
        alert(`${failedIds.size} 个单词保存失败，已保留在表格中以便重试。`)
    }
}

function resetAll(): void {
    if (dirtyIds.value.length === 0) return
    if (!confirm(`确定撤销 ${dirtyIds.value.length} 项变更？`)) return
    for (const id of dirtyIds.value) {
        const d = draftsMap.get(id)
        const o = originalsMap.get(id)
        if (d && o) Object.assign(d, o)
    }
    failedIds.clear()
    duplicateIds.clear()
    draftsVersion.value++
}

function rowClass(id: number): Record<string, boolean> {
    void draftsVersion.value
    return {
        'row-failed': failedIds.has(id),
        'row-saving': savingIds.has(id),
        'row-selected': selectedIds.has(id),
    }
}

// ── Word uniqueness validation ──────────────────────────────

const duplicateIds = reactive(new Set<number>())

const duplicateCount = computed(() => {
    const fromExisting = duplicateIds.size
    const fromNew = newRows.value.filter(r => r.duplicateState === 'duplicate').length
    return fromExisting + fromNew
})

async function checkWordDuplicate(word: Word): Promise<void> {
    const draft = draftsMap.get(word.id)
    if (!draft || draft.word === originalsMap.get(word.id)?.word) {
        duplicateIds.delete(word.id)
        return
    }
    const trimmed = draft.word.trim()
    if (!trimmed) return

    try {
        let exists: boolean
        if (props.allWordsLoaded) {
            const normalized = trimmed.normalize('NFC').toLowerCase()
            exists = props.allWords.some(
                w => w.id !== word.id && w.word.normalize('NFC').toLowerCase() === normalized
            )
        } else {
            exists = await api.words.checkWordExistsDirect(trimmed, word.id)
        }

        if (exists) duplicateIds.add(word.id)
        else duplicateIds.delete(word.id)
    } catch {
        // silently ignore check errors
    }
}

// ── New row management ──────────────────────────────────────

interface NewRow {
    tempId: number
    word: string
    source: string
    duplicateState: 'idle' | 'duplicate' | 'error'
}

let tempIdCounter = -1
const newRows = ref<NewRow[]>([])
const newRowWordRefs = new Map<number, HTMLInputElement>()

function addNewRow() {
    const source = props.availableSources[0] ?? 'IELTS'
    const nr: NewRow = {
        tempId: tempIdCounter--,
        word: '',
        source,
        duplicateState: 'idle',
    }
    newRows.value.unshift(nr)
    nextTick(() => {
        const el = newRowWordRefs.get(nr.tempId)
        el?.focus()
    })
}

function removeNewRow(tempId: number) {
    newRows.value = newRows.value.filter(r => r.tempId !== tempId)
    newRowWordRefs.delete(tempId)
}

async function checkNewRowDuplicate(nr: NewRow): Promise<void> {
    const trimmed = nr.word.trim()
    if (!trimmed) {
        nr.duplicateState = 'idle'
        return
    }
    try {
        let exists: boolean
        if (props.allWordsLoaded) {
            const normalized = trimmed.normalize('NFC').toLowerCase()
            exists = props.allWords.some(w => w.word.normalize('NFC').toLowerCase() === normalized)
        } else {
            exists = await api.words.checkWordExistsDirect(trimmed, -1)
        }
        nr.duplicateState = exists ? 'duplicate' : 'idle'
    } catch {
        nr.duplicateState = 'idle'
    }
}

async function saveNewRow(nr: NewRow): Promise<void> {
    const trimmed = nr.word.trim()
    if (!trimmed) return
    if (nr.duplicateState === 'duplicate') return

    try {
        const created = await api.words.createWordDirect(trimmed, nr.source)
        removeNewRow(nr.tempId)
        emit('wordAdded', created)
    } catch (err) {
        log.error('新增单词失败:', err)
        nr.duplicateState = 'error'
    }
}

// ── Cell editor modal ───────────────────────────────────────

type EditableLongField = 'definitionsText' | 'examplesText'

const CELL_EDITOR_META: Record<EditableLongField, { label: string; hint: string }> = {
    definitionsText: { label: '释义', hint: '每条之间用一空行分隔。' },
    examplesText: { label: '例句', hint: '每组「英文 ↵ 中文」，组与组用空行分隔；中文可省略。' },
}

const editingCell = ref<{ wordId: number; field: EditableLongField; wordText: string } | null>(null)
const editingCellValue = ref('')
const modalTextareaRef = ref<HTMLTextAreaElement | null>(null)

function openCellEditor(word: Word, field: EditableLongField): void {
    if (savingIds.has(word.id)) return
    const draft = getDraft(word)
    editingCellValue.value = draft[field] as string
    editingCell.value = { wordId: word.id, field, wordText: (draft.word as string) || word.word }
    nextTick(() => modalTextareaRef.value?.focus())
}

function closeCellEditor(): void {
    editingCell.value = null
    editingCellValue.value = ''
}

function commitCellEditor(): void {
    if (!editingCell.value) return
    const { wordId, field } = editingCell.value
    const draft = draftsMap.get(wordId)
    if (draft) draft[field] = editingCellValue.value
    closeCellEditor()
}

// ── Incremental rendering ───────────────────────────────────

const RENDER_BATCH = 100
const renderCount = ref(RENDER_BATCH)
const sentinelRef = ref<HTMLDivElement | null>(null)
const toolbarRef = ref<HTMLDivElement | null>(null)
let observer: IntersectionObserver | null = null

const visibleWords = computed(() =>
    props.filteredWords.slice(0, renderCount.value),
)

watch(
    () => [props.filteredWords.length, props.searchQuery],
    () => {
        renderCount.value = RENDER_BATCH
        selectedIds.clear()
    },
)

onMounted(() => {
    observer = new IntersectionObserver(entries => {
        if (
            entries[0]?.isIntersecting &&
            renderCount.value < props.filteredWords.length
        ) {
            renderCount.value = Math.min(
                renderCount.value + RENDER_BATCH,
                props.filteredWords.length,
            )
        }
    })
    if (sentinelRef.value) observer.observe(sentinelRef.value)

    window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
    window.removeEventListener('beforeunload', handleBeforeUnload)
})

function handleBeforeUnload(e: BeforeUnloadEvent): void {
    if (dirtyIds.value.length > 0 || newRows.value.length > 0) {
        e.preventDefault()
        e.returnValue = ''
    }
}

function syncWord(updated: Word): void {
    if (draftsMap.has(updated.id)) {
        refreshDraftFromWord(updated)
    }
}

defineExpose({
    syncWord,
    hasUnsaved: () => dirtyIds.value.length > 0 || newRows.value.length > 0,
})
</script>

<style scoped>
.word-table-wrapper {
    background: var(--color-surface-card);
    border: 1px solid var(--primitive-paper-400);
    border-radius: var(--radius-default);
    box-shadow: var(--shadow-sm);
    overflow: visible;
}

/* ═══ Toolbar ═══ */

.table-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px var(--space-3);
    background: linear-gradient(
        180deg,
        var(--primitive-paper-200) 0%,
        var(--primitive-paper-300) 100%
    );
    border-bottom: 1px solid var(--primitive-paper-400);
    gap: var(--space-2);
    flex-wrap: wrap;
    border-radius: var(--radius-default) var(--radius-default) 0 0;
}

.toolbar-left {
    display: flex;
    align-items: center;
    gap: var(--space-2);
}
.toolbar-right {
    display: flex;
    align-items: center;
    gap: 6px;
}

.word-count {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    letter-spacing: 0.02em;
}

/* ── Status badges ── */

.selected-badge,
.dirty-badge,
.failed-badge,
.duplicate-badge {
    font-family: var(--font-ui);
    font-size: 10px;
    font-weight: var(--font-weight-medium);
    padding: 1px 6px;
    border-radius: var(--radius-full);
    line-height: 1.5;
    letter-spacing: 0.01em;
    white-space: nowrap;
}

.selected-badge {
    color: var(--color-brand-primary);
    background: var(--color-brand-primary-light);
    border: 1px solid var(--color-brand-primary-border);
}
.dirty-badge {
    color: var(--primitive-copper-600);
    background: var(--color-edit-light);
    border: 1px solid rgba(153, 107, 61, 0.2);
}
.failed-badge {
    color: var(--primitive-brick-600);
    background: var(--color-delete-light);
    border: 1px solid rgba(155, 59, 59, 0.15);
}
.duplicate-badge {
    color: var(--primitive-brick-600);
    background: var(--color-delete-light);
    border: 1px solid rgba(155, 59, 59, 0.15);
}

/* ── Toolbar buttons ── */

.save-btn, .reset-btn, .add-btn, .delete-btn, .columns-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    font-size: 11px;
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all var(--transition-fast);
    border: 1px solid transparent;
    font-family: var(--font-ui);
    white-space: nowrap;
}
.save-btn {
    background: var(--gradient-primary);
    color: var(--primitive-paper-100);
    box-shadow: 0 1px 3px rgba(153, 107, 61, 0.2);
}
.save-btn:not(:disabled):hover {
    box-shadow: 0 2px 8px rgba(153, 107, 61, 0.3);
    transform: translateY(-0.5px);
}
.reset-btn {
    background: var(--primitive-paper-50);
    color: var(--color-text-secondary);
    border-color: var(--primitive-paper-400);
}
.reset-btn:not(:disabled):hover {
    background: var(--primitive-paper-300);
    color: var(--color-text-primary);
}
.save-btn:disabled, .reset-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}

.add-btn {
    background: var(--primitive-paper-50);
    color: var(--color-text-secondary);
    border-color: var(--primitive-paper-400);
}
.add-btn:hover {
    border-color: var(--color-brand-primary);
    color: var(--color-brand-primary);
    background: var(--color-brand-primary-light);
}

.delete-btn {
    background: transparent;
    color: var(--primitive-brick-500);
    border-color: rgba(155, 59, 59, 0.3);
}
.delete-btn:hover {
    background: var(--color-delete-light);
    border-color: var(--primitive-brick-400);
}

.columns-toggle-wrapper {
    position: relative;
}
.columns-btn {
    background: var(--primitive-paper-50);
    color: var(--color-text-secondary);
    border-color: var(--primitive-paper-400);
}
.columns-btn:hover {
    border-color: var(--color-brand-primary);
    color: var(--color-brand-primary);
}

.columns-popover {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 20;
    background: var(--primitive-paper-50);
    border: 1px solid var(--primitive-paper-400);
    border-radius: var(--radius-default);
    box-shadow: var(--shadow-lg);
    padding: 6px;
    min-width: 150px;
    max-height: 360px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.column-check-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    border-radius: var(--radius-xs);
    font-size: 11px;
    color: var(--color-text-primary);
    cursor: pointer;
    transition: background var(--transition-fast);
}
.column-check-item:hover {
    background: var(--primitive-paper-200);
}
.column-check-item input {
    accent-color: var(--color-brand-primary);
    width: 13px;
    height: 13px;
}

.popover-backdrop {
    position: fixed;
    inset: 0;
    z-index: 15;
}

.btn-icon {
    width: 13px;
    height: 13px;
}
.spin {
    animation: spin 0.9s linear infinite;
}
@keyframes spin {
    to { transform: rotate(360deg); }
}

/* ═══ Table layout ═══ */

.table-scroll {
    overflow-x: auto;
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
    z-index: 8;
    background: var(--primitive-paper-200);
    color: var(--primitive-ink-400);
    font-weight: var(--font-weight-semibold);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    text-align: left;
    padding: 5px 8px;
    border-bottom: 1px solid var(--primitive-paper-400);
    white-space: nowrap;
    font-family: var(--font-ui);
}

.th-hint {
    display: block;
    font-size: 9px;
    color: var(--color-text-muted);
    font-weight: var(--font-weight-normal);
    margin-top: 1px;
    text-transform: none;
    letter-spacing: normal;
}

.word-table tbody td {
    padding: 4px 8px;
    border-bottom: 1px solid rgba(139, 105, 20, 0.06);
    vertical-align: top;
}

.word-table tbody tr:hover td {
    background: var(--primitive-paper-200);
}
.word-table tbody tr:hover .sticky-col,
.word-table tbody tr:hover .sticky-col-check {
    background: var(--primitive-paper-200);
}

/* ═══ Sticky columns ═══ */

.sticky-col-check {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--color-surface-card);
    width: 34px;
    text-align: center;
}
.word-table thead th.sticky-col-check {
    z-index: 9;
    background: var(--primitive-paper-200);
}

.sticky-col {
    position: sticky;
    left: 34px;
    z-index: 1;
    background: var(--color-surface-card);
}
.word-table thead th.sticky-col {
    z-index: 9;
    background: var(--primitive-paper-200);
}

.header-checkbox {
    width: 14px;
    height: 14px;
    accent-color: var(--color-brand-primary);
    cursor: pointer;
    margin: 0;
}

/* ═══ Column widths ═══ */

.col-word { min-width: 110px; max-width: 150px; }
.col-phoneticUs, .col-phoneticUk { min-width: 90px; }
.col-definitionsText { min-width: 140px; max-width: 200px; }
.col-examplesText { min-width: 150px; max-width: 220px; }
.col-source { min-width: 50px; }
.col-stop_review, .col-stop_spell, .col-lapse { width: 48px; text-align: center; }
.col-ease_factor, .col-interval, .col-repetition,
.col-spell_strength, .col-remember_count, .col-forget_count,
.col-avg_elapsed_time { min-width: 60px; max-width: 80px; }
.col-date_added, .col-next_review, .col-spell_next_review,
.col-last_review, .col-last_spell { min-width: 96px; }

/* ═══ Cell styles ═══ */

.cell-input {
    width: 100%;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 3px;
    padding: 2px 6px;
    font-family: var(--font-ui);
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
    box-sizing: border-box;
    transition: all var(--transition-fast);
}
.cell-input:hover {
    border-color: var(--primitive-paper-400);
}
.cell-input:focus {
    outline: none;
    border-color: var(--color-brand-primary);
    background: var(--primitive-paper-50);
    box-shadow: 0 0 0 2px var(--color-brand-primary-light);
}
.cell-input.mono {
    font-family: var(--font-mono);
    font-size: 11px;
}
.cell-input[readonly] {
    color: var(--color-text-tertiary);
    cursor: not-allowed;
}

.cell-preview {
    width: 100%;
    min-height: 36px;
    max-height: 72px;
    overflow: hidden;
    text-align: left;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 3px;
    padding: 2px 6px;
    font-family: var(--font-ui);
    font-size: 11px;
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: block;
    box-sizing: border-box;
}
.cell-preview:hover:not(:disabled) {
    background: var(--primitive-paper-200);
    border-color: var(--primitive-paper-400);
}
.cell-preview:disabled {
    cursor: not-allowed;
    opacity: 0.6;
}
.cell-preview .preview-text {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.5;
}
.cell-preview .preview-empty,
.preview-empty {
    color: var(--color-text-muted);
    font-style: italic;
    font-size: 10px;
}

.cell-readonly {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-secondary);
    white-space: nowrap;
    padding: 2px 0;
}

.cell-checkbox-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: 1px solid transparent;
    border-radius: 3px;
}
.cell-checkbox {
    width: 14px;
    height: 14px;
    accent-color: var(--color-brand-primary);
    cursor: pointer;
    margin: 0;
}
.cell-checkbox:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

/* ═══ Cell state indicators ═══ */

.cell-input.cell-dirty,
.cell-preview.cell-dirty,
.cell-checkbox-wrapper.cell-dirty {
    border-color: var(--primitive-copper-300);
    background: var(--color-edit-light);
}

.cell-input.cell-error {
    border-color: var(--primitive-brick-400);
    background: var(--color-delete-light);
    box-shadow: 0 0 0 2px rgba(155, 59, 59, 0.08);
}

.row-failed td {
    border-left: 2px solid var(--color-state-error);
}
.row-failed td:first-child {
    border-left: 3px solid var(--color-state-error);
}
.row-saving td {
    opacity: 0.5;
    pointer-events: none;
}
.row-selected td {
    background: rgba(153, 107, 61, 0.06);
}
.row-selected .sticky-col,
.row-selected .sticky-col-check {
    background: rgba(253, 248, 243, 0.98);
}
.row-selected:hover td,
.row-selected:hover .sticky-col,
.row-selected:hover .sticky-col-check {
    background: rgba(153, 107, 61, 0.1);
}

/* ═══ New row ═══ */

.row-new td {
    background: rgba(153, 107, 61, 0.05);
    border-bottom-color: var(--primitive-copper-200);
}
.row-new .sticky-col,
.row-new .sticky-col-check {
    background: rgba(253, 248, 243, 0.95);
}

.new-row-cancel {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 4px;
    border-radius: var(--radius-full);
    line-height: 1;
    opacity: 0.5;
    transition: all var(--transition-fast);
}
.row-new:hover .new-row-cancel {
    opacity: 1;
}
.new-row-cancel:hover {
    color: var(--color-danger);
    background: var(--color-delete-light);
    opacity: 1;
}

/* ═══ Cell editor modal ═══ */

.cell-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(26, 32, 44, 0.35);
    backdrop-filter: blur(2px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    animation: fadeIn 0.15s ease-out;
}
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.cell-modal {
    background: var(--primitive-paper-100);
    border-radius: var(--radius-md);
    box-shadow:
        0 20px 60px rgba(0, 0, 0, 0.12),
        0 1px 3px rgba(0, 0, 0, 0.06);
    width: min(600px, 100%);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--primitive-paper-400);
    animation: modalSlideUp 0.2s ease-out;
}
@keyframes modalSlideUp {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

.cell-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px var(--space-4);
    border-bottom: 1px solid var(--primitive-paper-400);
    background: var(--primitive-paper-200);
}
.cell-modal-title {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
}
.cell-modal-field {
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
}
.cell-modal-word {
    font-family: var(--font-mono);
    color: var(--primitive-copper-500);
    font-size: var(--font-size-sm);
}
.cell-modal-close {
    background: transparent;
    border: none;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-base);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    line-height: 1;
    transition: all var(--transition-fast);
}
.cell-modal-close:hover {
    color: var(--color-text-primary);
    background: var(--primitive-paper-300);
}
.cell-modal-textarea {
    flex: 1;
    width: 100%;
    border: none;
    padding: var(--space-4);
    font-family: var(--font-serif);
    font-size: var(--font-size-base);
    line-height: 1.7;
    color: var(--color-text-primary);
    background: var(--primitive-paper-100);
    resize: none;
    box-sizing: border-box;
    outline: none;
}
.cell-modal-textarea:focus {
    background: var(--primitive-paper-50);
}
.cell-modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px var(--space-4);
    border-top: 1px solid var(--primitive-paper-400);
    background: var(--primitive-paper-200);
    gap: var(--space-3);
}
.cell-modal-hint {
    font-size: 10px;
    color: var(--color-text-muted);
    font-style: italic;
}
.cell-modal-actions {
    display: flex;
    gap: 6px;
}

.load-sentinel {
    height: 1px;
}

/* ═══ Scrollbar ═══ */

.table-scroll::-webkit-scrollbar {
    height: 6px;
}
.table-scroll::-webkit-scrollbar-track {
    background: var(--primitive-paper-200);
}
.table-scroll::-webkit-scrollbar-thumb {
    background: var(--primitive-paper-500);
    border-radius: 3px;
}
.table-scroll::-webkit-scrollbar-thumb:hover {
    background: var(--primitive-paper-600);
}

/* ═══ Mobile ═══ */

@media (max-width: 768px) {
    .table-toolbar {
        padding: var(--space-2);
    }
    .col-definitionsText { min-width: 110px; }
    .col-examplesText { min-width: 120px; }
    .toolbar-right {
        flex-wrap: wrap;
    }
}
</style>

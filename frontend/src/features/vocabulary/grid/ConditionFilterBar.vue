<template>
    <div class="condition-filter-bar" :class="{ 'has-conditions': conditions.length > 0 }">
        <div class="filter-header">
            <div class="header-left">
                <button
                    v-if="conditions.length > 0"
                    class="logic-toggle"
                    :class="logicMode"
                    @click="logicMode = logicMode === 'and' ? 'or' : 'and'"
                >
                    {{ logicMode === 'and' ? 'AND' : 'OR' }}
                </button>
                <button class="add-filter-btn" @click="addCondition">
                    <Plus class="btn-icon" />
                    <span>添加筛选</span>
                </button>
            </div>
            <div class="header-right">
                <span class="result-count" :class="{ filtered: filteredCount !== totalCount }">
                    <span class="result-current">{{ filteredCount }}</span>
                    <span class="result-sep">/</span>
                    <span class="result-total">{{ totalCount }}</span>
                </span>
                <button
                    v-if="conditions.length > 0"
                    class="clear-btn"
                    @click="clearAll"
                >
                    清除全部
                </button>
            </div>
        </div>

        <transition-group
            v-if="conditions.length > 0"
            name="filter-row"
            tag="div"
            class="filter-rows"
        >
            <div v-for="(cond, idx) in conditions" :key="cond.id" class="filter-row">
                <span class="row-index">{{ idx + 1 }}</span>

                <select
                    class="filter-select field-select"
                    :value="cond.field"
                    @change="handleFieldChange(cond, ($event.target as HTMLSelectElement).value)"
                >
                    <option v-for="f in FIELD_DEFS" :key="f.key" :value="f.key">
                        {{ f.label }}
                    </option>
                </select>

                <select
                    class="filter-select operator-select"
                    :value="cond.operator"
                    @change="updateCondition(cond.id, { operator: ($event.target as HTMLSelectElement).value as any })"
                >
                    <option
                        v-for="op in getFieldOperators(cond.field)"
                        :key="op"
                        :value="op"
                    >
                        {{ OPERATOR_LABELS[op] }}
                    </option>
                </select>

                <template v-if="!VALUE_FREE_OPS.has(cond.operator)">
                    <template v-if="getFieldType(cond.field) === 'boolean'">
                        <select
                            class="filter-select value-input"
                            :value="cond.value"
                            @change="updateCondition(cond.id, { value: ($event.target as HTMLSelectElement).value })"
                        >
                            <option value="1">是</option>
                            <option value="0">否</option>
                        </select>
                    </template>
                    <template v-else-if="getFieldType(cond.field) === 'date'">
                        <input
                            type="date"
                            class="filter-input value-input"
                            :value="cond.value"
                            @input="updateCondition(cond.id, { value: ($event.target as HTMLInputElement).value })"
                        />
                        <template v-if="cond.operator === 'between'">
                            <span class="between-sep">—</span>
                            <input
                                type="date"
                                class="filter-input value-input"
                                :value="cond.value2"
                                @input="updateCondition(cond.id, { value2: ($event.target as HTMLInputElement).value })"
                            />
                        </template>
                    </template>
                    <template v-else-if="getFieldType(cond.field) === 'number'">
                        <input
                            type="number"
                            class="filter-input value-input"
                            :value="cond.value"
                            step="any"
                            placeholder="值"
                            @input="updateCondition(cond.id, { value: ($event.target as HTMLInputElement).value })"
                        />
                        <template v-if="cond.operator === 'between'">
                            <span class="between-sep">—</span>
                            <input
                                type="number"
                                class="filter-input value-input"
                                :value="cond.value2"
                                step="any"
                                placeholder="值"
                                @input="updateCondition(cond.id, { value2: ($event.target as HTMLInputElement).value })"
                            />
                        </template>
                    </template>
                    <template v-else>
                        <input
                            type="text"
                            class="filter-input value-input"
                            :value="cond.value"
                            placeholder="输入值..."
                            @input="updateCondition(cond.id, { value: ($event.target as HTMLInputElement).value })"
                        />
                    </template>
                </template>
                <span v-else class="value-placeholder">—</span>

                <button class="remove-btn" @click="removeCondition(cond.id)" title="移除此条件">
                    <X class="remove-icon" />
                </button>
            </div>
        </transition-group>
    </div>
</template>

<script setup lang="ts">
import { Plus, X } from 'lucide-vue-next'
import type { FilterCondition, FilterOperator, FieldType } from './useConditionFilters'
import { FIELD_DEFS, OPERATOR_LABELS, VALUE_FREE_OPS } from './useConditionFilters'

interface Props {
    conditions: FilterCondition[]
    filteredCount: number
    totalCount: number
}

defineProps<Props>()

const emit = defineEmits<{
    addCondition: []
    removeCondition: [id: string]
    updateCondition: [payload: { id: string; partial: Partial<FilterCondition> }]
    clearAll: []
}>()

const logicMode = defineModel<'and' | 'or'>('logicMode')

const FIELD_MAP = new Map(FIELD_DEFS.map(f => [f.key, f]))

function getFieldOperators(fieldKey: string): FilterOperator[] {
    return FIELD_MAP.get(fieldKey)?.operators ?? []
}

function getFieldType(fieldKey: string): FieldType {
    return FIELD_MAP.get(fieldKey)?.type ?? 'string'
}

function addCondition() {
    emit('addCondition')
}

function removeCondition(id: string) {
    emit('removeCondition', id)
}

function updateCondition(id: string, partial: Partial<FilterCondition>) {
    emit('updateCondition', { id, partial })
}

function clearAll() {
    emit('clearAll')
}

function handleFieldChange(cond: FilterCondition, newField: string) {
    const newFieldDef = FIELD_MAP.get(newField)
    const currentOps = newFieldDef?.operators ?? []
    const newOperator = currentOps.includes(cond.operator) ? cond.operator : currentOps[0]
    updateCondition(cond.id, {
        field: newField,
        operator: newOperator,
        value: '',
        value2: '',
    })
}
</script>

<style scoped>
.condition-filter-bar {
    background: var(--color-surface-card);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-default);
    margin-bottom: var(--space-3);
    transition: box-shadow var(--transition-normal);
}

.condition-filter-bar.has-conditions {
    box-shadow: var(--shadow-sm);
}

.filter-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    gap: var(--space-3);
}

.header-left,
.header-right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
}

.logic-toggle {
    padding: 2px 8px;
    border-radius: var(--radius-full);
    border: 1.5px solid var(--color-brand-primary);
    background: transparent;
    color: var(--color-brand-primary);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all var(--transition-fast);
    min-width: 36px;
    text-align: center;
    line-height: 1.6;
}

.logic-toggle:hover {
    background: var(--color-brand-primary);
    color: var(--primitive-paper-50);
    transform: scale(1.05);
}

.logic-toggle.or {
    border-color: var(--primitive-gold-400);
    color: var(--primitive-gold-600);
}
.logic-toggle.or:hover {
    background: var(--primitive-gold-500);
    color: var(--primitive-paper-50);
}

.add-filter-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border: 1px dashed var(--color-border-medium);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-tertiary);
    font-family: var(--font-ui);
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.add-filter-btn:hover {
    border-color: var(--color-brand-primary);
    border-style: solid;
    color: var(--color-brand-primary);
    background: var(--color-brand-primary-light);
}

.result-count {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    display: inline-flex;
    align-items: baseline;
    gap: 2px;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
}

.result-count.filtered {
    background: var(--color-brand-primary-light);
    color: var(--color-brand-primary);
}

.result-current {
    font-weight: var(--font-weight-semibold);
}

.result-sep {
    opacity: 0.4;
}

.result-total {
    opacity: 0.6;
}

.clear-btn {
    padding: 2px 8px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-muted);
    font-family: var(--font-ui);
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.clear-btn:hover {
    color: var(--color-danger);
    background: var(--color-delete-light);
}

/* ── Filter rows ── */

.filter-rows {
    padding: 0 var(--space-3) var(--space-2);
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.filter-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 0;
    border-radius: var(--radius-xs);
}

.row-index {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--color-text-muted);
    width: 14px;
    text-align: right;
    flex-shrink: 0;
    user-select: none;
}

/* ── Shared input/select styles ── */

.filter-select,
.filter-input {
    height: 26px;
    padding: 0 6px;
    border: 1px solid var(--primitive-paper-400);
    border-radius: var(--radius-xs);
    background: var(--primitive-paper-50);
    color: var(--color-text-primary);
    font-family: var(--font-ui);
    font-size: 11px;
    transition: all var(--transition-fast);
    box-sizing: border-box;
}

.filter-select:focus,
.filter-input:focus {
    outline: none;
    border-color: var(--color-brand-primary);
    box-shadow: 0 0 0 2px var(--color-brand-primary-light);
}

.field-select {
    min-width: 90px;
    font-weight: var(--font-weight-medium);
}

.operator-select {
    min-width: 76px;
    color: var(--color-text-secondary);
}

.value-input {
    min-width: 100px;
    flex: 1;
    max-width: 180px;
}

.value-placeholder {
    color: var(--color-text-muted);
    font-size: 11px;
    padding: 0 4px;
}

.between-sep {
    color: var(--color-text-muted);
    font-size: 10px;
    flex-shrink: 0;
}

.remove-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
    opacity: 0.5;
}

.filter-row:hover .remove-btn {
    opacity: 1;
}

.remove-btn:hover {
    background: var(--color-delete-light);
    color: var(--color-danger);
    opacity: 1;
}

.btn-icon {
    width: 12px;
    height: 12px;
}

.remove-icon {
    width: 12px;
    height: 12px;
}

/* ── Row transitions ── */

.filter-row-enter-active {
    transition: all 0.2s ease-out;
}
.filter-row-leave-active {
    transition: all 0.15s ease-in;
}
.filter-row-enter-from {
    opacity: 0;
    transform: translateY(-6px);
}
.filter-row-leave-to {
    opacity: 0;
    transform: translateX(10px);
}

/* ── Mobile ── */

@media (max-width: 768px) {
    .filter-header {
        padding: var(--space-2);
    }

    .filter-rows {
        padding: 0 var(--space-2) var(--space-2);
    }

    .filter-row {
        flex-wrap: wrap;
    }

    .field-select,
    .operator-select {
        min-width: 72px;
    }

    .value-input {
        min-width: 72px;
    }
}
</style>

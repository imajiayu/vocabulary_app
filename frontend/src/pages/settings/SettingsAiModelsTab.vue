<template>
  <div class="ai-models-tab">
    <!-- ═══════════════════════════════════════════
         文本调用方（词汇 / 课程 / 口语 / 写作）
         ═══════════════════════════════════════════ -->
    <section
      v-for="group in AI_CALLER_GROUPS"
      :key="group.key"
      :id="`section-${group.key}`"
      class="settings-card"
    >
      <div class="card-header" @click="toggleSection(group.key)">
        <div class="card-title-row">
          <span class="card-icon">
            <AppIcon :name="groupIcon(group.key)" />
          </span>
          <h2 class="card-title">{{ group.label }}</h2>
          <span class="card-badge">{{ callersByGroup(group.key).length }}</span>
          <span v-if="groupCustomCount(group.key) > 0" class="custom-badge">
            {{ groupCustomCount(group.key) }} 自定义
          </span>
          <span class="auto-save-tag">自动保存</span>
        </div>
        <span :class="['chevron', { expanded: expanded[group.key] }]">
          <AppIcon name="expand" />
        </span>
      </div>

      <div v-show="expanded[group.key]" class="card-body">
        <div class="setting-list">
          <div
            v-for="caller in callersByGroup(group.key)"
            :key="caller"
            class="setting-row setting-row--ai"
          >
            <div class="setting-info">
              <label class="setting-label">{{ AI_CALLERS[caller].label }}</label>
              <span class="setting-hint">
                {{ AI_CALLERS[caller].description || caller }}
              </span>
            </div>
            <div class="setting-control setting-control--ai">
              <span class="chip" :data-provider="inferProvider(resolvedModel(caller))">
                <span class="chip__dot" aria-hidden="true"></span>
                <span class="chip__id">{{ resolvedModel(caller) }}</span>
              </span>
              <CustomSelect
                :model-value="localTextModels[caller] ?? ''"
                :options="getTextOptions(caller)"
                class="ai-select"
                @update:model-value="(value) => onTextChange(caller, String(value))"
              >
                <template #trigger="{ selected }">
                  <div class="ai-select-trigger">
                    <div class="ai-select-trigger__main">
                      <span class="ai-select-trigger__label">{{ selected?.label ?? '请选择模型' }}</span>
                      <span v-if="selected?.meta" class="ai-select-trigger__meta">{{ selected.meta }}</span>
                    </div>
                  </div>
                </template>
                <template #option="{ option }">
                  <div class="ai-option">
                    <div class="ai-option__main">
                      <span class="ai-option__label">{{ option.label }}</span>
                      <span v-if="option.meta" class="ai-option__meta">{{ option.meta }}</span>
                    </div>
                  </div>
                </template>
              </CustomSelect>
            </div>
          </div>
        </div>

        <div v-if="groupCustomCount(group.key) > 0" class="card-footer">
          <button class="reset-link" @click="resetGroup(group.key)">恢复默认</button>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════
         语音（STT + TTS）
         ═══════════════════════════════════════════ -->
    <section id="section-voice" class="settings-card">
      <div class="card-header" @click="toggleSection('__voice__')">
        <div class="card-title-row">
          <span class="card-icon">
            <AppIcon name="volume" />
          </span>
          <h2 class="card-title">语音</h2>
          <span class="card-badge">2</span>
          <span v-if="voiceCustomCount > 0" class="custom-badge">
            {{ voiceCustomCount }} 自定义
          </span>
          <span class="auto-save-tag">自动保存</span>
        </div>
        <span :class="['chevron', { expanded: expanded.__voice__ }]">
          <AppIcon name="expand" />
        </span>
      </div>

      <div v-show="expanded.__voice__" class="card-body">
        <div class="setting-list">
          <!-- STT -->
          <div class="setting-row setting-row--ai">
            <div class="setting-info">
              <label class="setting-label">语音识别 (STT)</label>
              <span class="setting-hint">口语练习录音 → 文字</span>
            </div>
            <div class="setting-control setting-control--ai">
              <span class="chip" :data-provider="inferProvider(resolvedSttId)">
                <span class="chip__dot" aria-hidden="true"></span>
                <span class="chip__id">{{ resolvedSttId }}</span>
              </span>
              <CustomSelect
                :model-value="localSttModel"
                :options="sttOptions"
                class="ai-select"
                @update:model-value="(value) => onSttChange(String(value))"
              >
                <template #trigger="{ selected }">
                  <div class="ai-select-trigger">
                    <div class="ai-select-trigger__main">
                      <span class="ai-select-trigger__label">{{ selected?.label ?? '请选择模型' }}</span>
                      <span v-if="selected?.meta" class="ai-select-trigger__meta">{{ selected.meta }}</span>
                    </div>
                  </div>
                </template>
                <template #option="{ option }">
                  <div class="ai-option">
                    <div class="ai-option__main">
                      <span class="ai-option__label">{{ option.label }}</span>
                      <span v-if="option.meta" class="ai-option__meta">{{ option.meta }}</span>
                    </div>
                  </div>
                </template>
              </CustomSelect>
            </div>
          </div>

          <!-- TTS -->
          <div class="setting-row setting-row--ai">
            <div class="setting-info">
              <label class="setting-label">语音合成 (TTS)</label>
              <span class="setting-hint">非英语单词发音 / 课程朗读</span>
            </div>
            <div class="setting-control setting-control--ai">
              <span class="chip" :data-provider="inferProvider(resolvedTtsId)">
                <span class="chip__dot" aria-hidden="true"></span>
                <span class="chip__id">{{ resolvedTtsId }}</span>
              </span>
              <CustomSelect
                :model-value="localTtsModel"
                :options="ttsOptions"
                class="ai-select"
                @update:model-value="(value) => onTtsChange(String(value))"
              >
                <template #trigger="{ selected }">
                  <div class="ai-select-trigger">
                    <div class="ai-select-trigger__main">
                      <span class="ai-select-trigger__label">{{ selected?.label ?? '请选择模型' }}</span>
                      <span v-if="selected?.meta" class="ai-select-trigger__meta">{{ selected.meta }}</span>
                    </div>
                  </div>
                </template>
                <template #option="{ option }">
                  <div class="ai-option">
                    <div class="ai-option__main">
                      <span class="ai-option__label">{{ option.label }}</span>
                      <span v-if="option.meta" class="ai-option__meta">{{ option.meta }}</span>
                    </div>
                  </div>
                </template>
              </CustomSelect>
            </div>
          </div>
        </div>

        <div v-if="voiceCustomCount > 0" class="card-footer">
          <button class="reset-link" @click="resetVoice">恢复默认</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onBeforeUnmount, watch } from 'vue'
import {
  AI_CALLERS,
  AI_CALLER_GROUPS,
  AI_TEXT_MODELS,
  AI_STT_MODELS,
  AI_TTS_MODELS,
  AI_STT_DEFAULT,
  AI_TTS_DEFAULT,
  callersByGroup,
  listCallers,
  type AiCaller,
  type AiCallerGroup,
} from '@/shared/constants/ai-callers'
import CustomSelect from '@/shared/components/CustomSelect.vue'
import AppIcon, { type IconName } from '@/shared/components/controls/Icons.vue'
import { useSettings } from '@/shared/composables/useSettings'
import { invalidateAiModelPrefs } from '@/shared/services/aiModelPrefs'

const { settings, updateSettings } = useSettings()

// ── 本地反应式副本 ──
const localTextModels = reactive<Record<string, string>>({})
const localSttModel = ref<string>('')
const localTtsModel = ref<string>('')

function syncFromSettings() {
  const textSrc = settings.value?.aiModels ?? {}
  for (const caller of listCallers()) {
    localTextModels[caller] = textSrc[caller] ?? ''
  }
  localSttModel.value = settings.value?.aiSttModel ?? ''
  localTtsModel.value = settings.value?.aiTtsModel ?? ''
}
syncFromSettings()

watch(
  computed(() => [settings.value?.aiModels, settings.value?.aiSttModel, settings.value?.aiTtsModel]),
  () => syncFromSettings(),
  { deep: true }
)

// ── 折叠状态 ──
const expanded = reactive<Record<string, boolean>>({
  vocabulary: true,
  course: true,
  speaking: true,
  writing: true,
  __voice__: true,
})
function toggleSection(key: string) {
  expanded[key] = !expanded[key]
}

// ── Resolvers ──
function resolvedModel(caller: AiCaller): string {
  return (localTextModels[caller] || '').trim() || AI_CALLERS[caller].defaultModel
}
const resolvedSttId = computed(() => localSttModel.value.trim() || AI_STT_DEFAULT)
const resolvedTtsId = computed(() => localTtsModel.value.trim() || AI_TTS_DEFAULT)

interface AiSelectOption {
  value: string
  label: string
  meta: string
}

function formatDefaultLabel(modelId: string): string {
  return `默认 · ${providerLabel(inferProvider(modelId))}`
}

function getTextOptions(caller: AiCaller): AiSelectOption[] {
  return [
    {
      value: '',
      label: formatDefaultLabel(AI_CALLERS[caller].defaultModel),
      meta: formatTextOption(AI_CALLERS[caller].defaultModel),
    },
    ...AI_TEXT_MODELS.map(model => ({
      value: model.id,
      label: `${providerLabel(inferProvider(model.id))} · ${model.id}`,
      meta: `ctx ${model.context} · ↓${model.inputPrice} ↑${model.outputPrice}`,
    })),
  ]
}

const sttOptions = computed<AiSelectOption[]>(() => [
  {
    value: '',
    label: formatDefaultLabel(AI_STT_DEFAULT),
    meta: `${AI_STT_DEFAULT} · ${AI_STT_MODELS.find(model => model.id === AI_STT_DEFAULT)?.price ?? ''}`,
  },
  ...AI_STT_MODELS.map(model => ({
    value: model.id,
    label: `${providerLabel(inferProvider(model.id))} · ${model.id}`,
    meta: model.price,
  })),
])

const ttsOptions = computed<AiSelectOption[]>(() => [
  {
    value: '',
    label: formatDefaultLabel(AI_TTS_DEFAULT),
    meta: `${AI_TTS_DEFAULT} · ${AI_TTS_MODELS.find(model => model.id === AI_TTS_DEFAULT)?.price ?? ''}`,
  },
  ...AI_TTS_MODELS.map(model => ({
    value: model.id,
    label: `${providerLabel(inferProvider(model.id))} · ${model.id}`,
    meta: model.price,
  })),
])

// ── 分组统计 ──
function groupCustomCount(group: AiCallerGroup): number {
  return callersByGroup(group).filter(c => (localTextModels[c] || '').trim()).length
}
const voiceCustomCount = computed(() =>
  (localSttModel.value.trim() ? 1 : 0) + (localTtsModel.value.trim() ? 1 : 0)
)

// ── Provider 推断 + 颜色 ──
type Provider = 'claude' | 'gemini' | 'openai' | 'elevenlabs' | 'generic'
function inferProvider(modelId: string): Provider {
  const id = (modelId || '').toLowerCase()
  if (id.startsWith('claude')) return 'claude'
  if (id.startsWith('gemini')) return 'gemini'
  if (id.startsWith('gpt')) return 'openai'
  if (id.startsWith('elevenlabs/')) return 'elevenlabs'
  return 'generic'
}
function providerLabel(p: Provider): string {
  switch (p) {
    case 'claude': return 'Anthropic'
    case 'gemini': return 'Google'
    case 'openai': return 'OpenAI'
    case 'elevenlabs': return 'ElevenLabs'
    default: return '—'
  }
}

// Group → 图标
function groupIcon(key: AiCallerGroup): IconName {
  switch (key) {
    case 'vocabulary': return 'book-open'
    case 'course': return 'graduation-cap'
    case 'speaking': return 'mic'
    case 'writing': return 'pen'
  }
}

// 默认选项的文案
function formatTextOption(id: string): string {
  const m = AI_TEXT_MODELS.find(x => x.id === id)
  const provider = providerLabel(inferProvider(id))
  if (!m) return `${provider} · ${id}`
  return `${provider} · ${id} · ctx ${m.context} · ↓${m.inputPrice} ↑${m.outputPrice}`
}

// ── Change handlers ──
function onTextChange(caller: AiCaller, value: string) {
  localTextModels[caller] = value
  scheduleSave()
}
function onSttChange(value: string) {
  localSttModel.value = value
  scheduleSave()
}
function onTtsChange(value: string) {
  localTtsModel.value = value
  scheduleSave()
}

// ── Reset ──
function resetGroup(group: AiCallerGroup) {
  for (const caller of callersByGroup(group)) {
    localTextModels[caller] = ''
  }
  scheduleSave()
}
function resetVoice() {
  localSttModel.value = ''
  localTtsModel.value = ''
  scheduleSave()
}

// ── Debounced 自动保存 ──
let saveTimer: number | null = null
const SAVE_DEBOUNCE_MS = 300

function scheduleSave() {
  if (saveTimer !== null) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    saveTimer = null
    void doSave()
  }, SAVE_DEBOUNCE_MS)
}

async function doSave() {
  const textPayload: Record<string, string> = {}
  for (const caller of listCallers()) {
    const v = (localTextModels[caller] ?? '').trim()
    if (v) textPayload[caller] = v
  }
  await updateSettings({
    aiModels: textPayload,
    aiSttModel: localSttModel.value.trim(),
    aiTtsModel: localTtsModel.value.trim(),
  })
  invalidateAiModelPrefs()
}

onBeforeUnmount(() => {
  if (saveTimer !== null) {
    window.clearTimeout(saveTimer)
    saveTimer = null
    void doSave()
  }
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Provider 色板（用于 chip）
   ═══════════════════════════════════════════════════════════════════════════ */
.ai-models-tab {
  --p-claude-tint:  var(--primitive-copper-100);
  --p-claude-edge:  var(--primitive-copper-400);
  --p-claude-text:  var(--primitive-copper-600);
  --p-claude-bar:   var(--primitive-copper-500);

  --p-gemini-tint:  var(--primitive-olive-100);
  --p-gemini-edge:  var(--primitive-olive-400);
  --p-gemini-text:  var(--primitive-olive-700);
  --p-gemini-bar:   var(--primitive-olive-500);

  --p-openai-tint:  var(--primitive-ink-100);
  --p-openai-edge:  var(--primitive-ink-400);
  --p-openai-text:  var(--primitive-ink-700);
  --p-openai-bar:   var(--primitive-ink-600);

  --p-eleven-tint:  var(--primitive-gold-100);
  --p-eleven-edge:  var(--primitive-gold-400);
  --p-eleven-text:  var(--primitive-gold-700);
  --p-eleven-bar:   var(--primitive-gold-500);

  --p-generic-tint: var(--primitive-paper-300);
  --p-generic-edge: var(--primitive-paper-500);
  --p-generic-text: var(--primitive-ink-500);
  --p-generic-bar:  var(--primitive-paper-600);
}

[data-provider="claude"]     { --pv-tint: var(--p-claude-tint);  --pv-edge: var(--p-claude-edge);  --pv-text: var(--p-claude-text);  --pv-bar: var(--p-claude-bar); }
[data-provider="gemini"]     { --pv-tint: var(--p-gemini-tint);  --pv-edge: var(--p-gemini-edge);  --pv-text: var(--p-gemini-text);  --pv-bar: var(--p-gemini-bar); }
[data-provider="openai"]     { --pv-tint: var(--p-openai-tint);  --pv-edge: var(--p-openai-edge);  --pv-text: var(--p-openai-text);  --pv-bar: var(--p-openai-bar); }
[data-provider="elevenlabs"] { --pv-tint: var(--p-eleven-tint);  --pv-edge: var(--p-eleven-edge);  --pv-text: var(--p-eleven-text);  --pv-bar: var(--p-eleven-bar); }
[data-provider="generic"]    { --pv-tint: var(--p-generic-tint); --pv-edge: var(--p-generic-edge); --pv-text: var(--p-generic-text); --pv-bar: var(--p-generic-bar); }

/* ═══════════════════════════════════════════════════════════════════════════
   与 SettingsPage 其它 tab 一致：settings-card / card-header / card-body
   ═══════════════════════════════════════════════════════════════════════════ */
.settings-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
  overflow: visible;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  user-select: none;
  transition: background var(--transition-fast);
}
.card-header:hover {
  background: var(--color-bg-secondary);
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.card-icon {
  display: inline-flex;
  align-items: center;
  color: var(--color-primary);
}
.card-icon :deep(.icon) {
  width: 16px;
  height: 16px;
}
.card-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  font-family: var(--font-serif);
  color: var(--color-text-primary);
  margin: 0;
}
.card-badge {
  font-size: 11px;
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  padding: 1px 7px;
  border-radius: var(--radius-full);
  font-family: var(--font-data);
}
.custom-badge {
  font-size: 10px;
  font-weight: var(--font-weight-medium);
  color: var(--primitive-copper-700);
  background: var(--primitive-copper-100);
  border: 1px solid var(--primitive-copper-200);
  padding: 1px 7px;
  border-radius: var(--radius-full);
  font-family: var(--font-data);
  letter-spacing: 0.02em;
}
.auto-save-tag {
  font-size: 10px;
  font-weight: var(--font-weight-medium);
  color: var(--color-state-success);
  background: var(--color-state-success-light);
  padding: 2px 7px;
  border-radius: var(--radius-full);
  letter-spacing: 0.3px;
}

.chevron {
  display: inline-flex;
  align-items: center;
  color: var(--color-text-tertiary);
  transition: transform 0.2s;
}
.chevron :deep(.icon) {
  width: 16px;
  height: 16px;
}
.chevron.expanded {
  transform: rotate(90deg);
}

.card-body {
  padding: 0 var(--space-4) var(--space-4);
  border-top: 1px solid var(--color-bg-tertiary);
}

.card-footer {
  display: flex;
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-bg-tertiary);
  margin-top: var(--space-1);
}
.reset-link {
  background: none;
  border: none;
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: var(--space-1) 0;
  transition: color var(--transition-fast);
}
.reset-link:hover {
  color: var(--color-primary);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Setting rows
   ═══════════════════════════════════════════════════════════════════════════ */
.setting-list {
  display: flex;
  flex-direction: column;
}
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-bg-tertiary);
  gap: var(--space-4);
}
.setting-row:last-child {
  border-bottom: none;
}

.setting-row--ai {
  align-items: flex-start;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
  padding-top: 4px;
}
.setting-label {
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}
.setting-hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.setting-control {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}
.setting-control--ai {
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  min-width: 260px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Chip（当前 model 胶囊）
   ═══════════════════════════════════════════════════════════════════════════ */
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 8px;
  background: var(--pv-tint);
  border: 1px solid var(--pv-edge);
  border-radius: var(--radius-full);
  max-width: 260px;
}
.chip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--pv-bar);
  flex-shrink: 0;
}
.chip__id {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  color: var(--pv-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-select {
  width: 100%;
  min-width: 260px;
}
.ai-select :deep(.custom-select-trigger) {
  padding: 8px 10px;
  align-items: flex-start;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-sm);
}
.ai-select :deep(.custom-select-trigger:hover) {
  border-color: var(--primitive-copper-300);
}
.ai-select :deep(.custom-select-dropdown) {
  z-index: 20;
}
.ai-select :deep(.select-option) {
  padding: 0;
}

.ai-select-trigger,
.ai-option {
  width: 100%;
  min-width: 0;
}

.ai-select-trigger__main,
.ai-option__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ai-select-trigger__label,
.ai-option__label {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-primary);
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-select-trigger__meta,
.ai-option__meta {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-tertiary);
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-option {
  padding: 10px 14px;
}

.ai-select :deep(.select-option.selected) .ai-option__label {
  font-weight: 600;
}

.ai-select :deep(.dropdown-arrow) {
  margin-top: 2px;
}

.ai-select :deep(.custom-select-trigger),
.ai-select-trigger__label,
.ai-select-trigger__meta,
.ai-option__label,
.ai-option__meta {
  appearance: none;
  font-family: var(--font-mono);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Responsive
   ═══════════════════════════════════════════════════════════════════════════ */
@media (max-width: 768px) {
  .setting-row--ai {
    flex-direction: column;
    align-items: stretch;
  }
  .setting-control--ai {
    align-items: stretch;
    min-width: 0;
  }
  .chip {
    max-width: none;
    align-self: flex-start;
  }
  .ai-select {
    min-width: 0;
  }
}
</style>

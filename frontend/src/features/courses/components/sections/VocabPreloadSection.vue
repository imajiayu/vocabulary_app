<template>
  <section class="course-vocab-section">
    <!-- 操作栏 -->
    <div class="course-vocab-actions">
      <button
        class="course-add-all-btn"
        :class="{ done: allAdded, empty: !selectedSource }"
        :disabled="!canAdd || adding"
        @click="addAll"
      >
        <span class="course-add-all-icon" aria-hidden="true">
          <svg v-if="allAdded" viewBox="0 0 16 16" fill="none"><path d="m4 8.5 2.5 2.5L12 5.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" /></svg>
          <svg v-else-if="adding" class="spinner" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.75" stroke-dasharray="8 20" stroke-linecap="round" /></svg>
          <svg v-else viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" /></svg>
        </span>
        <span>{{ addBtnText }}</span>
      </button>

      <div class="course-vocab-status">
        <div class="course-vocab-progress">
          <div class="course-vocab-progress-track">
            <div class="course-vocab-progress-bar" :style="{ width: progressPct + '%' }" />
          </div>
          <div class="course-vocab-progress-meta">
            <span class="stat-number">{{ addedCount }}</span>
            <span class="course-vocab-progress-sep">/</span>
            <span class="stat-number">{{ totalCount }}</span>
            <span class="course-vocab-progress-label">已加入词本</span>
          </div>
        </div>

        <p v-if="!selectedSource" class="course-vocab-hint">
          请先在顶部导航栏的「词本」选择目标词本。
        </p>
        <p v-else class="course-vocab-hint">
          当前词本：<strong>{{ selectedSource }}</strong>
        </p>
      </div>
    </div>

    <!-- 词汇组 -->
    <template v-for="(group, gi) in section.groups" :key="gi">
      <h2 v-if="group.heading">{{ group.heading }}</h2>
      <div class="course-vocab-grid">
        <div
          v-for="w in group.words"
          :key="w.word"
          class="course-vocab-row"
          :class="{ added: isAdded(w.word), failed: isFailed(w.word) }"
          :data-word="w.word"
        >
          <span :class="wordClass" :data-def="w.def">{{ w.word }}</span>
          <span class="course-vocab-def">{{ w.def }}</span>
          <span class="course-vocab-status-icon">
            <template v-if="isAdded(w.word)">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 8.5 2.5 2.5L12 5.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </template>
            <template v-else-if="isFailed(w.word)">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" /></svg>
            </template>
            <button
              v-else
              class="course-vocab-add-one"
              :disabled="adding || !selectedSource"
              :title="selectedSource ? '添加到 ' + selectedSource : '请先在顶部选择词本'"
              @click.stop="addOne(w)"
            >
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" /></svg>
            </button>
          </span>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted, watch } from 'vue'
import type { VocabPreloadSection, VocabWord } from '../../types/lesson'
import type { CourseConfig } from '../../types/course'
import { useCourseVocabAdd } from '../../composables/useCourseVocabAdd'
import { useWordEditorStore } from '@/features/vocabulary/stores/wordEditor'

const props = defineProps<{
  section: VocabPreloadSection
}>()

const config = inject<CourseConfig>('courseConfig')!
const wordClass = inject<string>('courseWordClass', 'uk-word')

const {
  selectedSource,
  loadSources,
  fetchExistingWords,
  addWords
} = useCourseVocabAdd(config)

const wordEditorStore = useWordEditorStore()

const addedWords = ref<Set<string>>(new Set())
const failedWords = ref<Set<string>>(new Set())
const adding = ref(false)

const allWords = computed(() =>
  props.section.groups.flatMap(g => g.words)
)

const totalCount = computed(() => allWords.value.length)
const addedCount = computed(() => addedWords.value.size)
const allAdded = computed(() =>
  totalCount.value > 0 && addedCount.value >= totalCount.value
)
const canAdd = computed(() => !!selectedSource.value && !allAdded.value)
const progressPct = computed(() =>
  totalCount.value > 0 ? Math.round(addedCount.value / totalCount.value * 100) : 0
)

const addBtnText = computed(() => {
  if (!selectedSource.value) return '请先选择词本'
  if (allAdded.value) return '全部已添加'
  if (adding.value) return '添加中…'
  return '一键添加到背单词 App'
})

function isAdded(word: string) { return addedWords.value.has(word) }
function isFailed(word: string) { return failedWords.value.has(word) }

async function checkExisting() {
  if (!selectedSource.value) {
    addedWords.value = new Set()
    failedWords.value = new Set()
    return
  }
  const normalizedMap = new Map<string, string>()
  for (const w of allWords.value) {
    normalizedMap.set(w.word.normalize('NFC').trim().toLowerCase(), w.word)
  }
  const existing = await fetchExistingWords([...normalizedMap.keys()])
  const next = new Set<string>()
  for (const [norm, original] of normalizedMap) {
    if (existing.has(norm)) next.add(original)
  }
  addedWords.value = next
  failedWords.value = new Set()
}

async function addOne(w: VocabWord) {
  if (addedWords.value.has(w.word) || !selectedSource.value) return
  // 与点击单词一致：先查再决定（命中 → 查看；未命中 → 创建态预填）
  await wordEditorStore.openForCourse(w.word, w.def, {
    source: selectedSource.value,
    lang: config.lang,
  })
}

// 编辑器关闭后重新核对该课词汇的入库状态（创建成功 / 已存在 / 用户取消都覆盖）
watch(() => wordEditorStore.isOpen, (open, prev) => {
  if (prev && !open) checkExisting()
})

async function addAll() {
  if (!selectedSource.value) return
  adding.value = true
  const pending = allWords.value.filter(w => !addedWords.value.has(w.word))
  const result = await addWords(pending.map(w => ({ word: w.word, def: w.def })))

  const newAdded = new Set(addedWords.value)
  const newFailed = new Set(failedWords.value)
  for (const w of result.added) newAdded.add(w)
  for (const w of result.existed) newAdded.add(w)
  for (const w of result.failed) newFailed.add(w)
  addedWords.value = newAdded
  failedWords.value = newFailed

  adding.value = false
}

onMounted(async () => {
  await loadSources()
  await checkExisting()
})

// 顶部 TopBar 切换 source 时重新检查
watch(selectedSource, () => {
  checkExisting()
})
</script>

<style scoped>
.course-vocab-section { margin: 8px 0 16px; }

/* ── 操作栏 ── */
.course-vocab-actions {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 24px;
  padding: 24px 28px;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-md);
  margin: 24px 0 32px;
}

.course-add-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 13px 24px;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  color: var(--course-accent-on);
  background: var(--course-accent);
  border: 1px solid var(--course-accent);
  border-radius: var(--radius-default);
  cursor: pointer;
  transition: background 0.18s ease, transform 0.1s ease, box-shadow 0.18s ease;
  line-height: 1;
  white-space: nowrap;
}

.course-add-all-btn:hover:not(:disabled) {
  background: var(--course-accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 8px 24px -12px var(--course-accent-shadow);
}

.course-add-all-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.course-add-all-btn.done {
  background: var(--color-state-success);
  border-color: var(--color-state-success);
  opacity: 0.95;
  cursor: default;
}

.course-add-all-btn.empty {
  background: transparent;
  color: var(--color-text-tertiary);
  border: 1px dashed var(--color-border-strong);
}

.course-add-all-icon {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
}

.course-add-all-icon svg { width: 14px; height: 14px; }
.course-add-all-icon .spinner { animation: course-vocab-spin 0.9s linear infinite; }

@keyframes course-vocab-spin { to { transform: rotate(360deg); } }

/* ── 状态（进度条 + 提示） ── */
.course-vocab-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.course-vocab-progress {
  display: flex;
  align-items: center;
  gap: 14px;
}

.course-vocab-progress-track {
  flex: 1;
  height: 4px;
  background: var(--color-border-light);
  border-radius: 999px;
  overflow: hidden;
  min-width: 60px;
}

.course-vocab-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--course-accent), var(--course-accent-glow));
  border-radius: 999px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.course-vocab-progress-meta {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-size: 13px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.course-vocab-progress-meta .stat-number {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.course-vocab-progress-sep { color: var(--color-text-tertiary); }

.course-vocab-progress-label {
  margin-left: 4px;
  font-size: 11.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
}

.course-vocab-hint {
  font-size: 12.5px;
  color: var(--color-text-tertiary);
  font-style: italic;
  font-family: var(--font-serif);
  margin: 0;
  line-height: 1.5;
}

.course-vocab-hint strong {
  color: var(--course-accent-strong);
  font-weight: 600;
  font-style: normal;
  padding: 1px 6px;
  background: var(--course-accent-soft);
  border-radius: 4px;
}

/* ── 词汇栅格 ── */
.course-vocab-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 8px;
  margin: 12px 0 24px;
}

[data-course="legal-english"] .course-vocab-grid {
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

.course-vocab-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-sm);
  transition: border-color 0.18s ease, background 0.18s ease;
}

.course-vocab-row:hover {
  border-color: var(--course-accent-soft-strong);
  background: var(--color-surface-elevated);
}

.course-vocab-row.added {
  border-color: var(--color-state-success);
  background: var(--color-state-success-light);
}

.course-vocab-row.failed {
  border-color: var(--color-state-error);
  background: var(--color-state-error-light);
}

.course-vocab-row :deep(.uk-word),
.course-vocab-row :deep(.term) {
  min-width: 110px;
  flex-shrink: 0;
}

.course-vocab-def {
  flex: 1;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.5;
  min-width: 0;
}

.course-vocab-status-icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

.course-vocab-row.added .course-vocab-status-icon { color: var(--color-state-success); }
.course-vocab-row.failed .course-vocab-status-icon { color: var(--color-state-error); }

.course-vocab-status-icon svg { width: 14px; height: 14px; }

.course-vocab-add-one {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--course-accent-soft-strong);
  border-radius: 50%;
  background: transparent;
  color: var(--course-accent);
  cursor: pointer;
  padding: 0;
  transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease, border-color 0.15s ease;
}

.course-vocab-add-one:hover:not(:disabled) {
  background: var(--course-accent);
  border-color: var(--course-accent);
  color: var(--course-accent-on);
  transform: scale(1.1);
}

.course-vocab-add-one:disabled { opacity: 0.4; cursor: not-allowed; }
.course-vocab-add-one svg { width: 11px; height: 11px; }

@media (max-width: 768px) {
  .course-vocab-actions {
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 18px 20px;
  }

  .course-add-all-btn { width: 100%; justify-content: center; }
  .course-vocab-grid { grid-template-columns: 1fr; }
  [data-course="legal-english"] .course-vocab-grid { grid-template-columns: 1fr; }
}
</style>

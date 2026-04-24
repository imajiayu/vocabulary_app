<template>
  <PageLayout
    with-topbar
    show-top-bar
    show-home-button
    max-width="880px"
    content-class="ai-review-content"
  >
    <template #topbar-center>
      <span class="page-title">AI 复习</span>
    </template>

    <div class="rail-wrapper">
      <DateRail
        v-model="selectedDate"
        :session-dates="sessionDatesSet"
        :history-dates="historyDatesSet"
        @need-load="loadRangeMeta"
      />
    </div>

    <section class="body">
      <Loading v-if="isLoading" text="加载中..." />

      <template v-else-if="session">
        <div class="toolbar" :key="'bar-' + selectedDate">
          <button
            class="regen-btn"
            :disabled="isGenerating"
            :aria-busy="isGenerating"
            @click="regenerate"
          >
            <svg class="regen-icon" :class="{ spin: isGenerating }" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path d="M13.5 3.5v3h-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M13 6.5A5 5 0 1 0 13 9.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
            <span>{{ isGenerating ? '生成中…' : '重新生成' }}</span>
          </button>
        </div>

        <div class="q-list" :key="'list-' + selectedDate">
          <QuestionCard
            v-for="(q, i) in session.questions"
            :key="selectedDate + '-' + i"
            :question="q"
            :index="i"
            :style="{ '--delay': i * 60 + 'ms' }"
            class="q-item"
          />
        </div>
      </template>

      <template v-else-if="hasHistoryToday">
        <div class="archive-card" :key="'empty-gen-' + selectedDate">
          <div class="archive-corner archive-corner-tl" aria-hidden="true" />
          <div class="archive-corner archive-corner-tr" aria-hidden="true" />
          <div class="archive-corner archive-corner-bl" aria-hidden="true" />
          <div class="archive-corner archive-corner-br" aria-hidden="true" />

          <div class="archive-eyebrow">UNFILED · {{ selectedDate }}</div>
          <div class="archive-title">{{ formatDateLabel(selectedDate) }}</div>
          <p class="archive-desc">
            当天共 <strong>{{ historyWordCount ?? '—' }}</strong> 个单词复习记录，尚未生成 AI 复习。
          </p>

          <button
            class="primary-btn"
            :disabled="isGenerating"
            :aria-busy="isGenerating"
            @click="generate"
          >
            <svg v-if="!isGenerating" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M8 2.5v11M2.5 8h11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
            <svg v-else class="spin" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="18 30" />
            </svg>
            <span>{{ isGenerating ? '正在生成…' : '生成 AI 复习' }}</span>
          </button>
          <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        </div>
      </template>

      <template v-else>
        <div class="empty-soft" :key="'empty-' + selectedDate">
          <div class="empty-mark" aria-hidden="true">·</div>
          <div class="empty-title">{{ formatDateLabel(selectedDate) }}</div>
          <p class="empty-desc">当天没有复习记录。</p>
        </div>
      </template>
    </section>
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PageLayout from '@/shared/components/layout/PageLayout.vue'
import Loading from '@/shared/components/feedback/Loading.vue'
import DateRail from '@/features/vocabulary/ai-review/DateRail.vue'
import QuestionCard from '@/features/vocabulary/ai-review/QuestionCard.vue'
import { AiReviewApi, type AiReviewSession } from '@/shared/api/aiReview'
import { generateAiReviewSession } from '@/shared/services/aiReviewService'
import { getUtcToday } from '@/shared/utils/date'
import { logger } from '@/shared/utils/logger'

const log = logger.create('AiReviewPage')

const selectedDate = ref(getUtcToday())
const session = ref<AiReviewSession | null>(null)
const isLoading = ref(false)
const isGenerating = ref(false)
const errorMsg = ref<string | null>(null)

const sessionDatesSet = ref<Set<string>>(new Set())
const historyDatesSet = ref<Set<string>>(new Set())
const loadedRanges = ref<Array<[string, string]>>([])

const hasHistoryToday = computed(() => historyDatesSet.value.has(selectedDate.value))
const historyWordCount = ref<number | null>(null)

function formatDateLabel(d: string): string {
  return `${d.slice(0, 4)} / ${d.slice(5, 7)} / ${d.slice(8, 10)} (UTC)`
}

async function loadRangeMeta(start: string, end: string) {
  if (loadedRanges.value.some(([s, e]) => s === start && e === end)) return
  loadedRanges.value.push([start, end])
  try {
    const [sessions, histories] = await Promise.all([
      AiReviewApi.listSessionDates(start, end),
      AiReviewApi.listHistoryDates(start, end),
    ])
    for (const d of sessions) sessionDatesSet.value.add(d)
    for (const d of histories) historyDatesSet.value.add(d)
  } catch (e) {
    log.error('加载日期元数据失败:', e)
  }
}

async function loadSessionFor(date: string) {
  isLoading.value = true
  errorMsg.value = null
  try {
    const [s] = await Promise.all([AiReviewApi.getSession(date)])
    session.value = s
    if (!s) {
      if (!historyDatesSet.value.has(date)) {
        const hs = await AiReviewApi.listHistoryDates(date, date)
        if (hs.length > 0) historyDatesSet.value.add(date)
      }
      if (historyDatesSet.value.has(date)) {
        const rows = await AiReviewApi.getDailyReviewWords(date)
        historyWordCount.value = rows.length
      } else {
        historyWordCount.value = 0
      }
    } else {
      historyWordCount.value = null
    }
  } catch (e) {
    log.error('加载 session 失败:', e)
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    isLoading.value = false
  }
}

async function generate() {
  if (isGenerating.value) return
  isGenerating.value = true
  errorMsg.value = null
  try {
    const s = await generateAiReviewSession(selectedDate.value)
    session.value = s
    sessionDatesSet.value.add(selectedDate.value)
  } catch (e) {
    log.error('生成失败:', e)
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    isGenerating.value = false
  }
}

async function regenerate() {
  await generate()
}

watch(selectedDate, (d) => {
  void loadSessionFor(d)
}, { immediate: true })
</script>

<style scoped>
.page-title {
  font-family: var(--font-serif);
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--primitive-ink-800);
  letter-spacing: 0.02em;
}

.ai-review-content {
  gap: 0.5rem;
}

/* ——— Sticky Rail ——— */
.rail-wrapper {
  position: sticky;
  top: var(--topbar-height, 48px);
  background: var(--color-surface-page);
  z-index: 3;
  margin-inline: calc(-1 * var(--space-2));
  padding-inline: var(--space-2);
}
.rail-wrapper::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -10px;
  height: 10px;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    rgba(15, 23, 42, 0.06) 0%,
    rgba(15, 23, 42, 0) 100%
  );
  opacity: 0.7;
}

/* ——— Body ——— */
.body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1rem 0 3rem;
}

/* ——— Toolbar ——— */
.toolbar {
  display: flex;
  justify-content: flex-end;
}

.regen-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border: 1px solid var(--primitive-paper-400);
  background: var(--primitive-paper-100);
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  color: var(--primitive-ink-600);
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease,
    background-color 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease;
}
.regen-btn:hover:not(:disabled) {
  border-color: var(--primitive-copper-400);
  color: var(--primitive-copper-600);
  background: var(--primitive-copper-50);
  box-shadow: var(--shadow-sm);
}
.regen-btn:active:not(:disabled) { transform: scale(0.97); }
.regen-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.regen-icon { transition: transform 0.25s ease; }
.regen-btn:hover:not(:disabled) .regen-icon { transform: rotate(-42deg); }
.regen-icon.spin { animation: spin 0.9s linear infinite; }
.primary-btn .spin {
  animation: spin 0.9s linear infinite;
  transform-origin: center;
}

/* ——— Question list stagger ——— */
.q-list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}
.q-item {
  animation: q-in 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: var(--delay, 0ms);
}

/* ——— Archive card (gen empty) ——— */
.archive-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 2rem 2.5rem;
  margin: 0.5rem 0;
  text-align: center;
  background:
    repeating-linear-gradient(
      45deg,
      transparent 0 9px,
      rgba(184, 131, 74, 0.025) 9px 10px
    ),
    var(--primitive-paper-100);
  border: 1px solid var(--primitive-paper-400);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  animation: archive-in 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.archive-corner {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--primitive-copper-400);
  opacity: 0.6;
}
.archive-corner-tl { top: 10px; left: 10px; border-right: 0; border-bottom: 0; }
.archive-corner-tr { top: 10px; right: 10px; border-left: 0; border-bottom: 0; }
.archive-corner-bl { bottom: 10px; left: 10px; border-right: 0; border-top: 0; }
.archive-corner-br { bottom: 10px; right: 10px; border-left: 0; border-top: 0; }

.archive-eyebrow {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.24em;
  color: var(--primitive-copper-500);
  margin-bottom: 0.125rem;
}
.archive-title {
  font-family: var(--font-serif);
  font-size: 1.375rem;
  font-weight: 600;
  color: var(--primitive-ink-800);
}
.archive-desc {
  margin: 0 0 0.5rem;
  color: var(--primitive-ink-500);
  font-size: 0.9375rem;
  line-height: 1.65;
  max-width: 36ch;
}
.archive-desc strong {
  color: var(--primitive-copper-600);
  font-weight: 700;
  font-family: var(--font-serif);
}

.primary-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.375rem;
  padding: 0.6875rem 1.5rem;
  border: none;
  border-radius: var(--radius-md);
  background: var(--gradient-primary);
  color: var(--primitive-paper-50);
  font-family: var(--font-sans);
  font-size: 0.9375rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(153, 107, 61, 0.25);
  transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
}
.primary-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 22px rgba(153, 107, 61, 0.32);
}
.primary-btn:active:not(:disabled) { transform: translateY(0); }
.primary-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.error-msg {
  margin: 0.5rem 0 0;
  color: var(--primitive-brick-500);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
}

/* ——— Empty soft ——— */
.empty-soft {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 4rem 1rem;
  text-align: center;
  opacity: 0;
  animation: fade-in 0.45s ease 0.1s forwards;
}
.empty-mark {
  font-family: var(--font-serif);
  font-size: 2.5rem;
  line-height: 0.7;
  color: var(--primitive-paper-500);
  letter-spacing: 0.4em;
  margin-bottom: 0.5rem;
}
.empty-title {
  font-family: var(--font-serif);
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--primitive-ink-600);
}
.empty-desc {
  margin: 0;
  color: var(--primitive-ink-400);
  font-size: 0.875rem;
  font-style: italic;
}

/* ——— Keyframes ——— */
@keyframes q-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes archive-in {
  from { opacity: 0; transform: scale(0.98); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes fade-in {
  to { opacity: 1; }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ——— Mobile ——— */
@media (max-width: 768px) {
  .archive-card { padding: 2.25rem 1.25rem; }
  .archive-title { font-size: 1.125rem; }
  .regen-btn span { display: none; }
  .regen-btn { padding: 0.5rem; }
}
</style>

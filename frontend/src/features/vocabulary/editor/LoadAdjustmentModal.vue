<template>
  <Teleport to="body">
    <Transition name="load-modal">
      <div
        v-if="adj.isOpen.value"
        class="modal-overlay"
        @click.self="!adj.isSaving.value && adj.close()"
        @touchmove.prevent
        @wheel.prevent
      >
        <div
          class="modal-content"
          @touchmove.stop
          @wheel.stop
        >
          <!-- Header -->
          <div class="modal-header">
            <div class="modal-header-left">
              <span class="modal-header-accent"></span>
              <h2 class="modal-title">负荷调整</h2>
            </div>
            <button
              v-if="!adj.isSaving.value"
              class="close-button"
              aria-label="关闭"
              @click="adj.close()"
            >
              <XIcon class="close-icon" />
            </button>
          </div>

          <!-- Loading -->
          <div v-if="adj.isLoading.value" class="modal-loading">
            <div class="loading-spinner"></div>
            <span>加载调度数据...</span>
          </div>

          <!-- Body -->
          <template v-else>
            <!-- Tab bar - pill style with sliding indicator -->
            <div class="tab-bar">
              <div class="tab-container">
                <div
                  class="tab-indicator"
                  :style="{ transform: adj.activeTab.value === 'spell' ? 'translateX(100%)' : 'translateX(0)' }"
                ></div>
                <button
                  class="tab-btn"
                  :class="{ active: adj.activeTab.value === 'review' }"
                  @click="adj.switchTab('review')"
                >
                  复习
                </button>
                <button
                  class="tab-btn"
                  :class="{ active: adj.activeTab.value === 'spell' }"
                  @click="adj.switchTab('spell')"
                >
                  拼写
                </button>
              </div>
            </div>

            <!-- Toolbar -->
            <div class="toolbar">
              <label class="limit-label">
                <span class="limit-label-text">每日上限</span>
                <input
                  type="number"
                  class="limit-input"
                  :value="adj.dailyLimit.value"
                  min="1"
                  max="200"
                  @change="handleLimitChange"
                />
              </label>
              <div class="toolbar-actions">
                <button class="tool-btn" @click="handleFlatten">
                  <TrendingDownIcon :size="14" />
                  <span>削峰</span>
                </button>
                <button class="tool-btn" @click="handleCondense">
                  <ShrinkIcon :size="14" />
                  <span>浓缩</span>
                </button>
                <button class="tool-btn tool-btn--subtle" @click="adj.reset()">
                  <RotateCcwIcon :size="14" />
                  <span>重置</span>
                </button>
              </div>
            </div>

            <!-- Table -->
            <div class="bucket-table" ref="tableRef">
              <div
                v-for="(bucket, index) in visibleBuckets"
                :key="bucket.date"
                class="bucket-row"
                :class="{
                  'bucket-row--today': bucket.isToday,
                  'bucket-row--over': bucket.words.length > adj.dailyLimit.value,
                  'bucket-row--changed': bucket.words.length !== bucket.originalCount,
                  'bucket-row--empty': bucket.words.length === 0,
                }"
                :style="{ '--row-index': index }"
              >
                <!-- Date -->
                <div class="bucket-date">
                  <span class="date-text">{{ formatDate(bucket.date) }}</span>
                  <span class="weekday-text">{{ bucket.isToday ? '今天' : bucket.weekday }}</span>
                </div>

                <!-- Count (editable) -->
                <div class="bucket-count">
                  <button
                    class="count-btn"
                    :disabled="bucket.words.length <= 0"
                    @click="adj.setDayTarget(bucket.originalIndex, bucket.words.length - 1)"
                    aria-label="减少"
                  >−</button>
                  <span class="count-value" :class="{ 'count-value--zero': bucket.words.length === 0 }">
                    {{ bucket.words.length }}
                  </span>
                  <button
                    class="count-btn"
                    @click="adj.setDayTarget(bucket.originalIndex, bucket.words.length + 1)"
                    aria-label="增加"
                  >+</button>
                </div>

                <!-- Bar -->
                <div class="bucket-bar-wrapper">
                  <!-- Cap reference line -->
                  <div
                    v-if="capLinePosition < 100"
                    class="cap-line"
                    :style="{ left: capLinePosition + '%' }"
                  ></div>
                  <!-- Bar fill -->
                  <div
                    class="bucket-bar"
                    :class="[
                      barColorClass,
                      { 'bucket-bar--over': bucket.words.length > adj.dailyLimit.value }
                    ]"
                    :style="{ width: barWidth(bucket.words.length) }"
                  ></div>
                  <!-- Original position marker -->
                  <div
                    v-if="bucket.originalCount !== bucket.words.length && bucket.originalCount > 0"
                    class="original-marker"
                    :style="{ left: barWidth(bucket.originalCount) }"
                  >
                    <div class="original-marker-line"></div>
                  </div>
                </div>

                <!-- Delta -->
                <div class="bucket-delta">
                  <span
                    v-if="bucket.words.length !== bucket.originalCount"
                    class="delta-badge"
                    :class="{
                      'delta-badge--positive': bucket.words.length > bucket.originalCount,
                      'delta-badge--negative': bucket.words.length < bucket.originalCount,
                    }"
                  >
                    {{ bucket.words.length > bucket.originalCount ? '+' : '' }}{{ bucket.words.length - bucket.originalCount }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="modal-footer">
              <div class="footer-summary">
                <template v-if="adj.hasChanges.value">
                  <span class="summary-count">{{ adj.totalMoved.value }}</span>
                  <span class="summary-text">个单词将被重新调度</span>
                </template>
                <span v-else class="summary-text summary-text--muted">暂无变更</span>
              </div>
              <div class="footer-actions">
                <button class="btn-cancel" @click="adj.close()" :disabled="adj.isSaving.value">
                  取消
                </button>
                <button
                  class="btn-apply"
                  :disabled="!adj.hasChanges.value || adj.isSaving.value"
                  @click="handleApply"
                >
                  <span v-if="adj.isSaving.value" class="btn-spinner"></span>
                  {{ adj.isSaving.value ? '应用中...' : '应用' }}
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { X as XIcon, TrendingDown as TrendingDownIcon, Minimize2 as ShrinkIcon, RotateCcw as RotateCcwIcon } from 'lucide-vue-next'
import { useLoadAdjustment } from './composables'

const adj = useLoadAdjustment()
const tableRef = ref<HTMLElement | null>(null)

defineExpose({
  open: (source: string) => adj.open(source),
})

// 过滤掉无数据的尾部空行，保留中间空行和今天的行
const visibleBuckets = computed(() => {
  const all = adj.buckets.value
  // 找到最后一个有数据 或 有 originalCount 的行
  let lastNonEmpty = 0
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].words.length > 0 || all[i].originalCount > 0 || all[i].isToday) {
      lastNonEmpty = i
      break
    }
  }
  // 多显示 3 行空行用于浓缩操作
  const end = Math.min(all.length, lastNonEmpty + 4)
  return all.slice(0, end).map((b, i) => ({ ...b, originalIndex: i }))
})

// 柱状条最大值 = max(实际最大值, dailyLimit) — 确保 cap line 始终可见
const maxCount = computed(() => {
  const counts = adj.buckets.value.map(b => b.words.length)
  return Math.max(1, adj.dailyLimit.value, ...counts)
})

// Cap 参考线位置（百分比）
const capLinePosition = computed(() =>
  Math.min(100, (adj.dailyLimit.value / maxCount.value) * 100)
)

const barColorClass = computed(() =>
  adj.activeTab.value === 'review' ? 'bar-review' : 'bar-spell'
)

function barWidth(count: number): string {
  if (count === 0) return '0%'
  return `${Math.min(100, (count / maxCount.value) * 100)}%`
}

function formatDate(dateStr: string): string {
  return dateStr.slice(5) // "MM-DD"
}

function handleLimitChange(e: Event) {
  const val = parseInt((e.target as HTMLInputElement).value)
  if (!isNaN(val) && val > 0) {
    adj.dailyLimit.value = val
  }
}

function handleFlatten() {
  adj.flattenPeaks(adj.dailyLimit.value)
}

function handleCondense() {
  adj.condense(adj.dailyLimit.value)
}

async function handleApply() {
  const ok = await adj.applyChanges()
  if (ok) {
    adj.close()
  } else {
    alert('应用失败，请重试')
  }
}

// 锁定背景滚动
watch(() => adj.isOpen.value, (open) => {
  if (open) {
    const scrollY = window.scrollY
    const hadScrollbar = document.documentElement.scrollHeight > window.innerHeight
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    if (hadScrollbar) {
      document.documentElement.style.overflowY = 'scroll'
    }
    document.body.setAttribute('data-scroll-y', scrollY.toString())
  } else {
    const scrollY = parseInt(document.body.getAttribute('data-scroll-y') || '0')
    document.body.style.overflow = ''
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.width = ''
    document.documentElement.style.overflowY = ''
    window.scrollTo(0, scrollY)
    document.body.removeAttribute('data-scroll-y')
  }
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   LoadAdjustmentModal - Editorial Study 风格
   温暖纸质感 · 铜褐强调 · 学术数据可视化
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Overlay ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 32, 44, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: var(--space-6);
  touch-action: none;
  overflow: hidden;
}

.modal-content {
  background: var(--color-surface-card);
  border-radius: var(--radius-lg);
  max-width: 40rem;
  width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.04),
    0 20px 50px -10px rgba(26, 32, 44, 0.18);
  border: 1px solid var(--color-border-light);
  overflow: hidden;
}

/* ── Header ── */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
  background: var(--color-surface-card);
}

.modal-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.modal-header-accent {
  width: 3px;
  height: 18px;
  background: var(--gradient-primary);
  border-radius: 2px;
  flex-shrink: 0;
}

.modal-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

.close-button {
  width: 32px;
  height: 32px;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-default);
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.close-button:hover {
  background-color: var(--color-bg-tertiary);
}

.close-button:focus-visible {
  outline: 2px solid var(--color-brand-primary);
  outline-offset: 2px;
}

.close-icon {
  width: 18px;
  height: 18px;
  color: var(--color-text-tertiary);
  transition: color var(--transition-fast);
}

.close-button:hover .close-icon {
  color: var(--color-text-primary);
}

/* ── Loading ── */
.modal-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-16) var(--space-6);
  font-family: var(--font-ui);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.loading-spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid var(--primitive-paper-400);
  border-top-color: var(--color-brand-primary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Pill Tabs — 渐变滑动指示器（与 SwitchTab 风格一致）
   ═══════════════════════════════════════════════════════════════════════════ */

.tab-bar {
  padding: var(--space-3) var(--space-6);
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.tab-container {
  position: relative;
  display: flex;
  gap: 4px;
  background: rgba(0, 0, 0, 0.05);
  padding: 4px;
  border-radius: var(--radius-default);
  width: fit-content;
}

.tab-indicator {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: calc(100% - 8px);
  background: var(--gradient-primary);
  border-radius: var(--radius-sm);
  z-index: 1;
  box-shadow: 0 1px 6px rgba(153, 107, 61, 0.2);
  transition:
    transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-btn {
  position: relative;
  flex: 1;
  padding: 6px 20px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  z-index: 2;
  transition: color 0.2s ease;
  white-space: nowrap;
}

.tab-btn:hover:not(.active) {
  color: var(--color-text-primary);
}

.tab-btn.active {
  color: white;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Toolbar
   ═══════════════════════════════════════════════════════════════════════════ */

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-6);
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
  gap: var(--space-3);
}

.limit-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.limit-label-text {
  font-family: var(--font-ui);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.limit-input {
  width: 3.75rem;
  padding: 5px var(--space-2);
  font-family: var(--font-data);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
  border: 1.5px solid var(--primitive-paper-400);
  border-radius: var(--radius-sm);
  background: var(--color-surface-card);
  color: var(--color-text-primary);
  text-align: center;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.limit-input:focus {
  outline: none;
  border-color: var(--color-brand-primary);
  box-shadow: 0 0 0 3px rgba(153, 107, 61, 0.12);
}

/* 隐藏数字输入的 spinner */
.limit-input::-webkit-inner-spin-button,
.limit-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.limit-input { -moz-appearance: textfield; }

.toolbar-actions {
  display: flex;
  gap: var(--space-2);
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0.375rem 0.75rem;
  font-family: var(--font-ui);
  font-size: 0.8125rem;
  font-weight: var(--font-weight-medium);
  color: var(--primitive-copper-600);
  background: var(--primitive-paper-50);
  border: 1px solid var(--primitive-paper-400);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 32px;
  white-space: nowrap;
}

.tool-btn:hover {
  border-color: var(--primitive-copper-300);
  color: var(--primitive-copper-700);
  background: var(--primitive-paper-100);
}

.tool-btn:active {
  transform: translateY(1px);
}

.tool-btn--subtle {
  color: var(--color-text-secondary);
}

.tool-btn--subtle:hover {
  color: var(--color-text-primary);
  border-color: var(--primitive-paper-500);
  background: var(--primitive-paper-200);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Bucket Table — 数据可视化表格
   ═══════════════════════════════════════════════════════════════════════════ */

.bucket-table {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-1) var(--space-6);
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar-thumb) transparent;
}

.bucket-table::-webkit-scrollbar {
  width: 6px;
}

.bucket-table::-webkit-scrollbar-track {
  background: transparent;
}

.bucket-table::-webkit-scrollbar-thumb {
  background: var(--color-scrollbar-thumb);
  border-radius: var(--radius-full);
}

.bucket-table::-webkit-scrollbar-thumb:hover {
  background: var(--color-scrollbar-thumb-hover);
}

.bucket-row {
  display: grid;
  grid-template-columns: 5.5rem 5.25rem 1fr 2.5rem;
  align-items: center;
  gap: var(--space-3);
  padding: 7px var(--space-2);
  border-radius: var(--radius-xs);
  margin: 0 calc(-1 * var(--space-2));
  transition:
    background 0.15s ease,
    opacity 0.15s ease;
}

.bucket-row:hover {
  background: var(--primitive-paper-200);
}

/* 状态行 — 覆盖 hover */
.bucket-row--today {
  background: var(--primitive-copper-50);
}

.bucket-row--today:hover {
  background: var(--primitive-copper-100);
}

.bucket-row--over {
  background: var(--primitive-brick-50);
}

.bucket-row--over:hover {
  background: var(--primitive-brick-100);
}

.bucket-row--changed:not(.bucket-row--over):not(.bucket-row--today) {
  background: var(--primitive-gold-50);
}

.bucket-row--changed:not(.bucket-row--over):not(.bucket-row--today):hover {
  background: var(--primitive-gold-100);
}

.bucket-row--empty {
  opacity: 0.5;
}

.bucket-row--empty:hover {
  opacity: 0.8;
}

/* ── Date column ── */
.bucket-date {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.date-text {
  font-family: var(--font-data);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

.weekday-text {
  font-family: var(--font-ui);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.bucket-row--today .weekday-text {
  color: var(--color-brand-primary);
  font-weight: var(--font-weight-semibold);
}

/* ── Count column ── */
.bucket-count {
  display: flex;
  align-items: center;
  gap: 2px;
}

.count-btn {
  width: 1.375rem;
  height: 1.375rem;
  min-width: 1.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-data);
  font-size: var(--font-size-base);
  color: var(--color-text-tertiary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-xs);
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: all var(--transition-fast);
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.count-btn:hover:not(:disabled) {
  color: var(--color-brand-primary);
  background: var(--color-brand-primary-light);
  border-color: rgba(153, 107, 61, 0.15);
}

.count-btn:active:not(:disabled) {
  transform: scale(0.9);
}

.count-btn:disabled {
  opacity: 0.2;
  cursor: default;
}

.count-value {
  font-family: var(--font-data);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);
  min-width: 1.75rem;
  text-align: center;
}

.count-value--zero {
  color: var(--color-text-muted);
}

/* ── Bar column ── */
.bucket-bar-wrapper {
  position: relative;
  height: 18px;
  background: var(--primitive-paper-300);
  border-radius: var(--radius-sm);
  overflow: visible;
}

/* Cap 参考线 */
.cap-line {
  position: absolute;
  top: -1px;
  bottom: -1px;
  width: 1px;
  background: var(--primitive-ink-300);
  opacity: 0.4;
  z-index: 2;
  pointer-events: none;
}

.cap-line::after {
  content: '';
  position: absolute;
  top: -3px;
  left: -2px;
  width: 5px;
  height: 5px;
  background: var(--primitive-ink-300);
  opacity: 0.5;
  border-radius: var(--radius-full);
}

.bucket-bar {
  height: 100%;
  border-radius: var(--radius-sm);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 0;
  position: relative;
}

/* 复习柱 — 铜褐渐变 */
.bar-review {
  background: linear-gradient(90deg, var(--primitive-copper-200), var(--primitive-copper-300));
}

/* 拼写柱 — 橄榄绿渐变 */
.bar-spell {
  background: linear-gradient(90deg, var(--primitive-olive-200), var(--primitive-olive-300));
}

/* 超限柱 — 砖红渐变 */
.bucket-bar--over {
  background: linear-gradient(90deg, var(--primitive-brick-300), var(--primitive-brick-400)) !important;
}

/* 原始位置标记 */
.original-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 3;
  pointer-events: none;
}

.original-marker-line {
  position: absolute;
  top: -2px;
  bottom: -2px;
  left: -1px;
  width: 2px;
  background: var(--primitive-ink-500);
  opacity: 0.35;
  border-radius: 1px;
}

/* ── Delta column ── */
.bucket-delta {
  font-family: var(--font-data);
  font-size: var(--font-size-xs);
  text-align: right;
  min-width: 0;
}

.delta-badge {
  display: inline-block;
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-medium);
  letter-spacing: -0.01em;
}

.delta-badge--positive {
  color: var(--primitive-olive-600);
  background: var(--primitive-olive-50);
}

.delta-badge--negative {
  color: var(--primitive-brick-500);
  background: var(--primitive-brick-50);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Footer
   ═══════════════════════════════════════════════════════════════════════════ */

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border-light);
  flex-shrink: 0;
  background: var(--color-surface-card);
}

.footer-summary {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.summary-count {
  font-family: var(--font-data);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
  color: var(--color-brand-primary);
}

.summary-text {
  font-family: var(--font-ui);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.summary-text--muted {
  color: var(--color-text-muted);
}

.footer-actions {
  display: flex;
  gap: var(--space-3);
}

.btn-cancel {
  padding: 0.375rem 0.75rem;
  font-family: var(--font-ui);
  font-size: 0.8125rem;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  background: transparent;
  border: 1px solid var(--primitive-paper-400);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 32px;
}

.btn-cancel:hover:not(:disabled) {
  border-color: var(--primitive-paper-500);
  background: var(--primitive-paper-200);
  color: var(--color-text-primary);
}

.btn-cancel:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn-apply {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.375rem 1rem;
  font-family: var(--font-ui);
  font-size: 0.8125rem;
  font-weight: var(--font-weight-medium);
  color: var(--primitive-paper-50);
  background: var(--gradient-primary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 32px;
  box-shadow: 0 2px 8px rgba(153, 107, 61, 0.2);
}

.btn-apply:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(153, 107, 61, 0.3);
  transform: translateY(-1px);
}

.btn-apply:active:not(:disabled) {
  transform: translateY(0);
}

.btn-apply:disabled {
  opacity: 0.5;
  cursor: default;
  box-shadow: none;
}

.btn-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: var(--radius-full);
  animation: spin 0.7s linear infinite;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Entry/Exit Transitions
   ═══════════════════════════════════════════════════════════════════════════ */

.load-modal-enter-active {
  transition: opacity 0.25s ease;
}

.load-modal-leave-active {
  transition: opacity 0.2s ease;
}

.load-modal-enter-active .modal-content {
  transition: transform 0.3s cubic-bezier(0.34, 1.2, 0.64, 1), opacity 0.25s ease;
}

.load-modal-leave-active .modal-content {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.load-modal-enter-from {
  opacity: 0;
}

.load-modal-enter-from .modal-content {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}

.load-modal-leave-to {
  opacity: 0;
}

.load-modal-leave-to .modal-content {
  opacity: 0;
  transform: scale(0.97) translateY(4px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mobile Responsive
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .modal-overlay {
    padding: 0;
    align-items: stretch;
    height: 100vh;
    height: 100dvh;
    min-height: -webkit-fill-available;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .modal-content {
    max-width: 100%;
    width: 100%;
    margin: 0;
    border-radius: 0;
    border: none;
    max-height: 100vh;
    max-height: 100dvh;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }

  .modal-header {
    padding: 0.875rem 1rem;
    padding-top: calc(0.875rem + env(safe-area-inset-top));
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .modal-header-accent {
    height: 14px;
  }

  .modal-title {
    font-size: var(--font-size-lg);
  }

  .tab-bar {
    padding: var(--space-3) var(--space-4);
  }

  .toolbar {
    flex-wrap: wrap;
    padding: var(--space-3) var(--space-4);
  }

  .tool-btn span {
    display: none;
  }

  .tool-btn {
    padding: 0.375rem;
    min-width: 32px;
    justify-content: center;
  }

  .bucket-table {
    padding: var(--space-1) var(--space-4);
  }

  .bucket-row {
    grid-template-columns: 4.5rem 4.5rem 1fr 2.25rem;
    gap: var(--space-2);
    padding: 6px var(--space-1);
    margin: 0 calc(-1 * var(--space-1));
  }

  .modal-footer {
    padding: var(--space-3) var(--space-4);
    padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom));
  }

  .close-button {
    width: 2.5rem;
    height: 2.5rem;
    min-width: 2.5rem;
    min-height: 2.5rem;
  }

  .close-icon {
    width: 20px;
    height: 20px;
  }

  /* Mobile transition: slide up from bottom */
  .load-modal-enter-from .modal-content {
    transform: translateY(100%);
    opacity: 1;
  }

  .load-modal-leave-to .modal-content {
    transform: translateY(100%);
    opacity: 1;
  }

  .load-modal-enter-active .modal-content {
    transition: transform 0.35s cubic-bezier(0.34, 1.1, 0.64, 1);
  }

  .load-modal-leave-active .modal-content {
    transition: transform 0.25s ease-in;
  }
}

/* ── Landscape ── */
@media (max-height: 500px) and (orientation: landscape) {
  .modal-content {
    max-height: 100vh;
    max-height: 100dvh;
    height: 100vh;
    height: 100dvh;
  }

  .modal-header {
    padding: 0.625rem 1rem;
    padding-top: calc(0.625rem + env(safe-area-inset-top));
  }
}

/* ── Safari fallback ── */
@supports not (height: 100dvh) {
  @media (max-width: 768px) {
    .modal-overlay {
      height: -webkit-fill-available;
    }

    .modal-content {
      max-height: -webkit-fill-available;
      height: -webkit-fill-available;
    }
  }
}
</style>

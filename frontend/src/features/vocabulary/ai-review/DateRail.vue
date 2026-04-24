<template>
  <div class="rail-frame">
    <button
      class="rail-nav rail-nav-left"
      :class="{ hidden: !canScrollLeft }"
      type="button"
      aria-label="向前滚动"
      @click="scrollBy(-1)"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M10.5 2 4 8l6.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <div class="rail-viewport">
      <div class="date-rail" ref="railEl" @scroll="onScroll">
        <template v-for="(item, idx) in items" :key="keyFor(item, idx)">
          <div v-if="item.kind === 'month'" class="month-divider" aria-hidden="true">
            <span class="month-label">{{ item.label }}</span>
          </div>
          <button
            v-else
            :class="[
              'date-chip',
              {
                active: item.date === modelValue,
                today: item.date === today,
                'has-session': sessionDates.has(item.date!),
                'has-history': !sessionDates.has(item.date!) && historyDates.has(item.date!),
                weekend: isWeekend(item.date!),
              },
            ]"
            type="button"
            :aria-label="ariaLabel(item.date!)"
            :aria-current="item.date === modelValue ? 'date' : undefined"
            @click="$emit('update:modelValue', item.date!)"
          >
            <span class="chip-weekday">{{ weekdayLabel(item.date!) }}</span>
            <span class="chip-day">{{ dayNum(item.date!) }}</span>
            <span class="chip-state" aria-hidden="true">
              <span v-if="sessionDates.has(item.date!)" class="state-dot state-session" />
              <span v-else-if="historyDates.has(item.date!)" class="state-dot state-history" />
              <span v-else class="state-dot state-empty" />
            </span>
            <span v-if="item.date === today" class="today-stamp" aria-hidden="true">TODAY</span>
          </button>
        </template>
      </div>
    </div>

    <button
      class="rail-nav rail-nav-right"
      :class="{ hidden: !canScrollRight }"
      type="button"
      aria-label="向后滚动"
      @click="scrollBy(1)"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M5.5 2 12 8l-6.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, nextTick } from 'vue'
import { getUtcToday, addDays } from '@/shared/utils/date'

interface Props {
  modelValue: string
  sessionDates: Set<string>
  historyDates: Set<string>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'needLoad', startDate: string, endDate: string): void
}>()

const today = getUtcToday()

const earliest = ref(addDays(today, -29))
const dates = computed(() => {
  const list: string[] = []
  let d = earliest.value
  while (d <= today) {
    list.push(d)
    d = addDays(d, 1)
  }
  return list
})

type RailItem =
  | { kind: 'date'; date: string }
  | { kind: 'month'; label: string }

function keyFor(item: RailItem, idx: number): string {
  if (item.kind === 'date') return `d-${item.date}`
  return `m-${item.label}-${idx}`
}

const items = computed<RailItem[]>(() => {
  const out: RailItem[] = []
  let lastMonth = ''
  for (const d of dates.value) {
    const monthKey = d.slice(0, 7)
    if (monthKey !== lastMonth) {
      if (lastMonth !== '') {
        out.push({ kind: 'month', label: monthLabel(d) })
      }
      lastMonth = monthKey
    }
    out.push({ kind: 'date', date: d })
  }
  return out
})

const railEl = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

function updateScrollState() {
  const el = railEl.value
  if (!el) return
  const maxScroll = el.scrollWidth - el.clientWidth
  canScrollLeft.value = el.scrollLeft > 4
  canScrollRight.value = el.scrollLeft < maxScroll - 4
}

function scrollToToday() {
  nextTick(() => {
    if (!railEl.value) return
    railEl.value.scrollLeft = railEl.value.scrollWidth
    updateScrollState()
  })
}

onMounted(() => {
  scrollToToday()
  emit('needLoad', earliest.value, today)
  window.addEventListener('resize', updateScrollState)
})

const onScroll = () => {
  if (!railEl.value) return
  updateScrollState()
  if (railEl.value.scrollLeft < 60) {
    const prevEarliest = earliest.value
    const newEarliest = addDays(prevEarliest, -30)
    earliest.value = newEarliest
    nextTick(() => {
      if (!railEl.value) return
      // 每 chip 约 64 + 8 gap；30 天预估偏移量
      railEl.value.scrollLeft += 30 * 72
      updateScrollState()
    })
    emit('needLoad', newEarliest, addDays(prevEarliest, -1))
  }
}

function scrollBy(direction: -1 | 1) {
  if (!railEl.value) return
  const step = Math.max(200, Math.floor(railEl.value.clientWidth * 0.7))
  railEl.value.scrollBy({ left: direction * step, behavior: 'smooth' })
}

watch(
  () => props.modelValue,
  () => {
    if (props.modelValue < earliest.value) {
      earliest.value = props.modelValue
    }
  },
)

const dayNum = (d: string) => Number(d.slice(8, 10))
const weekdayLabel = (d: string): string => {
  const [y, m, day] = d.split('-').map(Number)
  // UTC 对齐（该 d 来自 UTC today），Date.UTC 构造后 getUTCDay
  const dt = new Date(Date.UTC(y, m - 1, day))
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return names[dt.getUTCDay()]
}
const isWeekend = (d: string): boolean => {
  const wd = weekdayLabel(d)
  return wd === 'Sat' || wd === 'Sun'
}
const monthLabel = (d: string): string => {
  const m = Number(d.slice(5, 7))
  const names = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return names[m] ?? ''
}
const ariaLabel = (d: string): string => {
  return `${d} ${weekdayLabel(d)}${d === today ? '（今天）' : ''}`
}
</script>

<style scoped>
.rail-frame {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 0;
  padding-inline: 2px;
}

.rail-viewport {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
}

.date-rail {
  display: flex;
  align-items: stretch;
  gap: 8px;
  overflow-x: auto;
  padding: 0.5rem 8px 0.75rem;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  scroll-behavior: auto;
}
.date-rail::-webkit-scrollbar { display: none; }

/* ——— Nav buttons (desktop only) ——— */
.rail-nav {
  flex: 0 0 auto;
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-inline: 2px;
  padding: 0;
  border: 1px solid var(--primitive-paper-400);
  background: var(--primitive-paper-100);
  color: var(--primitive-ink-500);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease,
    background-color 0.15s ease, opacity 0.2s ease, transform 0.15s ease;
  box-shadow: var(--shadow-sm);
}
.rail-nav:hover {
  color: var(--primitive-copper-600);
  border-color: var(--primitive-copper-300);
  background: var(--primitive-copper-50);
}
.rail-nav:active { transform: scale(0.94); }
.rail-nav.hidden {
  opacity: 0;
  pointer-events: none;
  transform: scale(0.85);
}

/* ——— Month divider ——— */
.month-divider {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  padding-block: 6px;
}
.month-divider::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 10px;
  bottom: 10px;
  width: 1px;
  background: repeating-linear-gradient(
    to bottom,
    var(--primitive-paper-500) 0 3px,
    transparent 3px 6px
  );
}
.month-label {
  position: relative;
  transform: rotate(-90deg);
  transform-origin: center;
  font-family: var(--font-serif);
  font-size: 0.6875rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--primitive-ink-400);
  background: var(--color-surface-page);
  padding: 2px 4px;
  white-space: nowrap;
}

/* ——— Date chip ——— */
.date-chip {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  width: 58px;
  padding: 7px 6px 10px;
  border: 1px solid var(--primitive-paper-400);
  background: var(--primitive-paper-100);
  border-radius: 10px;
  cursor: pointer;
  font-family: var(--font-sans);
  color: var(--primitive-ink-700);
  transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1),
    border-color 0.18s ease, background-color 0.18s ease,
    box-shadow 0.18s ease;
}
.date-chip:hover {
  transform: translateY(-1px);
  border-color: var(--primitive-copper-300);
  box-shadow: var(--shadow-sm);
}
.date-chip.weekend { background: var(--primitive-paper-200); }

.chip-weekday {
  font-size: 0.625rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--primitive-ink-400);
  margin-bottom: 2px;
  line-height: 1.1;
}
.chip-day {
  font-family: var(--font-serif);
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.1;
  color: var(--primitive-ink-800);
  font-variant-numeric: tabular-nums;
}

/* state dot */
.chip-state {
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 6px;
}
.state-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.state-dot.state-empty {
  width: 4px;
  height: 1px;
  border-radius: 0;
  background: var(--primitive-paper-500);
}
.state-dot.state-history { background: var(--primitive-olive-400); }
.state-dot.state-session { background: var(--primitive-copper-500); box-shadow: 0 0 0 2px rgba(153, 107, 61, 0.14); }

/* ——— Today ——— */
.date-chip.today:not(.active) {
  border-color: var(--primitive-copper-400);
  border-style: dashed;
}
.today-stamp {
  position: absolute;
  top: -7px;
  right: -6px;
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 700;
  font-size: 0.5rem;
  letter-spacing: 0.18em;
  padding: 1px 5px 1.5px;
  color: var(--primitive-copper-600);
  background: var(--primitive-paper-100);
  border: 1px solid var(--primitive-copper-400);
  border-radius: 3px;
  transform: rotate(4deg);
  pointer-events: none;
}

/* ——— Active ——— */
.date-chip.active {
  background: var(--gradient-primary);
  border-color: transparent;
  box-shadow: 0 6px 18px rgba(153, 107, 61, 0.28),
    inset 0 0 0 1px rgba(255, 253, 247, 0.22);
  transform: translateY(-1px);
}
.date-chip.active .chip-day { color: var(--primitive-paper-50); }
.date-chip.active .chip-weekday { color: rgba(255, 253, 247, 0.78); }
.date-chip.active .state-dot.state-session { background: var(--primitive-paper-50); box-shadow: 0 0 0 2px rgba(255, 253, 247, 0.28); }
.date-chip.active .state-dot.state-history { background: rgba(255, 253, 247, 0.85); }
.date-chip.active .state-dot.state-empty { background: rgba(255, 253, 247, 0.4); }
.date-chip.active.today .today-stamp {
  background: var(--primitive-paper-50);
  color: var(--primitive-copper-600);
  border-color: rgba(255, 253, 247, 0.6);
}

/* ——— Mobile ——— */
@media (max-width: 768px) {
  .rail-nav { display: none; }
  .date-chip { width: 52px; padding: 6px 4px 9px; }
  .chip-day { font-size: 1rem; }
  .chip-weekday { font-size: 0.5625rem; }
}
</style>

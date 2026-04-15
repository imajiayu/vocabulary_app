<template>
  <Teleport to="body">
    <Transition name="course-pop">
      <div
        v-if="visible"
        ref="popoverRef"
        class="course-word-popover"
        :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
        :data-course="courseTheme"
      >
        <div class="course-word-popover-arrow" :class="{ bottom: arrowBottom }" aria-hidden="true" />

        <div class="course-word-popover-head">
          <span class="course-word-popover-word">{{ word }}</span>
          <button
            class="course-word-popover-close"
            aria-label="关闭"
            @click.stop="hidePopover"
          >
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 3 6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
          </button>
        </div>

        <div class="course-word-popover-def">{{ definition }}</div>

        <div v-if="selectedSource" class="course-word-popover-meta">
          <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 12A1.5 1.5 0 0 1 4.5 10.5H12M4.5 1H12v12H4.5A1.5 1.5 0 0 1 3 11.5v-9A1.5 1.5 0 0 1 4.5 1Z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>加入到 <strong>{{ selectedSource }}</strong></span>
        </div>
        <div v-else class="course-word-popover-meta course-word-popover-meta-empty">
          请先在顶部选择词本
        </div>

        <div class="course-word-popover-actions">
          <button
            class="course-word-popover-btn"
            title="发音"
            @click.stop="onSpeak"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 6v4h2.5L9 12.5V3.5L5.5 6H3Z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M11.5 5.5a3 3 0 0 1 0 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            </svg>
            <span>发音</span>
          </button>
          <button
            class="course-word-popover-btn course-word-popover-btn-primary"
            :class="{ added: addStatus === 'added' }"
            :disabled="!selectedSource || addStatus === 'adding' || addStatus === 'added'"
            title="添加到词本"
            @click.stop="onAdd"
          >
            <svg v-if="addStatus === 'added'" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m4 8.5 2.5 2.5L12 5.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg v-else-if="addStatus === 'adding'" class="spinner" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.6" stroke-dasharray="8 18" stroke-linecap="round" />
            </svg>
            <svg v-else viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
            </svg>
            <span>{{ addBtnText }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, inject, nextTick } from 'vue'
import type { CourseConfig } from '../../types/course'
import { useCourseTts } from '../../composables/useCourseTts'
import { useCourseVocabAdd } from '../../composables/useCourseVocabAdd'

const config = inject<CourseConfig>('courseConfig')!
const courseTheme = config.theme
const { speak } = useCourseTts(config)
const { selectedSource, loadSources, addWords } = useCourseVocabAdd(config)

const visible = ref(false)
const popoverRef = ref<HTMLElement | null>(null)
const word = ref('')
const definition = ref('')
const pos = ref({ x: 0, y: 0 })
const arrowBottom = ref(false)
const addStatus = ref<'idle' | 'adding' | 'added' | 'failed'>('idle')

const addBtnText = computed(() => {
  switch (addStatus.value) {
    case 'adding': return '添加中'
    case 'added': return '已加入'
    case 'failed': return '失败'
    default: return '加入词本'
  }
})

function onSpeak() { speak(word.value) }

async function onAdd() {
  if (!selectedSource.value) return
  addStatus.value = 'adding'
  const def = definition.value && definition.value !== '无释义' ? definition.value : undefined
  const result = await addWords([{ word: word.value, def }])
  if (result.added.includes(word.value) || result.existed.includes(word.value)) {
    addStatus.value = 'added'
  } else {
    addStatus.value = 'failed'
    setTimeout(() => { addStatus.value = 'idle' }, 1500)
  }
}

function showPopover(el: HTMLElement) {
  const text = el.textContent?.trim()
    .replace(/[.,!?;:…—–\-"«»()"。，！？：；]/g, '').trim() || ''
  if (!text) return

  word.value = text
  definition.value = el.getAttribute('data-def') || '无释义'
  addStatus.value = 'idle'
  visible.value = true

  nextTick(() => {
    const rect = el.getBoundingClientRect()
    const popW = popoverRef.value?.offsetWidth || 240
    const popH = popoverRef.value?.offsetHeight || 150

    let left = rect.left + rect.width / 2 - popW / 2
    let top = rect.top - popH - 12
    arrowBottom.value = false

    if (left < 8) left = 8
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8
    if (top < 8) {
      top = rect.bottom + 12
      arrowBottom.value = true
    }

    pos.value = { x: left + window.scrollX, y: top + window.scrollY }
  })
}

function hidePopover() {
  visible.value = false
}

let activeEl: HTMLElement | null = null

function onDocClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const wordEl = target.closest(`.${config.wordClass}, .tts-word`) as HTMLElement | null

  if (wordEl) {
    e.stopPropagation()
    // 在 <label>（quiz 选项）内部点词时，阻止 label 默认行为误选 radio
    if (wordEl.closest('label')) e.preventDefault()
    if (activeEl === wordEl) {
      hidePopover()
      activeEl = null
    } else {
      showPopover(wordEl)
      activeEl = wordEl
    }
    return
  }

  if (popoverRef.value && !popoverRef.value.contains(target)) {
    hidePopover()
    activeEl = null
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    hidePopover()
    activeEl = null
  }
}

onMounted(() => {
  loadSources()
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.course-word-popover {
  position: absolute;
  z-index: 1000;
  min-width: 220px;
  max-width: 300px;
  padding: 14px 16px 12px;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-md);
  box-shadow:
    0 12px 32px -8px rgba(15, 23, 42, 0.18),
    0 4px 12px -4px rgba(15, 23, 42, 0.1);
  font-family: var(--font-sans);
}

.course-word-popover-arrow {
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 10px;
  height: 10px;
  background: var(--color-surface-elevated);
  border-left: 1px solid var(--color-border-medium);
  border-top: 1px solid var(--color-border-medium);
}

.course-word-popover-arrow.bottom {
  top: auto;
  bottom: -6px;
  transform: translateX(-50%) rotate(225deg);
}

.course-word-popover-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.course-word-popover-word {
  font-family: var(--font-serif);
  font-weight: 600;
  font-size: 17px;
  color: var(--course-accent-strong);
  letter-spacing: -0.005em;
  line-height: 1.3;
  word-break: break-word;
}

.course-word-popover-close {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: var(--color-text-tertiary);
  background: transparent;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease;
}

.course-word-popover-close:hover {
  background: var(--course-accent-soft);
  color: var(--course-accent-strong);
}

.course-word-popover-close svg { width: 10px; height: 10px; }

.course-word-popover-def {
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--color-text-secondary);
  margin-bottom: 10px;
  font-family: var(--font-serif);
  font-style: italic;
}

.course-word-popover-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--color-text-tertiary);
  margin-bottom: 10px;
  padding: 5px 9px;
  background: var(--color-surface-page);
  border-radius: 999px;
  border: 1px solid var(--color-border-light);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.course-word-popover-meta svg {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
  color: var(--course-accent);
}

.course-word-popover-meta strong {
  color: var(--course-accent-strong);
  font-weight: 600;
  margin: 0 2px;
}

.course-word-popover-meta-empty {
  background: transparent;
  font-style: italic;
  border-style: dashed;
}

.course-word-popover-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.course-word-popover-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 1;
  padding: 8px 10px;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease, transform 0.1s ease;
  line-height: 1;
}

.course-word-popover-btn:hover:not(:disabled) {
  border-color: var(--course-accent);
  color: var(--course-accent-strong);
  background: var(--course-accent-soft);
}

.course-word-popover-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.course-word-popover-btn svg {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

.course-word-popover-btn .spinner { animation: course-pop-spin 0.9s linear infinite; }

@keyframes course-pop-spin { to { transform: rotate(360deg); } }

.course-word-popover-btn-primary {
  background: var(--course-accent);
  border-color: var(--course-accent);
  color: var(--course-accent-on);
}

.course-word-popover-btn-primary:hover:not(:disabled) {
  background: var(--course-accent-hover);
  border-color: var(--course-accent-hover);
  color: var(--course-accent-on);
  transform: translateY(-1px);
}

.course-word-popover-btn-primary.added {
  background: var(--color-state-success);
  border-color: var(--color-state-success);
  color: #fff;
}

/* 过渡动画 */
.course-pop-enter-active,
.course-pop-leave-active {
  transition: opacity 0.16s ease, transform 0.16s cubic-bezier(0.4, 0, 0.2, 1);
}

.course-pop-enter-from,
.course-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}
</style>

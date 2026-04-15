<template>
  <div
    v-if="sourceList.length"
    ref="rootRef"
    class="course-source"
    :class="{ open: isOpen, empty: !selectedSource }"
  >
    <button
      type="button"
      class="course-source-trigger"
      :title="selectedSource ? `当前词本：${selectedSource}` : '选择词本'"
      @click="toggleOpen"
    >
      <span class="course-source-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
        </svg>
      </span>
      <span class="course-source-meta">
        <span class="course-source-label">词本</span>
        <span class="course-source-value">{{ selectedSource || '未选择' }}</span>
      </span>
      <svg class="course-source-caret" :class="{ flipped: isOpen }" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <Transition name="course-source-menu">
      <div v-if="isOpen" class="course-source-menu" role="listbox">
        <div class="course-source-menu-heading">
          <span>选择词本</span>
          <span class="course-source-menu-count">{{ sourceList.length }}</span>
        </div>
        <button
          v-for="s in sourceList"
          :key="s"
          type="button"
          role="option"
          class="course-source-option"
          :class="{ active: s === selectedSource }"
          :aria-selected="s === selectedSource"
          @click="choose(s)"
        >
          <span class="course-source-dot" aria-hidden="true" />
          <span class="course-source-name">{{ s }}</span>
          <svg
            v-if="s === selectedSource"
            class="course-source-check"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path d="m4 8.5 2.5 2.5L12 5.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <div class="course-source-menu-hint">
          影响整个课程内的单词添加目标
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, inject } from 'vue'
import type { CourseConfig } from '../../types/course'
import { useCourseSource } from '../../composables/useCourseSource'

const config = inject<CourseConfig>('courseConfig')!
const { sourceList, selectedSource, loadSources, setSelected } = useCourseSource(config)

const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)

function toggleOpen() { isOpen.value = !isOpen.value }

function choose(s: string) {
  setSelected(s)
  isOpen.value = false
}

function onDocClick(e: MouseEvent) {
  if (!isOpen.value) return
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) isOpen.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) isOpen.value = false
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
.course-source {
  position: relative;
  font-family: var(--font-sans);
}

.course-source-trigger {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px 7px 12px;
  background: var(--course-surface-chip);
  border: 1px solid var(--course-chip-border);
  border-radius: 999px;
  cursor: pointer;
  color: var(--color-text-primary);
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
  font-family: inherit;
  line-height: 1;
}

.course-source-trigger:hover {
  border-color: var(--course-accent);
  background: var(--course-surface-chip-hover);
}

.course-source.open .course-source-trigger {
  border-color: var(--course-accent);
  box-shadow: 0 0 0 3px var(--course-accent-ring);
}

.course-source-icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: var(--course-accent-soft);
  color: var(--course-accent);
  flex-shrink: 0;
}

.course-source-icon svg { width: 15px; height: 15px; }

.course-source-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.05;
  min-width: 0;
}

.course-source-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-tertiary);
  font-weight: 500;
}

.course-source-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  max-width: 160px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.course-source.empty .course-source-value {
  color: var(--color-text-tertiary);
  font-weight: 500;
}

.course-source-caret {
  width: 11px;
  height: 11px;
  color: var(--color-text-tertiary);
  transition: transform 0.2s ease;
  margin-left: 2px;
}

.course-source-caret.flipped {
  transform: rotate(180deg);
  color: var(--course-accent);
}

.course-source-menu {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  min-width: 240px;
  max-width: 320px;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 6px;
  z-index: 50;
  overflow: hidden;
}

.course-source-menu-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px 10px;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  border-bottom: 1px solid var(--color-border-light);
  margin-bottom: 4px;
}

.course-source-menu-count {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0;
  color: var(--course-accent);
}

.course-source-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: inherit;
  font-size: 13.5px;
  color: var(--color-text-primary);
  text-align: left;
  transition: background 0.14s ease;
}

.course-source-option:hover {
  background: var(--course-accent-soft);
}

.course-source-option.active {
  background: var(--course-accent-soft);
  color: var(--course-accent-strong);
  font-weight: 600;
}

.course-source-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-border-strong);
  flex-shrink: 0;
  transition: background 0.14s ease, transform 0.14s ease;
}

.course-source-option.active .course-source-dot {
  background: var(--course-accent);
  transform: scale(1.3);
}

.course-source-name {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.course-source-check {
  width: 14px;
  height: 14px;
  color: var(--course-accent);
  flex-shrink: 0;
}

.course-source-menu-hint {
  padding: 10px 12px 6px;
  margin-top: 4px;
  border-top: 1px solid var(--color-border-light);
  font-size: 11.5px;
  color: var(--color-text-tertiary);
  font-style: italic;
  font-family: var(--font-serif);
}

/* 过渡 */
.course-source-menu-enter-active,
.course-source-menu-leave-active {
  transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: top right;
}

.course-source-menu-enter-from,
.course-source-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}

@media (max-width: 768px) {
  .course-source-trigger { padding: 6px 10px; gap: 8px; }
  .course-source-icon { width: 22px; height: 22px; border-radius: 6px; }
  .course-source-icon svg { width: 13px; height: 13px; }
  .course-source-value { max-width: 110px; font-size: 12.5px; }
  .course-source-label { font-size: 9.5px; }
  .course-source-menu { min-width: 220px; right: 0; }
}
</style>

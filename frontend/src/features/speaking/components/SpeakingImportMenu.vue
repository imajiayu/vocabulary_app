<template>
  <div v-if="show" class="import-menu">
    <button
      @click="emit('import', 1)"
      @mouseenter="activeHint = 1"
      @mouseleave="activeHint = null"
      class="menu-item"
    >
      <AppIcon name="file" class="menu-icon" />
      <span>导入 Part 1</span>
    </button>
    <button
      @click="emit('import', 2)"
      @mouseenter="activeHint = 2"
      @mouseleave="activeHint = null"
      class="menu-item"
    >
      <AppIcon name="file" class="menu-icon" />
      <span>导入 Part 2&3</span>
    </button>

    <!-- 格式说明 -->
    <div class="menu-hint">
      <div class="hint-header">
        <div class="hint-title">文件格式说明</div>
        <div class="hint-filetype">.txt · UTF-8</div>
      </div>

      <!-- Part 1 格式 -->
      <Transition name="hint-switch" mode="out-in">
        <div v-if="activeHint !== 2" key="part1" class="hint-section">
          <div class="hint-label">Part 1</div>
          <div class="hint-desc">每个主题第一行为标题，后续行为问题，主题间空行分隔</div>
          <div class="example-block">
            <span class="ex-topic">Dreams</span>
            <span class="ex-q">Can you remember the dreams you had?</span>
            <span class="ex-q">Do you share your dreams with others?</span>
            <span class="ex-blank"></span>
            <span class="ex-topic">Keys</span>
            <span class="ex-q">Do you always bring a lot of keys?</span>
          </div>
        </div>

        <!-- Part 2&3 格式 -->
        <div v-else key="part23" class="hint-section">
          <div class="hint-label">Part 2 & 3</div>
          <div class="hint-desc">Describe 开头为主题，后续行合并为提示卡，空行后每行为 Part 3 问题</div>
          <div class="example-block">
            <span class="ex-topic">Describe a person who makes plans...</span>
            <span class="ex-card">You should say:</span>
            <span class="ex-card">Who he or she is</span>
            <span class="ex-card">And explain how you feel about...</span>
            <span class="ex-blank"></span>
            <span class="ex-q">Do you think it's important to plan?</span>
            <span class="ex-q">What activities need planning ahead?</span>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '@/shared/components/controls/Icons.vue'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'import', part: 1 | 2): void
}>()

const activeHint = ref<1 | 2 | null>(null)
</script>

<style scoped>
.import-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: var(--spacing-sm);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-default);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 1000;
  min-width: 300px;
}

/* ── 按钮 ── */
.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0.75rem 1rem;
  border: none;
  background: var(--color-bg-primary);
  cursor: pointer;
  transition: background 0.2s ease;
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
}

.menu-item:hover {
  background: var(--color-purple-light);
}

.menu-icon {
  width: 1rem;
  height: 1rem;
  color: var(--color-purple);
}

/* ── 格式说明区 ── */
.menu-hint {
  padding: 0.75rem 1rem;
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border-light);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.hint-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}

.hint-title {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.hint-filetype {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  padding: 1px 6px;
  border-radius: var(--radius-xs);
}

/* ── 格式分区 ── */
.hint-section {
  min-height: 130px;
}

.hint-label {
  font-family: var(--font-ui);
  font-weight: var(--font-weight-semibold);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-purple);
  margin-bottom: 4px;
}

.hint-desc {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-bottom: 8px;
  line-height: 1.5;
}

/* ── 示例代码块 ── */
.example-block {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 8px 10px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1.6;
}

.ex-topic {
  color: var(--primitive-copper-500);
  font-weight: 600;
}

.ex-q {
  color: var(--color-text-primary);
  padding-left: 0;
}

.ex-card {
  color: var(--primitive-olive-600);
  padding-left: 0;
}

.ex-blank {
  height: 8px;
}

/* ── 切换过渡 ── */
.hint-switch-enter-active {
  transition: opacity 0.15s ease-out;
}

.hint-switch-leave-active {
  transition: opacity 0.1s ease-in;
}

.hint-switch-enter-from,
.hint-switch-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .import-menu {
    right: 0;
    left: auto;
    min-width: 260px;
  }
}
</style>

<template>
  <div class="version-history">
    <header class="section-header">
      <h3 class="section-title">版本历史</h3>
    </header>

    <div class="version-list">
      <div
        v-for="version in versions"
        :key="version.id"
        class="version-item"
        :class="{ 'is-active': activeVersionId === version.id }"
        @click="handleViewVersion(version)"
      >
        <div class="version-info">
          <span class="version-number">第 {{ version.version_number }} 版</span>
          <span class="version-meta">
            {{ formatDate(version.created_at) }} · {{ version.word_count || 0 }} 词
          </span>
        </div>
        <div v-if="version.scores" class="version-score">
          {{ version.scores.overall }}
        </div>
      </div>
    </div>

    <!-- Version Diff (if multiple versions) -->
    <div v-if="versions.length > 1" class="diff-section">
      <button
        class="diff-toggle"
        :class="{ 'is-active': showDiff }"
        @click="showDiff = !showDiff"
      >
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M16 3H5C3.89543 3 3 3.89543 3 5V16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <rect x="8" y="8" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        <span>{{ showDiff ? '隐藏对比' : '查看修改对比' }}</span>
      </button>

      <Transition name="expand">
        <VersionDiff
          v-if="showDiff"
          :old-text="versions[0].content"
          :new-text="versions[versions.length - 1].content"
        />
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { WritingVersion } from '@/shared/types/writing'
import VersionDiff from './VersionDiff.vue'

const props = defineProps<{
  versions: WritingVersion[]
}>()

const emit = defineEmits<{
  (e: 'view-version', version: WritingVersion): void
}>()

const activeVersionId = ref<number | null>(null)
const showDiff = ref(false)

function handleViewVersion(version: WritingVersion) {
  activeVersionId.value = version.id
  emit('view-version', version)
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.version-history {
  background: rgba(250, 247, 242, 0.02);
  border: 1px solid rgba(250, 247, 242, 0.05);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* ── Header ── */
.section-header {
  padding: 14px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(250, 247, 242, 0.05);
}

.section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--primitive-paper-200);
}

/* ── Version List ── */
.version-list {
  display: flex;
  flex-direction: column;
}

.version-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(250, 247, 242, 0.03);
  cursor: pointer;
  transition: all 0.2s ease;
}

.version-item:last-child {
  border-bottom: none;
}

.version-item:hover {
  background: rgba(250, 247, 242, 0.03);
}

.version-item.is-active {
  background: rgba(59, 130, 246, 0.1);
}

.version-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.version-number {
  font-size: 14px;
  font-weight: 500;
  color: var(--primitive-paper-200);
}

.version-meta {
  font-size: 12px;
  color: var(--primitive-ink-400);
}

.version-score {
  padding: 4px 10px;
  font-size: 14px;
  font-weight: 600;
  background: rgba(59, 130, 246, 0.15);
  color: var(--primitive-azure-400);
  border-radius: var(--radius-sm);
}

/* ── Diff Section ── */
.diff-section {
  padding: 12px 16px;
  border-top: 1px solid rgba(250, 247, 242, 0.05);
}

.diff-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  width: 100%;
  background: transparent;
  border: 1px solid rgba(250, 247, 242, 0.1);
  border-radius: var(--radius-sm);
  color: var(--primitive-paper-400);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.diff-toggle svg {
  width: 16px;
  height: 16px;
}

.diff-toggle:hover {
  background: rgba(250, 247, 242, 0.05);
}

.diff-toggle.is-active {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.2);
  color: var(--primitive-azure-400);
}

/* ── Expand Transition ── */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>

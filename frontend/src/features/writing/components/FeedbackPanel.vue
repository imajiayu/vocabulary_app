<template>
  <div class="feedback-panel">
    <header class="panel-header">
      <h3 class="panel-title">AI 反馈</h3>
    </header>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>分析中...</p>
    </div>

    <!-- Feedback Content -->
    <div v-else-if="feedback" class="panel-content">
      <!-- Summary -->
      <div class="feedback-summary">
        <p>{{ feedback.summary }}</p>
      </div>

      <!-- Improvement (for revision feedback) -->
      <div v-if="feedback.improvement" class="feedback-improvement">
        <div class="improvement-header">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>改进点</span>
        </div>
        <p>{{ feedback.improvement }}</p>
      </div>

      <!-- Issues by Type -->
      <div class="issues-section">
        <div
          v-for="group in groupedIssues"
          :key="group.type"
          class="issue-group"
        >
          <div class="group-header" @click="toggleGroup(group.type)">
            <div class="group-info">
              <span class="group-badge" :class="`badge-${group.type}`">
                {{ getTypeLabel(group.type) }}
              </span>
              <span class="group-count">{{ group.issues.length }}</span>
            </div>
            <svg
              class="expand-icon"
              :class="{ 'is-expanded': expandedGroups.has(group.type) }"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          <Transition name="expand">
            <div v-if="expandedGroups.has(group.type)" class="group-issues">
              <FeedbackItem
                v-for="issue in group.issues"
                :key="issue.id"
                :issue="issue"
                @click="handleIssueClick(issue)"
                @request-suggestion="handleRequestSuggestion(issue)"
              />
            </div>
          </Transition>
        </div>
      </div>

      <!-- No Issues -->
      <div v-if="feedback.issues.length === 0" class="no-issues">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>太棒了！没有发现问题</p>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <p>提交作文后将显示反馈</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WritingFeedback, WritingIssue, WritingIssueType } from '@/shared/types/writing'
import { ISSUE_TYPE_LABELS } from '@/shared/types/writing'
import FeedbackItem from './FeedbackItem.vue'

const props = defineProps<{
  feedback: WritingFeedback | null
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'issue-click', issue: WritingIssue): void
  (e: 'request-suggestion', issue: WritingIssue): void
}>()

const expandedGroups = ref(new Set<WritingIssueType>(['grammar', 'vocabulary']))

// Group issues by type
const groupedIssues = computed(() => {
  if (!props.feedback) return []

  const groups: Record<WritingIssueType, WritingIssue[]> = {
    grammar: [],
    vocabulary: [],
    coherence: [],
    task: []
  }

  for (const issue of props.feedback.issues) {
    if (groups[issue.type]) {
      groups[issue.type].push(issue)
    }
  }

  return Object.entries(groups)
    .filter(([_, issues]) => issues.length > 0)
    .map(([type, issues]) => ({
      type: type as WritingIssueType,
      issues
    }))
})

function getTypeLabel(type: WritingIssueType): string {
  return ISSUE_TYPE_LABELS[type] || type
}

function toggleGroup(type: WritingIssueType) {
  if (expandedGroups.value.has(type)) {
    expandedGroups.value.delete(type)
  } else {
    expandedGroups.value.add(type)
  }
}

function handleIssueClick(issue: WritingIssue) {
  emit('issue-click', issue)
}

function handleRequestSuggestion(issue: WritingIssue) {
  emit('request-suggestion', issue)
}
</script>

<style scoped>
.feedback-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.2);
}

/* 移动端：取消独立滚动 */
@media (max-width: 768px) {
  .feedback-panel {
    height: auto;
  }
}

/* ── Header ── */
.panel-header {
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(59, 130, 246, 0.1);
}

.panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--primitive-paper-200);
}

/* ── Loading ── */
.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 40px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(59, 130, 246, 0.2);
  border-top-color: var(--primitive-azure-500);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-state p {
  margin: 0;
  font-size: 14px;
  color: var(--primitive-ink-400);
}

/* ── Content ── */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 移动端：取消独立滚动，内容自然展开 */
@media (max-width: 768px) {
  .panel-content {
    overflow-y: visible;
    flex: none;
  }
}

/* ── Summary ── */
.feedback-summary {
  padding: 12px 16px;
  background: rgba(250, 247, 242, 0.03);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--primitive-azure-500);
}

.feedback-summary p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--primitive-paper-300);
}

/* ── Improvement ── */
.feedback-improvement {
  padding: 12px 16px;
  background: rgba(34, 197, 94, 0.08);
  border-radius: var(--radius-md);
  border-left: 3px solid #22c55e;
}

.improvement-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.improvement-header svg {
  width: 16px;
  height: 16px;
  color: #22c55e;
}

.improvement-header span {
  font-size: 13px;
  font-weight: 600;
  color: #22c55e;
}

.feedback-improvement p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--primitive-paper-300);
}

/* ── Issues Section ── */
.issues-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.issue-group {
  background: rgba(250, 247, 242, 0.02);
  border: 1px solid rgba(250, 247, 242, 0.05);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.group-header:hover {
  background: rgba(250, 247, 242, 0.03);
}

.group-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-badge {
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
}

.badge-grammar {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.badge-vocabulary {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.badge-coherence {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.badge-task {
  background: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

.group-count {
  font-size: 12px;
  color: var(--primitive-ink-400);
}

.expand-icon {
  width: 16px;
  height: 16px;
  color: var(--primitive-ink-400);
  transition: transform 0.2s ease;
}

.expand-icon.is-expanded {
  transform: rotate(180deg);
}

.group-issues {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid rgba(250, 247, 242, 0.05);
}

/* ── No Issues ── */
.no-issues {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px;
  text-align: center;
}

.no-issues svg {
  width: 40px;
  height: 40px;
  color: #22c55e;
}

.no-issues p {
  margin: 0;
  font-size: 14px;
  color: var(--primitive-paper-300);
}

/* ── Empty State ── */
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
  color: var(--primitive-ink-400);
}

/* ── Expand Transition ── */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
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

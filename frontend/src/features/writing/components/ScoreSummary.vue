<template>
  <div class="score-summary">
    <header class="summary-header">
      <h3 class="summary-title">最终评分</h3>
      <div class="overall-score">
        <span class="score-value">{{ scores.overall }}</span>
        <span class="score-label">总分</span>
      </div>
    </header>

    <div class="score-breakdown">
      <div
        v-for="(score, key) in dimensionScores"
        :key="key"
        class="score-item"
      >
        <div class="score-info">
          <span class="score-name">{{ getDimensionLabel(key) }}</span>
          <span class="score-band">{{ score }}</span>
        </div>
        <div class="score-bar">
          <div
            class="score-fill"
            :style="{ width: `${(score / 9) * 100}%` }"
            :class="getScoreClass(score)"
          ></div>
        </div>
      </div>
    </div>

    <div v-if="feedback?.improvement" class="feedback-detail">
      <h4 class="detail-title">详细反馈</h4>
      <div class="detail-content" v-html="formattedFeedback"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WritingScores, WritingFeedback } from '@/shared/types/writing'
import { SCORE_DIMENSION_LABELS } from '@/shared/types/writing'

const props = defineProps<{
  scores: WritingScores
  feedback: WritingFeedback | null
}>()

const dimensionScores = computed(() => ({
  taskAchievement: props.scores.taskAchievement,
  coherenceCohesion: props.scores.coherenceCohesion,
  lexicalResource: props.scores.lexicalResource,
  grammaticalRange: props.scores.grammaticalRange
}))

function getDimensionLabel(key: string): string {
  return SCORE_DIMENSION_LABELS[key as keyof typeof SCORE_DIMENSION_LABELS] || key
}

function getScoreClass(score: number): string {
  if (score >= 7) return 'score-high'
  if (score >= 6) return 'score-mid'
  return 'score-low'
}

const formattedFeedback = computed(() => {
  if (!props.feedback?.improvement) return ''
  return props.feedback.improvement
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(.*)$/, '<p>$1</p>')
})
</script>

<style scoped>
.score-summary {
  background: rgba(250, 247, 242, 0.02);
  border: 1px solid rgba(250, 247, 242, 0.05);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* ── Header ── */
.summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(250, 247, 242, 0.05);
}

.summary-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--primitive-paper-200);
}

.overall-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  background: linear-gradient(135deg, var(--primitive-azure-500), var(--primitive-azure-600));
  border-radius: var(--radius-md);
}

.score-value {
  font-size: 24px;
  font-weight: 700;
  color: white;
}

.score-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Breakdown ── */
.score-breakdown {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.score-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.score-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.score-name {
  font-size: 13px;
  color: var(--primitive-paper-300);
}

.score-band {
  font-size: 14px;
  font-weight: 600;
  color: var(--primitive-paper-200);
}

.score-bar {
  height: 6px;
  background: rgba(250, 247, 242, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.score-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

.score-fill.score-high {
  background: linear-gradient(90deg, #22c55e, #16a34a);
}

.score-fill.score-mid {
  background: linear-gradient(90deg, #f59e0b, #d97706);
}

.score-fill.score-low {
  background: linear-gradient(90deg, #ef4444, #dc2626);
}

/* ── Feedback Detail ── */
.feedback-detail {
  padding: 20px;
  border-top: 1px solid rgba(250, 247, 242, 0.05);
}

.detail-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--primitive-paper-200);
}

.detail-content {
  font-size: 14px;
  line-height: 1.7;
  color: var(--primitive-paper-400);
}

.detail-content :deep(p) {
  margin: 0 0 12px;
}

.detail-content :deep(p:last-child) {
  margin-bottom: 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mobile
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 480px) {
  .summary-header {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }

  .overall-score {
    width: 100%;
  }
}
</style>

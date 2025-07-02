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

    <div v-if="summary" class="feedback-detail">
      <h4 class="detail-title">详细反馈</h4>
      <div class="detail-content markdown-content" v-html="formatMarkdown(summary || '')"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WritingScores } from '@/shared/types/writing'
import { SCORE_DIMENSION_LABELS } from '@/shared/types/writing'
import { formatMarkdown } from '@/shared/utils/markdown'

const props = defineProps<{
  scores: WritingScores
  summary: string | null
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

</script>

<style src="@/shared/styles/markdown-content.css"></style>
<style scoped>
.score-summary {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-md);
  overflow: hidden;
}

/* ── Header ── */
.summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.summary-title {
  margin: 0;
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 600;
  color: rgba(250, 247, 242, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.overall-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 18px;
  background: linear-gradient(135deg, var(--primitive-gold-500), var(--primitive-gold-600));
  border-radius: var(--radius-default);
  box-shadow: 0 4px 16px rgba(184, 134, 11, 0.2);
}

.score-value {
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 700;
  color: white;
  line-height: 1;
}

.score-label {
  font-family: var(--font-ui);
  font-size: 9px;
  color: rgba(255, 255, 255, 0.75);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-top: 2px;
}

/* ── Breakdown ── */
.score-breakdown {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.score-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.score-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.score-name {
  font-family: var(--font-ui);
  font-size: 12px;
  color: rgba(250, 247, 242, 0.55);
}

.score-band {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: rgba(250, 247, 242, 0.85);
}

.score-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
}

.score-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

.score-fill.score-high {
  background: linear-gradient(90deg, #34d399, #10b981);
}

.score-fill.score-mid {
  background: linear-gradient(90deg, var(--primitive-gold-400), var(--primitive-gold-500));
}

.score-fill.score-low {
  background: linear-gradient(90deg, #f87171, #ef4444);
}

/* ── Feedback Detail ── */
.feedback-detail {
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.detail-title {
  margin: 0 0 12px;
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 600;
  color: rgba(250, 247, 242, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* markdown styles: inherits from markdown-content.css */
.detail-content {
  font-family: var(--font-serif);
  font-size: 13px;
  line-height: 1.8;
  color: rgba(250, 247, 242, 0.55);
}

/* Score-specific overrides */
.detail-content :deep(strong) {
  color: rgba(250, 247, 242, 0.85);
}

.detail-content :deep(em) {
  color: rgba(250, 247, 242, 0.45);
}

.detail-content :deep(p) {
  margin: 0 0 10px;
}

/* ── Mobile ── */

@media (max-width: 768px) {
  .summary-header {
    flex-direction: column;
    gap: 14px;
    text-align: center;
  }

  .overall-score {
    width: 100%;
  }

  .scores-grid {
    grid-template-columns: 1fr;
  }
}
</style>

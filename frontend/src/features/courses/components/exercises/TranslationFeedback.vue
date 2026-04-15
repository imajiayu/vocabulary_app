<template>
  <div>
    <!-- 评分 -->
    <div class="course-grade-score">
      <strong>{{ emoji }} AI 评分：{{ feedback.score }} 分</strong>
      <span v-if="feedback.summary"> — {{ feedback.summary }}</span>
    </div>

    <!-- 逐条批改 -->
    <div v-if="feedback.items?.length" class="course-grade-details">
      <div
        v-for="(item, i) in feedback.items"
        :key="i"
        class="course-grade-item"
        :class="item.status"
      >
        <template v-if="item.status === 'perfect'">
          ✅ <code>{{ item.term }}</code> → {{ item.idealTranslation }} ✓
        </template>
        <template v-else-if="item.status === 'acceptable'">
          ⚠️ <code>{{ item.term }}</code> → 你译为「{{ item.userTranslation }}」
          <br />&nbsp;&nbsp;&nbsp;&nbsp;✅ 更规范的法律表达：<em>{{ item.idealTranslation }}</em>
          <template v-if="item.note"><br />&nbsp;&nbsp;&nbsp;&nbsp;💡 {{ item.note }}</template>
        </template>
        <template v-else-if="item.status === 'error'">
          ❌ <code>{{ item.term }}</code> → 你译为「{{ item.userTranslation }}」
          <br />&nbsp;&nbsp;&nbsp;&nbsp;✅ 正确翻译：<em>{{ item.idealTranslation }}</em>
          <template v-if="item.note"><br />&nbsp;&nbsp;&nbsp;&nbsp;💡 {{ item.note }}</template>
        </template>
        <template v-else>
          ❌ <code>{{ item.term }}</code> → 遗漏
          <br />&nbsp;&nbsp;&nbsp;&nbsp;✅ 应译为：<em>{{ item.idealTranslation }}</em>
          <template v-if="item.note"><br />&nbsp;&nbsp;&nbsp;&nbsp;💡 {{ item.note }}</template>
        </template>
      </div>
    </div>

    <!-- 总评 -->
    <div v-if="feedback.overallComments" class="course-grade-keypoints">
      <strong>💡 总评：</strong>
      <p>{{ feedback.overallComments }}</p>
    </div>

    <!-- 参考译文 -->
    <div v-if="reference" class="course-grade-reference">
      <strong>📖 参考译文：</strong>
      <blockquote>{{ reference }}</blockquote>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AIFeedback } from './TranslationExercise.vue'

const props = defineProps<{
  feedback: AIFeedback
  reference?: string
}>()

const emoji = computed(() => {
  const s = props.feedback.score
  if (s >= 90) return '🎉'
  if (s >= 70) return '👍'
  if (s >= 50) return '💪'
  return '📚'
})
</script>

<style scoped>
.course-grade-details { margin-bottom: 10px; }
.course-grade-keypoints {
  background: #fffbeb;
  border-left: 3px solid var(--color-state-warning, #f59e0b);
  padding: 10px 14px;
  border-radius: 0 6px 6px 0;
  font-size: 0.93em;
  line-height: 1.7;
}
.course-grade-keypoints p { margin: 4px 0 0; }
</style>

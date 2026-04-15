<template>
  <div>
    <!-- 评分 -->
    <div class="course-grade-score">
      <strong>{{ emoji }} 评分：{{ pct }}分</strong>
      <span v-if="pct >= 70"> 核心意思正确！</span>
    </div>

    <!-- 逐条批改 -->
    <div class="course-grade-details">
      <div
        v-for="(r, i) in grade.results"
        :key="i"
        class="course-grade-item"
        :class="r.status"
      >
        <template v-if="r.status === 'perfect'">
          ✅ <code>{{ r.en }}</code> → {{ r.ideal }} ✓
        </template>
        <template v-else-if="r.status === 'acceptable'">
          ⚠️ <code>{{ r.en }}</code> → 你译为「{{ r.acceptText }}」
          <br />&nbsp;&nbsp;&nbsp;&nbsp;✅ 更规范的法律表达：<em>{{ r.ideal }}</em>
          <template v-if="r.note"><br />&nbsp;&nbsp;&nbsp;&nbsp;💡 {{ r.note }}</template>
        </template>
        <template v-else-if="r.status === 'error'">
          ❌ <code>{{ r.en }}</code> → 你译为「{{ r.errorText }}」← 翻译有误
          <br />&nbsp;&nbsp;&nbsp;&nbsp;✅ 正确翻译：<em>{{ r.ideal }}</em>
          <template v-if="r.note"><br />&nbsp;&nbsp;&nbsp;&nbsp;💡 {{ r.note }}</template>
        </template>
        <template v-else>
          ❌ <code>{{ r.en }}</code> → 遗漏
          <br />&nbsp;&nbsp;&nbsp;&nbsp;✅ 应译为：<em>{{ r.ideal }}</em>
          <template v-if="r.note"><br />&nbsp;&nbsp;&nbsp;&nbsp;💡 {{ r.note }}</template>
        </template>
      </div>
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
import type { GradeResult } from '../../utils/grading'

const props = defineProps<{
  grade: GradeResult
  reference?: string
}>()

const pct = computed(() =>
  props.grade.total > 0 ? Math.round(props.grade.score / props.grade.total * 100) : 0
)

const emoji = computed(() => {
  if (pct.value >= 90) return '🎉'
  if (pct.value >= 70) return '👍'
  if (pct.value >= 50) return '💪'
  return '📚'
})
</script>

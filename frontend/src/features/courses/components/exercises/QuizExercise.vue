<template>
  <div class="course-exercise">
    <h3 v-if="group.title" v-html="wrap(group.title)" />
    <p v-if="group.instruction" v-html="wrap(group.instruction)" />

    <div
      v-for="(q, qi) in group.questions"
      :key="qi"
      class="course-quiz-item"
    >
      <div class="course-quiz-prompt" v-html="wrap(`${qi + 1}. ${q.prompt}`)" />
      <div class="course-quiz-options">
        <label
          v-for="opt in q.options"
          :key="opt"
          :class="{
            'correct-answer': graded && stripHtml(opt) === stripHtml(q.answer),
            'wrong-answer': graded && answers[qi] === stripHtml(opt) && answers[qi] !== stripHtml(q.answer)
          }"
        >
          <input
            type="radio"
            :name="`${groupKey}q${qi}`"
            :value="stripHtml(opt)"
            :checked="answers[qi] === stripHtml(opt)"
            :disabled="graded"
            @change="onSelect(qi, stripHtml(opt))"
          />
          <span v-html="wrap(' ' + opt)" />
        </label>
      </div>

      <!-- 判题结果 -->
      <div v-if="graded" class="course-quiz-result" :class="answers[qi] === stripHtml(q.answer) ? 'correct' : 'wrong'">
        <template v-if="answers[qi] === stripHtml(q.answer)">
          <strong>✅ 正确！</strong>
          <span v-if="q.explanation"> <span v-html="wrap(q.explanation)" /></span>
        </template>
        <template v-else>
          <strong>❌ 错误</strong>
          <span v-if="answers[qi]">（你选了 {{ answers[qi] }}）</span>。正确答案：<strong v-html="wrap(q.answer)" />
          <span v-if="q.explanation"> — <span v-html="wrap(q.explanation)" /></span>
        </template>
      </div>

      <!-- 渐进提示 -->
      <div v-if="q.hints?.length" class="hint-container">
        <div
          v-for="h in shownHints(qi)"
          :key="h"
          class="course-hint-box"
        >💡 提示 {{ h + 1 }}：{{ q.hints[h] }}</div>
        <button
          v-if="(hintsUsed[qi] || 0) < q.hints.length"
          class="course-hint-btn"
          @click="showNextHint(qi, q.hints.length)"
        >
          💡 看提示（{{ (hintsUsed[qi] || 0) + 1 }}/{{ q.hints.length }}）
        </button>
      </div>
    </div>

    <button
      class="course-grade-btn"
      :disabled="!allAnswered && !graded"
      @click="grade"
    >
      {{ graded ? `重新判题 · ${correctCount}/${group.questions.length}` : '判题' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted } from 'vue'
import type { QuizGroup } from '../../types/lesson'
import type { ExerciseState } from '../../composables/useExerciseState'
import { useCourseHtml } from '../../composables/useCourseHtml'
import { stripHtml } from '../../utils/grading'

const { wrap } = useCourseHtml()

const props = defineProps<{
  group: QuizGroup
  groupIndex: number
}>()

const exerciseState = inject<ExerciseState>('exerciseState')!
const groupKey = `g${props.groupIndex}`

const answers = ref<Record<number, string>>({})
const graded = ref(false)
const hintsUsed = ref<Record<number, number>>({})

const allAnswered = computed(() =>
  props.group.questions.every((_, i) => !!answers.value[i])
)

const correctCount = computed(() =>
  props.group.questions.filter((q, i) => answers.value[i] === stripHtml(q.answer)).length
)

function onSelect(qi: number, val: string) {
  answers.value[qi] = val
  exerciseState.radio[`${groupKey}q${qi}`] = val
}

function grade() {
  graded.value = true
  if (!exerciseState.quizGraded.includes(props.groupIndex)) {
    exerciseState.quizGraded.push(props.groupIndex)
  }
}

function shownHints(qi: number): number[] {
  const count = hintsUsed.value[qi] || 0
  return Array.from({ length: count }, (_, i) => i)
}

function showNextHint(qi: number, total: number) {
  const current = hintsUsed.value[qi] || 0
  if (current < total) {
    hintsUsed.value[qi] = current + 1
    exerciseState.hintsUsed[`quiz_${props.groupIndex}_${qi}`] = current + 1
  }
}

// 恢复状态
onMounted(() => {
  // 恢复选择
  for (let qi = 0; qi < props.group.questions.length; qi++) {
    const key = `${groupKey}q${qi}`
    if (exerciseState.radio[key]) {
      answers.value[qi] = exerciseState.radio[key]
    }
  }
  // 恢复提示
  for (let qi = 0; qi < props.group.questions.length; qi++) {
    const key = `quiz_${props.groupIndex}_${qi}`
    if (exerciseState.hintsUsed[key]) {
      hintsUsed.value[qi] = exerciseState.hintsUsed[key]
    }
  }
  // 恢复判题
  if (exerciseState.quizGraded.includes(props.groupIndex)) {
    graded.value = true
  }
})
</script>

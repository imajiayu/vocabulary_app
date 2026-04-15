<template>
  <div class="course-exercise">
    <h3 v-if="group.title" v-html="wrap(group.title)" />
    <p v-if="group.instruction" v-html="wrap(group.instruction)" />

    <div
      v-for="(q, qi) in group.questions"
      :key="qi"
      class="course-fill-blank-item"
    >
      <div class="course-fill-blank-prompt">
        <template v-for="(part, pi) in splitPrompt(q.prompt, qi)" :key="pi">
          <span v-if="part.type === 'text'" v-html="wrap(part.content)" />
          <input
            v-else
            type="text"
            class="course-fill-blank-input"
            :class="{
              'fb-correct': graded && results[qi]?.correct,
              'fb-wrong': graded && results[qi] && !results[qi].correct
            }"
            autocomplete="off"
            :spellcheck="false"
            :value="inputs[qi] || ''"
            @input="onInput(qi, ($event.target as HTMLInputElement).value)"
          />
        </template>
      </div>

      <!-- 判题结果 -->
      <div v-if="graded && results[qi]" class="course-fill-blank-result" :class="results[qi].correct ? 'correct' : 'wrong'">
        <template v-if="results[qi].correct">
          <strong>✅ 正确！</strong>
        </template>
        <template v-else>
          <strong>❌ 错误</strong>
          <span v-if="inputs[qi]">（你填了 {{ inputs[qi] }}）</span>
          。正确答案：<strong>{{ q.answer }}</strong>
        </template>
        <span v-if="q.explanation"> — {{ q.explanation }}</span>
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
      :disabled="!allFilled && !graded"
      @click="grade"
    >
      {{ graded ? `重新判题 · ${correctCount}/${group.questions.length}` : '判题' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted } from 'vue'
import type { FillBlankGroup } from '../../types/lesson'
import type { ExerciseState } from '../../composables/useExerciseState'
import { matchFillBlank } from '../../utils/grading'
import { useCourseHtml } from '../../composables/useCourseHtml'

const { wrap } = useCourseHtml()

const props = defineProps<{
  group: FillBlankGroup
  groupIndex: number
}>()

const exerciseState = inject<ExerciseState>('exerciseState')!

const inputs = ref<Record<number, string>>({})
const graded = ref(false)
const results = ref<Record<number, { correct: boolean }>>({})
const hintsUsed = ref<Record<number, number>>({})

const allFilled = computed(() =>
  props.group.questions.every((_, i) => !!inputs.value[i]?.trim())
)

const correctCount = computed(() =>
  Object.values(results.value).filter(r => r.correct).length
)

function splitPrompt(prompt: string, qi: number) {
  const num = `${qi + 1}. `
  const full = num + prompt
  const parts = full.split('____')
  const result: { type: 'text' | 'input'; content: string }[] = []
  for (let i = 0; i < parts.length; i++) {
    result.push({ type: 'text', content: parts[i] })
    if (i < parts.length - 1) {
      result.push({ type: 'input', content: '' })
    }
  }
  return result
}

function onInput(qi: number, val: string) {
  inputs.value[qi] = val
  exerciseState.fillBlank[`fb${qi}`] = val
}

function grade() {
  graded.value = true
  const newResults: Record<number, { correct: boolean }> = {}
  for (let qi = 0; qi < props.group.questions.length; qi++) {
    const q = props.group.questions[qi]
    const userVal = inputs.value[qi] || ''
    newResults[qi] = { correct: matchFillBlank(userVal, q.answer, q.accept) }
  }
  results.value = newResults
  if (!exerciseState.fillBlankGraded.includes(props.groupIndex)) {
    exerciseState.fillBlankGraded.push(props.groupIndex)
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
    exerciseState.hintsUsed[`fb_${props.groupIndex}_${qi}`] = current + 1
  }
}

onMounted(() => {
  // 恢复输入
  for (let qi = 0; qi < props.group.questions.length; qi++) {
    const key = `fb${qi}`
    if (exerciseState.fillBlank[key]) {
      inputs.value[qi] = exerciseState.fillBlank[key]
    }
  }
  // 恢复提示
  for (let qi = 0; qi < props.group.questions.length; qi++) {
    const key = `fb_${props.groupIndex}_${qi}`
    if (exerciseState.hintsUsed[key]) {
      hintsUsed.value[qi] = exerciseState.hintsUsed[key]
    }
  }
  // 恢复判题
  if (exerciseState.fillBlankGraded.includes(props.groupIndex)) {
    grade()
  }
})
</script>

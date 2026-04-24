<template>
  <div class="course-exercise">
    <h3 v-if="group.title" v-html="wrap(group.title)" />
    <p v-if="group.instruction" v-html="wrap(group.instruction)" />

    <div
      v-for="(q, qi) in group.questions"
      :key="qi"
      class="course-translate-item"
    >
      <div class="course-translate-source">
        <span :class="textClass" v-html="wrap(q.source)" />
      </div>
      <textarea
        class="course-translate-textarea"
        placeholder="在此输入译文…"
        :value="inputs[qi] || ''"
        @input="onInput(qi, ($event.target as HTMLTextAreaElement).value)"
      />

      <!-- AI 批改结果 -->
      <div v-if="feedbacks[qi]" class="translate-feedback">
        <TranslationFeedback :feedback="feedbacks[qi]!" :reference="q.reference" />
      </div>

      <!-- 本地 rubric 批改结果 -->
      <div v-if="localGrades[qi]" class="translate-feedback">
        <RubricFeedback :grade="localGrades[qi]!" :reference="q.reference" />
      </div>
    </div>

    <button
      class="course-check-btn"
      :disabled="!allFilled || grading"
      @click="gradeAll"
    >
      {{ grading ? '⏳ AI 批改中...' : graded ? '重新批改' : '提交批改' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted } from 'vue'
import type { TranslationGroup } from '../../types/lesson'
import type { ExerciseState } from '../../composables/useExerciseState'
import type { GradeResult } from '../../utils/grading'
import { gradeWithRubric } from '../../utils/grading'
import { callAI } from '@/shared/services/ai'
import { TRANSLATION_GRADING_PROMPT, buildTranslationUserMessage } from '@/shared/prompts/translation'
import TranslationFeedback from './TranslationFeedback.vue'
import RubricFeedback from './RubricFeedback.vue'
import { useCourseHtml } from '../../composables/useCourseHtml'

const { wrap } = useCourseHtml()

const props = defineProps<{
  group: TranslationGroup
  groupIndex: number
}>()

const textClass = inject<string>('courseTextClass', 'uk-text')
const exerciseState = inject<ExerciseState>('exerciseState')!

const inputs = ref<Record<number, string>>({})
const feedbacks = ref<Record<number, AIFeedback | null>>({})
const localGrades = ref<Record<number, GradeResult | null>>({})
const grading = ref(false)
const graded = ref(false)

const allFilled = computed(() =>
  props.group.questions.every((_, i) => !!inputs.value[i]?.trim())
)

export interface AIFeedback {
  score: number
  summary?: string
  items?: AIFeedbackItem[]
  overallComments?: string
}

export interface AIFeedbackItem {
  term: string
  status: 'perfect' | 'acceptable' | 'error' | 'missing'
  userTranslation?: string
  idealTranslation: string
  note?: string
}

function onInput(qi: number, val: string) {
  inputs.value[qi] = val
  exerciseState.textarea[`t${qi}`] = val
}

async function callAIGrading(source: string, userText: string, reference?: string): Promise<AIFeedback> {
  const userMessage = buildTranslationUserMessage(source, userText, reference)

  const json = await callAI(TRANSLATION_GRADING_PROMPT, userMessage, [], {
    temperature: 0.3,
    jsonMode: true,
    caller: 'translation_grading',
  })
  return JSON.parse(json)
}

async function gradeAll() {
  grading.value = true
  feedbacks.value = {}
  localGrades.value = {}

  for (let qi = 0; qi < props.group.questions.length; qi++) {
    const q = props.group.questions[qi]
    const userText = inputs.value[qi]?.trim()
    if (!userText) continue

    try {
      const result = await callAIGrading(q.source, userText, q.reference)
      feedbacks.value[qi] = result
      exerciseState.aiResults[`${qi}`] = result
    } catch {
      // 降级到本地 rubric（包含 API key 未配置、网络失败等所有情况）
      if (q.rubric) {
        localGrades.value[qi] = gradeWithRubric(userText, q.rubric)
      }
      exerciseState.aiResults[`${qi}`] = 'fallback'
    }
  }

  grading.value = false
  graded.value = true
  if (!exerciseState.translateGraded.includes(props.groupIndex)) {
    exerciseState.translateGraded.push(props.groupIndex)
  }
}

onMounted(() => {
  // 恢复 textarea
  for (let qi = 0; qi < props.group.questions.length; qi++) {
    if (exerciseState.textarea[`t${qi}`]) {
      inputs.value[qi] = exerciseState.textarea[`t${qi}`]
    }
  }
  // 恢复 AI 结果
  if (exerciseState.translateGraded.includes(props.groupIndex)) {
    graded.value = true
    for (let qi = 0; qi < props.group.questions.length; qi++) {
      const saved = exerciseState.aiResults[`${qi}`]
      if (saved && saved !== 'fallback') {
        feedbacks.value[qi] = saved as AIFeedback
      } else if (saved === 'fallback') {
        const q = props.group.questions[qi]
        const userText = inputs.value[qi]?.trim()
        if (userText && q.rubric) {
          localGrades.value[qi] = gradeWithRubric(userText, q.rubric)
        }
      }
    }
  }
})
</script>

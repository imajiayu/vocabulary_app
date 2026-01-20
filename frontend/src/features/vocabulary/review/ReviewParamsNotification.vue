<template>
  <!-- 复习模式通知 -->
  <ReviewModeNotification
    v-if="paramType === 'ease_factor'"
    :show="show"
    :word="word"
    :param-change="paramChange"
    :new-param-value="newParamValue"
    :next-review-date="nextReviewDate"
    :breakdown="breakdown"
    @close="$emit('close')"
  />

  <!-- 拼写模式通知 -->
  <SpellingModeNotification
    v-else
    :show="show"
    :word="word"
    :param-type="paramType"
    :param-change="paramChange"
    :new-param-value="newParamValue"
    :next-review-date="nextReviewDate"
    :breakdown="breakdown"
    @close="$emit('close')"
  />
</template>

<script setup lang="ts">
import ReviewModeNotification from './ReviewModeNotification.vue'
import SpellingModeNotification from '../spelling/SpellingModeNotification.vue'

// 通用的 breakdown 类型，兼容复习和拼写模式
interface BreakdownData {
  elapsed_time?: number
  remembered?: boolean
  score?: number
  repetition?: number
  interval?: number
  typed_count?: number
  backspace_count?: number
  word_length?: number
  [key: string]: unknown
}

interface Props {
  word: string
  paramType: 'ease_factor' | 'spell_strength'
  paramChange: number
  newParamValue: number
  nextReviewDate: string
  show?: boolean
  breakdown?: BreakdownData
}

withDefaults(defineProps<Props>(), {
  show: true
})

defineEmits<{
  close: []
}>()
</script>

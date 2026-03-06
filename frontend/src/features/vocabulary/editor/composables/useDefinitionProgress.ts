import { ref, computed } from 'vue'

export function useDefinitionProgress() {
  const isActive = ref(false)
  const current = ref(0)
  const total = ref(0)
  const label = ref('')
  const failedCount = ref(0)
  const failedWords = ref<string[]>([])
  /** true = running, false but failedWords.length > 0 = showing failure summary */
  const showFailureSummary = ref(false)

  const progress = computed(() =>
    total.value > 0 ? Math.round((current.value / total.value) * 100) : 0
  )

  function start(count: number, text: string) {
    isActive.value = true
    showFailureSummary.value = false
    current.value = 0
    total.value = count
    label.value = text
    failedCount.value = 0
    failedWords.value = []
  }

  function increment() {
    current.value++
  }

  function incrementFailed(wordText?: string) {
    current.value++
    failedCount.value++
    if (wordText) {
      failedWords.value.push(wordText)
    }
  }

  /** Call when the batch operation finishes. Shows failure summary if needed. */
  function finish() {
    isActive.value = false
    if (failedWords.value.length > 0) {
      showFailureSummary.value = true
    } else {
      // 无失败时立即清理所有状态
      current.value = 0
      total.value = 0
      label.value = ''
    }
  }

  /** Dismiss the failure summary */
  function dismiss() {
    showFailureSummary.value = false
    current.value = 0
    total.value = 0
    label.value = ''
    failedCount.value = 0
    failedWords.value = []
  }

  return {
    isActive,
    current,
    total,
    label,
    failedCount,
    failedWords,
    showFailureSummary,
    progress,
    start,
    increment,
    incrementFailed,
    finish,
    dismiss,
  }
}

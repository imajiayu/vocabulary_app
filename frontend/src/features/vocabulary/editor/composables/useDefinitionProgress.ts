import { ref, computed } from 'vue'

export function useDefinitionProgress() {
  const isActive = ref(false)
  const current = ref(0)
  const total = ref(0)
  const label = ref('')
  const failedCount = ref(0)

  const progress = computed(() =>
    total.value > 0 ? Math.round((current.value / total.value) * 100) : 0
  )

  function start(count: number, text: string) {
    isActive.value = true
    current.value = 0
    total.value = count
    label.value = text
    failedCount.value = 0
  }

  function increment() {
    current.value++
  }

  function incrementFailed() {
    current.value++
    failedCount.value++
  }

  function reset() {
    isActive.value = false
    current.value = 0
    total.value = 0
    label.value = ''
    failedCount.value = 0
  }

  return {
    isActive,
    current,
    total,
    label,
    failedCount,
    progress,
    start,
    increment,
    incrementFailed,
    reset,
  }
}

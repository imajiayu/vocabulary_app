import { ref, onUnmounted } from 'vue'

interface LookupResult {
  word: string
  phonetic?: {
    us?: string
    uk?: string
  }
  definitions?: string[]
  error?: string
}

export function useWordLookup() {
  const lookupWord = ref('')
  const isLookupLoading = ref(false)
  const lookupResult = ref<LookupResult | null>(null)
  let lookupTimeout: NodeJS.Timeout | null = null

  // Look up word definition from dictionary API
  async function lookupDefinition() {
    if (!lookupWord.value.trim()) return

    isLookupLoading.value = true
    try {
      // dictionaryapi.dev supports CORS, no proxy needed
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lookupWord.value.trim())}`
      )

      if (response.ok) {
        const data = await response.json()
        if (data && data[0]) {
          const entry = data[0]
          lookupResult.value = {
            word: entry.word,
            phonetic: {
              us: entry.phonetic || (entry.phonetics && entry.phonetics[0]?.text),
              uk: entry.phonetic || (entry.phonetics && entry.phonetics[1]?.text)
            },
            definitions: entry.meanings?.[0]?.definitions?.slice(0, 3)?.map((def: { definition: string }) => def.definition) || []
          }
        }
      } else {
        lookupResult.value = {
          word: lookupWord.value,
          error: '未找到该单词的释义'
        }
      }
    } catch {
      lookupResult.value = {
        word: lookupWord.value,
        error: '查询失败，请检查网络连接'
      }
    } finally {
      isLookupLoading.value = false
    }
  }

  // Debounced input handler
  function handleLookupInput() {
    if (lookupTimeout) {
      clearTimeout(lookupTimeout)
    }

    lookupResult.value = null

    if (!lookupWord.value.trim()) {
      return
    }

    lookupTimeout = setTimeout(() => {
      lookupDefinition()
    }, 800)
  }

  // Close lookup result
  function closeLookupResult() {
    lookupResult.value = null
  }

  // Clear lookup input and result
  function clearLookup() {
    lookupWord.value = ''
    lookupResult.value = null
    if (lookupTimeout) {
      clearTimeout(lookupTimeout)
      lookupTimeout = null
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    if (lookupTimeout) {
      clearTimeout(lookupTimeout)
    }
  })

  return {
    lookupWord,
    isLookupLoading,
    lookupResult,
    lookupDefinition,
    handleLookupInput,
    closeLookupResult,
    clearLookup
  }
}

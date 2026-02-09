/**
 * 复习进度管理：debounced index update, beforeunload, cleanup
 */
import { api } from '@/shared/api'
import { useAuth, getCurrentUserId } from '@/shared/composables/useAuth'
import { reviewLogger as log } from '@/shared/utils/logger'

export function useReviewProgress() {
  const { session: authSession } = useAuth()

  let pendingIndexValue: number | null = null
  let indexDebounceTimer: ReturnType<typeof setTimeout> | null = null

  const flushProgressIndex = () => {
    if (pendingIndexValue !== null) {
      const value = pendingIndexValue
      pendingIndexValue = null
      if (indexDebounceTimer) {
        clearTimeout(indexDebounceTimer)
        indexDebounceTimer = null
      }
      api.progress.updateProgressIndexDirect(value)
        .catch(err => log.warn('Failed to flush progress index:', err))
    }
  }

  const cancelPendingIndex = () => {
    pendingIndexValue = null
    if (indexDebounceTimer) {
      clearTimeout(indexDebounceTimer)
      indexDebounceTimer = null
    }
  }

  const debouncedUpdateProgressIndex = (index: number) => {
    pendingIndexValue = index
    if (indexDebounceTimer) clearTimeout(indexDebounceTimer)
    indexDebounceTimer = setTimeout(flushProgressIndex, 5000)
  }

  // beforeunload: keepalive fetch 保证页面关闭时请求送达
  let beforeUnloadHandler: (() => void) | null = null

  const registerBeforeUnload = () => {
    if (typeof window === 'undefined') return

    beforeUnloadHandler = () => {
      try {
        if (pendingIndexValue === null) return
        const value = pendingIndexValue
        pendingIndexValue = null
        if (indexDebounceTimer) {
          clearTimeout(indexDebounceTimer)
          indexDebounceTimer = null
        }
        const token = authSession.value?.access_token
        if (!token) return
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/current_progress?user_id=eq.${getCurrentUserId()}`
        fetch(url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ current_index: value }),
          keepalive: true
        }).catch(() => {})
      } catch {}
    }

    window.addEventListener('beforeunload', beforeUnloadHandler)
  }

  const cleanup = () => {
    cancelPendingIndex()
    if (beforeUnloadHandler && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', beforeUnloadHandler)
      beforeUnloadHandler = null
    }
  }

  // 自动注册
  registerBeforeUnload()

  return {
    flushProgressIndex,
    cancelPendingIndex,
    debouncedUpdateProgressIndex,
    cleanup,
  }
}

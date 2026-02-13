import { ref, readonly } from 'vue'

const MOBILE_BREAKPOINT = '(max-width: 768px)'

const mql = window.matchMedia(MOBILE_BREAKPOINT)
const _isMobile = ref(mql.matches)
const _isDesktop = ref(!mql.matches)

mql.addEventListener('change', (e) => {
  _isMobile.value = e.matches
  _isDesktop.value = !e.matches
})

export function useBreakpoint() {
  return {
    isMobile: readonly(_isMobile),
    isDesktop: readonly(_isDesktop),
  }
}

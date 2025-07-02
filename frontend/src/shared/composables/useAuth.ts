/**
 * Auth Composable — Supabase Auth (Google OAuth)
 *
 * Replaces useUserSelection.ts. All API files import getCurrentUserId() from here.
 */
import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { supabase } from '@/shared/config/supabase'
import type { User, Session } from '@supabase/supabase-js'

// ── Singleton reactive state ──
const currentUser = ref<User | null>(null)
const session = ref<Session | null>(null)
const isLoading = ref(true)
let _initPromise: Promise<void> | null = null

/**
 * Get current user UUID (non-reactive, for API calls).
 * Throws if not authenticated — callers should ensure auth guard is in place.
 */
export function getCurrentUserId(): string {
  const uid = currentUser.value?.id
  if (!uid) throw new Error('Not authenticated')
  return uid
}

/**
 * Auth composable
 */
export function useAuth() {
  const isAuthenticated: ComputedRef<boolean> = computed(() => !!currentUser.value)

  const userEmail: ComputedRef<string> = computed(
    () => currentUser.value?.email ?? ''
  )

  const userAvatarUrl: ComputedRef<string> = computed(
    () => (currentUser.value?.user_metadata?.avatar_url as string) ?? ''
  )

  const userName: ComputedRef<string> = computed(
    () => (currentUser.value?.user_metadata?.full_name as string) ?? userEmail.value
  )

  /**
   * Initialize auth state: restore session + listen for changes.
   * Safe to call multiple times — only runs once.
   */
  async function initAuth(): Promise<void> {
    if (_initPromise) return _initPromise

    _initPromise = (async () => {
      try {
        // Restore existing session
        const { data } = await supabase.auth.getSession()
        session.value = data.session
        currentUser.value = data.session?.user ?? null
      } catch {
        // Session restore failed — user will be redirected to login
      } finally {
        isLoading.value = false
      }

      // Listen for auth state changes (login, logout, token refresh)
      supabase.auth.onAuthStateChange((_event, newSession) => {
        session.value = newSession
        currentUser.value = newSession?.user ?? null
      })
    })()

    return _initPromise
  }

  /**
   * Sign in with Google OAuth.
   * Redirects to Google, then back to the app.
   */
  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (error) throw error
  }

  /**
   * Sign in with GitHub OAuth.
   * Redirects to GitHub, then back to the app.
   */
  async function signInWithGitHub() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (error) throw error
  }

  /**
   * Sign out the current user.
   */
  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    currentUser.value = null
    session.value = null
  }

  return {
    // State
    currentUser: currentUser as Ref<User | null>,
    session: session as Ref<Session | null>,
    isLoading: isLoading as Ref<boolean>,
    isAuthenticated,
    userEmail,
    userAvatarUrl,
    userName,

    // Methods
    initAuth,
    signInWithGoogle,
    signInWithGitHub,
    signOut,
  }
}

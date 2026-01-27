/**
 * 用户选择 Composable
 * 管理多用户切换，使用 localStorage 持久化
 */
import { ref, watch } from 'vue'

const STORAGE_KEY = 'vocabulary_app_user_id'
const VALID_USER_IDS = [1, 2] as const
const DEFAULT_USER_ID = 1

type UserId = typeof VALID_USER_IDS[number]

// 从 localStorage 读取当前用户 ID
function getStoredUserId(): UserId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (VALID_USER_IDS.includes(parsed as UserId)) {
        return parsed as UserId
      }
    }
  } catch {
    // localStorage 不可用时忽略错误
  }
  return DEFAULT_USER_ID
}

// 响应式状态 - 单例
const currentUserId = ref<UserId>(getStoredUserId())

// 用户名称映射（姓氏）
const USER_NAMES: Record<UserId, string> = {
  1: '马',
  2: '苗'
}

/**
 * 获取当前用户 ID（非响应式，供 API client 使用）
 */
export function getCurrentUserId(): UserId {
  return currentUserId.value
}

/**
 * 用户选择 Composable
 */
export function useUserSelection() {
  // 切换用户
  const switchUser = (userId: UserId) => {
    if (!VALID_USER_IDS.includes(userId)) {
      console.warn(`Invalid user ID: ${userId}`)
      return
    }

    if (userId === currentUserId.value) {
      return
    }

    // 更新状态
    currentUserId.value = userId

    // 持久化到 localStorage
    try {
      localStorage.setItem(STORAGE_KEY, String(userId))
    } catch {
      // localStorage 不可用时忽略错误
    }

    // 刷新页面以重新加载数据
    window.location.reload()
  }

  // 获取用户名称
  const getUserName = (userId: UserId): string => {
    return USER_NAMES[userId] || `用户 ${userId}`
  }

  // 获取当前用户名称
  const currentUserName = () => getUserName(currentUserId.value)

  return {
    currentUserId,
    validUserIds: VALID_USER_IDS,
    switchUser,
    getUserName,
    currentUserName
  }
}

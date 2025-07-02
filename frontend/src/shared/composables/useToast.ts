import { inject } from 'vue'
import { logger } from '@/shared/utils/logger'

export interface ToastOptions {
  type?: 'success' | 'error' | 'warning' | 'info'
  message: string
  dismissible?: boolean
  duration?: number
}

export interface ToastApi {
  add: (options: ToastOptions) => string
  remove: (id: string) => void
  success: (message: string, options?: Partial<ToastOptions>) => string
  error: (message: string, options?: Partial<ToastOptions>) => string
  warning: (message: string, options?: Partial<ToastOptions>) => string
  info: (message: string, options?: Partial<ToastOptions>) => string
}

/**
 * 使用 Toast 通知
 *
 * @example
 * ```vue
 * <script setup>
 * import { useToast } from '@/shared/composables/useToast'
 *
 * const toast = useToast()
 *
 * // 快捷方法
 * toast.success('操作成功')
 * toast.error('操作失败')
 * toast.warning('请注意')
 * toast.info('提示信息')
 *
 * // 自定义选项
 * toast.add({
 *   type: 'success',
 *   message: '保存成功',
 *   duration: 5000,
 *   dismissible: true
 * })
 * </script>
 * ```
 *
 * 注意：需要在应用根组件挂载 ToastContainer
 */
export function useToast(): ToastApi {
  const toast = inject<ToastApi>('toast')

  if (!toast) {
    logger.warn('[useToast] ToastContainer not found. Please add <ToastContainer /> to your app root.')
    // 返回空操作，避免运行时错误
    return {
      add: () => '',
      remove: () => {},
      success: () => '',
      error: () => '',
      warning: () => '',
      info: () => ''
    }
  }

  return toast
}

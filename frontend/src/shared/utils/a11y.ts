/**
 * 可访问性工具函数
 *
 * 基于 FRONTEND_DESIGN_OPTIMIZATION.md 7.4 节实现。
 */

/**
 * 将十六进制颜色转换为 RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // 移除 # 前缀
  hex = hex.replace(/^#/, '')

  // 处理缩写格式 (如 #fff -> #ffffff)
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('')
  }

  if (hex.length !== 6) {
    return null
  }

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

/**
 * 计算颜色的相对亮度
 * 基于 WCAG 2.1 公式
 */
export function getLuminance(color: string): number {
  const rgb = hexToRgb(color)
  if (!rgb) return 0

  const { r, g, b } = rgb
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * 计算两个颜色之间的对比度
 * 返回值范围 1-21
 */
export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1)
  const lum2 = getLuminance(color2)
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * 检查颜色组合是否符合 WCAG 标准
 */
export function meetsWCAG(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  isLargeText = false
): boolean {
  const ratio = getContrastRatio(foreground, background)

  if (level === 'AAA') {
    return isLargeText ? ratio >= 4.5 : ratio >= 7
  }
  return isLargeText ? ratio >= 3 : ratio >= 4.5
}

/**
 * 通知屏幕阅读器
 * 创建一个临时的 aria-live 区域来播报消息
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.setAttribute('class', 'sr-only')
  announcement.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `

  document.body.appendChild(announcement)

  // 使用 requestAnimationFrame 确保元素已渲染
  requestAnimationFrame(() => {
    announcement.textContent = message
  })

  // 一段时间后移除元素
  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}

/**
 * 管理焦点陷阱
 * 用于模态框等需要限制焦点范围的场景
 */
export class FocusTrap {
  private container: HTMLElement
  private firstFocusable: HTMLElement | null = null
  private lastFocusable: HTMLElement | null = null
  private previousFocus: HTMLElement | null = null

  constructor(container: HTMLElement) {
    this.container = container
  }

  private getFocusableElements(): HTMLElement[] {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ]

    return Array.from(
      this.container.querySelectorAll<HTMLElement>(focusableSelectors.join(', '))
    ).filter(el => el.offsetParent !== null) // 排除不可见元素
  }

  private handleKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return

    const focusableElements = this.getFocusableElements()
    if (focusableElements.length === 0) return

    this.firstFocusable = focusableElements[0]
    this.lastFocusable = focusableElements[focusableElements.length - 1]

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === this.firstFocusable) {
        e.preventDefault()
        this.lastFocusable?.focus()
      }
    } else {
      // Tab
      if (document.activeElement === this.lastFocusable) {
        e.preventDefault()
        this.firstFocusable?.focus()
      }
    }
  }

  /**
   * 激活焦点陷阱
   */
  activate(): void {
    this.previousFocus = document.activeElement as HTMLElement

    // 聚焦到容器内第一个可聚焦元素
    const focusableElements = this.getFocusableElements()
    if (focusableElements.length > 0) {
      focusableElements[0].focus()
    }

    this.container.addEventListener('keydown', this.handleKeydown)
  }

  /**
   * 停用焦点陷阱
   */
  deactivate(): void {
    this.container.removeEventListener('keydown', this.handleKeydown)

    // 恢复之前的焦点
    if (this.previousFocus && document.body.contains(this.previousFocus)) {
      this.previousFocus.focus()
    }
  }
}

/**
 * 开发环境下检查对比度
 */
export function checkContrastInDev(): void {
  if (import.meta.env.PROD) return

  const checkContrast = () => {
    const styles = getComputedStyle(document.documentElement)

    const checks = [
      {
        name: 'Primary text on page background',
        fg: styles.getPropertyValue('--color-text-primary').trim(),
        bg: styles.getPropertyValue('--color-bg-primary').trim() || '#FAF7F2'
      },
      {
        name: 'Secondary text on page background',
        fg: styles.getPropertyValue('--color-text-secondary').trim(),
        bg: styles.getPropertyValue('--color-bg-primary').trim() || '#FAF7F2'
      }
    ]

    checks.forEach(({ name, fg, bg }) => {
      if (!fg || !bg) return

      const ratio = getContrastRatio(fg, bg)
      const passes = meetsWCAG(fg, bg)

      if (!passes) {
        console.warn(
          `[A11y] ${name}: contrast ratio ${ratio.toFixed(2)}:1 does not meet WCAG AA standard (requires 4.5:1)`
        )
      }
    })
  }

  // 页面加载后检查
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkContrast)
  } else {
    checkContrast()
  }
}

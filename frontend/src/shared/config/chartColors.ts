/**
 * 图表和统计页面的颜色配置
 * 集中管理所有图表相关的颜色值，便于统一维护
 */

// 调色板 - 用于图表系列颜色
export const palette = {
  // 主要颜色
  primary: '#1677ff',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',

  // 扩展颜色
  teal: '#36cfc9',
  orange: '#fa8c16',
  blue: '#1890ff',
  purple: '#9254de',
  green: '#52c41a',
  red: '#ff4d4f',
  yellow: '#fadb14',
  pink: '#eb2f96',
  gray: '#8c8c8c',
  cyan: '#13c2c2',
} as const

// 热力图颜色
export const heatmapColors = {
  // 拼写强度热力图
  spell: {
    hasStrength: '#2e7d32',    // 有拼写强度
    notSpelled: '#4da6ff',     // 未拼写过
    notAvailable: '#cbcbcb',   // 不可拼写
  },

  // EF(难度系数)热力图
  ef: {
    mastered: '#1890ff',       // 熟练单词
    difficult: '#ff4d4f',      // 困难单词
  },
} as const

// 状态颜色
export const statusColors = {
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
  info: '#1890ff',
} as const

// 文本颜色
export const textColors = {
  primary: '#2c3e50',
  secondary: '#64748b',
  muted: '#8c8c8c',
  disabled: '#595959',
} as const

// 边框颜色
export const borderColors = {
  light: '#e8e8e8',
  medium: '#d9d9d9',
  focus: '#1890ff',
  error: '#ff4d4f',
} as const

// 背景颜色
export const bgColors = {
  light: '#f5f5f5',
  hover: '#e8e8e8',
  error: '#fff2f0',
  errorBorder: '#ffccc7',
} as const

// 按钮颜色
export const buttonColors = {
  primary: '#1890ff',
  primaryHover: '#40a9ff',
  disabled: '#d9d9d9',
  disabledText: '#8c8c8c',
} as const

// 导出类型
export type PaletteKey = keyof typeof palette
export type StatusColorKey = keyof typeof statusColors

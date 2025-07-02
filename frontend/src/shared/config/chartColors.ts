/**
 * 图表和统计页面的颜色配置
 * Editorial Study 风格 - 学术感配色
 */

// 调色板 - 用于图表系列颜色
export const palette = {
  // 主要颜色（学术风）
  primary: '#996B3D',    // 铜褐
  success: '#5D7A5D',    // 橄榄绿
  warning: '#B8860B',    // 暗金
  danger: '#9B3B3B',     // 砖红

  // 扩展颜色
  teal: '#4A7A7A',
  orange: '#B87333',
  blue: '#5D6D7E',
  purple: '#6B4F0F',
  green: '#5D7A5D',
  red: '#9B3B3B',
  yellow: '#C4A000',
  pink: '#A05050',
  gray: '#7A7A7A',
  cyan: '#4A7A7A',
} as const

// 热力图颜色
export const heatmapColors = {
  // 拼写强度热力图
  spell: {
    hasStrength: '#4A6B4A',    // 有拼写强度（橄榄绿深）
    notSpelled: '#8B7355',     // 未拼写过（沙褐）
    notAvailable: '#C4B8A8',   // 不可拼写（温暖灰）
  },

  // EF(难度系数)热力图
  ef: {
    mastered: '#5D7A5D',       // 熟练单词
    difficult: '#9B3B3B',      // 困难单词
  },
} as const

// 文本颜色
export const textColors = {
  primary: '#2D3748',
  secondary: '#5A6578',
  muted: '#8A94A6',
  disabled: '#A0A8B8',
} as const

// 边框颜色
export const borderColors = {
  light: '#E8E0D5',
  medium: '#D4C9B8',
  focus: '#996B3D',
  error: '#9B3B3B',
} as const

// 导出类型
export type PaletteKey = keyof typeof palette

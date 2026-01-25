/**
 * 统计页面热力图颜色计算
 * 从后端 word_stats.py 迁移
 */
import { heatmapColors } from '@/shared/config/chartColors'

const MAX_SPELL_STRENGTH = 5.0

/**
 * 计算拼写热力图单元格颜色
 */
export function calcSpellColor(
  spellStrength: number | null,
  available: boolean
): string {
  if (!available) {
    return heatmapColors.spell.notAvailable
  }
  if (spellStrength === null) {
    return heatmapColors.spell.notSpelled
  }
  // 绿色渐变 - 已拼写 (橄榄绿色系 rgb(74,106,74))
  const clamped = Math.max(0, Math.min(1, spellStrength / MAX_SPELL_STRENGTH))
  const alpha = 0.15 + 0.85 * clamped
  return `rgba(74,106,74,${alpha.toFixed(3)})`
}

/**
 * 计算拼写热力图tooltip
 */
export function calcSpellTooltip(
  word: string,
  spellStrength: number | null,
  available: boolean
): string {
  if (!available) {
    return `${word}\n不可拼写`
  }
  if (spellStrength === null) {
    return `${word}\n未拼写过`
  }
  return `${word}\n分数: ${spellStrength.toFixed(1)}`
}

/**
 * 计算EF热力图单元格颜色
 * EF范围: 1.3 (困难/砖红) -> 2.5 (中性/白) -> 3.0+ (熟练/橄榄绿)
 */
export function calcEfColor(ef: number | null): string {
  if (ef === null) {
    return '#ffffff'
  }
  if (ef <= 1.3) {
    return heatmapColors.ef.difficult // 砖红 - 困难
  }
  if (ef >= 3.0) {
    return heatmapColors.ef.mastered // 橄榄绿 - 熟练
  }
  if (ef === 2.5) {
    return '#ffffff' // 白色 - 中性
  }
  if (ef < 2.5) {
    // 砖红(155,59,59)到白色渐变
    const t = (ef - 1.3) / (2.5 - 1.3)
    const r = Math.round(155 + (255 - 155) * t)
    const g = Math.round(59 + (255 - 59) * t)
    const b = Math.round(59 + (255 - 59) * t)
    return `rgb(${r},${g},${b})`
  }
  // ef > 2.5 && ef < 3.0: 白色到橄榄绿(93,122,93)渐变
  const t = (ef - 2.5) / (3.0 - 2.5)
  const r = Math.round(255 - (255 - 93) * t)
  const g = Math.round(255 - (255 - 122) * t)
  const b = Math.round(255 - (255 - 93) * t)
  return `rgb(${r},${g},${b})`
}

/**
 * 计算EF热力图tooltip
 */
export function calcEfTooltip(word: string, ef: number | null): string {
  return ef !== null ? `${word}: ${ef.toFixed(2)}` : `${word}: 0.00`
}

/**
 * 热力图单元格数据结构
 */
export interface HeatmapCell {
  word: string
  value: number | null
  available: boolean
  color: string
  tooltip: string
}

/**
 * 从原始单词数据生成拼写热力图单元格
 */
export function generateSpellHeatmapCell(row: {
  word: string
  spell_strength: number | null
  spell_available: boolean
}): HeatmapCell {
  const available = row.spell_available
  const value = row.spell_strength
  return {
    word: row.word,
    value,
    available,
    color: calcSpellColor(value, available),
    tooltip: calcSpellTooltip(row.word, value, available)
  }
}

/**
 * 从原始单词数据生成EF热力图单元格
 */
export function generateEfHeatmapCell(row: {
  word: string
  ease_factor: number | null
}): HeatmapCell {
  const value = row.ease_factor
  return {
    word: row.word,
    value,
    available: true,
    color: calcEfColor(value),
    tooltip: calcEfTooltip(row.word, value)
  }
}

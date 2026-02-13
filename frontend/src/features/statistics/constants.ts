import type { ChartDefinition } from './types'
import { palette } from '@/shared/config/chartColors'

/**
 * 图表定义 — 错落积木布局（4列网格，无留白）
 *
 *   Row 1:  [─1─] [─────3─────]          窄+宽
 *   Row 2:  [──2──] [─1─] [─1─]          宽+窄窄
 *   Row 3:  [──2──] [──2──]              对称双栏
 *   Row 4:  [──2──] [──2──]              对称双栏
 *   Row 5:  [─────3─────] [─1─]          宽+窄（首行镜像）
 */
export const CHART_DEFINITIONS: readonly ChartDefinition[] = [
  // Row 1: 1+3 — 概览入口
  { id: 'ef-pie',                title: 'EF 阶段占比',         span: 1, heightClass: '', accent: palette.orange },
  { id: 'added-review-trend',    title: '新增与复习趋势',       span: 3, heightClass: '', accent: palette.purple },
  // Row 2: 2+1+1 — 宽左窄右
  { id: 'review-count',          title: '复习次数分布',         span: 2, heightClass: '', accent: palette.yellow },
  { id: 'ef-histogram',          title: 'EF 分布柱状图',       span: 1, heightClass: '', accent: palette.teal },
  { id: 'reaction-time',         title: '反应时间分布图',       span: 1, heightClass: '', accent: palette.orange },
  // Row 3: 2+2 — 对称
  { id: 'accuracy-analysis',     title: '正确率分析',           span: 2, heightClass: '', accent: palette.green },
  { id: 'spell-strength',        title: '拼写强度累积分布图',   span: 2, heightClass: '', accent: palette.green },
  // Row 4: 2+2 — 对称
  { id: 'daily-activity',        title: '每日学习量',           span: 2, heightClass: '', accent: palette.blue },
  { id: 'interval-distribution', title: '复习间隔分布',         span: 2, heightClass: '', accent: palette.blue },
  // Row 5: 3+1 — 首行镜像收尾
  { id: 'study-heatmap',         title: '学习时段分布',         span: 3, heightClass: '', accent: palette.purple },
  { id: 'daily-accuracy',        title: '每日正确率趋势',       span: 1, heightClass: '', accent: palette.green },
]

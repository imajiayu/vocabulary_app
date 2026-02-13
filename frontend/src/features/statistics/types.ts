export type ChartId = 'review-count' | 'spell-strength' | 'ef-histogram'
  | 'reaction-time' | 'added-review-trend' | 'ef-pie'
  | 'interval-distribution' | 'accuracy-analysis'
  | 'daily-activity' | 'daily-accuracy' | 'study-heatmap'

export interface ChartDefinition {
  id: ChartId
  title: string
  span: 1 | 2 | 3 | 4     // 固定列宽（4列网格）
  heightClass: '' | 'h-compact' | 'h-tall'
  accent?: string           // 左侧色条（CSS颜色值）
}

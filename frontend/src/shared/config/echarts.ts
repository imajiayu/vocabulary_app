/**
 * ECharts 按需导入配置
 * 仅注册项目实际使用的组件，减少约 700KB 包体积
 */
import * as echarts from 'echarts/core'

import { LineChart, BarChart, PieChart, CustomChart, GraphChart } from 'echarts/charts'

import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from 'echarts/components'

import { CanvasRenderer } from 'echarts/renderers'

import type {
  LineSeriesOption,
  BarSeriesOption,
  PieSeriesOption,
  CustomSeriesOption,
  GraphSeriesOption,
} from 'echarts/charts'

import type {
  GridComponentOption,
  TooltipComponentOption,
  LegendComponentOption,
  TitleComponentOption,
} from 'echarts/components'

import type { ComposeOption } from 'echarts/core'

// 注册组件
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  CustomChart,
  GraphChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
])

// 组合类型 — 仅包含项目实际使用的选项
export type EChartsOption = ComposeOption<
  | LineSeriesOption
  | BarSeriesOption
  | PieSeriesOption
  | CustomSeriesOption
  | GraphSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | TitleComponentOption
>

// 导出 init 和 ECharts 实例类型
export const init = echarts.init
export type ECharts = ReturnType<typeof echarts.init>

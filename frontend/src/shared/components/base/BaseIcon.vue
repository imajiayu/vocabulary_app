<template>
  <component
    :is="iconComponent"
    v-if="iconComponent"
    :size="sizeMap[size]"
    :stroke-width="strokeWidth"
    :class="['icon', `icon--${size}`, colorClass]"
    :aria-hidden="!ariaLabel"
    :aria-label="ariaLabel"
  />
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  X, Check, Ban, ArrowRight, PartyPopper, Settings, AlertTriangle,
  Trash2, Plus, Eye, EyeOff, CheckCircle, XCircle, Info,
  GripVertical, LayoutGrid, RotateCcw
} from 'lucide-vue-next'
import { logger } from '@/shared/utils/logger'

const iconMap: Record<string, Component> = {
  X, Check, Ban, ArrowRight, PartyPopper, Settings, AlertTriangle,
  Trash2, Plus, Eye, EyeOff, CheckCircle, XCircle, Info,
  GripVertical, LayoutGrid, RotateCcw
}

interface Props {
  /** 图标名称（Lucide 图标名） */
  name: string
  /** 图标尺寸 */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** 图标颜色 */
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'muted' | 'inherit'
  /** 线条粗细 */
  strokeWidth?: number
  /** 无障碍标签 */
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  strokeWidth: 2,
  color: 'inherit'
})

const sizeMap: Record<string, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32
}

const iconComponent = computed(() => {
  const icon = iconMap[props.name]
  if (!icon) {
    logger.warn(`[BaseIcon] Unknown icon name: ${props.name}`)
    return null
  }
  return icon
})

const colorClass = computed(() => props.color !== 'inherit' ? `icon--${props.color}` : '')
</script>

<style scoped>
.icon {
  flex-shrink: 0;
  display: inline-block;
  vertical-align: middle;
}

/* 颜色变体 */
.icon--primary { color: var(--color-brand-primary); }
.icon--secondary { color: var(--color-brand-secondary); }
.icon--success { color: var(--color-state-success); }
.icon--warning { color: var(--color-state-warning); }
.icon--danger { color: var(--color-state-error); }
.icon--muted { color: var(--color-text-muted); }
</style>

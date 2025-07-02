<script setup lang="ts">
import { computed } from 'vue'
import WheelSelector from './WheelSelector.vue'

interface Props {
    /** 按钮图标 */
    icon: string
    /** 按钮标题 */
    title: string
    /** 计数值 (undefined → 不显示；0 → 显示 0；>0 → 显示 x/count + 滚轮) */
    count?: number
    /** 背景颜色 */
    background?: string
    /** 边框颜色 */
    borderColor?: string
    /** 滚轮默认值 */
    wheelValue?: number
    /** 按钮样式变体 */
    variant?: 'default' | 'compact'
    /** 滚轮最大可选值限制（默认 200，防止单词太多时 DOM 过载） */
    maxWheel?: number
}

const props = withDefaults(defineProps<Props>(), {
    background: '#fff',
    borderColor: 'rgba(0,0,0,0.1)',
    wheelValue: 1,
    variant: 'default',
    maxWheel: 500,
})

// 计算滚轮实际使用的最大值（取 count 和 maxWheel 的较小值）
const effectiveMax = computed(() => {
    if (props.count === undefined) return props.maxWheel
    return Math.min(props.count, props.maxWheel)
})

const emit = defineEmits<{
    (e: 'click'): void
    (e: 'update:wheelValue', value: number): void
}>()

const handleWheelChange = (val: number) => {
    if (props.count !== undefined) {
        emit('update:wheelValue', Math.min(val, props.count))
    }
}

const handleClick = () => {
    if (props.count === 0 || props.wheelValue === 0) return
    emit('click')
}
</script>

<template>
    <div class="tile" :class="[`tile--${variant}`, `index-button--${variant}`]" :style="{ border: `1px solid ${borderColor}`, background: background }" @click="handleClick">
        <!-- compact变体：居中对齐 -->
        <div v-if="variant === 'compact'" class="tile-compact">
            <div class="tile-icon">{{ icon }}</div>
            <div class="tile-title">{{ title }}</div>
        </div>

        <!-- default变体：原有布局 -->
        <template v-else>
            <!-- 左侧：图标 + 文本 + 计数 -->
            <div class="tile-left">
                <div class="tile-icon">{{ icon }}</div>
                <div class="tile-row">
                    <div class="tile-title">{{ title }}</div>
                    <div v-if="count !== undefined" class="tile-count">
                        <span v-if="count === 0">0</span>
                        <span v-else>{{ wheelValue }}/{{ count }}</span>
                    </div>
                </div>
            </div>

            <div class="tile-right" @click.stop>
                <WheelSelector v-if="count !== undefined" :model-value="wheelValue" :max="effectiveMax" :display-max="count" :min="0"
                    @update:model-value="handleWheelChange" />
            </div>
        </template>
    </div>
</template>

<style scoped>
.tile {
    position: relative;
    /* ✅ 关键改动：父元素定位 */
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: 14px;
    padding: 16px;
    cursor: pointer;
    color: var(--color-text-primary);
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
    transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.tile:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
}

.tile-left {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
}

.tile-icon {
    font-size: 22px;
}

.tile-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.tile-title {
    font-weight: 700;
    font-size: 16px;
}

.tile-count {
    font-weight: 700;
    color: var(--color-text-primary);
    white-space: nowrap;
}

/* 右侧滚轮容器 */
.tile-right {
    position: relative;
    /* ✅ 关键改动：为滚轮定位参考 */
    width: 60px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Compact变体样式 */
.tile--compact {
    /* 移除aspect-ratio，高度自然和default按钮一致，只控制布局 */
}

.tile-compact {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    height: 100%;
}

.tile--compact .tile-icon {
    font-size: 28px;
}

.tile--compact .tile-title {
    font-weight: 700;
    font-size: 14px;
    text-align: center;
    line-height: 1.2;
}

/* 移动端compact按钮优化 */
@media (max-width: 768px) {
    .tile--compact .tile-icon {
        font-size: 24px;
    }

    .tile--compact .tile-title {
        font-size: 13px;
    }
}

/* 小屏手机compact按钮优化 */
@media (max-width: 768px) {
    .tile--compact .tile-icon {
        font-size: 22px;
    }

    .tile--compact .tile-title {
        font-size: 12px;
    }
}
</style>

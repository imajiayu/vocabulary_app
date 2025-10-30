<template>
    <div class="word-review-container">
        <div class="content-area">
            <WordDetailsReview :word="word" :only-show-word="!showDefinition" :horizontal="true" />
            <RelatedWordsDisplay v-if="word.related_words && word.related_words.length > 0 && showDefinition"
                :relatedWords="word.related_words" />
        </div>

        <div class="button-bar">
            <div v-show="!showDefinition" class="button-group">
                <div class="row-buttons">
                    <button class="button yes-button" @click="handleChoice('yes')" :disabled="isSubmitting">
                        记住 ✅
                    </button>
                    <button class="button no-button" @click="handleChoice('no')" :disabled="isSubmitting">
                        没记住 ❌
                    </button>
                </div>
                <div class="row-buttons">
                    <button class="button full-width stop-button" @click="handleChoice('stop')"
                        :disabled="isSubmitting">
                        不再复习 🚫
                    </button>
                </div>
            </div>

            <div v-show="showDefinition" class="button-group">
                <div class="row-buttons">
                    <button class="button correction-button" @click="handleCorrection" :disabled="isSubmitting">
                        记错了 ❌
                    </button>
                    <button class="button next-button" @click="handleNext" :disabled="isSubmitting" :class="{
                        'next-yes': pendingChoice === 'yes',
                        'next-no': pendingChoice === 'no'
                    }">
                        下一个 ➡️
                    </button>
                </div>
            </div>

            <!-- 重置计时器按钮 - 只在第一阶段显示，且不在错题模式 -->
            <div v-show="!showDefinition && !isLapseMode" class="reset-timer-wrapper">
                <button class="reset-timer-button" @click="handleResetTimer" @mouseenter="showResetTooltip = true"
                    @mouseleave="showResetTooltip = false" title="重置计时器">
                    🔄
                </button>
                <div v-show="showResetTooltip" class="reset-timer-tooltip">
                    重置计时器
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import type { AudioType } from '@/features/vocabulary/stores/review'
import { Word } from '@/shared/types'
import WordDetailsReview from './WordDetailsReview.vue'
import { playWordAudio } from '@/shared/utils/playWordAudio'
import RelatedWordsDisplay from '@/shared/components/ui/RelatedWordsDisplay.vue'
import { useAudioAccent } from '@/shared/composables/useAudioAccent'
import { useHotkeys } from '@/shared/composables/useHotkeys'
import { useKeyboardManager } from '@/shared/composables/useKeyboardManager'
import { useReviewStore } from '@/features/vocabulary/stores/review'
import { useTimer } from '@/shared/composables/useTimer'


interface Props {
    word: Word
    audioType: AudioType
    onResult: (result: {
        remembered: boolean
        elapsedTime: number
    }) => Promise<void>
    onSkip: () => Promise<void>
}

interface Emits {
    (e: 'result', result: { remembered: boolean; elapsedTime: number }): void
    (e: 'skip'): void
    (e: 'audioTypeChange', type: AudioType): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 状态
const showDefinition = ref(false)
const pendingChoice = ref<string | null>(null)
const isSubmitting = ref(false)
const showResetTooltip = ref(false)

// 使用计时器
const timer = useTimer()

// 使用全局音频设置
const { audioAccent, autoPlayOnWordChange, autoPlayAfterAnswer, loadAudioAccent } = useAudioAccent()

// 使用全局快捷键设置
const { hotkeys, loadHotkeys } = useHotkeys()

// 🔧 使用全局键盘管理器
const { setContext, registerKeys, cleanup } = useKeyboardManager()

// 获取当前复习模式，用于判断是否需要缓存兜底音频
const reviewStore = useReviewStore()
const isLapseMode = computed(() => reviewStore.mode === 'mode_lapse')

const handleChoice = (choice: string) => {
    if (isSubmitting.value) return

    // 暂停计时器
    timer.pause()

    pendingChoice.value = choice

    // 立即显示释义和后续按钮，触发快捷键重新注册
    showDefinition.value = true

    // 在上下文切换后播放音频（非阻塞，不影响快捷键）
    if (autoPlayAfterAnswer.value) {
        // 使用 setTimeout 确保完全不阻塞
        setTimeout(() => {
            playWordAudio(props.word.word, audioAccent.value, 5, 300, isLapseMode.value)
        }, 0)
    }
}

const handleCorrection = async () => {
    // "记错了"按钮应该覆盖之前的选择，强制设置为"没记住"
    // 即使之前选了"不再复习"，也要改为提交学习结果
    await submitResult(false, true) // 第二个参数表示强制提交结果
}

const handleNext = async () => {
    const unRemembered = pendingChoice.value === 'no'
    await submitResult(!unRemembered, false)
}

const handleSkip = async () => {
    try {
        await props.onSkip()
    } catch (error) {
        console.error('Skip failed:', error)
    } finally {
    }
}

const handleResetTimer = () => {
    // 重置并重新启动计时器
    timer.reset()
    timer.start()
}

const submitResult = async (remembered: boolean, forceResult: boolean = false) => {
    if (isSubmitting.value) {
        return
    }

    isSubmitting.value = true
    try {
        // 读取并清空计时器，返回经过的时间（秒）
        const elapsedTime = timer.readAndReset(10.0)

        // 如果强制提交结果（来自"记错了"按钮），或者不是"不再复习"，则提交学习结果
        if (forceResult || pendingChoice.value !== 'stop') {
            await props.onResult({
                remembered,
                elapsedTime
            })
        } else {
            // 只有在非强制且选择了"不再复习"时才跳过
            await handleSkip()
        }

        // 👉 提交成功后，重置状态
        showDefinition.value = false
        pendingChoice.value = null

    } catch (error) {
        console.error('Submit result failed:', error)
    } finally {
        isSubmitting.value = false
    }
}

// 🔧 使用全局键盘管理器注册快捷键
const setupKeyboardShortcuts = () => {
    // 先清理旧的快捷键，避免重复注册
    cleanup()

    if (!showDefinition.value) {
        // 初始选择状态 - 注册初始快捷键
        setContext('review-initial')
        const initialKeys = hotkeys.value.reviewInitial
        registerKeys({
            [initialKeys.remembered]: () => handleChoice('yes'),
            [initialKeys.notRemembered]: () => handleChoice('no'),
            [initialKeys.stopReview]: () => handleChoice('stop')
        })
    } else {
        // 显示释义状态 - 注册显示释义后的快捷键
        setContext('review-after')
        const afterKeys = hotkeys.value.reviewAfter
        registerKeys({
            [afterKeys.wrong]: async () => await handleCorrection(),
            [afterKeys.next]: async () => await handleNext()
        })
    }
}

// 监听showDefinition变化，更新快捷键注册
// 注意：不使用 immediate，避免与 onMounted 中的调用冲突
watch(showDefinition, () => {
    setupKeyboardShortcuts()
}, { flush: 'post' })

// 监听单词变化，自动播放新单词的音频
watch(() => props.word?.id, (newWordId, oldWordId) => {
    if (newWordId && newWordId !== oldWordId) {
        // 重置状态
        showDefinition.value = false
        pendingChoice.value = null

        // 重置并启动计时器
        timer.reset()
        timer.start()

        // 播放新单词音频（根据设置决定是否自动播放）
        if (autoPlayOnWordChange.value && props.word) {
            playWordAudio(props.word.word, audioAccent.value, 5, 300, isLapseMode.value)
        }
    }
}, { immediate: false })

onMounted(async () => {
    // 加载音频设置和快捷键设置
    await Promise.all([
        loadAudioAccent(),
        loadHotkeys()
    ])

    // 🔧 注册快捷键到全局键盘管理器
    setupKeyboardShortcuts()

    // 启动计时器
    timer.start()

    // 初始播放音频（根据设置决定是否自动播放）
    if (props.word && autoPlayOnWordChange.value) {
        playWordAudio(props.word.word, audioAccent.value, 5, 300, isLapseMode.value)
    }
})
</script>

<style scoped>
/* 主容器 - 移除不必要的高度限制 */
.word-review-container {
    display: flex;
    flex-direction: column;
    max-width: 100%;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    /* 使用自然高度，不强制设置固定高度 */
    position: relative;
}

/* 内容区域 - 移除滚动容器设置 */
.content-area {
    padding: 1rem;
    padding-bottom: 5rem; /* 为底部按钮栏留空间，减少过多间距 */
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
    /* 移除滚动设置，使用页面自然滚动 */
    flex: 1;
}

/* 固定底部按钮栏 */
.button-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    padding: 1rem;
    background: none;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    box-sizing: border-box;
    /* 设置固定高度防止布局跳动 */
    height: calc(2 * 2.8rem + 0.75rem + 2rem); /* 按钮高度 + 间距 + padding */
    display: flex;
    align-items: flex-start;
    justify-content: center;
}

/* 按钮组 */
.button-group {
    max-width: 600px;
    margin: 0 auto;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
}

/* 按钮行 */
.row-buttons {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
}

.row-buttons:last-child {
    margin-bottom: 0;
}

/* 按钮基础样式 */
.button {
    flex: 1;
    font-size: 1.1em;
    padding: 0.8em;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    background-color: #f0f0f0;
    transition: all 0.2s ease;
    color: #333;
    touch-action: manipulation;
}

.next-yes {
    background-color: rgba(82, 196, 26, 0.3);
}

.next-no {
    background-color: rgba(255, 77, 79, 0.3);
}

.button:hover:not(:disabled) {
    background-color: #e0e0e0;
    transform: translateY(-1px);
}

.next-yes:hover:not(:disabled) {
    background-color: rgba(82, 196, 26, 0.5) !important;
}

.next-no:hover:not(:disabled) {
    background-color: rgba(255, 77, 79, 0.5) !important;
}

/* 按钮禁用状态 */
.button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
}

/* 全宽按钮 */
.full-width {
    width: 100%;
}

/* 重置计时器容器 - 固定在右下角 */
.reset-timer-wrapper {
    position: absolute;
    bottom: 1rem;
    right: 1rem;
    z-index: 10;
}

/* 重置计时器按钮 */
.reset-timer-button {
    width: 2.5rem;
    height: 2.5rem;
    border: none;
    border-radius: 50%;
    background-color: rgba(240, 240, 240, 0.9);
    cursor: pointer;
    font-size: 1.2em;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    touch-action: manipulation;
}

.reset-timer-button:hover {
    background-color: rgba(220, 220, 220, 0.95);
    transform: rotate(180deg) scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.reset-timer-button:active {
    transform: rotate(180deg) scale(0.95);
}

/* 重置计时器提示 - 只在桌面端显示 */
.reset-timer-tooltip {
    position: absolute;
    right: calc(100% + 0.75rem);
    top: 50%;
    transform: translateY(-50%);
    background-color: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    animation: tooltipFadeIn 0.2s ease;
}

.reset-timer-tooltip::after {
    content: '';
    position: absolute;
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    border: 0.375rem solid transparent;
    border-left-color: rgba(0, 0, 0, 0.85);
}

@keyframes tooltipFadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

/* 移动端和平板隐藏提示 */
@media (max-width: 1024px) {
    .reset-timer-tooltip {
        display: none;
    }
}

/* 桌面端优化 - 增加底部空间避免被按钮栏挡住 */
@media (min-width: 1025px) {
    .content-area {
        padding-bottom: 8rem; /* 桌面端增加底部空间 */
        /* 允许轻微滚动以查看被遮挡的内容 */
    }
}

/* 平板适配 */
@media (max-width: 1024px) and (min-width: 769px) {
    .content-area {
        max-width: 100%;
        padding: 1rem 1rem 6rem 1rem !important; /* 强制覆盖基础样式 */
    }

    .button-group {
        max-width: 100%;
    }
}

/* 移动端适配 - 强制覆盖 */
@media (max-width: 768px) {
    .word-review-container .content-area {
        padding-top: 0.5rem !important;
        padding-left: 0.5rem !important;
        padding-right: 0.5rem !important;
        padding-bottom: 6rem !important; /* 强制设置底部间距 - 96px */
    }

    .button-bar {
        padding: 1rem 0.75rem;
        padding-bottom: calc(1rem + env(safe-area-inset-bottom));
        /* 确保固定在底部 */
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 1001;
        /* 使用固定高度防止跳动 */
        height: calc(2 * 3.5rem + 0.75rem + 2rem + env(safe-area-inset-bottom));
        display: flex;
        align-items: flex-start;
        justify-content: center;
    }

    .row-buttons {
        gap: 0.5rem;
        margin-bottom: 0.75rem;
    }

    .button {
        min-height: 3.5rem;
        padding: 0.875rem;
        font-size: 1rem;
    }

    .reset-timer-wrapper {
        bottom: calc(1rem + env(safe-area-inset-bottom));
        right: 0.75rem;
    }

    .reset-timer-button {
        width: 3rem;
        height: 3rem;
        font-size: 1.3em;
    }
}

/* 小屏幕手机适配 - 强制覆盖 */
@media (max-width: 480px) {
    .word-review-container .content-area {
        padding-top: 0.25rem !important;
        padding-left: 0.25rem !important;
        padding-right: 0.25rem !important;
        padding-bottom: 8rem !important; /* 强制设置底部间距 - 88px */
    }

    .button-bar {
        padding: 0.875rem 0.5rem;
        padding-bottom: calc(0.875rem + env(safe-area-inset-bottom));
        /* 使用固定高度防止跳动 */
        height: calc(2 * 3.25rem + 0.625rem + 1.75rem + env(safe-area-inset-bottom));
        display: flex;
        align-items: flex-start;
        justify-content: center;
    }

    .row-buttons {
        gap: 0.375rem;
        margin-bottom: 0.625rem;
    }

    .button {
        min-height: 3.25rem;
        padding: 0.75rem;
        font-size: 0.95rem;
    }

    .reset-timer-wrapper {
        bottom: calc(0.875rem + env(safe-area-inset-bottom));
        right: 0.5rem;
    }

    .reset-timer-button {
        width: 2.75rem;
        height: 2.75rem;
        font-size: 1.2em;
    }
}

/* 横屏适配 */
@media (max-height: 600px) and (orientation: landscape) {
    .content-area {
        padding-bottom: 5rem;
    }

    .button-bar {
        padding: 0.75rem;
        /* 使用固定高度防止跳动 */
        height: calc(2 * 2.5rem + 0.75rem + 1.5rem);
        display: flex;
        align-items: flex-start;
        justify-content: center;
    }

    .button {
        min-height: 2.5rem;
        padding: 0.5rem;
        font-size: 0.9rem;
    }

    .reset-timer-wrapper {
        bottom: 0.75rem;
        right: 0.75rem;
    }

    .reset-timer-button {
        width: 2.5rem;
        height: 2.5rem;
        font-size: 1.1em;
    }
}

/* iOS Safari 特定修复 - 移除强制高度设置 */
@supports (-webkit-touch-callout: none) {
    /* 不再强制设置容器高度，让内容自然流动 */
}

/* 支持安全区域 */
@supports (padding: max(0px)) {
    .button-bar {
        padding-left: max(1rem, env(safe-area-inset-left));
        padding-right: max(1rem, env(safe-area-inset-right));
        padding-bottom: max(1rem, env(safe-area-inset-bottom));
    }

    .reset-timer-wrapper {
        right: max(1rem, env(safe-area-inset-right));
        bottom: max(1rem, env(safe-area-inset-bottom));
    }
}
</style>
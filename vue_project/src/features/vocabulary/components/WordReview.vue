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
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { AudioType } from '@/features/vocabulary/stores/review'
import { Word } from '@/shared/types'
import WordDetailsReview from './WordDetailsReview.vue'
import { playWordAudio } from '@/shared/utils/playWordAudio'
import RelatedWordsDisplay from '@/shared/components/ui/RelatedWordsDisplay.vue'


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

const showDefinition = ref(false)
const pendingChoice = ref<string | null>(null)
const startTime = ref(Date.now())
const endTime = ref(Date.now());
const isSubmitting = ref(false)

const handleChoice = async (choice: string) => {
    if (isSubmitting.value) return

    endTime.value = Date.now()

    pendingChoice.value = choice

    // 显示释义和后续按钮
    showDefinition.value = true

    // 播放音频
    await playWordAudio(props.word.word)
}

const handleCorrection = async () => {
    await submitResult(false)
}

const handleNext = async () => {
    const unRemembered = pendingChoice.value === 'no'
    await submitResult(!unRemembered)
}

const handleSkip = async () => {
    try {
        await props.onSkip()
    } catch (error) {
        console.error('Skip failed:', error)
    } finally {
    }
}

const submitResult = async (remembered: boolean) => {
    if (isSubmitting.value) return

    isSubmitting.value = true
    try {
        const elapsedTime = Math.min(10.0, (endTime.value - startTime.value) / 1000)
        if (pendingChoice.value === 'stop') {
            await handleSkip()
        } else {
            await props.onResult({
                remembered,
                elapsedTime
            })
        }

        // 👉 提交成功后，重置状态
        showDefinition.value = false
        pendingChoice.value = null
        startTime.value = Date.now()

    } catch (error) {
        console.error('Submit result failed:', error)
    } finally {
        isSubmitting.value = false
    }
}

// 快捷键处理
const handleKeydown = async (event: KeyboardEvent) => {
    if (isSubmitting.value) return

    if (!showDefinition.value) {
        // 初始选择状态
        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault()
                await handleChoice('yes')
                break
            case 'ArrowRight':
                event.preventDefault()
                await handleChoice('no')
                break
            case 'ArrowDown':
                event.preventDefault()
                await handleChoice('stop')
                break
            case ' ':
                event.preventDefault()
                await playWordAudio(props.word.word)
                break
        }
    } else {
        // 显示释义状态
        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault()
                await handleCorrection()
                break
            case 'ArrowRight':
            case 'Enter':
                event.preventDefault()
                await handleNext()
                break
            case ' ':
                event.preventDefault()
                await playWordAudio(props.word.word)
                break
        }
    }
}

// 监听单词变化，自动播放新单词的音频
watch(() => props.word, (newWord) => {
    if (newWord) {
        // 重置状态
        showDefinition.value = false
        pendingChoice.value = null
        startTime.value = Date.now()

        // 播放新单词音频
        playWordAudio(newWord.word)
    }
}, { immediate: true })

onMounted(() => {
    // 注册快捷键
    document.addEventListener('keydown', handleKeydown)

    // 初始播放音频（作为fallback）
    if (props.word) {
        playWordAudio(props.word.word)
    }
})

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
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
}
</style>
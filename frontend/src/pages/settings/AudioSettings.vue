<template>
  <section class="settings-section">
    <h1 class="section-title">音频设置</h1>
    <p class="section-description">选择单词发音口音和自动播放</p>

    <div class="settings-group">
      <div class="audio-settings">
        <div class="audio-accent-selector">
          <label class="audio-label">单词发音</label>
          <SwitchTab
            v-model="audio.accent"
            :tabs="[
              { value: 'us', label: '美音', icon: '🇺🇸' },
              { value: 'uk', label: '英音', icon: '🇬🇧' }
            ]"
            :show-indicator="true"
            container-class="accent-switch"
          />
          <p class="audio-hint">该设置将应用于所有单词的自动播放</p>
        </div>

        <div class="audio-autoplay-settings">
          <label class="audio-label">自动播放</label>
          <div class="autoplay-options">
            <div class="autoplay-item">
              <IOSSwitch
                v-model="audio.autoPlayOnWordChange"
              />
              <div class="autoplay-text">
                <span class="autoplay-title">新单词出现时</span>
                <span class="autoplay-desc">切换到新单词时自动播放发音</span>
              </div>
            </div>

            <div class="autoplay-item">
              <IOSSwitch
                v-model="audio.autoPlayAfterAnswer"
              />
              <div class="autoplay-text">
                <span class="autoplay-title">选择答案后</span>
                <span class="autoplay-desc">点击"记住"或"没记住"后自动播放</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import SwitchTab from '@/shared/components/controls/SwitchTab.vue'
import IOSSwitch from '@/shared/components/controls/IOSSwitch.vue'
import { useSettings } from '@/shared/composables/useSettings'
import type { UserSettings } from '@/shared/types'
import { logger } from '@/shared/utils/logger'

interface Props {
  modelValue: UserSettings['audio']
}

interface Emits {
  (e: 'update:modelValue', value: UserSettings['audio']): void
  (e: 'save-success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 使用全局设置管理
const { updateSettings } = useSettings()

const isSaving = ref(false)

// Local state - 只保留音频设置
const audio = ref<UserSettings['audio']>(props.modelValue)

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  audio.value = newValue
}, { deep: true })

// Emit changes to parent
watch(audio, (newValue) => {
  emit('update:modelValue', newValue)
}, { deep: true })

const saveAudioSettings = async () => {
  isSaving.value = true
  try {
    // 使用全局设置管理器更新（自动更新缓存）
    const latestSettings = await updateSettings({
      audio: audio.value
    })
    audio.value = latestSettings.audio
    emit('update:modelValue', latestSettings.audio)
    emit('save-success')
  } catch (error) {
    logger.error('保存音频设置失败:', error)
  } finally {
    isSaving.value = false
  }
}

// Auto-save on changes
watch(() => audio.value.accent, async (newAccent, oldAccent) => {
  if (oldAccent && newAccent !== oldAccent) {
    logger.log('[AudioSettings] 音频口音变化，自动保存:', oldAccent, '->', newAccent)
    await saveAudioSettings()
  }
})

watch(() => audio.value.autoPlayOnWordChange, async (newValue, oldValue) => {
  if (oldValue !== undefined && newValue !== oldValue) {
    logger.log('[AudioSettings] 新单词自动播放变化，自动保存:', oldValue, '->', newValue)
    await saveAudioSettings()
  }
})

watch(() => audio.value.autoPlayAfterAnswer, async (newValue, oldValue) => {
  if (oldValue !== undefined && newValue !== oldValue) {
    logger.log('[AudioSettings] 答案后自动播放变化，自动保存:', oldValue, '->', newValue)
    await saveAudioSettings()
  }
})
</script>

<style scoped>
.settings-section {
  margin-bottom: 64px;
}

.section-title {
  font-size: 32px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 8px 0;
}

.section-description {
  font-size: 16px;
  color: var(--color-text-secondary);
  margin: 0 0 32px 0;
}

.settings-group {
  background: white;
  border-radius: var(--radius-xl);
  padding: 32px;
  margin-bottom: 24px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.audio-settings {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  align-items: start;
}

.audio-accent-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.audio-label {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.accent-switch {
  max-width: 300px;
}

.audio-hint {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
}

.audio-autoplay-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.autoplay-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.autoplay-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-default);
  border: 1px solid rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

.autoplay-item:hover {
  background: #f1f5f9;
  border-color: rgba(102, 126, 234, 0.2);
}

.autoplay-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.autoplay-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.autoplay-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

@media (max-width: 480px) {
  .settings-group {
    padding: 20px 16px;
  }

  .audio-settings {
    grid-template-columns: 1fr;
  }

  .accent-switch {
    max-width: 100%;
  }

  .section-title {
    font-size: 28px;
  }
}
</style>

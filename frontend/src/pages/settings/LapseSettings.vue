<template>
  <section class="settings-section">
    <h1 class="section-title">错题集设置</h1>
    <p class="section-description">自定义错题复习策略和退出机制</p>

    <div class="settings-group">
      <div class="settings-grid">
        <!-- 错题队列大小 -->
        <div class="setting-card">
          <div class="setting-info">
            <label class="setting-label">错题队列默认大小</label>
            <span class="setting-value">{{ learning.lapseQueueSize }}</span>
            <span class="setting-unit">个单词</span>
          </div>
          <div class="setting-control">
            <WheelSelector
              v-model="learning.lapseQueueSize"
              :min="15"
              :max="40"
              :step="5"
            />
          </div>
          <p class="setting-hint">基于认知心理学优化<br>推荐20-30个单词</p>
        </div>

        <!-- 答错后需答对次数 -->
        <div class="setting-card">
          <div class="setting-info">
            <label class="setting-label">答错后需连续答对次数</label>
            <span class="setting-value">{{ learning.lapseInitialValue }}</span>
            <span class="setting-unit">次</span>
          </div>
          <div class="setting-control">
            <WheelSelector
              v-model="learning.lapseInitialValue"
              :min="1"
              :max="learning.lapseMaxValue"
              :step="1"
            />
          </div>
          <p class="setting-hint">单词答错进入错题集后<br>需答对的次数才能移出</p>
        </div>

        <!-- 移出错题所需答对次数 -->
        <div class="setting-card">
          <div class="setting-info">
            <label class="setting-label">最大需要连续答对次数</label>
            <span class="setting-value">{{ learning.lapseMaxValue }}</span>
            <span class="setting-unit">次</span>
          </div>
          <div class="setting-control">
            <WheelSelector
              v-model="learning.lapseMaxValue"
              :min="3"
              :max="5"
              :step="1"
            />
          </div>
          <p class="setting-hint">单词需连续答对的次数<br>才能彻底移出错题集</p>
        </div>

        <!-- 加速退出模式 -->
        <div class="setting-card">
          <div class="setting-info">
            <label class="setting-label">加速退出模式</label>
            <span class="setting-value">{{ learning.lapseFastExitEnabled ? '开启' : '关闭' }}</span>
          </div>
          <div class="setting-control">
            <IOSSwitch v-model="learning.lapseFastExitEnabled" />
          </div>
          <p class="setting-hint">启用时，高难度错题<br>可更快移出错题集</p>
        </div>

        <!-- 快速退出门槛 -->
        <div v-if="learning.lapseFastExitEnabled" class="setting-card">
          <div class="setting-info">
            <label class="setting-label">快速退出门槛</label>
            <span class="setting-value">{{ learning.lapseConsecutiveThreshold }}</span>
            <span class="setting-unit">次</span>
          </div>
          <div class="setting-control">
            <WheelSelector
              v-model="learning.lapseConsecutiveThreshold"
              :min="1"
              :max="learning.lapseMaxValue"
              :step="1"
            />
          </div>
          <p class="setting-hint">答错次数≥此数字时<br>答对一次等于两次（加速）</p>
        </div>
      </div>
    </div>

    <!-- 错题集设置保存按钮 -->
    <div class="settings-actions">
      <BaseButton
        variant="primary"
        :loading="isSaving"
        :disabled="isSaving"
        @click="saveSettings"
        class="btn-save"
      >
        <template #icon><BaseIcon name="Save" size="sm" /></template>
        {{ isSaving ? '保存中...' : '保存错题集设置' }}
      </BaseButton>
      <BaseButton variant="secondary" @click="resetSettings">
        <template #icon><BaseIcon name="RotateCcw" size="sm" /></template>
        恢复默认
      </BaseButton>
    </div>

    <!-- 保存成功提示 -->
    <transition name="fade">
      <BaseAlert v-if="saveSuccess" type="success" class="save-alert">
        错题集设置已保存
      </BaseAlert>
    </transition>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import WheelSelector from '@/shared/components/controls/WheelSelector.vue'
import IOSSwitch from '@/shared/components/controls/IOSSwitch.vue'
import { useSettings } from '@/shared/composables/useSettings'
import type { UserSettings } from '@/shared/types'
import { logger } from '@/shared/utils/logger'
import { BaseAlert, BaseButton, BaseIcon } from '@/shared/components/base'

interface Props {
  modelValue: UserSettings['learning']
}

interface Emits {
  (e: 'update:modelValue', value: UserSettings['learning']): void
  (e: 'save-success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 使用全局设置管理
const { updateSettings } = useSettings()

const isSaving = ref(false)
const saveSuccess = ref(false)
let saveSuccessTimeout: ReturnType<typeof setTimeout> | null = null

// Local state - 只保留学习设置
const learning = ref<UserSettings['learning']>(props.modelValue)

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  learning.value = newValue
}, { deep: true })

// Emit changes to parent
watch(learning, (newValue) => {
  emit('update:modelValue', newValue)
}, { deep: true })

const showSaveSuccess = () => {
  if (saveSuccessTimeout) {
    clearTimeout(saveSuccessTimeout)
  }
  saveSuccess.value = true
  saveSuccessTimeout = setTimeout(() => {
    saveSuccess.value = false
  }, 3000)
}

const saveSettings = async () => {
  isSaving.value = true
  saveSuccess.value = false
  try {
    // 使用全局设置管理器更新（自动更新缓存）
    const latestSettings = await updateSettings({
      learning: learning.value
    })
    learning.value = latestSettings.learning
    emit('update:modelValue', latestSettings.learning)
    showSaveSuccess()
    emit('save-success')
  } catch (error) {
    logger.error('保存错题集设置失败:', error)
    alert('保存失败，请重试')
  } finally {
    isSaving.value = false
  }
}

const resetSettings = async () => {
  if (confirm('确定要恢复错题集设置的默认值吗？')) {
    try {
      learning.value = {
        ...learning.value,
        lapseQueueSize: 25,
        lapseMaxValue: 4,
        lapseInitialValue: 3,
        lapseFastExitEnabled: true,
        lapseConsecutiveThreshold: 2
      }
      await saveSettings()
    } catch (error) {
      logger.error('恢复错题集设置失败:', error)
      alert('恢复失败，请重试')
    }
  }
}
</script>

<style scoped>
.settings-section {
  margin-bottom: 64px;
}

.section-title {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-text-primary);
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

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
  max-width: 700px;
}

.setting-card {
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

.setting-card:hover {
  background: var(--color-bg-tertiary);
  border-color: rgba(102, 126, 234, 0.2);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.08);
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
}

.setting-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.setting-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1;
}

.setting-unit {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-tertiary);
  margin-top: 2px;
}

.setting-control {
  position: relative;
  height: 80px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.setting-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin: 0;
  line-height: 1.5;
  text-align: center;
}

.settings-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-8);
}

.btn-save {
  flex: 1;
}

.save-alert {
  margin-top: var(--space-4);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 480px) {
  .settings-group {
    padding: 20px 16px;
  }

  .settings-grid {
    grid-template-columns: 1fr;
  }

  .setting-card {
    padding: 16px;
  }

  .settings-actions {
    flex-direction: column;
  }

  .setting-value {
    font-size: 28px;
  }

  .section-title {
    font-size: 28px;
  }
}
</style>

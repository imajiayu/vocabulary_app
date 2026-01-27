<template>
  <section id="management" class="settings-section">
    <h1 class="section-title">单词管理设置</h1>
    <p class="section-description">配置单词加载和释义获取参数</p>

    <div class="settings-group">
      <div class="settings-grid">
        <!-- 分页加载数量 -->
        <div class="setting-card">
          <div class="setting-info">
            <label class="setting-label">分页加载数量</label>
            <span class="setting-value">{{ management.wordsLoadBatchSize }}</span>
            <span class="setting-unit">个单词</span>
          </div>
          <div class="setting-control">
            <WheelSelector
              v-model="management.wordsLoadBatchSize"
              :min="50"
              :max="500"
              :step="50"
            />
          </div>
          <p class="setting-hint">单词管理页面<br>每批加载的单词数量</p>
        </div>

        <!-- 释义获取线程数 -->
        <div class="setting-card">
          <div class="setting-info">
            <label class="setting-label">释义获取线程</label>
            <span class="setting-value">{{ management.definitionFetchThreads }}</span>
            <span class="setting-unit">个</span>
          </div>
          <div class="setting-control">
            <WheelSelector
              v-model="management.definitionFetchThreads"
              :min="1"
              :max="10"
              :step="1"
            />
          </div>
          <p class="setting-hint">并发获取释义的线程数<br>推荐2-5个</p>
        </div>
      </div>
    </div>

    <!-- 管理设置保存按钮 -->
    <div class="settings-actions">
      <button class="btn-save" @click="saveSettings" :disabled="isSaving">
        <span v-if="!isSaving">保存管理设置</span>
        <span v-else>保存中...</span>
      </button>
      <button class="btn-reset" @click="resetSettings">
        恢复默认
      </button>
    </div>

    <!-- 保存成功提示 -->
    <transition name="fade">
      <BaseAlert v-if="saveSuccess" type="success" class="save-alert">
        管理设置已保存
      </BaseAlert>
    </transition>

  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import WheelSelector from '@/shared/components/controls/WheelSelector.vue'
import { useSettings } from '@/shared/composables/useSettings'
import type { UserSettings } from '@/shared/types'
import { logger } from '@/shared/utils/logger'
import { BaseAlert } from '@/shared/components/base'

interface Props {
  modelValue: UserSettings['management']
}

interface Emits {
  (e: 'update:modelValue', value: UserSettings['management']): void
  (e: 'save-success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 使用全局设置管理
const { updateSettings } = useSettings()

const isSaving = ref(false)
const saveSuccess = ref(false)
let saveSuccessTimeout: ReturnType<typeof setTimeout> | null = null

// Local state - 只保留管理设置
const management = ref<UserSettings['management']>(props.modelValue)

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  management.value = newValue
}, { deep: true })

// Emit changes to parent
watch(management, (newValue) => {
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
      management: management.value
    })
    management.value = latestSettings.management
    emit('update:modelValue', latestSettings.management)
    showSaveSuccess()
    emit('save-success')
  } catch (error) {
    logger.error('保存管理设置失败:', error)
    alert('保存失败，请重试')
  } finally {
    isSaving.value = false
  }
}

const resetSettings = async () => {
  if (confirm('确定要恢复管理设置的默认值吗？')) {
    try {
      management.value = {
        wordsLoadBatchSize: 200,
        definitionFetchThreads: 3
      }
      await saveSettings()
    } catch (error) {
      logger.error('恢复管理设置失败:', error)
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
  gap: 12px;
  margin-top: 32px;
}

.btn-save,
.btn-reset {
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-save {
  background: var(--gradient-primary);
  color: white;
  flex: 1;
}

.btn-save:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-reset {
  background: white;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-medium);
}

.btn-reset:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-medium);
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

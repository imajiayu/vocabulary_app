<template>
  <section class="settings-section">
    <h1 class="section-title">学习设置</h1>
    <p class="section-description">自定义您的学习节奏和复习策略</p>

    <div class="settings-group">
      <div class="settings-grid">
        <!-- 每日复习上限 -->
        <div class="setting-card">
          <div class="setting-info">
            <label class="setting-label">每日复习上限</label>
            <span class="setting-value">{{ learning.dailyReviewLimit }}</span>
            <span class="setting-unit">个单词</span>
          </div>
          <div class="setting-control">
            <WheelSelector
              v-model="learning.dailyReviewLimit"
              :min="50"
              :max="1000"
              :step="50"
            />
          </div>
          <p class="setting-hint">建议根据备考时间调整<br></br>50-500 适合大多数学习者</p>
        </div>

        <!-- 每日拼写上限 -->
        <div class="setting-card">
          <div class="setting-info">
            <label class="setting-label">每日拼写上限</label>
            <span class="setting-value">{{ learning.dailySpellLimit }}</span>
            <span class="setting-unit">个单词</span>
          </div>
          <div class="setting-control">
            <WheelSelector
              v-model="learning.dailySpellLimit"
              :min="50"
              :max="800"
              :step="50"
            />
          </div>
          <p class="setting-hint">建议设置为复习量的 60-80%</p>
        </div>

        <!-- 最大准备天数 -->
        <div class="setting-card">
          <div class="setting-info">
            <label class="setting-label">最大准备天数</label>
            <span class="setting-value">{{ learning.maxPrepDays }}</span>
            <span class="setting-unit">天</span>
          </div>
          <div class="setting-control">
            <WheelSelector
              v-model="learning.maxPrepDays"
              :min="15"
              :max="180"
              :step="15"
            />
          </div>
          <p class="setting-hint">系统将优化复习间隔<br></br>确保考前完成</p>
        </div>

        <!-- 低EF额外数量 -->
        <div class="setting-card">
          <div class="setting-info">
            <label class="setting-label">低EF额外数量</label>
            <span class="setting-value">{{ learning.lowEfExtraCount }}</span>
            <span class="setting-unit">个单词</span>
          </div>
          <div class="setting-control">
            <WheelSelector
              v-model="learning.lowEfExtraCount"
              :min="0"
              :max="200"
              :step="10"
            />
          </div>
          <p class="setting-hint">复习时额外加入低EF单词<br></br>加速提升掌握程度</p>
        </div>
      </div>
    </div>

    <!-- 学习设置保存按钮 -->
    <div class="settings-actions">
      <button class="btn-save" @click="saveSettings" :disabled="isSaving">
        <span v-if="!isSaving">💾 保存学习设置</span>
        <span v-else>⏳ 保存中...</span>
      </button>
      <button class="btn-reset" @click="resetSettings">
        🔄 恢复默认
      </button>
    </div>

    <!-- 保存成功提示 -->
    <transition name="fade">
      <div v-if="saveSuccess" class="save-success">
        ✅ 学习设置已保存
      </div>
    </transition>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import WheelSelector from '@/shared/components/ui/WheelSelector.vue'
import { useSettings } from '@/shared/composables/useSettings'
import type { UserSettings } from '@/shared/types'

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
    console.error('保存学习设置失败:', error)
    alert('保存失败，请重试')
  } finally {
    isSaving.value = false
  }
}

const resetSettings = async () => {
  if (confirm('确定要恢复学习设置的默认值吗？')) {
    try {
      learning.value = {
        ...learning.value,
        dailyReviewLimit: 300,
        dailySpellLimit: 200,
        maxPrepDays: 45,
        defaultShuffle: false,
        lowEfExtraCount: 50
      }
      await saveSettings()
    } catch (error) {
      console.error('恢复学习设置失败:', error)
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
  color: #0f172a;
  margin: 0 0 8px 0;
}

.section-description {
  font-size: 16px;
  color: #64748b;
  margin: 0 0 32px 0;
}

.settings-group {
  background: white;
  border-radius: 20px;
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
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

.setting-card:hover {
  background: #f1f5f9;
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
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.setting-value {
  font-size: 32px;
  font-weight: 700;
  color: #667eea;
  line-height: 1;
}

.setting-unit {
  font-size: 14px;
  font-weight: 500;
  color: #94a3b8;
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
  color: #94a3b8;
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
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-save {
  background: linear-gradient(135deg, #667eea, #764ba2);
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
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.btn-reset:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.save-success {
  margin-top: 16px;
  padding: 12px 16px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  color: #15803d;
  font-size: 14px;
  font-weight: 500;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Toggle switch 样式 */
.switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 34px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 34px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 26px;
  width: 26px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background: linear-gradient(135deg, #667eea, #764ba2);
}

input:checked + .slider:before {
  transform: translateX(26px);
}

@media (max-width: 768px) {
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

<template>
  <section id="hotkeys" class="settings-section desktop-only">
    <h1 class="section-title">快捷键设置</h1>
    <p class="section-description">自定义键盘快捷键,提升学习效率</p>

    <!-- 复习页面 - 初始状态 -->
    <div class="settings-group">
      <div class="group-header">
        <h2 class="group-title">复习页面 - 初始状态</h2>
        <p class="group-description">在看到单词释义之前的快捷键</p>
      </div>

      <div class="hotkey-grid">
        <div class="hotkey-item">
          <label class="hotkey-label">记住 ✅</label>
          <KeySelector
            v-model="hotkeys.reviewInitial.remembered"
            :used-keys="[hotkeys.reviewInitial.notRemembered, hotkeys.reviewInitial.stopReview]"
          />
        </div>

        <div class="hotkey-item">
          <label class="hotkey-label">没记住 ❌</label>
          <KeySelector
            v-model="hotkeys.reviewInitial.notRemembered"
            :used-keys="[hotkeys.reviewInitial.remembered, hotkeys.reviewInitial.stopReview]"
          />
        </div>

        <div class="hotkey-item">
          <label class="hotkey-label">不再复习 🚫</label>
          <KeySelector
            v-model="hotkeys.reviewInitial.stopReview"
            :used-keys="[hotkeys.reviewInitial.remembered, hotkeys.reviewInitial.notRemembered]"
          />
        </div>
      </div>
    </div>

    <!-- 复习页面 - 显示释义后 -->
    <div class="settings-group">
      <div class="group-header">
        <h2 class="group-title">复习页面 - 显示释义后</h2>
        <p class="group-description">在看到单词释义之后的快捷键</p>
      </div>

      <div class="hotkey-grid">
        <div class="hotkey-item">
          <label class="hotkey-label">记错了 ❌</label>
          <KeySelector
            v-model="hotkeys.reviewAfter.wrong"
            :used-keys="[hotkeys.reviewAfter.next]"
          />
        </div>

        <div class="hotkey-item">
          <label class="hotkey-label">下一个 ➡️</label>
          <KeySelector
            v-model="hotkeys.reviewAfter.next"
            :used-keys="[hotkeys.reviewAfter.wrong]"
          />
        </div>
      </div>
    </div>

    <!-- 拼写页面 -->
    <div class="settings-group">
      <div class="group-header">
        <h2 class="group-title">拼写页面</h2>
        <p class="group-description">在拼写练习时的快捷键</p>
      </div>

      <div class="hotkey-grid">
        <div class="hotkey-item">
          <label class="hotkey-label">播放发音 🔊</label>
          <KeySelector
            v-model="hotkeys.spelling.playAudio"
            :used-keys="[hotkeys.spelling.forgot, hotkeys.spelling.next]"
          />
        </div>

        <div class="hotkey-item">
          <label class="hotkey-label">忘记了 ❓</label>
          <KeySelector
            v-model="hotkeys.spelling.forgot"
            :used-keys="[hotkeys.spelling.playAudio, hotkeys.spelling.next]"
          />
        </div>

        <div class="hotkey-item">
          <label class="hotkey-label">下一个 ➡️</label>
          <KeySelector
            v-model="hotkeys.spelling.next"
            :used-keys="[hotkeys.spelling.playAudio, hotkeys.spelling.forgot]"
          />
        </div>
      </div>
    </div>

    <!-- 快捷键设置保存按钮 -->
    <div class="settings-actions">
      <button class="btn-save" @click="saveSettings" :disabled="isSaving">
        <span v-if="!isSaving">💾 保存快捷键设置</span>
        <span v-else>⏳ 保存中...</span>
      </button>
      <button class="btn-reset" @click="resetSettings">
        🔄 恢复默认
      </button>
    </div>

    <!-- 保存成功提示 -->
    <transition name="fade">
      <div v-if="saveSuccess" class="save-success">
        ✅ 快捷键设置已保存
      </div>
    </transition>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import KeySelector from '@/shared/components/ui/KeySelector.vue'
import { useSettings } from '@/shared/composables/useSettings'
import type { UserSettings, HotkeySettings } from '@/shared/types'

interface Props {
  modelValue: UserSettings['hotkeys']
}

interface Emits {
  (e: 'update:modelValue', value: UserSettings['hotkeys']): void
  (e: 'save-success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 使用全局设置管理
const { updateSettings } = useSettings()

const isSaving = ref(false)
const saveSuccess = ref(false)
let saveSuccessTimeout: ReturnType<typeof setTimeout> | null = null

// Local state - 只保留快捷键设置
const hotkeys = ref<HotkeySettings>(props.modelValue)

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  hotkeys.value = newValue
}, { deep: true })

// Emit changes to parent
watch(hotkeys, (newValue) => {
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
      hotkeys: hotkeys.value
    })
    hotkeys.value = latestSettings.hotkeys
    emit('update:modelValue', latestSettings.hotkeys)
    showSaveSuccess()
    emit('save-success')
  } catch (error) {
    console.error('保存快捷键设置失败:', error)
    alert('保存失败,请重试')
  } finally {
    isSaving.value = false
  }
}

const resetSettings = async () => {
  if (confirm('确定要恢复快捷键设置的默认值吗?')) {
    try {
      hotkeys.value = {
        reviewInitial: {
          remembered: 'ArrowLeft',
          notRemembered: 'ArrowRight',
          stopReview: 'ArrowDown'
        },
        reviewAfter: {
          wrong: 'ArrowLeft',
          next: 'ArrowRight'
        },
        spelling: {
          playAudio: 'ArrowLeft',
          forgot: 'ArrowRight',
          next: 'Enter'
        }
      }
      await saveSettings()
    } catch (error) {
      console.error('恢复快捷键设置失败:', error)
      alert('恢复失败,请重试')
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

.group-header {
  margin-bottom: 28px;
}

.group-title {
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 8px 0;
}

.group-description {
  font-size: 14px;
  color: #64748b;
  margin: 0;
  line-height: 1.6;
}

.hotkey-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;
  max-width: 800px;
}

.hotkey-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hotkey-label {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 6px;
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

.desktop-only {
  display: block;
}

@media (max-width: 768px) {
  .desktop-only {
    display: none !important;
  }

  .section-title {
    font-size: 28px;
  }
}
</style>

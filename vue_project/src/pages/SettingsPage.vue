<template>
  <div class="settings-page" :class="{ 'lock-position': lockPosition }">
    <!-- 侧边栏 -->
    <aside class="settings-sidebar" :class="{ 'nav-expanded': navExpanded }">
      <div class="sidebar-header">
        <h2>设置</h2>
      </div>
      <nav class="sidebar-nav">
        <button
          v-for="section in sections"
          :key="section.id"
          :class="['nav-item', { active: activeSection === section.id }]"
          @click="scrollToSection(section.id)"
        >
          <span class="nav-icon">{{ section.icon }}</span>
          <div class="nav-content">
            <span class="nav-title">{{ section.title }}</span>
            <span class="nav-subtitle">{{ section.subtitle }}</span>
          </div>
        </button>
      </nav>
    </aside>

    <!-- 主内容区 -->
    <main class="settings-content" :class="{ 'nav-expanded': navExpanded }" @scroll="handleScroll">
      <div class="content-inner">
        <!-- 学习设置 -->
        <section id="learning" class="settings-section">
          <h1 class="section-title">学习设置</h1>
          <p class="section-description">自定义您的学习节奏和复习策略</p>

          <div class="settings-group">
            <div class="group-header">
              <h2 class="group-title">学习配置</h2>
              <p class="group-description">配置每日学习量和备考周期</p>
            </div>

            <div class="settings-grid">
              <!-- 每日复习上限 -->
              <div class="setting-card">
                <div class="setting-info">
                  <label class="setting-label">每日复习上限</label>
                  <span class="setting-value">{{ settings.learning.dailyReviewLimit }}</span>
                  <span class="setting-unit">个单词</span>
                </div>
                <div class="setting-control">
                  <WheelSelector
                    v-model="settings.learning.dailyReviewLimit"
                    :min="50"
                    :max="1000"
                  />
                </div>
                <p class="setting-hint">建议根据备考时间调整，50-500 适合大多数学习者</p>
              </div>

              <!-- 每日拼写上限 -->
              <div class="setting-card">
                <div class="setting-info">
                  <label class="setting-label">每日拼写上限</label>
                  <span class="setting-value">{{ settings.learning.dailySpellLimit }}</span>
                  <span class="setting-unit">个单词</span>
                </div>
                <div class="setting-control">
                  <WheelSelector
                    v-model="settings.learning.dailySpellLimit"
                    :min="50"
                    :max="800"
                  />
                </div>
                <p class="setting-hint">建议设置为复习量的 60-80%</p>
              </div>

              <!-- 最大准备天数 -->
              <div class="setting-card">
                <div class="setting-info">
                  <label class="setting-label">最大准备天数</label>
                  <span class="setting-value">{{ settings.learning.maxPrepDays }}</span>
                  <span class="setting-unit">天</span>
                </div>
                <div class="setting-control">
                  <WheelSelector
                    v-model="settings.learning.maxPrepDays"
                    :min="15"
                    :max="180"
                  />
                </div>
                <p class="setting-hint">系统将优化复习间隔，确保考前完成</p>
              </div>
            </div>
          </div>

          <!-- 保存按钮 -->
          <div class="settings-actions">
            <button class="btn-save" @click="saveSettings" :disabled="isSaving">
              <span v-if="!isSaving">💾 保存设置</span>
              <span v-else>⏳ 保存中...</span>
            </button>
            <button class="btn-reset" @click="resetSettings">
              🔄 恢复默认
            </button>
          </div>

          <!-- 保存成功提示 -->
          <transition name="fade">
            <div v-if="saveSuccess" class="save-success">
              ✅ 设置已保存
            </div>
          </transition>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import WheelSelector from '@/shared/components/ui/WheelSelector.vue'
import { api } from '@/shared/api'
import type { UserSettings } from '@/shared/types'

interface SettingsSection {
  id: string
  title: string
  subtitle: string
  icon: string
}

interface Props {
  navExpanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  navExpanded: false
})

// 控制是否锁定位置（防止侧边栏跳动）
const lockPosition = ref(false)

const sections: SettingsSection[] = [
  { id: 'learning', title: '学习设置', subtitle: '复习与拼写配置', icon: '📚' },
]

const activeSection = ref('learning')
const isSaving = ref(false)
const saveSuccess = ref(false)

const settings = ref<UserSettings>({
  learning: {
    dailyReviewLimit: 300,
    dailySpellLimit: 200,
    maxPrepDays: 45
  }
})

const scrollToSection = (sectionId: string) => {
  const element = document.getElementById(sectionId)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  activeSection.value = sectionId
}

const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  const scrollTop = target.scrollTop

  // 简单的滚动检测，更新活动section
  sections.forEach((section) => {
    const element = document.getElementById(section.id)
    if (element) {
      const rect = element.getBoundingClientRect()
      if (rect.top <= 100 && rect.bottom >= 100) {
        activeSection.value = section.id
      }
    }
  })
}

const loadSettings = async () => {
  try {
    const data = await api.settings.getSettings()
    settings.value = data
  } catch (error) {
    console.error('加载设置失败:', error)
  }
}

const saveSettings = async () => {
  isSaving.value = true
  saveSuccess.value = false
  try {
    await api.settings.updateSettings(settings.value)
    saveSuccess.value = true
    setTimeout(() => {
      saveSuccess.value = false
    }, 3000)
  } catch (error) {
    console.error('保存设置失败:', error)
    alert('保存失败，请重试')
  } finally {
    isSaving.value = false
  }
}

const resetSettings = async () => {
  if (confirm('确定要恢复默认设置吗？')) {
    try {
      const defaults = await api.settings.resetToDefaults()
      settings.value = defaults
      saveSuccess.value = true
      setTimeout(() => {
        saveSuccess.value = false
      }, 3000)
    } catch (error) {
      console.error('恢复默认设置失败:', error)
      alert('恢复失败，请重试')
    }
  }
}

onMounted(() => {
  loadSettings()
  // 等待进入动画完成后锁定位置
  setTimeout(() => {
    lockPosition.value = true
  }, 350) // fade-slide transition 是 300ms，加 50ms 缓冲
})
</script>

<style scoped>
.settings-page {
  display: flex;
  width: 100%;
  height: 100vh;
  position: relative;
}

/* 进入动画完成后锁定位置，防止侧边栏跳动 */
.settings-page.lock-position {
  transform: none !important;
}

/* ===== 侧边栏 ===== */
.settings-sidebar {
  position: fixed;
  left: 48px;
  top: 0;
  width: 280px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  z-index: 10;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.settings-sidebar.nav-expanded {
  left: 280px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0 20px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.sidebar-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.sidebar-nav {
  flex: 1;
  padding: 20px 12px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 12px;
  margin-bottom: 4px;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.nav-item:hover {
  background: #f1f5f9;
}

.nav-item.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.nav-icon {
  font-size: 20px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-title {
  font-size: 14px;
  font-weight: 500;
  color: inherit;
}

.nav-item.active .nav-title {
  color: white;
}

.nav-subtitle {
  font-size: 12px;
  color: #64748b;
}

.nav-item.active .nav-subtitle {
  color: rgba(255, 255, 255, 0.8);
}

/* ===== 主内容区 ===== */
.settings-content {
  position: fixed;
  left: 328px; /* 48px (MainNavigation) + 280px (sidebar) */
  right: 0;
  top: 0;
  bottom: 0;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.settings-content.nav-expanded {
  left: 560px; /* 280px (MainNavigation expanded) + 280px (sidebar) */
}

.content-inner {
  max-width: 900px;
  width: 100%;
  padding: 48px 32px;
}

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

/* 响应式设计 */
@media (max-width: 768px) {
  .settings-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    width: 260px;
    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
  }

  .content-inner {
    padding: 32px 20px;
  }

  .section-title {
    font-size: 28px;
  }

  .settings-grid {
    grid-template-columns: 1fr;
  }

  .settings-actions {
    flex-direction: column;
  }

  .setting-value {
    font-size: 28px;
  }
}
</style>

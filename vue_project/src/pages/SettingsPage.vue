<template>
  <div class="settings-page" :class="{ 'nav-expanded': navExpanded }">
    <!-- 侧边栏 - 移动端隐藏 -->
    <aside class="settings-sidebar desktop-only">
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
    <main class="settings-content" @scroll="handleScroll">
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
                <p class="setting-hint">建议根据备考时间调整<br></br>50-500 适合大多数学习者</p>
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
                <p class="setting-hint">系统将优化复习间隔<br></br>确保考前完成</p>
              </div>
            </div>
          </div>

          <!-- 学习设置保存按钮 -->
          <div class="settings-actions">
            <button class="btn-save" @click="saveLearningSettings" :disabled="isSaving">
              <span v-if="!isSaving">💾 保存学习设置</span>
              <span v-else>⏳ 保存中...</span>
            </button>
            <button class="btn-reset" @click="resetLearningSettings">
              🔄 恢复默认
            </button>
          </div>

          <!-- 保存成功提示 -->
          <transition name="fade">
            <div v-if="saveSuccess === 'learning'" class="save-success">
              ✅ 学习设置已保存
            </div>
          </transition>
        </section>

        <!-- 音频设置 -->
        <section id="audio" class="settings-section">
          <h1 class="section-title">音频设置</h1>
          <p class="section-description">自定义单词发音口音</p>

          <div class="settings-group">
            <div class="group-header">
              <h2 class="group-title">音频设置</h2>
              <p class="group-description">选择单词发音口音</p>
            </div>

            <div class="audio-settings">
              <div class="audio-accent-selector">
                <label class="audio-label">单词发音</label>
                <SwitchTab
                  v-model="settings.audio.accent"
                  :tabs="[
                    { value: 'us', label: '美音', icon: '🇺🇸' },
                    { value: 'uk', label: '英音', icon: '🇬🇧' }
                  ]"
                  :show-indicator="true"
                  container-class="accent-switch"
                />
                <p class="audio-hint">该设置将应用于所有单词的自动播放</p>
              </div>
            </div>
          </div>
        </section>

        <!-- 快捷键设置 - 移动端隐藏 -->
        <section id="hotkeys" class="settings-section desktop-only">
          <h1 class="section-title">快捷键设置</h1>
          <p class="section-description">自定义键盘快捷键，提升学习效率</p>

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
                  v-model="settings.hotkeys.reviewInitial.remembered"
                  :used-keys="[settings.hotkeys.reviewInitial.notRemembered, settings.hotkeys.reviewInitial.stopReview]"
                />
              </div>

              <div class="hotkey-item">
                <label class="hotkey-label">没记住 ❌</label>
                <KeySelector
                  v-model="settings.hotkeys.reviewInitial.notRemembered"
                  :used-keys="[settings.hotkeys.reviewInitial.remembered, settings.hotkeys.reviewInitial.stopReview]"
                />
              </div>

              <div class="hotkey-item">
                <label class="hotkey-label">不再复习 🚫</label>
                <KeySelector
                  v-model="settings.hotkeys.reviewInitial.stopReview"
                  :used-keys="[settings.hotkeys.reviewInitial.remembered, settings.hotkeys.reviewInitial.notRemembered]"
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
                  v-model="settings.hotkeys.reviewAfter.wrong"
                  :used-keys="[settings.hotkeys.reviewAfter.next]"
                />
              </div>

              <div class="hotkey-item">
                <label class="hotkey-label">下一个 ➡️</label>
                <KeySelector
                  v-model="settings.hotkeys.reviewAfter.next"
                  :used-keys="[settings.hotkeys.reviewAfter.wrong]"
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
                  v-model="settings.hotkeys.spelling.playAudio"
                  :used-keys="[settings.hotkeys.spelling.forgot, settings.hotkeys.spelling.next]"
                />
              </div>

              <div class="hotkey-item">
                <label class="hotkey-label">忘记了 ❓</label>
                <KeySelector
                  v-model="settings.hotkeys.spelling.forgot"
                  :used-keys="[settings.hotkeys.spelling.playAudio, settings.hotkeys.spelling.next]"
                />
              </div>

              <div class="hotkey-item">
                <label class="hotkey-label">下一个 ➡️</label>
                <KeySelector
                  v-model="settings.hotkeys.spelling.next"
                  :used-keys="[settings.hotkeys.spelling.playAudio, settings.hotkeys.spelling.forgot]"
                />
              </div>
            </div>
          </div>

          <!-- 快捷键设置保存按钮 -->
          <div class="settings-actions">
            <button class="btn-save" @click="saveHotkeySettings" :disabled="isSaving">
              <span v-if="!isSaving">💾 保存快捷键设置</span>
              <span v-else>⏳ 保存中...</span>
            </button>
            <button class="btn-reset" @click="resetHotkeySettings">
              🔄 恢复默认
            </button>
          </div>

          <!-- 保存成功提示 -->
          <transition name="fade">
            <div v-if="saveSuccess === 'hotkeys'" class="save-success">
              ✅ 快捷键设置已保存
            </div>
          </transition>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import WheelSelector from '@/shared/components/ui/WheelSelector.vue'
import SwitchTab from '@/shared/components/ui/SwitchTab.vue'
import KeySelector from '@/shared/components/ui/KeySelector.vue'
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

const sections: SettingsSection[] = [
  { id: 'learning', title: '学习设置', subtitle: '复习与拼写配置', icon: '📚' },
  { id: 'audio', title: '音频设置', subtitle: '发音口音选择', icon: '🔊' },
  { id: 'hotkeys', title: '快捷键设置', subtitle: '自定义键盘快捷键', icon: '⌨️' },
]

const activeSection = ref('learning')
const isSaving = ref(false)
const saveSuccess = ref<string | false>(false) // 改为字符串类型，记录哪个设置区域保存成功
const isScrollingProgrammatically = ref(false) // 标记是否正在程序化滚动
let scrollTimeout: ReturnType<typeof setTimeout> | null = null
let saveSuccessTimeout: ReturnType<typeof setTimeout> | null = null

const settings = ref<UserSettings>({
  learning: {
    dailyReviewLimit: 300,
    dailySpellLimit: 200,
    maxPrepDays: 45
  },
  audio: {
    accent: 'us'
  },
  hotkeys: {
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
})

const scrollToSection = (sectionId: string) => {
  const element = document.getElementById(sectionId)
  if (element) {
    console.log('[ScrollToSection] 开始滚动到:', sectionId)

    // 清除之前的超时
    if (scrollTimeout) {
      clearTimeout(scrollTimeout)
    }

    // 立即标记开始程序化滚动（在设置 activeSection 之前）
    isScrollingProgrammatically.value = true
    console.log('[ScrollToSection] isScrollingProgrammatically 设置为 true')

    // 立即更新 activeSection
    activeSection.value = sectionId
    console.log('[ScrollToSection] activeSection 已设置为:', sectionId)

    // 触发滚动
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })

    // 滚动结束后清除标记
    scrollTimeout = setTimeout(() => {
      isScrollingProgrammatically.value = false
      console.log('[ScrollToSection] 程序化滚动标记已清除')
      scrollTimeout = null
    }, 2000) // 增加到 2 秒
  }
}

const handleScroll = (event: Event) => {
  console.log('[HandleScroll] 滚动事件触发, isScrollingProgrammatically =', isScrollingProgrammatically.value)

  // 如果正在程序化滚动，忽略滚动事件
  if (isScrollingProgrammatically.value) {
    console.log('[HandleScroll] 忽略滚动事件（程序化滚动中）')
    return
  }

  const target = event.target as HTMLElement
  const containerRect = target.getBoundingClientRect()

  // 检查是否滚动到顶部
  const isAtTop = target.scrollTop < 10 // 10px 的容差

  if (isAtTop) {
    // 滚动到顶部时，选中第一个 section
    const firstSection = sections[0].id
    if (activeSection.value !== firstSection) {
      console.log('[HandleScroll] 滚动到顶部，切换到第一个 section:', firstSection)
      activeSection.value = firstSection
    }
    return
  }

  // 检查是否滚动到底部
  const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 10 // 10px 的容差

  if (isAtBottom) {
    // 滚动到底部时，选中最后一个 section
    const lastSection = sections[sections.length - 1].id
    if (activeSection.value !== lastSection) {
      console.log('[HandleScroll] 滚动到底部，切换到最后一个 section:', lastSection)
      activeSection.value = lastSection
    }
    return
  }

  // 找到当前视口中最靠近顶部的 section
  let closestSection = null
  let closestDistance = Infinity

  sections.forEach((section) => {
    const element = document.getElementById(section.id)
    if (element) {
      const rect = element.getBoundingClientRect()
      // 计算 section 顶部距离容器顶部的距离
      const distance = Math.abs(rect.top - containerRect.top)

      // 如果 section 在视口内，且距离更近
      if (rect.top <= containerRect.top + 150 && rect.bottom >= containerRect.top && distance < closestDistance) {
        closestDistance = distance
        closestSection = section.id
      }
    }
  })

  if (closestSection && closestSection !== activeSection.value) {
    console.log('[HandleScroll] 自动切换 activeSection 从', activeSection.value, '到', closestSection)
    activeSection.value = closestSection
  }
}

const loadSettings = async () => {
  try {
    const data = await api.settings.getSettings()
    settings.value = data
  } catch (error) {
    console.error('加载设置失败:', error)
  }
}

// 显示保存成功提示的辅助函数
const showSaveSuccess = (section: string) => {
  if (saveSuccessTimeout) {
    clearTimeout(saveSuccessTimeout)
  }
  saveSuccess.value = section
  saveSuccessTimeout = setTimeout(() => {
    saveSuccess.value = false
  }, 3000)
}

// 保存学习设置
const saveLearningSettings = async () => {
  isSaving.value = true
  saveSuccess.value = false
  try {
    // 只更新学习设置部分
    await api.settings.updateSettings({
      learning: settings.value.learning
    })
    // 重新获取最新的所有设置
    const latestSettings = await api.settings.getSettings()
    settings.value = latestSettings
    showSaveSuccess('learning')
  } catch (error) {
    console.error('保存学习设置失败:', error)
    alert('保存失败，请重试')
  } finally {
    isSaving.value = false
  }
}

// 重置学习设置
const resetLearningSettings = async () => {
  if (confirm('确定要恢复学习设置的默认值吗？')) {
    try {
      settings.value.learning = {
        dailyReviewLimit: 300,
        dailySpellLimit: 200,
        maxPrepDays: 45
      }
      await saveLearningSettings()
    } catch (error) {
      console.error('恢复学习设置失败:', error)
      alert('恢复失败，请重试')
    }
  }
}

// 保存音频设置
const saveAudioSettings = async () => {
  isSaving.value = true
  saveSuccess.value = false
  try {
    // 只更新音频设置部分
    await api.settings.updateSettings({
      audio: settings.value.audio
    })
    // 重新获取最新的所有设置
    const latestSettings = await api.settings.getSettings()
    settings.value = latestSettings
    showSaveSuccess('audio')
  } catch (error) {
    console.error('保存音频设置失败:', error)
    alert('保存失败，请重试')
  } finally {
    isSaving.value = false
  }
}

// 重置音频设置
const resetAudioSettings = async () => {
  if (confirm('确定要恢复音频设置的默认值吗？')) {
    try {
      settings.value.audio = {
        accent: 'us'
      }
      await saveAudioSettings()
    } catch (error) {
      console.error('恢复音频设置失败:', error)
      alert('恢复失败，请重试')
    }
  }
}

// 监听音频设置变化，自动保存
watch(() => settings.value.audio.accent, async (newAccent, oldAccent) => {
  // 只在设置加载完成后才自动保存（避免初始加载时触发）
  if (oldAccent && newAccent !== oldAccent) {
    console.log('[AudioSettings] 音频口音变化，自动保存:', oldAccent, '->', newAccent)
    await saveAudioSettings()
  }
})

// 保存快捷键设置
const saveHotkeySettings = async () => {
  isSaving.value = true
  saveSuccess.value = false
  try {
    // 只更新快捷键设置部分
    await api.settings.updateSettings({
      hotkeys: settings.value.hotkeys
    })
    // 重新获取最新的所有设置
    const latestSettings = await api.settings.getSettings()
    settings.value = latestSettings
    showSaveSuccess('hotkeys')
  } catch (error) {
    console.error('保存快捷键设置失败:', error)
    alert('保存失败，请重试')
  } finally {
    isSaving.value = false
  }
}

// 重置快捷键设置
const resetHotkeySettings = async () => {
  if (confirm('确定要恢复快捷键设置的默认值吗？')) {
    try {
      settings.value.hotkeys = {
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
      await saveHotkeySettings()
    } catch (error) {
      console.error('恢复快捷键设置失败:', error)
      alert('恢复失败，请重试')
    }
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.settings-page {
  display: flex;
  width: 100%;
  min-height: 100vh; /* 改用 min-height 允许内容超出视口高度 */
  position: relative;
}

/* ===== 侧边栏 ===== */
.settings-sidebar {
  position: sticky;
  left: 0;
  top: 0;
  width: 280px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  justify-content: flex-start; /* 改为 flex-start，让内容从顶部开始 */
  align-items: flex-start; /* 确保内容对齐到顶部 */
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 100vh; /* 使用 max-height 而不是 height */
  box-sizing: border-box;
}

.content-inner {
  max-width: 900px;
  width: 100%;
  padding: 48px 32px; /* 恢复原来的内边距 */
  padding-bottom: 120px; /* 增加底部内边距，确保最后一个元素可以滚动到视图中 */
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

/* 音频设置样式 */
.audio-settings {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.audio-accent-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  color: #64748b;
  margin: 0;
}

/* 移动端隐藏侧边栏和快捷键设置 */
.desktop-only {
  display: block;
}

@media (max-width: 768px) {
  .desktop-only {
    display: none !important;
  }

  .settings-page {
    display: block; /* 移动端不使用 flex，让内容占满宽度 */
  }

  .settings-sidebar {
    width: 260px;
  }

  .settings-content {
    max-height: none; /* 移动端移除最大高度限制 */
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

  .accent-switch {
    max-width: 100%;
  }
}

/* 快捷键设置样式 */
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
</style>

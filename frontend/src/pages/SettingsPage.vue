<template>
  <div class="settings-page">
    <!-- 顶部搜索栏 -->
    <header class="settings-header">
      <div class="header-content">
        <h1 class="settings-title">设置</h1>
        <div class="search-box">
          <span class="search-icon">⌘K</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索设置项..."
            class="search-input"
            @focus="isSearchFocused = true"
            @blur="isSearchFocused = false"
          />
        </div>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="settings-main">
      <!-- 左侧快速导航 -->
      <aside class="settings-nav desktop-only">
        <nav class="nav-list">
          <button
            v-for="section in filteredSections"
            :key="section.id"
            :class="['nav-item', { active: activeSection === section.id }]"
            @click="scrollToSection(section.id)"
          >
            <span class="nav-icon">{{ section.icon }}</span>
            <span class="nav-label">{{ section.title }}</span>
            <span class="nav-count">{{ section.itemCount }}</span>
          </button>
        </nav>
      </aside>

      <!-- 设置内容区 -->
      <div class="settings-content" ref="contentRef" @scroll="handleScroll">
        <!-- 学习设置 -->
        <section
          v-show="matchesSearch('learning')"
          :id="'section-learning'"
          class="settings-section"
        >
          <div class="section-header" @click="toggleSection('learning')">
            <div class="section-title-row">
              <span class="section-icon">§</span>
              <h2 class="section-title">学习设置</h2>
              <span class="section-badge">{{ Object.keys(learningItems).length }} 项</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.learning }]">›</span>
          </div>

          <div v-show="expandedSections.learning" class="section-body">
            <div class="settings-grid">
              <!-- 每日复习上限 -->
              <div class="setting-row" v-show="matchesSearchItem('dailyReviewLimit')">
                <div class="setting-label-group">
                  <label class="setting-label">每日复习上限</label>
                  <span class="setting-hint">建议 50-500</span>
                </div>
                <div class="setting-control-row">
                  <WheelSelector
                    v-model="settings.learning.dailyReviewLimit"
                    :min="50"
                    :max="1000"
                    :step="50"
                  />
                  <span class="setting-value">{{ settings.learning.dailyReviewLimit }}</span>
                  <span class="setting-unit">词</span>
                </div>
              </div>

              <!-- 每日拼写上限 -->
              <div class="setting-row" v-show="matchesSearchItem('dailySpellLimit')">
                <div class="setting-label-group">
                  <label class="setting-label">每日拼写上限</label>
                  <span class="setting-hint">建议为复习量的 60-80%</span>
                </div>
                <div class="setting-control-row">
                  <WheelSelector
                    v-model="settings.learning.dailySpellLimit"
                    :min="50"
                    :max="800"
                    :step="50"
                  />
                  <span class="setting-value">{{ settings.learning.dailySpellLimit }}</span>
                  <span class="setting-unit">词</span>
                </div>
              </div>

              <!-- 最大准备天数 -->
              <div class="setting-row" v-show="matchesSearchItem('maxPrepDays')">
                <div class="setting-label-group">
                  <label class="setting-label">最大准备天数</label>
                  <span class="setting-hint">系统优化复习间隔确保考前完成</span>
                </div>
                <div class="setting-control-row">
                  <WheelSelector
                    v-model="settings.learning.maxPrepDays"
                    :min="15"
                    :max="180"
                    :step="15"
                  />
                  <span class="setting-value">{{ settings.learning.maxPrepDays }}</span>
                  <span class="setting-unit">天</span>
                </div>
              </div>

              <!-- 低EF额外数量 -->
              <div class="setting-row" v-show="matchesSearchItem('lowEfExtraCount')">
                <div class="setting-label-group">
                  <label class="setting-label">低EF额外数量</label>
                  <span class="setting-hint">复习时额外加入难词加速提升</span>
                </div>
                <div class="setting-control-row">
                  <WheelSelector
                    v-model="settings.learning.lowEfExtraCount"
                    :min="0"
                    :max="200"
                    :step="10"
                  />
                  <span class="setting-value">{{ settings.learning.lowEfExtraCount }}</span>
                  <span class="setting-unit">词</span>
                </div>
              </div>
            </div>

            <div class="section-actions">
              <BaseButton
                variant="primary"
                size="sm"
                :loading="savingSection === 'learning'"
                @click="saveSection('learning')"
              >
                保存学习设置
              </BaseButton>
              <BaseButton variant="ghost" size="sm" @click="resetSection('learning')">
                恢复默认
              </BaseButton>
            </div>
          </div>
        </section>

        <!-- 错题集设置 -->
        <section
          v-show="matchesSearch('lapse')"
          :id="'section-lapse'"
          class="settings-section"
        >
          <div class="section-header" @click="toggleSection('lapse')">
            <div class="section-title-row">
              <span class="section-icon">✗</span>
              <h2 class="section-title">错题集设置</h2>
              <span class="section-badge">5 项</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.lapse }]">›</span>
          </div>

          <div v-show="expandedSections.lapse" class="section-body">
            <div class="settings-grid">
              <!-- 错题队列大小 -->
              <div class="setting-row" v-show="matchesSearchItem('lapseQueueSize')">
                <div class="setting-label-group">
                  <label class="setting-label">错题队列默认大小</label>
                  <span class="setting-hint">推荐 20-30 个</span>
                </div>
                <div class="setting-control-row">
                  <WheelSelector
                    v-model="settings.learning.lapseQueueSize"
                    :min="15"
                    :max="40"
                    :step="5"
                  />
                  <span class="setting-value">{{ settings.learning.lapseQueueSize }}</span>
                  <span class="setting-unit">词</span>
                </div>
              </div>

              <!-- 答错后需连续答对次数 -->
              <div class="setting-row" v-show="matchesSearchItem('lapseInitialValue')">
                <div class="setting-label-group">
                  <label class="setting-label">答错后需连续答对</label>
                  <span class="setting-hint">答对此数才能移出错题集</span>
                </div>
                <div class="setting-control-row">
                  <WheelSelector
                    v-model="settings.learning.lapseInitialValue"
                    :min="1"
                    :max="settings.learning.lapseMaxValue"
                    :step="1"
                  />
                  <span class="setting-value">{{ settings.learning.lapseInitialValue }}</span>
                  <span class="setting-unit">次</span>
                </div>
              </div>

              <!-- 最大需要连续答对次数 -->
              <div class="setting-row" v-show="matchesSearchItem('lapseMaxValue')">
                <div class="setting-label-group">
                  <label class="setting-label">最大连续答对次数</label>
                  <span class="setting-hint">彻底移出错题集的阈值</span>
                </div>
                <div class="setting-control-row">
                  <WheelSelector
                    v-model="settings.learning.lapseMaxValue"
                    :min="3"
                    :max="5"
                    :step="1"
                  />
                  <span class="setting-value">{{ settings.learning.lapseMaxValue }}</span>
                  <span class="setting-unit">次</span>
                </div>
              </div>

              <!-- 加速退出模式 -->
              <div class="setting-row setting-row-toggle" v-show="matchesSearchItem('lapseFastExitEnabled')">
                <div class="setting-label-group">
                  <label class="setting-label">加速退出模式</label>
                  <span class="setting-hint">高难度错题可更快移出</span>
                </div>
                <IOSSwitch v-model="settings.learning.lapseFastExitEnabled" />
              </div>

              <!-- 快速退出门槛 -->
              <div
                v-if="settings.learning.lapseFastExitEnabled"
                class="setting-row"
                v-show="matchesSearchItem('lapseConsecutiveThreshold')"
              >
                <div class="setting-label-group">
                  <label class="setting-label">快速退出门槛</label>
                  <span class="setting-hint">答错次数 ≥ 此值时加速</span>
                </div>
                <div class="setting-control-row">
                  <WheelSelector
                    v-model="settings.learning.lapseConsecutiveThreshold"
                    :min="1"
                    :max="settings.learning.lapseMaxValue"
                    :step="1"
                  />
                  <span class="setting-value">{{ settings.learning.lapseConsecutiveThreshold }}</span>
                  <span class="setting-unit">次</span>
                </div>
              </div>
            </div>

            <div class="section-actions">
              <BaseButton
                variant="primary"
                size="sm"
                :loading="savingSection === 'lapse'"
                @click="saveSection('lapse')"
              >
                保存错题设置
              </BaseButton>
              <BaseButton variant="ghost" size="sm" @click="resetSection('lapse')">
                恢复默认
              </BaseButton>
            </div>
          </div>
        </section>

        <!-- 单词管理设置 -->
        <section
          v-show="matchesSearch('management')"
          :id="'section-management'"
          class="settings-section"
        >
          <div class="section-header" @click="toggleSection('management')">
            <div class="section-title-row">
              <span class="section-icon">✎</span>
              <h2 class="section-title">单词管理</h2>
              <span class="section-badge">2 项</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.management }]">›</span>
          </div>

          <div v-show="expandedSections.management" class="section-body">
            <div class="settings-grid">
              <!-- 分页加载数量 -->
              <div class="setting-row" v-show="matchesSearchItem('wordsLoadBatchSize')">
                <div class="setting-label-group">
                  <label class="setting-label">分页加载数量</label>
                  <span class="setting-hint">单词管理页每批加载数</span>
                </div>
                <div class="setting-control-row">
                  <WheelSelector
                    v-model="settings.management.wordsLoadBatchSize"
                    :min="50"
                    :max="500"
                    :step="50"
                  />
                  <span class="setting-value">{{ settings.management.wordsLoadBatchSize }}</span>
                  <span class="setting-unit">词</span>
                </div>
              </div>

              <!-- 释义获取线程数 -->
              <div class="setting-row" v-show="matchesSearchItem('definitionFetchThreads')">
                <div class="setting-label-group">
                  <label class="setting-label">释义获取线程</label>
                  <span class="setting-hint">推荐 2-5 个</span>
                </div>
                <div class="setting-control-row">
                  <WheelSelector
                    v-model="settings.management.definitionFetchThreads"
                    :min="1"
                    :max="10"
                    :step="1"
                  />
                  <span class="setting-value">{{ settings.management.definitionFetchThreads }}</span>
                  <span class="setting-unit">个</span>
                </div>
              </div>
            </div>

            <div class="section-actions">
              <BaseButton
                variant="primary"
                size="sm"
                :loading="savingSection === 'management'"
                @click="saveSection('management')"
              >
                保存管理设置
              </BaseButton>
              <BaseButton variant="ghost" size="sm" @click="resetSection('management')">
                恢复默认
              </BaseButton>
            </div>
          </div>
        </section>

        <!-- 词汇来源设置 -->
        <section
          v-show="matchesSearch('sources')"
          :id="'section-sources'"
          class="settings-section"
        >
          <div class="section-header" @click="toggleSection('sources')">
            <div class="section-title-row">
              <span class="section-icon">¶</span>
              <h2 class="section-title">词汇来源</h2>
              <span class="section-badge">{{ localSources.length }}/3</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.sources }]">›</span>
          </div>

          <div v-show="expandedSections.sources" class="section-body">
            <!-- 来源列表 -->
            <div class="sources-grid">
              <div
                v-for="(source, index) in localSources"
                :key="index"
                class="source-chip"
              >
                <span class="source-name">{{ source }}</span>
                <span class="source-count">{{ sourceStats[source] || 0 }}</span>
                <button
                  class="source-delete"
                  :disabled="localSources.length <= 1 || isDeleting"
                  @click="confirmDeleteSource(source)"
                >
                  ×
                </button>
              </div>

              <!-- 添加新来源 -->
              <div v-if="localSources.length < 3" class="source-add">
                <input
                  v-model="newSourceName"
                  type="text"
                  placeholder="+ 新来源"
                  class="source-input"
                  @keyup.enter="addSource"
                />
              </div>
            </div>

            <p class="source-warning">删除来源会同时删除该来源的所有单词，不可撤销</p>
          </div>
        </section>

        <!-- 音频设置 -->
        <section
          v-show="matchesSearch('audio')"
          :id="'section-audio'"
          class="settings-section"
        >
          <div class="section-header" @click="toggleSection('audio')">
            <div class="section-title-row">
              <span class="section-icon">♪</span>
              <h2 class="section-title">音频设置</h2>
              <span class="section-badge">3 项</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.audio }]">›</span>
          </div>

          <div v-show="expandedSections.audio" class="section-body">
            <div class="settings-grid">
              <!-- 发音口音 -->
              <div class="setting-row setting-row-accent" v-show="matchesSearchItem('accent')">
                <div class="setting-label-group">
                  <label class="setting-label">单词发音</label>
                </div>
                <div class="accent-toggle">
                  <button
                    :class="['accent-btn', { active: settings.audio.accent === 'us' }]"
                    @click="setAccent('us')"
                  >
                    🇺🇸 美音
                  </button>
                  <button
                    :class="['accent-btn', { active: settings.audio.accent === 'uk' }]"
                    @click="setAccent('uk')"
                  >
                    🇬🇧 英音
                  </button>
                </div>
              </div>

              <!-- 新单词出现时自动播放 -->
              <div class="setting-row setting-row-toggle" v-show="matchesSearchItem('autoPlayOnWordChange')">
                <div class="setting-label-group">
                  <label class="setting-label">新单词出现时自动播放</label>
                  <span class="setting-hint">切换到新单词时自动播放发音</span>
                </div>
                <IOSSwitch v-model="settings.audio.autoPlayOnWordChange" @update:modelValue="saveAudioSettings" />
              </div>

              <!-- 选择答案后自动播放 -->
              <div class="setting-row setting-row-toggle" v-show="matchesSearchItem('autoPlayAfterAnswer')">
                <div class="setting-label-group">
                  <label class="setting-label">选择答案后自动播放</label>
                  <span class="setting-hint">点击记住/没记住后自动播放</span>
                </div>
                <IOSSwitch v-model="settings.audio.autoPlayAfterAnswer" @update:modelValue="saveAudioSettings" />
              </div>
            </div>
          </div>
        </section>

        <!-- 快捷键设置 - 仅桌面端 -->
        <section
          v-show="matchesSearch('hotkeys')"
          :id="'section-hotkeys'"
          class="settings-section desktop-only"
        >
          <div class="section-header" @click="toggleSection('hotkeys')">
            <div class="section-title-row">
              <span class="section-icon">⌘</span>
              <h2 class="section-title">快捷键设置</h2>
              <span class="section-badge">8 项</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.hotkeys }]">›</span>
          </div>

          <div v-show="expandedSections.hotkeys" class="section-body">
            <!-- 复习初始状态 -->
            <div class="hotkey-group">
              <h3 class="hotkey-group-title">复习 · 初始状态</h3>
              <div class="hotkey-grid">
                <div class="hotkey-row">
                  <span class="hotkey-label">记住 <BaseIcon name="Check" size="xs" color="success" /></span>
                  <KeySelector
                    v-model="settings.hotkeys.reviewInitial.remembered"
                    :used-keys="[settings.hotkeys.reviewInitial.notRemembered, settings.hotkeys.reviewInitial.stopReview]"
                  />
                </div>
                <div class="hotkey-row">
                  <span class="hotkey-label">没记住</span>
                  <KeySelector
                    v-model="settings.hotkeys.reviewInitial.notRemembered"
                    :used-keys="[settings.hotkeys.reviewInitial.remembered, settings.hotkeys.reviewInitial.stopReview]"
                  />
                </div>
                <div class="hotkey-row">
                  <span class="hotkey-label">不再复习 <BaseIcon name="Ban" size="xs" /></span>
                  <KeySelector
                    v-model="settings.hotkeys.reviewInitial.stopReview"
                    :used-keys="[settings.hotkeys.reviewInitial.remembered, settings.hotkeys.reviewInitial.notRemembered]"
                  />
                </div>
              </div>
            </div>

            <!-- 复习显示释义后 -->
            <div class="hotkey-group">
              <h3 class="hotkey-group-title">复习 · 显示释义后</h3>
              <div class="hotkey-grid">
                <div class="hotkey-row">
                  <span class="hotkey-label">记错了</span>
                  <KeySelector
                    v-model="settings.hotkeys.reviewAfter.wrong"
                    :used-keys="[settings.hotkeys.reviewAfter.next]"
                  />
                </div>
                <div class="hotkey-row">
                  <span class="hotkey-label">下一个 <BaseIcon name="ArrowRight" size="xs" /></span>
                  <KeySelector
                    v-model="settings.hotkeys.reviewAfter.next"
                    :used-keys="[settings.hotkeys.reviewAfter.wrong]"
                  />
                </div>
              </div>
            </div>

            <!-- 拼写页面 -->
            <div class="hotkey-group">
              <h3 class="hotkey-group-title">拼写练习</h3>
              <div class="hotkey-grid">
                <div class="hotkey-row">
                  <span class="hotkey-label">播放发音</span>
                  <KeySelector
                    v-model="settings.hotkeys.spelling.playAudio"
                    :used-keys="[settings.hotkeys.spelling.forgot, settings.hotkeys.spelling.next]"
                  />
                </div>
                <div class="hotkey-row">
                  <span class="hotkey-label">忘记了 ❓</span>
                  <KeySelector
                    v-model="settings.hotkeys.spelling.forgot"
                    :used-keys="[settings.hotkeys.spelling.playAudio, settings.hotkeys.spelling.next]"
                  />
                </div>
                <div class="hotkey-row">
                  <span class="hotkey-label">下一个 <BaseIcon name="ArrowRight" size="xs" /></span>
                  <KeySelector
                    v-model="settings.hotkeys.spelling.next"
                    :used-keys="[settings.hotkeys.spelling.playAudio, settings.hotkeys.spelling.forgot]"
                  />
                </div>
              </div>
            </div>

            <div class="section-actions">
              <BaseButton
                variant="primary"
                size="sm"
                :loading="savingSection === 'hotkeys'"
                @click="saveSection('hotkeys')"
              >
                保存快捷键
              </BaseButton>
              <BaseButton variant="ghost" size="sm" @click="resetSection('hotkeys')">
                恢复默认
              </BaseButton>
            </div>
          </div>
        </section>

        <!-- 单词关联 -->
        <section
          v-show="matchesSearch('relations')"
          :id="'section-relations'"
          class="settings-section"
        >
          <div class="section-header" @click="toggleSection('relations')">
            <div class="section-title-row">
              <span class="section-icon">◈</span>
              <h2 class="section-title">单词关联</h2>
              <span class="section-badge">{{ relationStats.total }} 条</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.relations }]">›</span>
          </div>

          <div v-show="expandedSections.relations" class="section-body">
            <div class="relation-stats">
              <div class="relation-stat">
                <span class="stat-label">同义词</span>
                <span class="stat-value">{{ relationStats.synonym || 0 }}</span>
              </div>
              <div class="relation-stat">
                <span class="stat-label">反义词</span>
                <span class="stat-value">{{ relationStats.antonym || 0 }}</span>
              </div>
              <div class="relation-stat">
                <span class="stat-label">词根</span>
                <span class="stat-value">{{ relationStats.root || 0 }}</span>
              </div>
              <div class="relation-stat">
                <span class="stat-label">易混淆</span>
                <span class="stat-value">{{ relationStats.confused || 0 }}</span>
              </div>
              <div class="relation-stat">
                <span class="stat-label">主题</span>
                <span class="stat-value">{{ relationStats.topic || 0 }}</span>
              </div>
            </div>

            <BaseButton
              variant="secondary"
              size="sm"
              class="desktop-only"
              @click="viewRelationGraph"
            >
              ◈ 查看关系图
            </BaseButton>
          </div>
        </section>
      </div>
    </main>

    <!-- 全局保存成功提示 -->
    <transition name="toast">
      <div v-if="toastMessage" class="toast">
        <span class="toast-icon">✓</span>
        {{ toastMessage }}
      </div>
    </transition>

    <!-- 关系图浮窗 -->
    <RelationGraphModal v-model:show="showGraphModal" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import WheelSelector from '@/shared/components/controls/WheelSelector.vue'
import IOSSwitch from '@/shared/components/controls/IOSSwitch.vue'
import KeySelector from '@/shared/components/controls/KeySelector.vue'
import RelationGraphModal from '@/shared/components/RelationGraphModal.vue'
import { BaseButton } from '@/shared/components/base'
import { useSettings } from '@/shared/composables/useSettings'
import { api } from '@/shared/api'
import type { UserSettings } from '@/shared/types'
import { logger } from '@/shared/utils/logger'
import { BaseIcon } from '@/shared/components/base'

// 搜索和导航
const searchQuery = ref('')
const isSearchFocused = ref(false)
const activeSection = ref('learning')
const contentRef = ref<HTMLElement | null>(null)

// 展开状态 - 默认全部展开
const expandedSections = reactive({
  learning: true,
  lapse: true,
  management: true,
  sources: true,
  audio: true,
  hotkeys: true,
  relations: true,
})

// 设置数据
const { settings: globalSettings, loadSettings, updateSettings } = useSettings()

// 搜索关键词映射
const searchKeywords: Record<string, string[]> = {
  dailyReviewLimit: ['复习', '上限', '每日', 'review', 'limit'],
  dailySpellLimit: ['拼写', '上限', '每日', 'spell'],
  maxPrepDays: ['准备', '天数', '考试', 'prep', 'days'],
  lowEfExtraCount: ['低EF', '额外', '难词', 'ef', 'extra'],
  lapseQueueSize: ['错题', '队列', '大小', 'lapse', 'queue'],
  lapseInitialValue: ['错题', '答对', '次数', 'initial'],
  lapseMaxValue: ['最大', '答对', '次数', 'max'],
  lapseFastExitEnabled: ['加速', '退出', 'fast', 'exit'],
  lapseConsecutiveThreshold: ['快速', '门槛', 'threshold'],
  wordsLoadBatchSize: ['分页', '加载', '批量', 'batch'],
  definitionFetchThreads: ['释义', '线程', '并发', 'threads'],
  accent: ['发音', '口音', '美音', '英音', 'accent'],
  autoPlayOnWordChange: ['自动播放', '新单词', 'autoplay'],
  autoPlayAfterAnswer: ['自动播放', '答案', 'autoplay'],
}

const sectionKeywords: Record<string, string[]> = {
  learning: ['学习', '复习', '拼写', 'learning'],
  lapse: ['错题', 'lapse'],
  management: ['管理', '加载', 'management'],
  sources: ['来源', '词库', 'sources'],
  audio: ['音频', '发音', 'audio'],
  hotkeys: ['快捷键', 'hotkey'],
  relations: ['关联', '关系', 'relation'],
}

// 导航数据
const sections = computed(() => [
  { id: 'learning', title: '学习', icon: '§', itemCount: 4 },
  { id: 'lapse', title: '错题', icon: '✗', itemCount: 5 },
  { id: 'management', title: '管理', icon: '✎', itemCount: 2 },
  { id: 'sources', title: '来源', icon: '¶', itemCount: localSources.value.length },
  { id: 'audio', title: '音频', icon: '♪', itemCount: 3 },
  { id: 'hotkeys', title: '快捷键', icon: '⌘', itemCount: 8 },
  { id: 'relations', title: '关联', icon: '◈', itemCount: relationStats.value.total },
])

const filteredSections = computed(() => {
  if (!searchQuery.value.trim()) return sections.value
  const query = searchQuery.value.toLowerCase()
  return sections.value.filter((section) => {
    const keywords = sectionKeywords[section.id] || []
    return keywords.some((kw) => kw.includes(query)) || section.title.includes(query)
  })
})

// 搜索匹配
const matchesSearch = (sectionId: string) => {
  if (!searchQuery.value.trim()) return true
  const query = searchQuery.value.toLowerCase()
  const keywords = sectionKeywords[sectionId] || []
  return keywords.some((kw) => kw.includes(query))
}

const matchesSearchItem = (itemKey: string) => {
  if (!searchQuery.value.trim()) return true
  const query = searchQuery.value.toLowerCase()
  const keywords = searchKeywords[itemKey] || []
  return keywords.some((kw) => kw.includes(query))
}

// 学习设置项
const learningItems = {
  dailyReviewLimit: true,
  dailySpellLimit: true,
  maxPrepDays: true,
  lowEfExtraCount: true,
}

// 设置数据 - 带默认值
const settings = computed<UserSettings>(() =>
  globalSettings.value || {
    learning: {
      dailyReviewLimit: 300,
      dailySpellLimit: 200,
      maxPrepDays: 45,
      lapseQueueSize: 25,
      lapseMaxValue: 4,
      lapseInitialValue: 3,
      lapseFastExitEnabled: true,
      lapseConsecutiveThreshold: 2,
      defaultShuffle: false,
      lowEfExtraCount: 50,
    },
    management: {
      wordsLoadBatchSize: 200,
      definitionFetchThreads: 3,
    },
    sources: {
      customSources: ['IELTS', 'GRE'],
    },
    audio: {
      accent: 'us',
      autoPlayOnWordChange: true,
      autoPlayAfterAnswer: true,
    },
    hotkeys: {
      reviewInitial: {
        remembered: 'ArrowLeft',
        notRemembered: 'ArrowRight',
        stopReview: 'ArrowDown',
      },
      reviewAfter: {
        wrong: 'ArrowLeft',
        next: 'ArrowRight',
      },
      spelling: {
        playAudio: 'ArrowLeft',
        forgot: 'ArrowRight',
        next: 'Enter',
      },
    },
  }
)

// 来源管理
const localSources = ref<string[]>([])
const sourceStats = ref<Record<string, number>>({})
const newSourceName = ref('')
const isDeleting = ref(false)

// 关系统计
const relationStats = ref({
  synonym: 0,
  antonym: 0,
  root: 0,
  confused: 0,
  topic: 0,
  total: 0,
})

// 保存状态
const savingSection = ref<string | null>(null)
const toastMessage = ref('')
const showGraphModal = ref(false)

// 方法
const toggleSection = (id: string) => {
  expandedSections[id as keyof typeof expandedSections] =
    !expandedSections[id as keyof typeof expandedSections]
}

const scrollToSection = (sectionId: string) => {
  activeSection.value = sectionId
  const element = document.getElementById(`section-${sectionId}`)
  if (element && contentRef.value) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // 确保展开
    expandedSections[sectionId as keyof typeof expandedSections] = true
  }
}

const handleScroll = () => {
  if (!contentRef.value) return
  const containerRect = contentRef.value.getBoundingClientRect()

  for (const section of sections.value) {
    const element = document.getElementById(`section-${section.id}`)
    if (element) {
      const rect = element.getBoundingClientRect()
      if (rect.top <= containerRect.top + 100 && rect.bottom > containerRect.top) {
        activeSection.value = section.id
        break
      }
    }
  }
}

const showToast = (message: string) => {
  toastMessage.value = message
  setTimeout(() => {
    toastMessage.value = ''
  }, 2000)
}

// 保存各区块设置
const saveSection = async (section: string) => {
  savingSection.value = section
  try {
    if (section === 'learning' || section === 'lapse') {
      await updateSettings({ learning: settings.value.learning })
    } else if (section === 'management') {
      await updateSettings({ management: settings.value.management })
    } else if (section === 'hotkeys') {
      await updateSettings({ hotkeys: settings.value.hotkeys })
    }
    showToast('设置已保存')
  } catch (error) {
    logger.error(`保存${section}设置失败:`, error)
    alert('保存失败，请重试')
  } finally {
    savingSection.value = null
  }
}

// 重置各区块
const resetSection = async (section: string) => {
  if (!confirm('确定要恢复默认值吗？')) return

  try {
    if (section === 'learning') {
      settings.value.learning = {
        ...settings.value.learning,
        dailyReviewLimit: 300,
        dailySpellLimit: 200,
        maxPrepDays: 45,
        defaultShuffle: false,
        lowEfExtraCount: 50,
      }
    } else if (section === 'lapse') {
      settings.value.learning = {
        ...settings.value.learning,
        lapseQueueSize: 25,
        lapseMaxValue: 4,
        lapseInitialValue: 3,
        lapseFastExitEnabled: true,
        lapseConsecutiveThreshold: 2,
      }
    } else if (section === 'management') {
      settings.value.management = {
        wordsLoadBatchSize: 200,
        definitionFetchThreads: 3,
      }
    } else if (section === 'hotkeys') {
      settings.value.hotkeys = {
        reviewInitial: {
          remembered: 'ArrowLeft',
          notRemembered: 'ArrowRight',
          stopReview: 'ArrowDown',
        },
        reviewAfter: {
          wrong: 'ArrowLeft',
          next: 'ArrowRight',
        },
        spelling: {
          playAudio: 'ArrowLeft',
          forgot: 'ArrowRight',
          next: 'Enter',
        },
      }
    }
    await saveSection(section)
  } catch (error) {
    logger.error(`重置${section}设置失败:`, error)
  }
}

// 音频设置自动保存
const setAccent = async (accent: 'us' | 'uk') => {
  settings.value.audio.accent = accent
  await saveAudioSettings()
}

const saveAudioSettings = async () => {
  try {
    await updateSettings({ audio: settings.value.audio })
    showToast('音频设置已保存')
  } catch (error) {
    logger.error('保存音频设置失败:', error)
  }
}

// 来源管理
const addSource = async () => {
  const name = newSourceName.value.trim()
  if (!name || localSources.value.length >= 3 || localSources.value.includes(name)) return

  try {
    const newSources = [...localSources.value, name]
    await updateSettings({
      sources: { customSources: newSources },
    })
    localSources.value.push(name)
    newSourceName.value = ''
    showToast(`已添加来源"${name}"`)
  } catch (error) {
    logger.error('添加来源失败:', error)
    alert('添加失败，请重试')
  }
}

const confirmDeleteSource = async (source: string) => {
  const wordCount = sourceStats.value[source] || 0
  if (!confirm(`删除来源"${source}"将删除 ${wordCount} 个单词，不可撤销！`)) return

  try {
    isDeleting.value = true
    await api.config.deleteSource(source)
    const index = localSources.value.indexOf(source)
    if (index > -1) {
      localSources.value.splice(index, 1)
    }
    await loadSourceStats()
    showToast(`已删除来源"${source}"`)
  } catch (error) {
    logger.error('删除来源失败:', error)
    alert('删除失败，请重试')
  } finally {
    isDeleting.value = false
  }
}

const loadSourceStats = async () => {
  try {
    sourceStats.value = await api.config.getSourcesStats()
  } catch (error) {
    logger.error('加载来源统计失败:', error)
  }
}

// 关系统计
const loadRelationStats = async () => {
  try {
    const data = await api.relations.getStatsDirect()
    relationStats.value = data
  } catch (error) {
    logger.error('加载关系统计失败:', error)
  }
}

const viewRelationGraph = () => {
  showGraphModal.value = true
}

// 初始化
onMounted(async () => {
  await loadSettings({ force: true })

  // 加载来源
  const settingsData = await api.settings.getSettings()
  localSources.value = [...(settingsData.sources?.customSources || ['IELTS', 'GRE'])]

  await Promise.all([loadSourceStats(), loadRelationStats()])
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   高信息密度设置页面 - IDE/编辑器风格
   ═══════════════════════════════════════════════════════════════════════════ */

.settings-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--color-bg-secondary);
  font-family: var(--font-ui);
  /* 覆盖父容器的居中效果，填满宽度 */
  width: 100%;
  align-self: stretch;
}

/* ═══════════════════════════════════════════════════════════════════════════
   顶部搜索栏
   ═══════════════════════════════════════════════════════════════════════════ */

.settings-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border-medium);
  padding: 12px 24px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  font-family: var(--font-heading);
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-default);
  padding: 6px 12px;
  min-width: 240px;
  transition: all 0.2s;
}

.search-box:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.search-icon {
  font-size: 11px;
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  margin-right: 8px;
  font-family: var(--font-mono);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--color-text-primary);
  outline: none;
}

.search-input::placeholder {
  color: var(--color-text-tertiary);
}

/* ═══════════════════════════════════════════════════════════════════════════
   主内容区
   ═══════════════════════════════════════════════════════════════════════════ */

.settings-main {
  display: flex;
  flex: 1;
  width: 100%;
}

/* ═══════════════════════════════════════════════════════════════════════════
   左侧快速导航
   ═══════════════════════════════════════════════════════════════════════════ */

.settings-nav {
  position: sticky;
  top: 60px;
  width: 160px;
  height: calc(100vh - 60px);
  padding: 16px 8px;
  flex-shrink: 0;
  overflow-y: auto;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  font-size: 13px;
}

.nav-item:hover {
  background: var(--color-bg-tertiary);
}

.nav-item.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.nav-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
}

.nav-label {
  flex: 1;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.nav-item.active .nav-label {
  color: var(--color-primary);
}

.nav-count {
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-family: var(--font-mono);
}

/* ═══════════════════════════════════════════════════════════════════════════
   设置内容区
   ═══════════════════════════════════════════════════════════════════════════ */

.settings-content {
  flex: 1;
  padding: 16px 32px 80px;
  overflow-y: auto;
  max-height: calc(100vh - 60px);
}

.settings-content > .settings-section {
  max-width: 900px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   设置区块
   ═══════════════════════════════════════════════════════════════════════════ */

.settings-section {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.section-header:hover {
  background: var(--color-bg-secondary);
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-icon {
  font-size: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.section-badge {
  font-size: 11px;
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-family: var(--font-mono);
}

.chevron {
  font-size: 18px;
  color: var(--color-text-tertiary);
  transition: transform 0.2s;
  font-weight: 300;
}

.chevron.expanded {
  transform: rotate(90deg);
}

.section-body {
  padding: 0 16px 16px;
  border-top: 1px solid var(--color-border-light);
}

/* ═══════════════════════════════════════════════════════════════════════════
   设置行 - 高密度布局
   ═══════════════════════════════════════════════════════════════════════════ */

.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border-light);
  gap: 16px;
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-label-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.setting-hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.setting-control-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* WheelSelector 包装器 - 让绝对定位的组件正常显示 */
.setting-control-row :deep(.wheel) {
  position: relative;
  top: auto;
  left: auto;
  transform: none;
  width: 56px;
  height: 60px;
}

.setting-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-primary);
  font-family: var(--font-mono);
  min-width: 40px;
  text-align: right;
}

.setting-unit {
  font-size: 12px;
  color: var(--color-text-tertiary);
  min-width: 24px;
}

.setting-row-toggle {
  padding: 10px 0;
}

.setting-row-accent {
  flex-wrap: wrap;
}

/* ═══════════════════════════════════════════════════════════════════════════
   口音切换
   ═══════════════════════════════════════════════════════════════════════════ */

.accent-toggle {
  display: flex;
  gap: 4px;
  background: var(--color-bg-secondary);
  padding: 3px;
  border-radius: var(--radius-default);
}

.accent-btn {
  padding: 6px 14px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  color: var(--color-text-secondary);
}

.accent-btn:hover {
  background: var(--color-bg-tertiary);
}

.accent-btn.active {
  background: var(--color-bg-primary);
  color: var(--color-primary);
  font-weight: 500;
  box-shadow: var(--shadow-sm);
}

/* ═══════════════════════════════════════════════════════════════════════════
   来源管理
   ═══════════════════════════════════════════════════════════════════════════ */

.sources-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 0;
}

.source-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 12px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-full);
  font-size: 13px;
}

.source-name {
  font-weight: 500;
  color: var(--color-text-primary);
}

.source-count {
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-family: var(--font-mono);
}

.source-delete {
  width: 18px;
  height: 18px;
  border: none;
  background: var(--color-bg-tertiary);
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.source-delete:hover:not(:disabled) {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.source-delete:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.source-add {
  display: flex;
}

.source-input {
  padding: 6px 12px;
  border: 1px dashed var(--color-border-medium);
  border-radius: var(--radius-full);
  background: transparent;
  font-size: 13px;
  color: var(--color-text-primary);
  outline: none;
  min-width: 100px;
  transition: all 0.15s;
}

.source-input:focus {
  border-style: solid;
  border-color: var(--color-primary);
  background: var(--color-bg-primary);
}

.source-input::placeholder {
  color: var(--color-text-tertiary);
}

.source-warning {
  font-size: 11px;
  color: var(--color-warning);
  margin: 0;
  padding-top: 4px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   快捷键设置
   ═══════════════════════════════════════════════════════════════════════════ */

.hotkey-group {
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border-light);
}

.hotkey-group:last-of-type {
  border-bottom: none;
}

.hotkey-group-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 10px 0;
}

.hotkey-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.hotkey-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
}

.hotkey-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* ═══════════════════════════════════════════════════════════════════════════
   关系统计
   ═══════════════════════════════════════════════════════════════════════════ */

.relation-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 0;
}

.relation-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-default);
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
  font-family: var(--font-mono);
}

/* ═══════════════════════════════════════════════════════════════════════════
   区块操作按钮
   ═══════════════════════════════════════════════════════════════════════════ */

.section-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-light);
  margin-top: 4px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Toast 提示
   ═══════════════════════════════════════════════════════════════════════════ */

.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-text-primary);
  color: var(--color-text-inverse);
  padding: 10px 20px;
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: var(--shadow-lg);
  z-index: 1000;
}

.toast-icon {
  color: var(--color-success);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   响应式 - 隐藏桌面端元素
   ═══════════════════════════════════════════════════════════════════════════ */

.desktop-only {
  display: flex;
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .settings-page {
    /* 外边距由组件自己控制，与 HomePage main-container 解耦 */
    margin: 0.75rem;
    width: calc(100% - 1.5rem);
    min-height: auto;
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .settings-header {
    padding: 10px 16px;
  }

  .settings-title {
    font-size: 18px;
  }

  .search-box {
    min-width: 160px;
  }

  .search-icon {
    display: none;
  }

  .settings-nav {
    display: none;
  }

  .settings-content {
    padding: 12px 16px 80px;
    max-height: none;
    /* 隐藏滚动条但保持滚动功能 */
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .settings-content::-webkit-scrollbar {
    display: none;
  }

  .settings-section {
    margin-bottom: 8px;
  }

  .section-header {
    padding: 10px 12px;
  }

  .section-body {
    padding: 0 12px 12px;
  }

  .setting-row {
    flex-wrap: wrap;
    padding: 10px 0;
  }

  .setting-label-group {
    width: 100%;
    margin-bottom: 8px;
  }

  .setting-control-row {
    width: 100%;
    justify-content: flex-end;
  }

  .hotkey-grid {
    grid-template-columns: 1fr;
  }

  .sources-grid {
    gap: 6px;
  }

  .source-chip {
    padding: 5px 8px 5px 10px;
    font-size: 12px;
  }

  .relation-stats {
    gap: 8px;
  }

  .relation-stat {
    padding: 5px 10px;
  }

  .desktop-only {
    display: none !important;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   小屏手机
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 380px) {
  .settings-header {
    padding: 8px 12px;
  }

  .settings-title {
    font-size: 16px;
  }

  .search-box {
    min-width: 120px;
    padding: 5px 10px;
  }

  .settings-content {
    padding: 8px 12px 60px;
  }

  .section-header {
    padding: 8px 10px;
  }

  .section-title {
    font-size: 13px;
  }

  .section-icon {
    font-size: 14px;
  }

  .setting-label {
    font-size: 12px;
  }

  .setting-value {
    font-size: 14px;
  }
}
</style>

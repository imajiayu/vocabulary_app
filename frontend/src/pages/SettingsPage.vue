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
            <span class="nav-icon"><AppIcon :name="section.icon" /></span>
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
              <span class="section-icon"><AppIcon name="graduation-cap" /></span>
              <h2 class="section-title">学习设置</h2>
              <span class="section-badge">{{ Object.keys(learningItems).length }} 项</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.learning }]"><AppIcon name="expand" /></span>
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
              <button class="reset-link" @click="resetSection('learning')">
                恢复默认
              </button>
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
              <span class="section-icon"><AppIcon name="rotate-ccw" /></span>
              <h2 class="section-title">错题集设置</h2>
              <span class="section-badge">1 项</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.lapse }]"><AppIcon name="expand" /></span>
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
            </div>

            <div class="section-actions">
              <button class="reset-link" @click="resetSection('lapse')">
                恢复默认
              </button>
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
              <span class="section-icon"><AppIcon name="sliders" /></span>
              <h2 class="section-title">单词管理</h2>
              <span class="section-badge">2 项</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.management }]"><AppIcon name="expand" /></span>
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
              <button class="reset-link" @click="resetSection('management')">
                恢复默认
              </button>
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
              <span class="section-icon"><AppIcon name="layers" /></span>
              <h2 class="section-title">词汇来源</h2>
              <span class="section-badge">{{ localSources.length }}/3</span>
              <span class="auto-save-tag">自动保存</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.sources }]"><AppIcon name="expand" /></span>
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
              <span class="section-icon"><AppIcon name="music-note" /></span>
              <h2 class="section-title">音频设置</h2>
              <span class="section-badge">3 项</span>
              <span class="auto-save-tag">自动保存</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.audio }]"><AppIcon name="expand" /></span>
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
                    美音
                  </button>
                  <button
                    :class="['accent-btn', { active: settings.audio.accent === 'uk' }]"
                    @click="setAccent('uk')"
                  >
                    英音
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
              <span class="section-icon"><AppIcon name="command" /></span>
              <h2 class="section-title">快捷键设置</h2>
              <span class="section-badge">8 项</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.hotkeys }]"><AppIcon name="expand" /></span>
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
                  <span class="hotkey-label">忘记了</span>
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
              <button class="reset-link" @click="resetSection('hotkeys')">
                恢复默认
              </button>
            </div>
          </div>
        </section>

        <!-- 单词关联 -->
        <section
          v-show="matchesSearch('relations')"
          :id="'section-relations'"
          class="settings-section settings-section--relations"
        >
          <div class="section-header" @click="toggleSection('relations')">
            <div class="section-title-row">
              <span class="section-icon"><AppIcon name="git-branch" /></span>
              <h2 class="section-title">单词关联</h2>
              <span class="section-badge">{{ relationStats.total }} 条</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.relations }]"><AppIcon name="expand" /></span>
          </div>

          <div v-show="expandedSections.relations" class="section-body section-body--relations">
            <!-- 关系卡片网格 -->
            <div class="relation-grid">
              <article
                v-for="rt in relationTypes"
                :key="rt.type"
                :class="[
                  'relation-tile',
                  `relation-tile--${rt.type}`,
                  { 'relation-tile--active': isRunning(rt.type) }
                ]"
              >
                <!-- 装饰性色带 -->
                <div class="relation-tile__accent"></div>

                <!-- 主体内容 -->
                <div class="relation-tile__body">
                  <!-- 头部：图标 + 标题 -->
                  <header class="relation-tile__header">
                    <div class="relation-tile__icon-wrap">
                      <span class="relation-tile__icon"><AppIcon :name="rt.icon" /></span>
                    </div>
                    <div class="relation-tile__title-group">
                      <h3 class="relation-tile__title">{{ rt.label }}</h3>
                      <span class="relation-tile__subtitle">{{ rt.type }}</span>
                    </div>
                  </header>

                  <!-- 统计/状态区 -->
                  <div class="relation-tile__stats">
                    <template v-if="isRunning(rt.type)">
                      <div class="relation-tile__live-stats">
                        <div class="live-stat">
                          <span class="live-stat__value">{{ generationStatus[rt.type]?.found || 0 }}</span>
                          <span class="live-stat__label">发现</span>
                        </div>
                        <div class="live-stat">
                          <span class="live-stat__value">{{ generationStatus[rt.type]?.saved || 0 }}</span>
                          <span class="live-stat__label">已保存</span>
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <div class="relation-tile__count">
                        <span class="relation-tile__count-value">
                          {{ relationStats[rt.type as keyof typeof relationStats] || 0 }}
                        </span>
                        <span class="relation-tile__count-unit">对</span>
                      </div>
                    </template>
                  </div>

                  <!-- 进度条（生成中） -->
                  <div v-if="isRunning(rt.type)" class="relation-tile__progress">
                    <div class="progress-track">
                      <div
                        class="progress-fill"
                        :style="{ width: progressPercent(rt.type) + '%' }"
                      >
                        <div class="progress-shine"></div>
                      </div>
                    </div>
                    <div class="progress-meta">
                      <span class="progress-percent">{{ progressPercent(rt.type) }}%</span>
                      <span class="progress-detail">
                        {{ generationStatus[rt.type]?.processed || 0 }} / {{ generationStatus[rt.type]?.total || 0 }}
                        <template v-if="generationStatus[rt.type]?.skipped">
                          · 跳过 {{ generationStatus[rt.type]?.skipped }}
                        </template>
                      </span>
                    </div>
                  </div>

                  <!-- 结果摘要（完成/停止后） -->
                  <div v-else-if="hasResult(rt.type)" class="relation-tile__result">
                    <span class="result-badge" :class="generationStatus[rt.type]?.status === 'completed' ? 'result-badge--success' : 'result-badge--stopped'">
                      {{ generationStatus[rt.type]?.status === 'completed' ? '完成' : '已停止' }}
                    </span>
                    <span class="result-summary">
                      +{{ generationStatus[rt.type]?.saved || 0 }} 对
                      <template v-if="generationStatus[rt.type]?.skipped">
                        · 跳过 {{ generationStatus[rt.type]?.skipped }}
                      </template>
                    </span>
                  </div>
                </div>

                <!-- 操作区 -->
                <footer class="relation-tile__actions">
                  <template v-if="isRunning(rt.type)">
                    <button
                      class="tile-btn tile-btn--stop"
                      @click="handleStop(rt.type)"
                    >
                      <span class="tile-btn__icon"><AppIcon name="ban" /></span>
                      停止
                    </button>
                  </template>
                  <template v-else>
                    <button
                      class="tile-btn tile-btn--generate"
                      :disabled="isRunning(rt.type)"
                      @click="handleGenerate(rt.type)"
                    >
                      <span class="tile-btn__icon"><AppIcon name="play" /></span>
                      生成
                    </button>
                    <button
                      class="tile-btn tile-btn--clear"
                      :disabled="isRunning(rt.type) || !(relationStats[rt.type as keyof typeof relationStats])"
                      @click="handleClear(rt.type, rt.label)"
                    >
                      清空
                    </button>
                  </template>
                </footer>
              </article>
            </div>

            <!-- 底部操作栏 -->
            <div class="relation-footer desktop-only">
              <button class="relation-graph-btn" @click="viewRelationGraph">
                <span class="relation-graph-btn__icon"><AppIcon name="git-branch" /></span>
                <span class="relation-graph-btn__text">查看关系图谱</span>
                <span class="relation-graph-btn__arrow"><AppIcon name="expand" /></span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>

    <!-- ═══════════════════════════════════════════════════════════════════════
         统一保存栏 - 有未保存修改时从底部滑入
         ═══════════════════════════════════════════════════════════════════════ -->
    <transition name="save-bar">
      <div v-if="isDirty" class="save-bar">
        <div class="save-bar-inner">
          <div class="save-bar-info">
            <span class="save-bar-dot"></span>
            <span class="save-bar-text">有未保存的修改</span>
          </div>
          <div class="save-bar-actions">
            <button class="save-bar-discard" @click="discardChanges" :disabled="isSaving">
              放弃修改
            </button>
            <button class="save-bar-save" @click="saveAllSettings" :disabled="isSaving">
              <span v-if="isSaving" class="save-bar-spinner"></span>
              {{ isSaving ? '保存中...' : '保存设置' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 全局保存成功提示 -->
    <transition name="toast">
      <div v-if="toastMessage" class="toast">
        <span class="toast-icon"><AppIcon name="check" /></span>
        {{ toastMessage }}
      </div>
    </transition>

    <!-- 关系图浮窗 -->
    <RelationGraphModal v-model:show="showGraphModal" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import WheelSelector from '@/shared/components/controls/WheelSelector.vue'
import IOSSwitch from '@/shared/components/controls/IOSSwitch.vue'
import KeySelector from '@/shared/components/controls/KeySelector.vue'
import RelationGraphModal from '@/shared/components/RelationGraphModal.vue'
import { useSettings } from '@/shared/composables/useSettings'
import { api } from '@/shared/api'
import type { GenerationTaskStatus } from '@/shared/api/relations'
import type { UserSettings } from '@/shared/types'
import { logger } from '@/shared/utils/logger'
import { BaseIcon } from '@/shared/components/base'
import AppIcon, { type IconName } from '@/shared/components/controls/Icons.vue'

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

// ═══════════════════════════════════════════════════════════════════════════
// 脏状态追踪 - 记录最后保存的快照，与当前值对比
// ═══════════════════════════════════════════════════════════════════════════
const savedSnapshot = ref<string>('')

const takeSavableSnapshot = () => {
  if (!globalSettings.value) return ''
  const { learning, management, hotkeys } = globalSettings.value
  return JSON.stringify({ learning, management, hotkeys })
}

const currentSavableState = computed(() => {
  if (!globalSettings.value) return ''
  const { learning, management, hotkeys } = globalSettings.value
  return JSON.stringify({ learning, management, hotkeys })
})

const isDirty = computed(() => {
  if (!savedSnapshot.value || !currentSavableState.value) return false
  return savedSnapshot.value !== currentSavableState.value
})

const isSaving = ref(false)

// 搜索关键词映射
const searchKeywords: Record<string, string[]> = {
  dailyReviewLimit: ['复习', '上限', '每日', 'review', 'limit'],
  dailySpellLimit: ['拼写', '上限', '每日', 'spell'],
  maxPrepDays: ['准备', '天数', '考试', 'prep', 'days'],
  lowEfExtraCount: ['低EF', '额外', '难词', 'ef', 'extra'],
  lapseQueueSize: ['错题', '队列', '大小', 'lapse', 'queue'],
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
const sections = computed<{ id: string; title: string; icon: IconName; itemCount: number }[]>(() => [
  { id: 'learning', title: '学习', icon: 'graduation-cap', itemCount: 4 },
  { id: 'lapse', title: '错题', icon: 'rotate-ccw', itemCount: 1 },
  { id: 'management', title: '管理', icon: 'sliders', itemCount: 2 },
  { id: 'sources', title: '来源', icon: 'layers', itemCount: localSources.value.length },
  { id: 'audio', title: '音频', icon: 'music-note', itemCount: 3 },
  { id: 'hotkeys', title: '快捷键', icon: 'command', itemCount: 8 },
  { id: 'relations', title: '关联', icon: 'git-branch', itemCount: relationStats.value.total },
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
      lapseQueueSize: 20,
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
        remembered: 'ArrowRight',
        notRemembered: 'ArrowLeft',
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

// ═══════════════════════════════════════════════════════════════════════════
// 统一保存 - 一次性保存所有需要手动保存的设置
// ═══════════════════════════════════════════════════════════════════════════
const saveAllSettings = async () => {
  isSaving.value = true
  try {
    await updateSettings({
      learning: settings.value.learning,
      management: settings.value.management,
      hotkeys: settings.value.hotkeys,
    })
    savedSnapshot.value = takeSavableSnapshot()
    showToast('设置已保存')
  } catch (error) {
    logger.error('保存设置失败:', error)
    alert('保存失败，请重试')
  } finally {
    isSaving.value = false
  }
}

// 放弃修改 - 还原到快照状态
const discardChanges = () => {
  if (!savedSnapshot.value || !globalSettings.value) return
  try {
    const snapshot = JSON.parse(savedSnapshot.value) as Pick<UserSettings, 'learning' | 'management' | 'hotkeys'>
    globalSettings.value.learning = { ...snapshot.learning }
    globalSettings.value.management = { ...snapshot.management }
    globalSettings.value.hotkeys = JSON.parse(JSON.stringify(snapshot.hotkeys))
  } catch (error) {
    logger.error('放弃修改失败:', error)
  }
}

// 重置各区块（仅还原本地状态，不立即保存 —— 需要点全局保存）
const resetSection = (section: string) => {
  if (!confirm('确定要恢复默认值吗？恢复后需点击"保存设置"生效。')) return

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
      lapseQueueSize: 20,
    }
  } else if (section === 'management') {
    settings.value.management = {
      wordsLoadBatchSize: 200,
      definitionFetchThreads: 3,
    }
  } else if (section === 'hotkeys') {
    settings.value.hotkeys = {
      reviewInitial: {
        remembered: 'ArrowRight',
        notRemembered: 'ArrowLeft',
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
}

// 音频设置自动保存（不受统一保存控制）
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

// 来源管理（自动保存，不受统一保存控制）
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
    sourceStats.value = await api.config.getSourcesStats(localSources.value)
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

// ═══════════════════════════════════════════════════════════════════════════
// 关系生成
// ═══════════════════════════════════════════════════════════════════════════

const relationTypes: { type: string; label: string; icon: IconName }[] = [
  { type: 'synonym', label: '同义词', icon: 'synonym' },
  { type: 'antonym', label: '反义词', icon: 'antonym' },
  { type: 'root', label: '词根', icon: 'word-root' },
  { type: 'confused', label: '易混淆', icon: 'confused' },
  { type: 'topic', label: '主题', icon: 'topic' },
]

const generationStatus = ref<Record<string, GenerationTaskStatus>>({})
let eventSource: EventSource | null = null

const isRunning = (type: string) =>
  generationStatus.value[type]?.status === 'running'

const hasResult = (type: string) => {
  const s = generationStatus.value[type]
  return s && (s.status === 'completed' || s.status === 'stopped')
}

const clearResultAfterDelay = (type: string, delay = 5000) => {
  setTimeout(() => {
    const s = generationStatus.value[type]
    if (s && (s.status === 'completed' || s.status === 'stopped')) {
      generationStatus.value[type] = { ...s, status: 'idle' }
    }
  }, delay)
}

const progressPercent = (type: string) => {
  const s = generationStatus.value[type]
  if (!s || !s.total) return 0
  return Math.round((s.processed / s.total) * 100)
}

const ensureSSE = async () => {
  if (eventSource) return

  eventSource = await api.relations.createProgressStream()

  eventSource.addEventListener('progress', (e) => {
    const data = JSON.parse((e as MessageEvent).data)
    for (const [rt, status] of Object.entries(data)) {
      generationStatus.value[rt] = status as GenerationTaskStatus
    }
  })

  eventSource.addEventListener('completed', (e) => {
    const data = JSON.parse((e as MessageEvent).data)
    generationStatus.value[data.relation_type] = data
    loadRelationStats()
    clearResultAfterDelay(data.relation_type)
  })

  eventSource.addEventListener('stopped', (e) => {
    const data = JSON.parse((e as MessageEvent).data)
    generationStatus.value[data.relation_type] = data
    loadRelationStats()
    clearResultAfterDelay(data.relation_type)
  })

  eventSource.addEventListener('error', (e) => {
    // SSE error event from browser (connection lost) vs our custom error event
    if (e instanceof MessageEvent && e.data) {
      const data = JSON.parse(e.data)
      generationStatus.value[data.relation_type] = data
    }
  })

  eventSource.addEventListener('done', () => {
    closeSSE()
  })
}

const closeSSE = () => {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

const handleGenerate = async (type: string) => {
  try {
    generationStatus.value[type] = {
      status: 'running',
      processed: 0,
      total: 0,
      found: 0,
      saved: 0,
      skipped: 0,
    }
    await api.relations.startGeneration(type)
    ensureSSE()
  } catch (error: any) {
    logger.error('启动生成失败:', error)
    generationStatus.value[type] = { status: 'idle', processed: 0, total: 0, found: 0, saved: 0, skipped: 0 }
    alert(error.apiMessage || '启动生成失败')
  }
}

const handleStop = async (type: string) => {
  try {
    await api.relations.stopGeneration(type)
  } catch (error) {
    logger.error('停止生成失败:', error)
  }
}

const handleClear = async (type: string, label: string) => {
  const count = relationStats.value[type as keyof typeof relationStats.value] || 0
  if (!confirm(`确定清空所有${label}关系（${count} 对）？此操作不可撤销。`)) return

  try {
    await api.relations.clearByType(type)
    await loadRelationStats()
    showToast(`已清空${label}关系`)
  } catch (error) {
    logger.error('清空关系失败:', error)
    alert('清空失败，请重试')
  }
}

const initGenerationStatus = async () => {
  try {
    const status = await api.relations.getGenerationStatus()
    generationStatus.value = status

    // 有活跃任务则开启 SSE
    if (Object.values(status).some((s) => s.status === 'running')) {
      ensureSSE()
    }

    // 已完成的任务 5 秒后自动消失
    for (const [rt, s] of Object.entries(status)) {
      if (s.status === 'completed' || s.status === 'stopped') {
        clearResultAfterDelay(rt)
      }
    }
  } catch {
    // 后端未启动时忽略
  }
}

// 初始化
onMounted(async () => {
  await loadSettings({ force: true })

  // 初始化快照
  savedSnapshot.value = takeSavableSnapshot()

  // 加载来源
  const settingsData = await api.settings.getSettings()
  localSources.value = [...(settingsData.sources?.customSources || ['IELTS', 'GRE'])]

  await Promise.all([loadSourceStats(), loadRelationStats(), initGenerationStatus()])
})

onUnmounted(() => {
  closeSSE()
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   高信息密度设置页面 - IDE/编辑器风格
   ═══════════════════════════════════════════════════════════════════════════ */

.settings-page {
  /* 设置模块主题色覆盖 - 墨灰色调 */
  --color-primary: var(--primitive-ink-500);
  --color-primary-hover: var(--primitive-ink-600);
  --color-primary-light: rgba(90, 101, 120, 0.1);
  --color-bg-primary: #F8F9FB;
  --color-bg-secondary: #F0F1F4;
  --color-bg-tertiary: #E4E6EB;
  --color-border-medium: #D8DBE2;
  --color-border-light: rgba(90, 101, 120, 0.08);
  --button-primary-bg: var(--primitive-ink-600);
  --button-primary-bg-hover: var(--primitive-ink-700);
  --button-primary-text: #F8F9FB;

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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
}

.nav-icon .icon {
  width: 14px;
  height: 14px;
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
  /* 隐藏滚动条但保持滚动功能 */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.settings-content::-webkit-scrollbar {
  display: none;
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
  display: inline-flex;
  align-items: center;
}

.section-icon .icon {
  width: 16px;
  height: 16px;
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

/* 自动保存标签 */
.auto-save-tag {
  font-size: 10px;
  font-weight: 500;
  color: var(--color-state-success);
  background: var(--color-state-success-light);
  padding: 2px 7px;
  border-radius: var(--radius-full);
  letter-spacing: 0.3px;
}

.chevron {
  display: inline-flex;
  align-items: center;
  color: var(--color-text-tertiary);
  transition: transform 0.2s;
}

.chevron .icon {
  width: 16px;
  height: 16px;
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
   区块操作 - 仅保留恢复默认（文字链接样式）
   ═══════════════════════════════════════════════════════════════════════════ */

.section-actions {
  display: flex;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border-light);
  margin-top: 4px;
}

.reset-link {
  background: none;
  border: none;
  font-size: 12px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 4px 0;
  transition: color 0.15s;
}

.reset-link:hover {
  color: var(--color-primary);
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

.hotkey-group:has(+ .section-actions) {
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
   单词关联模块 - 与设置页面统一的灰色调
   ═══════════════════════════════════════════════════════════════════════════ */

.section-body--relations {
  padding: 16px !important;
}

/* 卡片网格布局 */
.relation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

/* 单张关系卡片 */
.relation-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-default);
  overflow: hidden;
  transition: all 0.2s ease;
}

.relation-tile:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(90, 101, 120, 0.08);
}

.relation-tile--active {
  border-color: var(--color-primary);
  box-shadow: 0 2px 12px rgba(90, 101, 120, 0.1);
}

/* 左侧装饰色带 */
.relation-tile__accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
}

.relation-tile--synonym .relation-tile__accent { background: var(--primitive-olive-500); }
.relation-tile--antonym .relation-tile__accent { background: var(--primitive-brick-500); }
.relation-tile--root .relation-tile__accent { background: var(--primitive-copper-500); }
.relation-tile--confused .relation-tile__accent { background: var(--primitive-gold-500); }
.relation-tile--topic .relation-tile__accent { background: var(--primitive-azure-500); }

/* 卡片主体 */
.relation-tile__body {
  flex: 1;
  padding: 12px 14px 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 头部区域 */
.relation-tile__header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.relation-tile__icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--color-bg-secondary);
}

.relation-tile--synonym .relation-tile__icon-wrap { color: var(--primitive-olive-600); }
.relation-tile--antonym .relation-tile__icon-wrap { color: var(--primitive-brick-600); }
.relation-tile--root .relation-tile__icon-wrap { color: var(--primitive-copper-600); }
.relation-tile--confused .relation-tile__icon-wrap { color: var(--primitive-gold-600); }
.relation-tile--topic .relation-tile__icon-wrap { color: var(--primitive-azure-600); }

.relation-tile__icon {
  display: inline-flex;
  align-items: center;
}

.relation-tile__icon .icon {
  width: 16px;
  height: 16px;
}

.relation-tile__title-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.relation-tile__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.relation-tile__subtitle {
  font-size: 10px;
  color: var(--color-text-tertiary);
  font-family: var(--font-mono);
}

/* 统计区 */
.relation-tile__stats {
  display: flex;
  align-items: center;
}

.relation-tile__count {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.relation-tile__count-value {
  font-size: 24px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--color-text-primary);
  line-height: 1;
  letter-spacing: -0.02em;
}

.relation-tile__count-unit {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* 实时统计（生成中） */
.relation-tile__live-stats {
  display: flex;
  gap: 16px;
}

.live-stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.live-stat__value {
  font-size: 18px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--color-text-primary);
  line-height: 1;
}

.live-stat__label {
  font-size: 10px;
  color: var(--color-text-tertiary);
}

/* 进度条 */
.relation-tile__progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-track {
  height: 4px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  position: relative;
  transition: width 0.3s ease;
  background: var(--color-primary);
}

/* 进度条光效 */
.progress-shine {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%
  );
  animation: progress-shimmer 1.5s ease-in-out infinite;
}

@keyframes progress-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.progress-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-percent {
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--color-text-primary);
}

.progress-detail {
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-family: var(--font-mono);
}

/* 结果摘要 */
.relation-tile__result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
}

.result-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--radius-full);
}

.result-badge--success {
  background: var(--color-state-success-light);
  color: var(--color-state-success);
}

.result-badge--stopped {
  background: var(--color-state-warning-light);
  color: var(--color-state-warning);
}

.result-summary {
  font-size: 11px;
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
}

/* 操作区 */
.relation-tile__actions {
  display: flex;
  gap: 6px;
  padding: 10px 14px 10px 16px;
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border-light);
}

.tile-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 6px 12px;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
}

.tile-btn__icon {
  display: inline-flex;
  align-items: center;
  opacity: 0.6;
}

.tile-btn__icon .icon {
  width: 10px;
  height: 10px;
}

.tile-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.tile-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tile-btn--generate:hover:not(:disabled) {
  background: var(--color-primary-light);
}

.tile-btn--stop {
  border-color: var(--primitive-brick-300);
  color: var(--primitive-brick-600);
}

.tile-btn--stop:hover {
  background: var(--color-state-error-light);
}

.tile-btn--clear {
  flex: 0 0 auto;
  border-color: transparent;
  background: transparent;
  color: var(--color-text-tertiary);
}

.tile-btn--clear:hover:not(:disabled) {
  color: var(--primitive-brick-600);
}

/* 底部操作栏 */
.relation-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-light);
}

.relation-graph-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: transparent;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-default);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.relation-graph-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.relation-graph-btn__icon {
  display: inline-flex;
  align-items: center;
}

.relation-graph-btn__icon .icon {
  width: 14px;
  height: 14px;
}

.relation-graph-btn__text {
  flex: 1;
}

.relation-graph-btn__arrow {
  display: inline-flex;
  align-items: center;
  transition: transform 0.15s;
}

.relation-graph-btn__arrow .icon {
  width: 12px;
  height: 12px;
}

.relation-graph-btn:hover .relation-graph-btn__arrow {
  transform: translateX(2px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   统一保存栏 - 底部固定
   ═══════════════════════════════════════════════════════════════════════════ */

.save-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 200;
  background: var(--color-bg-primary);
  border-top: 1px solid var(--color-border-medium);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
}

.save-bar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  max-width: 1100px;
  margin: 0 auto;
}

.save-bar-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.save-bar-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-state-warning);
  animation: pulse-dot 1.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.save-bar-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.save-bar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.save-bar-discard {
  padding: 7px 16px;
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 13px;
  cursor: pointer;
  border-radius: var(--radius-default);
  transition: all 0.15s;
}

.save-bar-discard:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

.save-bar-discard:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-bar-save {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 20px;
  border: none;
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius-default);
  cursor: pointer;
  transition: all 0.15s;
}

.save-bar-save:hover:not(:disabled) {
  background: var(--button-primary-bg-hover);
  box-shadow: 0 2px 8px rgba(90, 101, 120, 0.25);
}

.save-bar-save:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.save-bar-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 保存栏动画 */
.save-bar-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.save-bar-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.save-bar-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.save-bar-leave-to {
  transform: translateY(100%);
  opacity: 0;
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
  display: inline-flex;
  align-items: center;
  color: var(--color-success);
}

.toast-icon .icon {
  width: 14px;
  height: 14px;
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
    /* 移动端：去掉外边距，让背景填满容器 */
    margin: 0;
    width: 100%;
    /* 减去底部导航高度，避免与父容器 padding-bottom 叠加导致多余滚动 */
    min-height: calc(100dvh - var(--mobile-nav-height, 88px));
    border-radius: 0;
    /* 移动端：自己处理滚动，隐藏滚动条 */
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .settings-page::-webkit-scrollbar {
    display: none;
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
    padding: 12px 16px 16px;
    max-height: none;
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

  /* 关系卡片移动端适配 */
  .relation-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .relation-tile__body {
    padding: 10px 12px 8px 14px;
    gap: 8px;
  }

  .relation-tile__icon-wrap {
    width: 28px;
    height: 28px;
  }

  .relation-tile__icon .icon {
    width: 14px;
    height: 14px;
  }

  .relation-tile__count-value {
    font-size: 20px;
  }

  .live-stat__value {
    font-size: 16px;
  }

  .relation-tile__actions {
    padding: 8px 12px 8px 14px;
  }

  .tile-btn {
    padding: 5px 10px;
    font-size: 11px;
  }

  .relation-footer {
    display: none;
  }

  .desktop-only {
    display: none !important;
  }

  /* 保存栏移动端适配 */
  .save-bar {
    /* 移动端下方有更多空间给 nav bar */
    bottom: 0;
  }

  .save-bar-inner {
    padding: 10px 16px;
    gap: 8px;
  }

  .save-bar-text {
    font-size: 12px;
  }

  .save-bar-discard {
    padding: 6px 12px;
    font-size: 12px;
  }

  .save-bar-save {
    padding: 6px 16px;
    font-size: 12px;
  }
}
</style>

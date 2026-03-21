<template>
  <div class="settings-page" ref="contentRef">

    <!-- Tab 栏 + 搜索 -->
    <nav class="settings-tabs">
      <div class="tabs-track">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['tab-item', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >
          <span class="tab-label">{{ tab.label }}</span>
          <span v-if="tab.langTag" class="tab-lang">{{ tab.langTag }}</span>
        </button>
      </div>
      <div class="tabs-search">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索..."
          class="search-input"
          @focus="isSearchFocused = true"
          @blur="isSearchFocused = false"
        />
      </div>
    </nav>

    <!-- 主内容区 -->
    <main class="settings-main">
      <!-- 左侧索引导航 -->
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

      <!-- 内容区 -->
      <div class="settings-content">

      <!-- ═══════════════════════════════════════════════════════════════
           Source Tab 内容（按源独立的设置）
           ═══════════════════════════════════════════════════════════════ -->
      <template v-if="activeTab !== '__global__'">

        <!-- 学习设置 -->
        <section
          v-show="matchesSearch('learning')"
          :id="'section-learning'"
          class="settings-card"
        >
          <div class="card-header" @click="toggleSection('learning')">
            <div class="card-title-row">
              <span class="card-icon"><AppIcon name="graduation-cap" /></span>
              <h2 class="card-title">学习设置</h2>
              <span class="card-badge">{{ Object.keys(learningItems).length }}</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.learning }]"><AppIcon name="expand" /></span>
          </div>

          <div v-show="expandedSections.learning" class="card-body">
            <div class="setting-list">
              <!-- 每日复习上限 -->
              <div class="setting-row" v-show="matchesSearchItem('dailyReviewLimit')">
                <div class="setting-info">
                  <label class="setting-label">每日复习上限</label>
                  <span class="setting-hint">建议 50-500</span>
                </div>
                <div class="setting-control">
                  <WheelSelector
                    v-model="currentSourceSettings.learning.dailyReviewLimit"
                    :min="50"
                    :max="1000"
                    :step="10"
                  />
                  <span class="setting-value">{{ currentSourceSettings.learning.dailyReviewLimit }}</span>
                  <span class="setting-unit">词</span>
                </div>
              </div>

              <!-- 每日拼写上限 -->
              <div class="setting-row" v-show="matchesSearchItem('dailySpellLimit')">
                <div class="setting-info">
                  <label class="setting-label">每日拼写上限</label>
                  <span class="setting-hint">建议为复习量的 60-80%</span>
                </div>
                <div class="setting-control">
                  <WheelSelector
                    v-model="currentSourceSettings.learning.dailySpellLimit"
                    :min="50"
                    :max="800"
                    :step="10"
                  />
                  <span class="setting-value">{{ currentSourceSettings.learning.dailySpellLimit }}</span>
                  <span class="setting-unit">词</span>
                </div>
              </div>

              <!-- 最大准备天数 -->
              <div class="setting-row" v-show="matchesSearchItem('maxPrepDays')">
                <div class="setting-info">
                  <label class="setting-label">最大准备天数</label>
                  <span class="setting-hint">系统优化复习间隔确保考前完成</span>
                </div>
                <div class="setting-control">
                  <WheelSelector
                    v-model="currentSourceSettings.learning.maxPrepDays"
                    :min="15"
                    :max="180"
                    :step="15"
                  />
                  <span class="setting-value">{{ currentSourceSettings.learning.maxPrepDays }}</span>
                  <span class="setting-unit">天</span>
                </div>
              </div>

              <!-- 低EF额外数量 -->
              <div class="setting-row" v-show="matchesSearchItem('lowEfExtraCount')">
                <div class="setting-info">
                  <label class="setting-label">低EF额外数量</label>
                  <span class="setting-hint">复习时额外加入难词加速提升</span>
                </div>
                <div class="setting-control">
                  <WheelSelector
                    v-model="currentSourceSettings.learning.lowEfExtraCount"
                    :min="0"
                    :max="200"
                    :step="10"
                  />
                  <span class="setting-value">{{ currentSourceSettings.learning.lowEfExtraCount }}</span>
                  <span class="setting-unit">词</span>
                </div>
              </div>
            </div>

            <div class="card-footer">
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
          class="settings-card"
        >
          <div class="card-header" @click="toggleSection('lapse')">
            <div class="card-title-row">
              <span class="card-icon"><AppIcon name="rotate-ccw" /></span>
              <h2 class="card-title">错题集设置</h2>
              <span class="card-badge">1</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.lapse }]"><AppIcon name="expand" /></span>
          </div>

          <div v-show="expandedSections.lapse" class="card-body">
            <div class="setting-list">
              <div class="setting-row" v-show="matchesSearchItem('lapseQueueSize')">
                <div class="setting-info">
                  <label class="setting-label">错题队列默认大小</label>
                  <span class="setting-hint">推荐 20-30 个</span>
                </div>
                <div class="setting-control">
                  <WheelSelector
                    v-model="currentSourceSettings.learning.lapseQueueSize"
                    :min="15"
                    :max="40"
                    :step="5"
                  />
                  <span class="setting-value">{{ currentSourceSettings.learning.lapseQueueSize }}</span>
                  <span class="setting-unit">词</span>
                </div>
              </div>
            </div>

            <div class="card-footer">
              <button class="reset-link" @click="resetSection('lapse')">
                恢复默认
              </button>
            </div>
          </div>
        </section>

        <!-- 发音口音 -->
        <section
          v-if="currentTabSupportsAccent"
          v-show="matchesSearch('accent')"
          :id="'section-accent'"
          class="settings-card"
        >
          <div class="card-header" @click="toggleSection('accent')">
            <div class="card-title-row">
              <span class="card-icon"><AppIcon name="music-note" /></span>
              <h2 class="card-title">发音口音</h2>
              <span class="auto-save-tag">自动保存</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.accent }]"><AppIcon name="expand" /></span>
          </div>

          <div v-show="expandedSections.accent" class="card-body">
            <div class="setting-list">
              <div class="setting-row">
                <div class="setting-info">
                  <label class="setting-label">单词发音</label>
                </div>
                <div class="accent-toggle">
                  <button
                    :class="['accent-btn', { active: currentSourceSettings.accent === 'us' }]"
                    @click="setAccent('us')"
                  >
                    美音
                  </button>
                  <button
                    :class="['accent-btn', { active: currentSourceSettings.accent === 'uk' }]"
                    @click="setAccent('uk')"
                  >
                    英音
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

      </template>

      <!-- ═══════════════════════════════════════════════════════════════
           通用 Tab 内容（全局设置）
           ═══════════════════════════════════════════════════════════════ -->
      <template v-else>

        <!-- 自动播放设置 -->
        <section
          v-show="matchesSearch('audio')"
          :id="'section-audio'"
          class="settings-card"
        >
          <div class="card-header" @click="toggleSection('audio')">
            <div class="card-title-row">
              <span class="card-icon"><AppIcon name="music-note" /></span>
              <h2 class="card-title">自动播放</h2>
              <span class="auto-save-tag">自动保存</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.audio }]"><AppIcon name="expand" /></span>
          </div>

          <div v-show="expandedSections.audio" class="card-body">
            <div class="setting-list">
              <div class="setting-row setting-row--toggle" v-show="matchesSearchItem('autoPlayOnWordChange')">
                <div class="setting-info">
                  <label class="setting-label">新单词出现时自动播放</label>
                  <span class="setting-hint">切换到新单词时自动播放发音</span>
                </div>
                <IOSSwitch v-model="settings.audio.autoPlayOnWordChange" @update:modelValue="saveAudioSettings" />
              </div>
              <div class="setting-row setting-row--toggle" v-show="matchesSearchItem('autoPlayAfterAnswer')">
                <div class="setting-info">
                  <label class="setting-label">选择答案后自动播放</label>
                  <span class="setting-hint">点击记住/没记住后自动播放</span>
                </div>
                <IOSSwitch v-model="settings.audio.autoPlayAfterAnswer" @update:modelValue="saveAudioSettings" />
              </div>
            </div>
          </div>
        </section>

        <!-- 单词管理设置 -->
        <section
          v-show="matchesSearch('management')"
          :id="'section-management'"
          class="settings-card"
        >
          <div class="card-header" @click="toggleSection('management')">
            <div class="card-title-row">
              <span class="card-icon"><AppIcon name="sliders" /></span>
              <h2 class="card-title">单词管理</h2>
              <span class="card-badge">2</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.management }]"><AppIcon name="expand" /></span>
          </div>

          <div v-show="expandedSections.management" class="card-body">
            <div class="setting-list">
              <div class="setting-row" v-show="matchesSearchItem('wordsLoadBatchSize')">
                <div class="setting-info">
                  <label class="setting-label">分页加载数量</label>
                  <span class="setting-hint">单词管理页每批加载数</span>
                </div>
                <div class="setting-control">
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

              <div class="setting-row" v-show="matchesSearchItem('definitionFetchThreads')">
                <div class="setting-info">
                  <label class="setting-label">释义获取线程</label>
                  <span class="setting-hint">推荐 2-5 个</span>
                </div>
                <div class="setting-control">
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

            <div class="card-footer">
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
          class="settings-card"
        >
          <div class="card-header" @click="toggleSection('sources')">
            <div class="card-title-row">
              <span class="card-icon"><AppIcon name="layers" /></span>
              <h2 class="card-title">词汇来源</h2>
              <span class="card-badge">{{ sourceCount }}/3</span>
              <span class="auto-save-tag">自动保存</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.sources }]"><AppIcon name="expand" /></span>
          </div>

          <div v-show="expandedSections.sources" class="card-body">
            <div class="sources-list">
              <div
                v-for="(name, index) in localSourceOrder"
                :key="name"
                :class="[
                  'source-chip',
                  { 'is-dragging': dragIndex === index },
                  { 'drop-before': dropIndex === index && dragIndex !== null && dragIndex > index },
                  { 'drop-after': dropIndex === index && dragIndex !== null && dragIndex < index },
                ]"
                :draggable="localSourceOrder.length > 1"
                @dragstart="onDragStart(index, $event)"
                @dragover.prevent="onDragOver(index)"
                @dragend="onDragEnd"
                @touchstart="onTouchStart(index, $event)"
                @touchmove="onTouchMove($event)"
                @touchend="onTouchEnd"
              >
                <span v-if="localSourceOrder.length > 1" class="drag-handle">
                  <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
                    <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                    <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
                    <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
                  </svg>
                </span>
                <span class="source-name">{{ name }}</span>
                <span class="source-lang">{{ localSources[name] === 'uk' ? 'УКР' : 'EN' }}</span>
                <span class="source-count">{{ sourceStats[name] || 0 }}</span>
                <button
                  class="source-delete"
                  :disabled="sourceCount <= 1 || isDeleting"
                  @click="confirmDeleteSource(name)"
                >
                  ×
                </button>
              </div>

              <!-- 添加新来源 -->
              <div v-if="sourceCount < 3" class="source-add">
                <input
                  v-model="newSourceName"
                  type="text"
                  placeholder="+ 新来源"
                  class="source-input"
                  @keyup.enter="addSource"
                />
                <select v-model="newSourceLang" class="source-lang-select">
                  <option value="en">English</option>
                  <option value="uk">Українська</option>
                </select>
              </div>
            </div>

            <p class="source-warning">删除来源会同时删除该来源的所有单词，不可撤销</p>
          </div>
        </section>

        <!-- 单词关联（仅当有英语源时显示） -->
        <section
          v-if="englishSources.length > 0"
          v-show="matchesSearch('relations')"
          :id="'section-relations'"
          class="settings-card"
        >
          <div class="card-header" @click="toggleSection('relations')">
            <div class="card-title-row">
              <span class="card-icon"><AppIcon name="git-branch" /></span>
              <h2 class="card-title">单词关联</h2>
              <span class="relation-scope">{{ englishSources.join(' · ') }}</span>
              <span class="card-badge">{{ relationStats.total }}</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.relations }]"><AppIcon name="expand" /></span>
          </div>

          <div v-show="expandedSections.relations" class="card-body card-body--flush">
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
                <div class="relation-tile__accent"></div>
                <div class="relation-tile__body">
                  <header class="relation-tile__header">
                    <div class="relation-tile__icon-wrap">
                      <span class="relation-tile__icon"><AppIcon :name="rt.icon" /></span>
                    </div>
                    <div class="relation-tile__title-group">
                      <h3 class="relation-tile__title">{{ rt.label }}</h3>
                      <span class="relation-tile__count-inline" v-if="!isRunning(rt.type) && !hasResult(rt.type)">
                        {{ relationStats[rt.type as keyof typeof relationStats] || 0 }} 对
                      </span>
                    </div>
                  </header>

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
                    <div class="relation-tile__progress">
                      <div class="progress-track">
                        <div class="progress-fill" :style="{ width: progressPercent(rt.type) + '%' }">
                          <div class="progress-shine"></div>
                        </div>
                      </div>
                      <div class="progress-meta">
                        <span class="progress-percent">{{ progressPercent(rt.type) }}%</span>
                        <span v-if="generationStatus[rt.type]?.skipped" class="progress-detail">
                          跳过 {{ generationStatus[rt.type]?.skipped }} 词
                        </span>
                      </div>
                    </div>
                  </template>

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

                <footer class="relation-tile__actions">
                  <template v-if="isRunning(rt.type)">
                    <button class="tile-btn tile-btn--stop" @click="handleStop(rt.type)">
                      <span class="tile-btn__icon"><AppIcon name="ban" /></span>
                      停止
                    </button>
                  </template>
                  <template v-else>
                    <button class="tile-btn tile-btn--generate" :disabled="isRunning(rt.type)" @click="handleGenerate(rt.type)">
                      <span class="tile-btn__icon"><AppIcon name="play" /></span>
                      生成
                    </button>
                    <button class="tile-btn tile-btn--clear" :disabled="isRunning(rt.type) || !(relationStats[rt.type as keyof typeof relationStats])" @click="handleClear(rt.type, rt.label)">
                      清空
                    </button>
                  </template>
                </footer>
              </article>
            </div>
          </div>
        </section>

        <!-- 快捷键设置 -->
        <section
          v-show="matchesSearch('hotkeys')"
          :id="'section-hotkeys'"
          class="settings-card desktop-only"
        >
          <div class="card-header" @click="toggleSection('hotkeys')">
            <div class="card-title-row">
              <span class="card-icon"><AppIcon name="command" /></span>
              <h2 class="card-title">快捷键设置</h2>
              <span class="card-badge">11</span>
            </div>
            <span :class="['chevron', { expanded: expandedSections.hotkeys }]"><AppIcon name="expand" /></span>
          </div>

          <div v-show="expandedSections.hotkeys" class="card-body">
            <!-- 复习初始状态 -->
            <div class="hotkey-group">
              <h3 class="hotkey-group-title">复习 · 初始状态</h3>
              <div class="hotkey-grid">
                <div class="hotkey-row">
                  <span class="hotkey-label">记住 <BaseIcon name="Check" size="xs" color="success" /></span>
                  <KeySelector
                    v-model="settings.hotkeys.reviewInitial.remembered"
                    :used-keys="[settings.hotkeys.reviewInitial.notRemembered, settings.hotkeys.reviewInitial.stopReview, settings.hotkeys.reviewInitial.resetTimer].filter(k => k)"
                  />
                </div>
                <div class="hotkey-row">
                  <span class="hotkey-label">没记住</span>
                  <KeySelector
                    v-model="settings.hotkeys.reviewInitial.notRemembered"
                    :used-keys="[settings.hotkeys.reviewInitial.remembered, settings.hotkeys.reviewInitial.stopReview, settings.hotkeys.reviewInitial.resetTimer].filter(k => k)"
                  />
                </div>
                <div class="hotkey-row">
                  <span class="hotkey-label">不再复习 <BaseIcon name="Ban" size="xs" /></span>
                  <KeySelector
                    v-model="settings.hotkeys.reviewInitial.stopReview"
                    :used-keys="[settings.hotkeys.reviewInitial.remembered, settings.hotkeys.reviewInitial.notRemembered, settings.hotkeys.reviewInitial.resetTimer].filter(k => k)"
                  />
                </div>
                <div class="hotkey-row">
                  <span class="hotkey-label">重置计时器</span>
                  <KeySelector
                    v-model="settings.hotkeys.reviewInitial.resetTimer"
                    :used-keys="[settings.hotkeys.reviewInitial.remembered, settings.hotkeys.reviewInitial.notRemembered, settings.hotkeys.reviewInitial.stopReview].filter(k => k)"
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
                    :used-keys="[settings.hotkeys.spelling.forgot, settings.hotkeys.spelling.next, settings.hotkeys.spelling.resetInput, settings.hotkeys.spelling.stopSpell].filter(k => k)"
                  />
                </div>
                <div class="hotkey-row">
                  <span class="hotkey-label">忘记了</span>
                  <KeySelector
                    v-model="settings.hotkeys.spelling.forgot"
                    :used-keys="[settings.hotkeys.spelling.playAudio, settings.hotkeys.spelling.next, settings.hotkeys.spelling.resetInput, settings.hotkeys.spelling.stopSpell].filter(k => k)"
                  />
                </div>
                <div class="hotkey-row">
                  <span class="hotkey-label">下一个 <BaseIcon name="ArrowRight" size="xs" /></span>
                  <KeySelector
                    v-model="settings.hotkeys.spelling.next"
                    :used-keys="[settings.hotkeys.spelling.playAudio, settings.hotkeys.spelling.forgot, settings.hotkeys.spelling.resetInput, settings.hotkeys.spelling.stopSpell].filter(k => k)"
                  />
                </div>
                <div class="hotkey-row">
                  <span class="hotkey-label">重置输入</span>
                  <KeySelector
                    v-model="settings.hotkeys.spelling.resetInput"
                    :used-keys="[settings.hotkeys.spelling.playAudio, settings.hotkeys.spelling.forgot, settings.hotkeys.spelling.next, settings.hotkeys.spelling.stopSpell].filter(k => k)"
                  />
                </div>
                <div class="hotkey-row">
                  <span class="hotkey-label">不再拼写 <BaseIcon name="Ban" size="xs" /></span>
                  <KeySelector
                    v-model="settings.hotkeys.spelling.stopSpell"
                    :used-keys="[settings.hotkeys.spelling.playAudio, settings.hotkeys.spelling.forgot, settings.hotkeys.spelling.next, settings.hotkeys.spelling.resetInput].filter(k => k)"
                  />
                </div>
              </div>
            </div>

            <div class="card-footer">
              <button class="reset-link" @click="resetSection('hotkeys')">
                恢复默认
              </button>
            </div>
          </div>
        </section>

      </template>

    </div>
    </main>

    <!-- 统一保存栏 -->
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

    <!-- Toast 提示 -->
    <transition name="toast">
      <div v-if="toastMessage" class="toast">
        <span class="toast-icon"><AppIcon name="check" /></span>
        {{ toastMessage }}
      </div>
    </transition>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import WheelSelector from '@/shared/components/controls/WheelSelector.vue'
import IOSSwitch from '@/shared/components/controls/IOSSwitch.vue'
import KeySelector from '@/shared/components/controls/KeySelector.vue'
import { useSettings } from '@/shared/composables/useSettings'
import { api } from '@/shared/api'
import type { GenerationTaskStatus } from '@/shared/api/relations'
import type { UserSettings, SourceLang, SourceSpecificSettings } from '@/shared/types'
import { createDefaultSourceSettings } from '@/shared/api/settings-supabase'
import { getSourceLangConfig } from '@/shared/config/sourceLanguage'
import { deleteTtsCacheSource } from '@/shared/utils/playWordAudio'
import { logger } from '@/shared/utils/logger'
import { BaseIcon } from '@/shared/components/base'
import AppIcon, { type IconName } from '@/shared/components/controls/Icons.vue'

// 搜索和导航
const searchQuery = ref('')
const isSearchFocused = ref(false)
const activeSection = ref('')
const contentRef = ref<HTMLElement | null>(null)

// 展开状态 - 默认全部展开
const expandedSections = reactive<Record<string, boolean>>({
  learning: true,
  lapse: true,
  management: true,
  sources: true,
  audio: true,
  accent: true,
  hotkeys: true,
  relations: true,
})

// Tab 状态
const activeTab = ref<string>('')  // source name 或 '__global__'

// 设置数据
const { settings: globalSettings, loadSettings, updateSettings } = useSettings()

// ═══════════════════════════════════════════════════════════════════════════
// 脏状态追踪 - 记录最后保存的快照，与当前值对比
// ═══════════════════════════════════════════════════════════════════════════
const savedSnapshot = ref<string>('')

const takeSavableSnapshot = () => {
  if (!globalSettings.value) return ''
  const { sourceSettings, management, hotkeys } = globalSettings.value
  return JSON.stringify({ sourceSettings, management, hotkeys })
}

const currentSavableState = computed(() => {
  if (!globalSettings.value) return ''
  const { sourceSettings, management, hotkeys } = globalSettings.value
  return JSON.stringify({ sourceSettings, management, hotkeys })
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
  accent: ['发音', '口音', '美音', '英音', 'accent'],
  management: ['管理', '加载', 'management'],
  sources: ['来源', '词库', 'sources'],
  audio: ['音频', '自动播放', 'audio', 'autoplay'],
  hotkeys: ['快捷键', 'hotkey'],
  relations: ['关联', '关系', 'relation'],
}

// 导航数据 - 根据当前 Tab 动态切换
const sections = computed<{ id: string; title: string; icon: IconName; itemCount: number }[]>(() => {
  if (activeTab.value === '__global__') {
    const result: { id: string; title: string; icon: IconName; itemCount: number }[] = [
      { id: 'audio', title: '自动播放', icon: 'music-note', itemCount: 2 },
      { id: 'management', title: '管理', icon: 'sliders', itemCount: 2 },
      { id: 'sources', title: '来源', icon: 'layers', itemCount: sourceCount.value },
    ]
    if (englishSources.value.length > 0) {
      result.push({ id: 'relations', title: '关联', icon: 'git-branch', itemCount: relationStats.value.total })
    }
    result.push({ id: 'hotkeys', title: '快捷键', icon: 'command', itemCount: 11 })
    return result
  }
  const result: { id: string; title: string; icon: IconName; itemCount: number }[] = [
    { id: 'learning', title: '学习', icon: 'graduation-cap', itemCount: 4 },
    { id: 'lapse', title: '错题', icon: 'rotate-ccw', itemCount: 1 },
  ]
  if (currentTabSupportsAccent.value) {
    result.push({ id: 'accent', title: '发音', icon: 'music-note', itemCount: 1 })
  }
  return result
})

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
    sourceSettings: { IELTS: createDefaultSourceSettings() },
    audio: {
      autoPlayOnWordChange: true,
      autoPlayAfterAnswer: true,
    },
    management: {
      wordsLoadBatchSize: 200,
      definitionFetchThreads: 3,
    },
    sources: {
      customSources: { IELTS: 'en' },
      sourceOrder: ['IELTS'],
    },
    hotkeys: {
      reviewInitial: {
        remembered: 'ArrowRight',
        notRemembered: 'ArrowLeft',
        stopReview: 'ArrowDown',
        resetTimer: '',
      },
      reviewAfter: {
        wrong: 'ArrowLeft',
        next: 'ArrowRight',
      },
      spelling: {
        playAudio: 'ArrowLeft',
        forgot: 'ArrowRight',
        next: 'Enter',
        resetInput: '',
        stopSpell: '',
      },
    },
  }
)

// 当前 Tab 对应的 source settings（per-source 设置的双向绑定入口）
const currentSourceSettings = computed<SourceSpecificSettings>(() => {
  if (activeTab.value === '__global__' || !globalSettings.value) {
    return createDefaultSourceSettings()
  }
  return globalSettings.value.sourceSettings[activeTab.value] ?? createDefaultSourceSettings()
})

// Tab 数据
const tabs = computed(() => {
  const sourceTabs = localSourceOrder.value.map(name => ({
    key: name,
    label: name,
    langTag: localSources.value[name] === 'uk' ? 'УКР' : 'EN',
  }))
  return [...sourceTabs, { key: '__global__', label: '通用', langTag: '' }]
})

// 当前 Tab 是否支持口音切换
const currentTabSupportsAccent = computed(() => {
  if (activeTab.value === '__global__') return false
  const lang = localSources.value[activeTab.value]
  if (!lang) return false
  return getSourceLangConfig(activeTab.value, localSources.value).supportsAccentSwitch
})

// 所有英语来源（关系生成的作用范围）
const englishSources = computed(() =>
  localSourceOrder.value.filter(name => localSources.value[name] === 'en')
)

// 来源管理
const localSources = ref<Record<string, SourceLang>>({})
const localSourceOrder = ref<string[]>([])
const sourceCount = computed(() => localSourceOrder.value.length)
const sourceStats = ref<Record<string, number>>({})
const newSourceName = ref('')
const newSourceLang = ref<SourceLang>('en')
const isDeleting = ref(false)

// 拖拽状态
const dragIndex = ref<number | null>(null)
const dropIndex = ref<number | null>(null)

// supportsRelations 已被 englishSources 替代

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

// 找到实际的滚动父容器（向上遍历直到找到 overflow auto/scroll 的元素）
let scrollParent: HTMLElement | null = null

const findScrollParent = (el: HTMLElement | null): HTMLElement => {
  let node = el?.parentElement
  while (node && node !== document.documentElement) {
    const style = getComputedStyle(node)
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') return node
    node = node.parentElement
  }
  return document.documentElement
}

const handleScroll = () => {
  // 使用视口顶部作为参考（sticky tab 栏高度约 45px）
  const threshold = 100

  for (const section of sections.value) {
    const element = document.getElementById(`section-${section.id}`)
    if (element) {
      const rect = element.getBoundingClientRect()
      if (rect.top <= threshold && rect.bottom > 0) {
        activeSection.value = section.id
        break
      }
    }
  }
}

/**
 * 自动保存后 patch 快照中对应字段，而非重拍整个快照
 * （避免将内存中未持久化的 learning/hotkeys 修改纳入快照，导致 isDirty 误清除）
 */
const patchSnapshot = (patcher: (snap: Record<string, unknown>) => void) => {
  const snap = JSON.parse(savedSnapshot.value || '{}')
  patcher(snap)
  savedSnapshot.value = JSON.stringify(snap)
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
    // 从快照中提取旧的 sourceSettings 用于 maxPrepDays 变小检测
    // （v-model 已原地修改了 reactive 对象，不能直接取 settings.value 作为旧值）
    const oldSourceSettings = savedSnapshot.value
      ? (JSON.parse(savedSnapshot.value) as Pick<UserSettings, 'sourceSettings'>).sourceSettings
      : undefined

    await updateSettings({
      sourceSettings: settings.value.sourceSettings,
      management: settings.value.management,
      hotkeys: settings.value.hotkeys,
    }, oldSourceSettings)
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
    const snapshot = JSON.parse(savedSnapshot.value) as Pick<UserSettings, 'sourceSettings' | 'management' | 'hotkeys'>
    globalSettings.value.sourceSettings = JSON.parse(JSON.stringify(snapshot.sourceSettings))
    globalSettings.value.management = { ...snapshot.management }
    globalSettings.value.hotkeys = JSON.parse(JSON.stringify(snapshot.hotkeys))
  } catch (error) {
    logger.error('放弃修改失败:', error)
  }
}

// 重置各区块（仅还原本地状态，不立即保存 —— 需要点全局保存）
const resetSection = (section: string) => {
  if (!confirm('确定要恢复默认值吗？恢复后需点击"保存设置"生效。')) return

  if (section === 'learning' && activeTab.value !== '__global__') {
    const source = activeTab.value
    if (globalSettings.value?.sourceSettings[source]) {
      globalSettings.value.sourceSettings[source].learning = {
        ...globalSettings.value.sourceSettings[source].learning,
        dailyReviewLimit: 300,
        dailySpellLimit: 200,
        maxPrepDays: 45,
        defaultShuffle: false,
        lowEfExtraCount: 50,
      }
    }
  } else if (section === 'lapse' && activeTab.value !== '__global__') {
    const source = activeTab.value
    if (globalSettings.value?.sourceSettings[source]) {
      globalSettings.value.sourceSettings[source].learning = {
        ...globalSettings.value.sourceSettings[source].learning,
        lapseQueueSize: 20,
      }
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
        resetTimer: '',
      },
      reviewAfter: {
        wrong: 'ArrowLeft',
        next: 'ArrowRight',
      },
      spelling: {
        playAudio: 'ArrowLeft',
        forgot: 'ArrowRight',
        next: 'Enter',
        resetInput: '',
        stopSpell: '',
      },
    }
  }
}

// 口音设置自动保存（per-source，不受统一保存控制）
const setAccent = async (accent: 'us' | 'uk') => {
  const source = activeTab.value
  if (source === '__global__' || !globalSettings.value?.sourceSettings[source]) return
  globalSettings.value.sourceSettings[source].accent = accent
  try {
    // 只传 accent，避免意外将未保存的 learning 修改写入 DB
    await updateSettings({
      sourceSettings: { [source]: { accent } as SourceSpecificSettings }
    })
    patchSnapshot(snap => {
      const ss = snap.sourceSettings as Record<string, Record<string, unknown>> | undefined
      if (ss?.[source]) ss[source].accent = accent
    })
    showToast('口音设置已保存')
  } catch (error) {
    logger.error('保存口音设置失败:', error)
  }
}

// 自动播放设置自动保存（全局，不受统一保存控制）
const saveAudioSettings = async () => {
  try {
    await updateSettings({ audio: settings.value.audio })
    showToast('自动播放设置已保存')
  } catch (error) {
    logger.error('保存音频设置失败:', error)
  }
}

// 来源管理（自动保存，不受统一保存控制）
const addSource = async () => {
  const name = newSourceName.value.trim()
  const lang = newSourceLang.value
  if (!name || sourceCount.value >= 3 || name in localSources.value) return

  // 乐观更新：先更新本地状态防止快速重复提交
  localSources.value[name] = lang
  localSourceOrder.value.push(name)
  newSourceName.value = ''
  newSourceLang.value = 'en'

  // 为新 source 创建默认 sourceSettings
  if (globalSettings.value) {
    globalSettings.value.sourceSettings[name] = createDefaultSourceSettings()
  }

  try {
    await updateSettings({
      sources: {
        customSources: { ...localSources.value },
        sourceOrder: [...localSourceOrder.value],
      },
      sourceSettings: { [name]: createDefaultSourceSettings() },
    })
    activeTab.value = name
    patchSnapshot(snap => {
      const ss = snap.sourceSettings as Record<string, unknown> | undefined
      if (ss) ss[name] = JSON.parse(JSON.stringify(createDefaultSourceSettings()))
    })
    showToast(`已添加来源"${name}"`)
  } catch (error) {
    delete localSources.value[name]
    localSourceOrder.value = localSourceOrder.value.filter(s => s !== name)
    if (globalSettings.value) delete globalSettings.value.sourceSettings[name]
    logger.error('添加来源失败:', error)
    alert('添加失败，请重试')
  }
}

const confirmDeleteSource = async (source: string) => {
  const wordCount = sourceStats.value[source] || 0
  if (!confirm(`删除来源"${source}"将删除 ${wordCount} 个单词，不可撤销！`)) return

  try {
    isDeleting.value = true
    const ttsLang = getSourceLangConfig(source, localSources.value).ttsLang
    await api.config.deleteSource(source)
    if (ttsLang) deleteTtsCacheSource(source)
    delete localSources.value[source]
    if (globalSettings.value) delete globalSettings.value.sourceSettings[source]
    localSourceOrder.value = localSourceOrder.value.filter(s => s !== source)
    if (activeTab.value === source) {
      activeTab.value = localSourceOrder.value[0] || '__global__'
    }
    await loadSourceStats()
    patchSnapshot(snap => {
      const ss = snap.sourceSettings as Record<string, unknown> | undefined
      if (ss) delete ss[source]
    })
    showToast(`已删除来源"${source}"`)
  } catch (error) {
    logger.error('删除来源失败:', error)
    alert('删除失败，请重试')
  } finally {
    isDeleting.value = false
  }
}

// 拖拽排序（桌面端 HTML5 Drag and Drop）
const onDragStart = (index: number, e: DragEvent) => {
  dragIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
  }
}

const onDragOver = (index: number) => {
  dropIndex.value = index
}

const onDragEnd = () => {
  commitDrag()
}

// 拖拽排序（移动端 Touch Events）
const touchStartY = ref(0)
const touchStartX = ref(0)
const touchMoved = ref(false)

const onTouchStart = (index: number, e: TouchEvent) => {
  if (localSourceOrder.value.length <= 1) return
  dragIndex.value = index
  const touch = e.touches[0]
  touchStartY.value = touch.clientY
  touchStartX.value = touch.clientX
  touchMoved.value = false
}

const onTouchMove = (e: TouchEvent) => {
  if (dragIndex.value === null) return
  const touch = e.touches[0]

  // 判断是否超过拖拽阈值（5px），避免误触
  if (!touchMoved.value) {
    const dx = Math.abs(touch.clientX - touchStartX.value)
    const dy = Math.abs(touch.clientY - touchStartY.value)
    if (dx < 5 && dy < 5) return
    touchMoved.value = true
  }

  // 进入拖拽后才阻止默认滚动
  e.preventDefault()

  // 找到手指下方的 source-chip 元素
  const el = document.elementFromPoint(touch.clientX, touch.clientY)
  if (!el) return
  const chip = el.closest('.source-chip') as HTMLElement | null
  if (!chip) return

  // 从 DOM 顺序确定目标索引
  const chips = Array.from(chip.parentElement!.querySelectorAll('.source-chip'))
  const targetIndex = chips.indexOf(chip)
  if (targetIndex !== -1) {
    dropIndex.value = targetIndex
  }
}

const onTouchEnd = () => {
  if (!touchMoved.value) {
    // 没有实际拖拽，清除状态
    dragIndex.value = null
    dropIndex.value = null
    return
  }
  commitDrag()
}

// 共用：提交拖拽结果
const commitDrag = async () => {
  const from = dragIndex.value
  const to = dropIndex.value
  dragIndex.value = null
  dropIndex.value = null

  if (from === null || to === null || from === to) return

  // 保存旧顺序用于回滚
  const oldOrder = [...localSourceOrder.value]

  // 数组重排
  const order = [...oldOrder]
  const [moved] = order.splice(from, 1)
  order.splice(to, 0, moved)
  localSourceOrder.value = order

  // 自动保存
  try {
    await updateSettings({
      sources: {
        customSources: { ...localSources.value },
        sourceOrder: [...localSourceOrder.value],
      },
    })
    showToast('排序已保存')
  } catch (error) {
    localSourceOrder.value = oldOrder
    logger.error('保存排序失败:', error)
  }
}

const loadSourceStats = async () => {
  try {
    sourceStats.value = await api.config.getSourcesStats(Object.keys(localSources.value))
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

  // 加载来源（直接从已加载的 globalSettings 读取，避免重复请求）
  const sourcesConfig = globalSettings.value?.sources
  localSources.value = { ...(sourcesConfig?.customSources || { IELTS: 'en' }) }
  localSourceOrder.value = sourcesConfig?.sourceOrder
    ?? Object.keys(localSources.value)

  // 初始化 Tab（联动 WordIndex 选择的 source，回退到第一个）
  const lastSource = sessionStorage.getItem('currentSource') || ''
  activeTab.value = localSourceOrder.value.includes(lastSource)
    ? lastSource
    : localSourceOrder.value[0] || '__global__'

  const tasks: Promise<void>[] = [loadSourceStats()]
  // 如果有任何英语源，加载关系数据
  const hasEnglishSource = Object.values(localSources.value).some(lang => lang === 'en')
  if (hasEnglishSource) {
    tasks.push(loadRelationStats(), initGenerationStatus())
  }
  await Promise.all(tasks)

  // 监听实际滚动父容器的 scroll 事件
  scrollParent = findScrollParent(contentRef.value)
  scrollParent.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  closeSSE()
  if (scrollParent) {
    scrollParent.removeEventListener('scroll', handleScroll)
    scrollParent = null
  }
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Settings Page — Editorial Study 风格
   温暖纸质感 · Tab + 内容区两层结构
   ═══════════════════════════════════════════════════════════════════════════ */

.settings-page {
  /* 设置模块主题色覆盖 — 墨灰色调 */
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
  width: 100%;
  align-self: stretch;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tab 栏 — 紧贴顶部，下划线指示
   ═══════════════════════════════════════════════════════════════════════════ */

.settings-tabs {
  --tabs-height: 41px;
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border-medium);
  display: flex;
  align-items: stretch;
}

.tabs-track {
  display: flex;
  gap: 0;
  padding: 0 0 0 var(--space-6);
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  flex: 1;
  min-width: 0;
}

.tabs-track::-webkit-scrollbar {
  display: none;
}

.tabs-search {
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
  flex-shrink: 0;
}

.search-input {
  width: 120px;
  padding: 5px 10px;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-default);
  background: var(--color-bg-secondary);
  font-size: 12px;
  color: var(--color-text-primary);
  outline: none;
  transition: all 0.15s;
  font-family: var(--font-ui);
}

.search-input::placeholder {
  color: var(--color-text-tertiary);
}

.search-input:focus {
  border-color: var(--color-primary);
  background: var(--color-bg-primary);
  width: 180px;
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.tab-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  border-bottom: 2px solid transparent;
  transition: color var(--transition-fast), border-color var(--transition-fast);
  white-space: nowrap;
  font-family: var(--font-ui);
}

.tab-item:hover {
  color: var(--color-text-primary);
}

.tab-item.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tab-lang {
  font-size: 9px;
  font-family: var(--font-data);
  letter-spacing: 0.05em;
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  padding: 2px 5px;
  border-radius: var(--radius-xs);
  line-height: 1;
}

/* ═══════════════════════════════════════════════════════════════════════════
   主内容区（侧边栏 + 内容）
   ═══════════════════════════════════════════════════════════════════════════ */

.settings-main {
  display: flex;
  flex: 1;
  width: 100%;
}

/* ═══════════════════════════════════════════════════════════════════════════
   左侧索引导航
   ═══════════════════════════════════════════════════════════════════════════ */

.settings-nav {
  position: sticky;
  top: var(--tabs-height, 41px);
  width: 148px;
  height: calc(100vh - var(--tabs-height, 41px));
  align-self: flex-start;
  padding: var(--space-4) var(--space-2);
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
  padding: 7px 10px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  font-size: 13px;
  font-family: var(--font-ui);
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
  width: 18px;
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
  font-family: var(--font-data);
}

/* ═══════════════════════════════════════════════════════════════════════════
   内容区
   ═══════════════════════════════════════════════════════════════════════════ */

.settings-content {
  flex: 1;
  padding: var(--space-4) var(--space-6) calc(var(--space-16) + var(--space-8));
  max-width: 720px;
  width: 100%;
  min-height: 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   设置卡片
   ═══════════════════════════════════════════════════════════════════════════ */

.settings-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  user-select: none;
  transition: background var(--transition-fast);
}

.card-header:hover {
  background: var(--color-bg-secondary);
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.card-icon {
  display: inline-flex;
  align-items: center;
  color: var(--color-primary);
}

.card-icon .icon {
  width: 16px;
  height: 16px;
}

.card-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  font-family: var(--font-serif);
  color: var(--color-text-primary);
  margin: 0;
}

.card-badge {
  font-size: 11px;
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  padding: 1px 7px;
  border-radius: var(--radius-full);
  font-family: var(--font-data);
}

.relation-scope {
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-family: var(--font-data);
  letter-spacing: 0.02em;
}

.auto-save-tag {
  font-size: 10px;
  font-weight: var(--font-weight-medium);
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

.card-body {
  padding: 0 var(--space-4) var(--space-4);
  border-top: 1px solid var(--color-bg-tertiary);
}

.card-body--flush {
  padding: var(--space-3);
}

.card-footer {
  display: flex;
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-bg-tertiary);
  margin-top: var(--space-1);
}

.reset-link {
  background: none;
  border: none;
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: var(--space-1) 0;
  transition: color var(--transition-fast);
}

.reset-link:hover {
  color: var(--color-primary);
}

/* ═══════════════════════════════════════════════════════════════════════════
   设置行
   ═══════════════════════════════════════════════════════════════════════════ */

.setting-list {
  display: flex;
  flex-direction: column;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-bg-tertiary);
  gap: var(--space-4);
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-row--toggle {
  padding: var(--space-2) 0;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.setting-hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.setting-control {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.setting-control :deep(.wheel) {
  position: relative;
  top: auto;
  left: auto;
  transform: none;
  width: 56px;
  height: 60px;
}

.setting-value {
  font-size: 15px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
  font-family: var(--font-data);
  min-width: 40px;
  text-align: right;
}

.setting-unit {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  min-width: 24px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   口音切换
   ═══════════════════════════════════════════════════════════════════════════ */

.accent-toggle {
  display: flex;
  gap: 2px;
  background: var(--color-bg-tertiary);
  padding: 3px;
  border-radius: var(--radius-default);
}

.accent-btn {
  padding: 6px 16px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--color-text-secondary);
  font-family: var(--font-ui);
}

.accent-btn:hover {
  color: var(--color-text-primary);
}

.accent-btn.active {
  background: var(--color-surface-elevated);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
  box-shadow: var(--shadow-sm);
}

/* ═══════════════════════════════════════════════════════════════════════════
   来源管理
   ═══════════════════════════════════════════════════════════════════════════ */

.sources-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-3) 0;
}

.source-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 10px 6px 12px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-full);
  font-size: 13px;
  transition: opacity 0.2s ease, transform 0.2s ease, border-color var(--transition-fast);
  position: relative;
}

.source-chip[draggable="true"] {
  cursor: grab;
}

.source-chip.is-dragging {
  opacity: 0.25;
  transform: scale(0.95);
}

.source-chip.drop-before::before,
.source-chip.drop-after::after {
  content: '';
  position: absolute;
  top: 4px;
  bottom: 4px;
  width: 2px;
  border-radius: 1px;
  background: var(--color-primary);
  pointer-events: none;
}

.source-chip.drop-before::before { left: -5px; }
.source-chip.drop-after::after { right: -5px; }

.drag-handle {
  color: var(--color-text-tertiary);
  cursor: grab;
  user-select: none;
  display: flex;
  align-items: center;
  opacity: 0.4;
  transition: opacity var(--transition-fast);
}

.source-chip:hover .drag-handle {
  opacity: 0.8;
}

.source-name {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.source-lang {
  font-size: 9px;
  font-family: var(--font-data);
  letter-spacing: 0.05em;
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  padding: 2px 5px;
  border-radius: var(--radius-xs);
  line-height: 1;
}

.source-count {
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-family: var(--font-data);
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
  transition: all var(--transition-fast);
}

.source-delete:hover:not(:disabled) {
  background: var(--color-state-error-light);
  color: var(--color-state-error);
}

.source-delete:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.source-add {
  display: flex;
  gap: 6px;
  align-items: center;
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
  transition: all var(--transition-fast);
  font-family: var(--font-ui);
}

.source-input:focus {
  border-style: solid;
  border-color: var(--color-primary);
  background: var(--color-surface-elevated);
}

.source-input::placeholder {
  color: var(--color-text-tertiary);
}

.source-lang-select {
  padding: 5px 8px;
  border: 1px dashed var(--color-border-medium);
  border-radius: var(--radius-full);
  background: transparent;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  outline: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: var(--font-ui);
}

.source-lang-select:focus {
  border-style: solid;
  border-color: var(--color-primary);
  background: var(--color-surface-elevated);
}

.source-warning {
  font-size: 11px;
  color: var(--color-state-warning);
  margin: 0;
  padding-top: var(--space-1);
}

/* ═══════════════════════════════════════════════════════════════════════════
   快捷键设置
   ═══════════════════════════════════════════════════════════════════════════ */

#section-hotkeys {
  overflow: visible;
}

.hotkey-group {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-bg-tertiary);
}

.hotkey-group:has(+ .card-footer) {
  border-bottom: none;
}

.hotkey-group-title {
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 var(--space-2) 0;
  font-family: var(--font-ui);
}

.hotkey-grid {
  display: flex;
  flex-direction: column;
}

.hotkey-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border-light);
  gap: var(--space-4);
}

.hotkey-row:last-child {
  border-bottom: none;
}

.hotkey-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   单词关联 — 网格布局 + 左侧色带
   ═══════════════════════════════════════════════════════════════════════════ */

.relation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-3);
}

.relation-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-default);
  overflow: hidden;
  transition: border-color var(--transition-normal), box-shadow var(--transition-normal);
}

.relation-tile:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.relation-tile--active {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

/* 左侧色带 */
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

.relation-tile__body {
  flex: 1;
  padding: var(--space-3) var(--space-3) var(--space-2) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.relation-tile__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.relation-tile__icon-wrap {
  width: 28px;
  height: 28px;
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
  width: 14px;
  height: 14px;
}

.relation-tile__title-group {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.relation-tile__title {
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.relation-tile__count-inline {
  font-size: 12px;
  color: var(--color-text-tertiary);
  font-family: var(--font-data);
}

/* 实时统计 */
.relation-tile__live-stats {
  display: flex;
  gap: var(--space-4);
}

.live-stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.live-stat__value {
  font-size: 16px;
  font-weight: var(--font-weight-bold);
  font-family: var(--font-data);
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
  gap: 3px;
}

.progress-track {
  height: 3px;
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

.progress-shine {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%);
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
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  font-family: var(--font-data);
  color: var(--color-text-primary);
}

.progress-detail {
  font-size: 10px;
  color: var(--color-text-tertiary);
  font-family: var(--font-data);
}

/* 结果摘要 */
.relation-tile__result {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-xs);
}

.result-badge {
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
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
  font-family: var(--font-data);
}

/* 操作区 */
.relation-tile__actions {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3) var(--space-2) var(--space-4);
  border-top: 1px solid var(--color-bg-tertiary);
}

.tile-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 10px;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: var(--color-surface-elevated);
  color: var(--color-text-secondary);
  font-family: var(--font-ui);
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

/* ═══════════════════════════════════════════════════════════════════════════
   保存栏 — 底部粘性，铜褐强调
   ═══════════════════════════════════════════════════════════════════════════ */

.save-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 200;
  background: var(--color-bg-primary);
  border-top: 2px solid var(--color-primary);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.08);
}

.save-bar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-6);
  max-width: 720px;
  margin: 0 auto;
}

.save-bar-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.save-bar-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
  animation: pulse-dot 1.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.save-bar-text {
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.save-bar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.save-bar-discard {
  padding: 7px var(--space-4);
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 13px;
  cursor: pointer;
  border-radius: var(--radius-default);
  transition: all var(--transition-fast);
  font-family: var(--font-ui);
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
  padding: 7px var(--space-5);
  border: none;
  background: var(--color-primary);
  color: var(--button-primary-text);
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-default);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: var(--font-ui);
}

.save-bar-save:hover:not(:disabled) {
  background: var(--button-primary-bg-hover);
  box-shadow: 0 2px 8px var(--color-primary-light);
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
  font-weight: var(--font-weight-medium);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  box-shadow: var(--shadow-lg);
  z-index: 1000;
}

.toast-icon {
  display: inline-flex;
  align-items: center;
  color: var(--color-state-success);
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
   桌面端可见性
   ═══════════════════════════════════════════════════════════════════════════ */

.desktop-only {
  display: block;
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .settings-page {
    margin: 0;
    width: 100%;
    min-height: calc(100dvh - var(--mobile-nav-height, 88px));
    border-radius: 0;
  }

  .tabs-track {
    padding: 0 var(--space-4);
  }

  .tabs-search {
    display: none;
  }

  .tab-item {
    padding: var(--space-2) var(--space-3);
    font-size: 13px;
  }

  .settings-content {
    padding: var(--space-3) var(--space-3) var(--space-12);
    max-width: none;
  }

  .settings-card {
    margin-bottom: var(--space-2);
  }

  .card-header {
    padding: var(--space-2) var(--space-3);
  }

  .card-body {
    padding: 0 var(--space-3) var(--space-3);
  }

  .card-body--flush {
    padding: var(--space-2);
  }

  .setting-row {
    flex-wrap: wrap;
    padding: var(--space-2) 0;
  }

  .setting-info {
    width: 100%;
    margin-bottom: var(--space-2);
  }

  .setting-control {
    width: 100%;
    justify-content: flex-end;
  }

  .sources-list {
    gap: 6px;
  }

  .source-chip {
    padding: 5px 8px 5px 10px;
    font-size: 12px;
  }

  .source-chip[draggable="true"] {
    touch-action: none;
  }

  .drag-handle {
    opacity: 0.6;
  }

  .relation-grid {
    grid-template-columns: 1fr;
    gap: var(--space-2);
  }

  .relation-tile__body {
    padding: var(--space-2) var(--space-3) var(--space-2) var(--space-3);
  }

  .relation-tile__actions {
    padding: var(--space-2) var(--space-3);
  }

  .tile-btn {
    padding: 5px 8px;
    font-size: 11px;
  }

  .desktop-only {
    display: none !important;
  }

  .save-bar-inner {
    padding: var(--space-2) var(--space-4);
    gap: var(--space-2);
  }

  .save-bar-text {
    font-size: 12px;
  }

  .save-bar-discard {
    padding: 6px var(--space-3);
    font-size: 12px;
  }

  .save-bar-save {
    padding: 6px var(--space-4);
    font-size: 12px;
  }
}
</style>

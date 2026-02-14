<template>
  <!-- 右侧学习控制台 - 桌面端固定面板 / 移动端浮动按钮 -->
  <div class="review-right-panel" :class="{ 'is-mobile': isMobile, 'is-spelling': isSpellingMode }">
    <!-- ═══════════════════════════════════════════════════════════════════════════
         桌面端：固定右侧面板
         ═══════════════════════════════════════════════════════════════════════════ -->
    <template v-if="!isMobile">
      <!-- 墨迹装饰线 -->
      <div class="panel-ink-decoration">
        <div class="ink-drip drip-1"></div>
        <div class="ink-drip drip-2"></div>
      </div>

      <!-- Lapse 模式：错题追踪面板 -->
      <section v-if="isLapseMode" class="lapse-tracker-section">
        <header class="section-header">
          <div class="header-accent"></div>
          <span class="header-title">错题追踪</span>
        </header>

        <Transition name="notification-fade" mode="out-in">
          <div v-if="lastLapseResult" :key="lastLapseResult.word" class="lapse-tracker-card notif-lapse">
            <!-- 单词名 + 结果指示 -->
            <div class="lapse-word-row">
              <span class="lapse-word">{{ lastLapseResult.word }}</span>
              <span class="lapse-result-badge" :class="lastLapseResult.graduated ? 'badge-graduated' : lastLapseResult.remembered ? 'badge-correct' : 'badge-wrong'">
                {{ lastLapseResult.graduated ? '毕业' : lastLapseResult.remembered ? '记住' : '忘记' }}
              </span>
            </div>

            <!-- 反应时间 -->
            <div class="lapse-reaction">
              <div class="reaction-header">
                <span class="reaction-label">反应时间</span>
                <span class="reaction-value" :class="lastLapseResult.elapsed_time < 4 ? 'time-fast' : 'time-slow'">
                  {{ lastLapseResult.elapsed_time.toFixed(1) }}s
                </span>
              </div>
              <div class="reaction-bar-track">
                <div class="reaction-bar-fill" :style="{ width: `${getReactionPercentage(lastLapseResult.elapsed_time)}%`, background: getTimeColor(lastLapseResult.elapsed_time) }"></div>
                <div class="reaction-threshold" :style="{ left: '50%' }">
                  <span class="threshold-label">4s</span>
                </div>
              </div>
              <div class="reaction-hint">
                {{ lastLapseResult.elapsed_time < 4 ? '快速回忆 → 级别提升' : '回忆较慢 → 级别不变' }}
              </div>
            </div>

            <!-- Gap 级别进度 -->
            <div class="lapse-gap-progress">
              <div class="gap-header">
                <span class="gap-label">间隔级别</span>
                <span class="gap-value">
                  {{ lastLapseResult.graduated ? '已毕业' : `${Math.min(lastLapseResult.newLevel, 3)} / 4` }}
                </span>
              </div>
              <div class="gap-steps">
                <template v-for="(gap, i) in [1, 3, 7, 15]" :key="i">
                  <div
                    class="gap-step"
                    :class="{
                      'step-passed': lastLapseResult.newLevel > i || lastLapseResult.graduated,
                      'step-current': lastLapseResult.newLevel === i && !lastLapseResult.graduated,
                      'step-regressed': !lastLapseResult.remembered && i === 0
                    }"
                  >
                    <div class="step-dot"></div>
                    <span class="step-gap">{{ gap }}</span>
                  </div>
                  <div v-if="i < 3" class="gap-segment" :class="{ 'segment-filled': lastLapseResult.newLevel > i || lastLapseResult.graduated }"></div>
                </template>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-else class="lapse-tracker-empty">
            <div class="empty-illustration">
              <div class="empty-dots">
                <span></span><span></span><span></span><span></span>
              </div>
            </div>
            <p class="empty-text">答题后<br/>这里会显示错题追踪</p>
          </div>
        </Transition>
      </section>

      <!-- 参数通知区域 - 错题模式下隐藏 -->
      <section v-if="!isLapseMode" class="notification-section" :class="{ 'has-data': notificationData }">
      <header class="section-header">
        <div class="header-accent"></div>
        <span class="header-title">学习反馈</span>
      </header>

      <!-- 有数据时显示通知内容 -->
      <Transition name="notification-fade" mode="out-in">
        <div v-if="notificationData" :key="notificationData.word" class="notification-card" :class="isReviewMode ? 'notif-review' : 'notif-spelling'">
          <!-- 单词 -->
          <div class="notif-word">{{ notificationData.word }}</div>

          <!-- 参数变化 -->
          <div class="notif-param">
            <span class="param-label">{{ paramLabel }}</span>
            <span class="param-change" :class="changeClass">{{ formattedChange }}</span>
          </div>

          <!-- 详情网格 -->
          <div class="notif-details">
            <div class="detail-item">
              <span class="detail-label">新值</span>
              <span class="detail-value">{{ notificationData.new_param_value.toFixed(2) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">下次复习</span>
              <span class="detail-value">{{ formattedDate }}</span>
            </div>
            <div v-if="breakdown?.interval !== undefined" class="detail-item">
              <span class="detail-label">间隔天数</span>
              <span class="detail-value">{{ breakdown.interval }} 天</span>
            </div>
            <div v-if="breakdown?.repetition !== undefined" class="detail-item">
              <span class="detail-label">连续记住</span>
              <span class="detail-value">{{ breakdown.repetition }}</span>
            </div>
          </div>

          <!-- 评分可视化 - 复习模式 -->
          <div v-if="isReviewMode && breakdown?.remembered" class="notif-score-section">
            <div class="score-divider"></div>
            <div class="score-display">
              <div class="score-info">
                <span class="score-label">回忆评分</span>
                <span class="score-value">{{ breakdown.score }}</span>
                <span class="score-time">耗时 {{ (breakdown.elapsed_time ?? 0).toFixed(1) }}s</span>
              </div>
              <!-- 简化的时间刻度 -->
              <div class="time-scale">
                <div class="scale-bar">
                  <div class="scale-fill" :style="{ width: `${getTimePercentage(breakdown.elapsed_time ?? 0)}%`, background: getTimeColor(breakdown.elapsed_time ?? 0) }"></div>
                </div>
                <div class="scale-labels">
                  <span>0s</span>
                  <span>8s+</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 评分可视化 - 拼写模式 -->
          <div v-else-if="!isReviewMode && breakdown?.remembered" class="notif-score-section">
            <div class="score-divider"></div>
            <div class="spelling-scores">
              <div class="spell-score-item">
                <div class="spell-score-header">
                  <span class="spell-score-name">准确性</span>
                  <span class="spell-score-weight">60%</span>
                </div>
                <div class="spell-score-bar">
                  <div class="spell-bar-fill" :style="{ width: `${(breakdown.accuracy_score ?? 0) * 100}%` }"></div>
                </div>
              </div>
              <div class="spell-score-item">
                <div class="spell-score-header">
                  <span class="spell-score-name">流畅度</span>
                  <span class="spell-score-weight">20%</span>
                </div>
                <div class="spell-score-bar">
                  <div class="spell-bar-fill" :style="{ width: `${(breakdown.fluency_score ?? 0) * 100}%` }"></div>
                </div>
              </div>
              <div class="spell-score-item">
                <div class="spell-score-header">
                  <span class="spell-score-name">独立性</span>
                  <span class="spell-score-weight">20%</span>
                </div>
                <div class="spell-score-bar">
                  <div class="spell-bar-fill" :style="{ width: `${(breakdown.independence_score ?? 0) * 100}%` }"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 未记住状态 -->
          <div v-else-if="breakdown && !breakdown.remembered" class="notif-forgot">
            <span class="forgot-icon"><AppIcon name="cross" /></span>
            <span class="forgot-text">未记住</span>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="notification-empty">
          <div class="empty-illustration">
            <div class="empty-book"></div>
            <div class="empty-quill"><AppIcon name="pen" /></div>
          </div>
          <p class="empty-text">开始复习后<br/>这里会显示学习反馈</p>
        </div>
      </Transition>
    </section>

    <!-- 未来负荷预览 -->
    <ReviewLoadPreview />

    <!-- AI 助手入口 -->
    <section class="ai-section">
      <button
        class="ai-trigger"
        :class="{ 'is-active': isAIExpanded }"
        @click="toggleAI"
      >
        <div class="ai-trigger-content">
          <span class="ai-icon"><AppIcon name="pen" /></span>
          <span class="ai-label">学术助手</span>
          <span v-if="currentWord" class="ai-word">{{ currentWord.word }}</span>
        </div>
        <div class="ai-trigger-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      </button>
    </section>

    <!-- AI 展开面板 -->
    <Teleport to="body">
      <Transition name="ai-panel-slide">
        <div v-if="isAIExpanded" class="ai-panel-overlay" @click.self="toggleAI">
          <div class="ai-panel">
            <!-- 顶部装饰 -->
            <div class="ai-panel-ornament top"></div>

            <!-- 标题区 -->
            <header class="ai-panel-header">
              <div class="ai-header-left">
                <div class="ai-header-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5l6.74-6.76z"/>
                    <line x1="16" y1="8" x2="2" y2="22"/>
                  </svg>
                </div>
                <div class="ai-header-text">
                  <h2 class="ai-panel-title">学术助手</h2>
                  <p v-if="currentWord" class="ai-current-word">
                    正在研习 <span class="study-word">{{ currentWord.word }}</span>
                  </p>
                </div>
              </div>
              <button class="ai-close-btn" @click="toggleAI">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </header>

            <!-- 消息区域 -->
            <div class="ai-messages scrollbar-thin" ref="messagesContainer">
              <!-- 欢迎状态 -->
              <div v-if="messages.length === 0" class="ai-welcome">
                <div class="welcome-books">
                  <div class="book b1"></div>
                  <div class="book b2"></div>
                  <div class="book b3"></div>
                </div>
                <h3 class="welcome-title">请教任何问题</h3>
                <p class="welcome-desc">我是你的词汇学习助手，可以帮你理解词义、记忆技巧、搭配用法等</p>
              </div>

              <!-- 对话消息 -->
              <template v-if="messages.length > 0">
                <TransitionGroup name="message-flow">
                  <div
                    v-for="(msg, index) in messages"
                    :key="index"
                    class="ai-message"
                    :class="msg.role"
                  >
                    <div v-if="msg.role === 'user'" class="user-bubble">
                      {{ msg.content }}
                    </div>
                    <div v-else class="ai-response">
                      <div class="response-marker"><AppIcon name="book" /></div>
                      <div class="response-content" v-html="formatMessage(msg.content)"></div>
                    </div>
                  </div>
                </TransitionGroup>
              </template>

              <!-- 加载态 -->
              <div v-if="isLoading" class="ai-loading">
                <div class="loading-dots">
                  <span></span><span></span><span></span>
                </div>
                <span class="loading-text">正在书写...</span>
              </div>
            </div>

            <!-- 快捷建议（始终可见） -->
            <div class="ai-suggestions">
              <button
                v-for="(s, i) in suggestions"
                :key="i"
                class="suggestion-btn"
                :style="{ '--delay': `${i * 0.06}s` }"
                @click="handleSuggestionClick(s.text)"
                :disabled="isLoading"
              >
                <span class="suggestion-icon"><AppIcon :name="s.icon" /></span>
                <span class="suggestion-label">{{ s.label }}</span>
              </button>
            </div>

            <!-- 输入区 -->
            <div class="ai-input-area">
              <div class="input-decoration"></div>
              <div class="ai-input-wrapper">
                <input
                  ref="inputRef"
                  v-model="userInput"
                  type="text"
                  class="ai-input"
                  placeholder="请教一个问题..."
                  :disabled="isLoading"
                  @keypress.enter="sendMessage"
                />
                <button
                  class="ai-send-btn"
                  :class="{ active: userInput.trim() && !isLoading }"
                  :disabled="!userInput.trim() || isLoading"
                  @click="sendMessage"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- 底部装饰 -->
            <div class="ai-panel-ornament bottom"></div>
          </div>
        </div>
      </Transition>
    </Teleport>
    </template>

    <!-- ═══════════════════════════════════════════════════════════════════════════
         移动端：底部浮动控制栏
         ═══════════════════════════════════════════════════════════════════════════ -->
    <template v-else>
      <!-- 浮动控制栏 -->
      <div class="mobile-control-bar">
        <!-- Lapse 模式徽章 -->
        <button
          v-if="isLapseMode && lastLapseResult"
          class="mobile-lapse-badge"
          :class="lastLapseResult.graduated ? 'badge-graduated' : lastLapseResult.remembered ? 'badge-correct' : 'badge-wrong'"
          @click="toggleMobileLapse"
        >
          <span class="badge-word">{{ lastLapseResult.word }}</span>
          <span class="lapse-badge-level">
            {{ lastLapseResult.graduated ? '毕业' : `Lv.${Math.min(lastLapseResult.newLevel, 3)}` }}
          </span>
        </button>

        <!-- 通知徽章（有数据时显示，错题模式下隐藏） -->
        <button
          v-if="notificationData && !isLapseMode"
          class="mobile-notif-badge"
          :class="mobileNotifClass"
          @click="toggleMobileNotif"
        >
          <span class="badge-word">{{ notificationData.word }}</span>
          <span class="badge-change" :class="changeClass">{{ formattedChange }}</span>
        </button>

        <!-- AI 助手入口按钮 -->
        <button
          class="mobile-ai-btn"
          :class="{ 'is-active': isAIExpanded }"
          @click="toggleAI"
        >
          <span class="ai-btn-icon"><AppIcon name="pen" /></span>
          <span class="ai-btn-label">助手</span>
        </button>
      </div>

      <!-- 移动端通知展开面板 - 错题模式下隐藏 -->
      <Teleport to="body">
        <Transition name="mobile-notif-slide">
          <div v-if="isMobileNotifExpanded && notificationData && !isLapseMode" class="mobile-notif-overlay" @click.self="closeMobileNotif">
            <div class="mobile-notif-panel" :class="isReviewMode ? 'notif-review' : 'notif-spelling'">
              <!-- 面板头部 -->
              <div class="mobile-notif-header">
                <span class="notif-header-word">{{ notificationData.word }}</span>
                <button class="notif-close-btn" @click="closeMobileNotif">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <!-- 参数变化 -->
              <div class="mobile-notif-main">
                <span class="notif-param-label">{{ paramLabel }}</span>
                <span class="notif-param-change" :class="changeClass">{{ formattedChange }}</span>
              </div>

              <!-- 详情网格 -->
              <div class="mobile-notif-details">
                <div class="detail-row">
                  <span class="detail-label">新值</span>
                  <span class="detail-value">{{ notificationData.new_param_value.toFixed(2) }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">下次复习</span>
                  <span class="detail-value">{{ formattedDate }}</span>
                </div>
                <div v-if="breakdown?.interval !== undefined" class="detail-row">
                  <span class="detail-label">间隔天数</span>
                  <span class="detail-value">{{ breakdown.interval }} 天</span>
                </div>
                <div v-if="breakdown?.repetition !== undefined" class="detail-row">
                  <span class="detail-label">连续记住</span>
                  <span class="detail-value">{{ breakdown.repetition }}</span>
                </div>
              </div>

              <!-- 评分信息 -->
              <div v-if="isReviewMode && breakdown?.remembered" class="mobile-notif-score">
                <div class="score-header">
                  <span class="score-label">回忆评分</span>
                  <span class="score-value">{{ breakdown.score }}</span>
                  <span class="score-time">耗时 {{ (breakdown.elapsed_time ?? 0).toFixed(1) }}s</span>
                </div>
                <div class="score-bar">
                  <div class="bar-fill" :style="{ width: `${getTimePercentage(breakdown.elapsed_time ?? 0)}%`, background: getTimeColor(breakdown.elapsed_time ?? 0) }"></div>
                </div>
              </div>

              <!-- 拼写评分 -->
              <div v-else-if="!isReviewMode && breakdown?.remembered" class="mobile-spelling-scores">
                <div class="spell-item">
                  <span class="spell-name">准确性 (60%)</span>
                  <div class="spell-bar"><div class="bar-fill" :style="{ width: `${(breakdown.accuracy_score ?? 0) * 100}%` }"></div></div>
                </div>
                <div class="spell-item">
                  <span class="spell-name">流畅度 (20%)</span>
                  <div class="spell-bar"><div class="bar-fill" :style="{ width: `${(breakdown.fluency_score ?? 0) * 100}%` }"></div></div>
                </div>
                <div class="spell-item">
                  <span class="spell-name">独立性 (20%)</span>
                  <div class="spell-bar"><div class="bar-fill" :style="{ width: `${(breakdown.independence_score ?? 0) * 100}%` }"></div></div>
                </div>
              </div>

              <!-- 未记住状态 -->
              <div v-else-if="breakdown && !breakdown.remembered" class="mobile-notif-forgot">
                <span class="forgot-icon"><AppIcon name="cross" /></span>
                <span class="forgot-text">未记住</span>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- 移动端 Lapse 追踪面板 -->
      <Teleport to="body">
        <Transition name="mobile-notif-slide">
          <div v-if="isMobileLapseExpanded && lastLapseResult" class="mobile-notif-overlay" @click.self="closeMobileLapse">
            <div class="mobile-lapse-panel notif-lapse">
              <!-- 面板头部 -->
              <div class="mobile-lapse-header">
                <span class="lapse-header-word">{{ lastLapseResult.word }}</span>
                <div class="lapse-header-right">
                  <span class="lapse-result-badge" :class="lastLapseResult.graduated ? 'badge-graduated' : lastLapseResult.remembered ? 'badge-correct' : 'badge-wrong'">
                    {{ lastLapseResult.graduated ? '毕业' : lastLapseResult.remembered ? '记住' : '忘记' }}
                  </span>
                  <button class="notif-close-btn" @click="closeMobileLapse">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- 反应时间 -->
              <div class="mobile-lapse-reaction">
                <div class="reaction-header">
                  <span class="reaction-label">反应时间</span>
                  <span class="reaction-value" :class="lastLapseResult.elapsed_time < 4 ? 'time-fast' : 'time-slow'">
                    {{ lastLapseResult.elapsed_time.toFixed(1) }}s
                  </span>
                </div>
                <div class="reaction-bar-track">
                  <div class="reaction-bar-fill" :style="{ width: `${getReactionPercentage(lastLapseResult.elapsed_time)}%`, background: getTimeColor(lastLapseResult.elapsed_time) }"></div>
                  <div class="reaction-threshold" :style="{ left: '50%' }">
                    <span class="threshold-label">4s</span>
                  </div>
                </div>
                <div class="reaction-hint">
                  {{ lastLapseResult.elapsed_time < 4 ? '快速回忆 → 级别提升' : '回忆较慢 → 级别不变' }}
                </div>
              </div>

              <!-- Gap 级别 -->
              <div class="mobile-lapse-gap">
                <div class="gap-header">
                  <span class="gap-label">间隔级别</span>
                  <span class="gap-value">
                    {{ lastLapseResult.graduated ? '已毕业' : `${Math.min(lastLapseResult.newLevel, 3)} / 4` }}
                  </span>
                </div>
                <div class="gap-steps">
                  <template v-for="(gap, i) in [1, 3, 7, 15]" :key="i">
                    <div
                      class="gap-step"
                      :class="{
                        'step-passed': lastLapseResult.newLevel > i || lastLapseResult.graduated,
                        'step-current': lastLapseResult.newLevel === i && !lastLapseResult.graduated,
                        'step-regressed': !lastLapseResult.remembered && i === 0
                      }"
                    >
                      <div class="step-dot"></div>
                      <span class="step-gap">{{ gap }}</span>
                    </div>
                    <div v-if="i < 3" class="gap-segment" :class="{ 'segment-filled': lastLapseResult.newLevel > i || lastLapseResult.graduated }"></div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- 移动端 AI 面板 -->
      <Teleport to="body">
        <Transition name="mobile-ai-slide">
          <div v-if="isAIExpanded" class="mobile-ai-overlay" @click.self="toggleAI">
            <div class="mobile-ai-panel">
              <!-- 顶部装饰 -->
              <div class="ai-panel-ornament top"></div>

              <!-- 标题区 -->
              <header class="mobile-ai-header">
                <div class="ai-header-left">
                  <div class="ai-header-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5l6.74-6.76z"/>
                      <line x1="16" y1="8" x2="2" y2="22"/>
                    </svg>
                  </div>
                  <div class="ai-header-text">
                    <h2 class="ai-panel-title">学术助手</h2>
                    <p v-if="currentWord" class="ai-current-word">
                      正在研习 <span class="study-word">{{ currentWord.word }}</span>
                    </p>
                  </div>
                </div>
                <button class="ai-close-btn" @click="toggleAI">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </header>

              <!-- 消息区域 -->
              <div class="mobile-ai-messages scrollbar-thin" ref="messagesContainer">
                <!-- 欢迎状态 -->
                <div v-if="messages.length === 0" class="ai-welcome">
                  <div class="welcome-books">
                    <div class="book b1"></div>
                    <div class="book b2"></div>
                    <div class="book b3"></div>
                  </div>
                  <h3 class="welcome-title">请教任何问题</h3>
                  <p class="welcome-desc">我是你的词汇学习助手，可以帮你理解词义、记忆技巧、搭配用法等</p>
                </div>

                <!-- 对话消息 -->
                <template v-if="messages.length > 0">
                  <TransitionGroup name="message-flow">
                    <div
                      v-for="(msg, index) in messages"
                      :key="index"
                      class="ai-message"
                      :class="msg.role"
                    >
                      <div v-if="msg.role === 'user'" class="user-bubble">
                        {{ msg.content }}
                      </div>
                      <div v-else class="ai-response">
                        <div class="response-marker"><AppIcon name="book" /></div>
                        <div class="response-content" v-html="formatMessage(msg.content)"></div>
                      </div>
                    </div>
                  </TransitionGroup>
                </template>

                <!-- 加载态 -->
                <div v-if="isLoading" class="ai-loading">
                  <div class="loading-dots">
                    <span></span><span></span><span></span>
                  </div>
                  <span class="loading-text">正在书写...</span>
                </div>
              </div>

              <!-- 快捷建议（始终可见） -->
              <div class="mobile-ai-suggestions">
                <button
                  v-for="(s, i) in suggestions"
                  :key="i"
                  class="suggestion-btn"
                  @click="handleSuggestionClick(s.text)"
                  :disabled="isLoading"
                >
                  <span class="suggestion-icon"><AppIcon :name="s.icon" /></span>
                  <span class="suggestion-label">{{ s.label }}</span>
                </button>
              </div>

              <!-- 输入区 -->
              <div class="mobile-ai-input-area">
                <div class="ai-input-wrapper">
                  <input
                    ref="inputRef"
                    v-model="userInput"
                    type="text"
                    class="ai-input"
                    placeholder="请教一个问题..."
                    :disabled="isLoading"
                    @keypress.enter="sendMessage"
                  />
                  <button
                    class="ai-send-btn"
                    :class="{ active: userInput.trim() && !isLoading }"
                    :disabled="!userInput.trim() || isLoading"
                    @click="sendMessage"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- 底部装饰 -->
              <div class="ai-panel-ornament bottom"></div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useBreakpoint } from '@/shared/composables/useBreakpoint'
import type { Word, ReviewBreakdown, SpellingBreakdown } from '@/shared/types'
import type { ReviewNotificationData } from '@/shared/api/words'
import { useTimerPause } from '@/shared/composables/useTimerPause'
import { useChatMessages } from '@/shared/composables/useChatMessages'
import AppIcon, { type IconName } from '@/shared/components/controls/Icons.vue'
import { useReviewStore } from '@/features/vocabulary/stores/review'
import ReviewLoadPreview from './ReviewLoadPreview.vue'

interface Props {
  notificationData?: ReviewNotificationData | null
  currentWord?: Word | null
}

const props = withDefaults(defineProps<Props>(), {
  notificationData: null,
  currentWord: null
})

// State
const { isMobile } = useBreakpoint()
const isAIExpanded = ref(false)
const isMobileNotifExpanded = ref(false)
const isMobileLapseExpanded = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

// Composables
const { requestPause, releasePause } = useTimerPause()
const reviewStore = useReviewStore()

// 错题模式下不显示通知
const isLapseMode = computed(() => reviewStore.mode === 'mode_lapse')
const isSpellingMode = computed(() => reviewStore.mode === 'mode_spelling')

// Lapse 追踪数据
const lastLapseResult = computed(() => reviewStore.lastLapseResult)

const currentWordRef = computed(() => props.currentWord)
const {
  userInput,
  messages,
  isLoading,
  messagesContainer,
  formatMessage,
  handleSuggestionClick: baseSuggestionClick,
  sendMessage
} = useChatMessages(currentWordRef, isAIExpanded)

// Computed
// 模板中通过 v-if 按 param_type 分别访问 review/spelling 字段，
// 此处合并为 Partial 联合以便模板安全访问所有可能字段
const breakdown = computed(() =>
  props.notificationData?.breakdown as Partial<ReviewBreakdown & SpellingBreakdown> | undefined
)
const isReviewMode = computed(() => props.notificationData?.param_type === 'ease_factor')

const paramLabel = computed(() =>
  props.notificationData?.param_type === 'ease_factor' ? '难度系数' : '拼写强度'
)

const formattedChange = computed(() => {
  if (!props.notificationData) return ''
  const sign = props.notificationData.param_change > 0 ? '+' : ''
  return `${sign}${props.notificationData.param_change.toFixed(2)}`
})

const changeClass = computed(() => {
  if (!props.notificationData) return ''
  const change = props.notificationData.param_change
  const newValue = props.notificationData.new_param_value
  const paramType = props.notificationData.param_type

  if (change === 0) {
    const isAtMax = paramType === 'spell_strength' ? newValue >= 5 : newValue >= 3.0
    return isAtMax ? 'change--positive' : 'change--neutral'
  }
  return change > 0 ? 'change--positive' : 'change--negative'
})

const formattedDate = computed(() => {
  if (!props.notificationData) return ''
  try {
    const date = new Date(props.notificationData.next_review_date)
    return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
  } catch {
    return props.notificationData.next_review_date
  }
})

// Suggestions
const suggestions: { icon: IconName; label: string; text: string }[] = [
  { icon: 'list-tree', label: '常用搭配', text: '这个词有哪些常用搭配？' },
  { icon: 'text-cursor', label: '造句示例', text: '如何用这个词造句？' },
  { icon: 'sparkle', label: '记忆方法', text: '有什么好的记忆方法？' },
  { icon: 'arrows-right-left', label: '近义反义', text: '它的同义词和反义词是什么？' }
]

// Methods
const getTimePercentage = (time: number): number => {
  return Math.min((time / 8) * 100, 100)
}

const getReactionPercentage = (time: number): number => {
  return Math.min((time / 8) * 100, 100)
}

const getTimeColor = (time: number): string => {
  if (time < 2) return '#7FD17F'
  if (time < 3) return '#B0D87F'
  if (time < 4) return '#FFD77A'
  if (time < 5.5) return '#FFB27A'
  return '#FF9B9B'
}

const toggleAI = () => {
  isAIExpanded.value = !isAIExpanded.value

  if (isAIExpanded.value) {
    requestPause()
    nextTick(() => {
      setTimeout(() => inputRef.value?.focus(), 300)
    })
  } else {
    releasePause()
  }
}

const handleSuggestionClick = (text: string) => {
  baseSuggestionClick(text)
}

// 移动端通知方法
const toggleMobileNotif = () => {
  isMobileNotifExpanded.value = !isMobileNotifExpanded.value
}

const closeMobileNotif = () => {
  isMobileNotifExpanded.value = false
}

// 移动端 Lapse 面板方法
const toggleMobileLapse = () => {
  isMobileLapseExpanded.value = !isMobileLapseExpanded.value
}

const closeMobileLapse = () => {
  isMobileLapseExpanded.value = false
}

// 移动端通知徽章样式
const mobileNotifClass = computed(() => {
  if (!props.notificationData) return ''
  return props.notificationData.param_change >= 0 ? 'badge-positive' : 'badge-negative'
})

</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Review Right Panel - 学习控制台
   桌面端固定右侧面板，整合通知和AI助手入口
   ═══════════════════════════════════════════════════════════════════════════ */

.review-right-panel {
  position: fixed;
  top: var(--topbar-height);
  right: 0;
  width: 220px;
  height: calc(100vh - var(--topbar-height));
  display: flex;
  flex-direction: column;
  z-index: 150;
  padding: 1rem;
  gap: 1rem;

  /* 纸张纹理背景 */
  background:
    linear-gradient(180deg,
      rgba(255, 253, 247, 0.95) 0%,
      rgba(250, 247, 242, 0.88) 100%
    );

  /* 左侧墨迹边缘 */
  border-left: 1px solid var(--primitive-paper-400);
  box-shadow:
    -2px 0 20px rgba(0, 0, 0, 0.03),
    inset 1px 0 0 rgba(255, 255, 255, 0.5);
}

/* ─────────────────────────────────────────────────────────────────────────────
   墨迹装饰
   ───────────────────────────────────────────────────────────────────────────── */

.panel-ink-decoration {
  position: absolute;
  top: 0;
  left: -1px;
  width: 4px;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}

.ink-drip {
  position: absolute;
  left: 0;
  width: 3px;
  background: linear-gradient(180deg,
    var(--primitive-copper-400) 0%,
    transparent 100%
  );
  border-radius: 0 0 2px 2px;
  opacity: 0.25;
  animation: inkDrip 10s ease-in-out infinite;
}

.drip-1 {
  top: 15%;
  height: 50px;
  animation-delay: 0s;
}

.drip-2 {
  top: 55%;
  height: 35px;
  animation-delay: 4s;
}

@keyframes inkDrip {
  0%, 100% {
    opacity: 0.2;
    transform: translateY(0) scaleY(1);
  }
  50% {
    opacity: 0.4;
    transform: translateY(15px) scaleY(1.15);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Section 通用样式
   ───────────────────────────────────────────────────────────────────────────── */

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.header-accent {
  width: 3px;
  height: 14px;
  background: var(--gradient-primary);
  border-radius: 2px;
}

.header-title {
  font-family: var(--font-serif);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--primitive-ink-500);
  letter-spacing: 0.05em;
}

/* ─────────────────────────────────────────────────────────────────────────────
   通知区域
   ───────────────────────────────────────────────────────────────────────────── */

.notification-section {
  flex-shrink: 0;
  min-height: 18rem;
  display: flex;
  flex-direction: column;
}

/* 通知卡片 */
.notification-card {
  background: linear-gradient(145deg,
    rgba(58, 50, 42, 0.92),
    rgba(42, 36, 30, 0.88)
  );
  border-radius: var(--radius-md);
  padding: 1rem;
  color: var(--primitive-paper-100);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 253, 247, 0.06);
  border: 1px solid rgba(255, 253, 247, 0.06);
}

/* 模式色带 */
.notif-review { border-top: 3px solid var(--primitive-copper-400); }
.notif-spelling { border-top: 3px solid var(--primitive-olive-400); }
.notif-lapse { border-top: 3px solid var(--primitive-brick-400); }

.notif-word {
  font-family: var(--font-serif);
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-align: center;
  margin-bottom: 0.5rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.notif-param {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.param-label {
  font-size: 0.75rem;
  opacity: 0.8;
}

.param-change {
  font-size: 1.5rem;
  font-weight: 700;
  font-family: var(--font-data);
  letter-spacing: -0.5px;
}

.change--positive {
  color: #7FD17F;
  text-shadow: 0 0 10px rgba(127, 209, 127, 0.3);
}

.change--negative {
  color: #FF9B9B;
  text-shadow: 0 0 10px rgba(255, 155, 155, 0.3);
}

.change--neutral {
  color: #FFD77A;
  text-shadow: 0 0 10px rgba(255, 215, 122, 0.3);
}

/* 详情网格 */
.notif-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem 0.5rem;
  font-size: 0.7rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.15rem 0;
}

.detail-label {
  opacity: 0.7;
}

.detail-value {
  font-weight: 600;
  font-family: var(--font-data);
}

/* 评分区域 */
.notif-score-section {
  margin-top: 0.75rem;
}

.score-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
  margin-bottom: 0.75rem;
}

.score-display {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.score-info {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.5rem;
}

.score-label {
  font-size: 0.65rem;
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.score-value {
  font-size: 1.75rem;
  font-weight: 700;
  font-family: var(--font-data);
  line-height: 1;
}

.score-time {
  font-size: 0.65rem;
  opacity: 0.7;
}

/* 时间刻度 */
.time-scale {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.scale-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  overflow: hidden;
}

.scale-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease, background 0.3s ease;
}

.scale-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.6rem;
  opacity: 0.6;
}

/* 拼写评分 */
.spelling-scores {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.spell-score-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.spell-score-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.65rem;
}

.spell-score-name {
  font-weight: 500;
}

.spell-score-weight {
  opacity: 0.6;
}

.spell-score-bar {
  height: 5px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  overflow: hidden;
}

.spell-bar-fill {
  height: 100%;
  background: var(--gradient-success);
  border-radius: 3px;
  transition: width 0.4s ease;
}

/* 未记住状态 */
.notif-forgot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: rgba(255, 155, 155, 0.15);
  border-radius: var(--radius-sm);
}

.forgot-icon {
  display: inline-flex;
  align-items: center;
  color: #FF9B9B;
}

.forgot-icon .icon {
  width: 14px;
  height: 14px;
}

.forgot-text {
  font-size: 0.8rem;
  color: #FF9B9B;
  font-weight: 500;
}

/* 空状态 */
.notification-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  text-align: center;
}

.empty-illustration {
  position: relative;
  width: 60px;
  height: 40px;
  margin-bottom: 1rem;
}

.empty-book {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 8px;
  background: var(--primitive-copper-300);
  border-radius: 2px;
  opacity: 0.5;
}

.empty-quill {
  position: absolute;
  top: 0;
  right: 5px;
  display: inline-flex;
  align-items: center;
  opacity: 0.4;
  animation: quillFloat 3s ease-in-out infinite;
}

.empty-quill .icon {
  width: 18px;
  height: 18px;
}

@keyframes quillFloat {
  0%, 100% { transform: translateY(0) rotate(-15deg); }
  50% { transform: translateY(-4px) rotate(-10deg); }
}

.empty-text {
  font-size: 0.75rem;
  color: var(--primitive-ink-400);
  line-height: 1.5;
  margin: 0;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Lapse 错题追踪面板
   ───────────────────────────────────────────────────────────────────────────── */

.lapse-tracker-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.lapse-tracker-card {
  background: linear-gradient(145deg,
    rgba(58, 50, 42, 0.92),
    rgba(42, 36, 30, 0.88)
  );
  border-radius: var(--radius-md);
  padding: 0.875rem;
  color: var(--primitive-paper-100);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 253, 247, 0.06);
  border: 1px solid rgba(255, 253, 247, 0.06);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* 单词名 + 结果 */
.lapse-word-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.lapse-word {
  font-family: var(--font-serif);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lapse-result-badge {
  font-family: var(--font-ui);
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-full);
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

.badge-correct {
  background: rgba(127, 209, 127, 0.2);
  color: #7FD17F;
}

.badge-wrong {
  background: rgba(255, 155, 155, 0.2);
  color: #FF9B9B;
}

.badge-graduated {
  background: rgba(255, 215, 122, 0.2);
  color: #FFD77A;
}

/* 反应时间 */
.lapse-reaction {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.reaction-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.reaction-label {
  font-size: 0.65rem;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-family: var(--font-ui);
}

.reaction-value {
  font-size: 1.1rem;
  font-weight: 700;
  font-family: var(--font-data);
  line-height: 1;
}

.time-fast {
  color: #7FD17F;
}

.time-slow {
  color: #FFD77A;
}

.reaction-bar-track {
  height: 6px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  overflow: visible;
  position: relative;
}

.reaction-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease;
}

.reaction-threshold {
  position: absolute;
  top: -2px;
  width: 2px;
  height: 10px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 1px;
  transform: translateX(-50%);
}

.threshold-label {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.55rem;
  font-family: var(--font-data);
  opacity: 0.5;
  white-space: nowrap;
}

.reaction-hint {
  font-size: 0.6rem;
  opacity: 0.5;
  font-family: var(--font-ui);
  text-align: center;
}

/* Gap 级别步进条 */
.lapse-gap-progress {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.gap-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.gap-label {
  font-size: 0.65rem;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-family: var(--font-ui);
}

.gap-value {
  font-size: 0.75rem;
  font-weight: 600;
  font-family: var(--font-data);
}

.gap-steps {
  display: flex;
  align-items: flex-start;
}

.gap-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  flex-shrink: 0;
}

.gap-segment {
  flex: 1;
  height: 2px;
  margin-top: 5px; /* dot center: 12px / 2 - line height 2px / 2 = 5px */
  margin-inline: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 1px;
  transition: background 0.4s ease;
}

.gap-segment.segment-filled {
  background: linear-gradient(90deg, rgba(127, 209, 127, 0.7), rgba(255, 215, 122, 0.7));
}

.step-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  border: 2px solid rgba(255, 255, 255, 0.2);
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.step-passed .step-dot {
  background: #7FD17F;
  border-color: #7FD17F;
  box-shadow: 0 0 8px rgba(127, 209, 127, 0.4);
}

.step-current .step-dot {
  background: #FFD77A;
  border-color: #FFD77A;
  box-shadow: 0 0 8px rgba(255, 215, 122, 0.4);
  animation: currentPulse 2s ease-in-out infinite;
}

.step-regressed .step-dot {
  background: #FF9B9B;
  border-color: #FF9B9B;
  box-shadow: 0 0 8px rgba(255, 155, 155, 0.4);
}

@keyframes currentPulse {
  0%, 100% { box-shadow: 0 0 6px rgba(255, 215, 122, 0.3); }
  50% { box-shadow: 0 0 12px rgba(255, 215, 122, 0.6); }
}

.step-gap {
  font-size: 0.55rem;
  font-family: var(--font-data);
  opacity: 0.5;
}

.step-passed .step-gap,
.step-current .step-gap {
  opacity: 0.8;
}

/* Lapse 空状态 */
.lapse-tracker-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  text-align: center;
}

.empty-dots {
  display: flex;
  gap: 6px;
  margin-bottom: 1rem;
}

.empty-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--primitive-paper-400);
  opacity: 0.4;
  animation: emptyDotFloat 2.5s ease-in-out infinite;
}

.empty-dots span:nth-child(1) { animation-delay: 0s; }
.empty-dots span:nth-child(2) { animation-delay: 0.3s; }
.empty-dots span:nth-child(3) { animation-delay: 0.6s; }
.empty-dots span:nth-child(4) { animation-delay: 0.9s; }

@keyframes emptyDotFloat {
  0%, 100% { transform: translateY(0); opacity: 0.3; }
  50% { transform: translateY(-4px); opacity: 0.6; }
}

/* ─────────────────────────────────────────────────────────────────────────────
   AI 助手入口
   ───────────────────────────────────────────────────────────────────────────── */

.ai-section {
  flex-shrink: 0;
  padding-top: 0.5rem;
  border-top: 1px solid var(--primitive-paper-400);
}

.ai-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: linear-gradient(145deg,
    var(--primitive-copper-400),
    var(--primitive-copper-500)
  );
  border: none;
  border-radius: var(--radius-md);
  color: var(--primitive-paper-100);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow:
    0 4px 12px rgba(153, 107, 61, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.ai-trigger:hover {
  transform: translateY(-2px);
  box-shadow:
    0 6px 16px rgba(153, 107, 61, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.ai-trigger:active {
  transform: translateY(0);
}

.ai-trigger.is-active {
  background: linear-gradient(145deg,
    var(--primitive-copper-500),
    var(--primitive-gold-600)
  );
}

.ai-trigger-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ai-icon {
  display: inline-flex;
  align-items: center;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2));
}

.ai-icon .icon {
  width: 14px;
  height: 14px;
}

.ai-label {
  font-family: var(--font-ui);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.ai-word {
  font-size: 0.7rem;
  opacity: 0.8;
  font-style: italic;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-trigger-arrow {
  width: 18px;
  height: 18px;
  opacity: 0.8;
  transition: transform 0.25s ease;
}

.ai-trigger-arrow svg {
  width: 100%;
  height: 100%;
}

.ai-trigger.is-active .ai-trigger-arrow {
  transform: rotate(180deg);
}

/* ─────────────────────────────────────────────────────────────────────────────
   AI 展开面板
   ───────────────────────────────────────────────────────────────────────────── */

.ai-panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 240px;
}

.ai-panel {
  width: 420px;
  height: min(680px, 90vh);
  background: var(--primitive-paper-100);
  border-radius: var(--radius-lg);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.2),
    0 0 0 1px rgba(153, 107, 61, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* 纸张纹理 */
.ai-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23paper)'/%3E%3C/svg%3E");
  opacity: 0.02;
  pointer-events: none;
  z-index: 0;
}

.ai-panel-ornament {
  height: 4px;
  background: linear-gradient(90deg,
    transparent 0%,
    var(--primitive-copper-300) 10%,
    var(--primitive-copper-400) 50%,
    var(--primitive-copper-300) 90%,
    transparent 100%
  );
  flex-shrink: 0;
}

.ai-panel-ornament.top {
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.ai-panel-ornament.bottom {
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

/* 标题区 */
.ai-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--primitive-paper-400);
  background: linear-gradient(to bottom,
    var(--primitive-paper-100),
    var(--primitive-paper-200)
  );
  position: relative;
  z-index: 1;
}

.ai-header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ai-header-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  border-radius: var(--radius-default);
  color: var(--primitive-paper-100);
  box-shadow: 0 2px 8px rgba(153, 107, 61, 0.3);
}

.ai-header-icon svg {
  width: 20px;
  height: 20px;
}

.ai-header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ai-panel-title {
  font-family: var(--font-serif);
  font-size: 1rem;
  font-weight: 600;
  color: var(--primitive-ink-800);
  margin: 0;
}

.ai-current-word {
  font-size: 0.75rem;
  color: var(--primitive-ink-400);
  margin: 0;
  font-family: var(--font-ui);
}

.ai-current-word .study-word {
  color: var(--primitive-copper-500);
  font-weight: 600;
  font-style: italic;
}

.ai-close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-default);
  color: var(--primitive-ink-400);
  cursor: pointer;
  transition: all 0.2s ease;
}

.ai-close-btn:hover {
  background: var(--primitive-paper-300);
  color: var(--primitive-ink-600);
}

.ai-close-btn svg {
  width: 18px;
  height: 18px;
}

/* 消息区域 */
.ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: linear-gradient(to bottom,
    var(--primitive-paper-200),
    var(--primitive-paper-100) 30%
  );
  position: relative;
  z-index: 1;
}

/* 欢迎状态 */
.ai-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 0;
  animation: welcomeFade 0.5s ease-out;
}

@keyframes welcomeFade {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.welcome-books {
  position: relative;
  width: 70px;
  height: 50px;
  margin-bottom: 1.25rem;
}

.book {
  position: absolute;
  bottom: 0;
  left: 50%;
  border-radius: 2px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.book.b1 {
  width: 45px;
  height: 8px;
  background: var(--primitive-copper-400);
  transform: translateX(-50%) rotate(-2deg);
}

.book.b2 {
  width: 40px;
  height: 10px;
  background: var(--primitive-olive-400);
  transform: translateX(-50%) translateY(-10px) rotate(1deg);
}

.book.b3 {
  width: 42px;
  height: 9px;
  background: var(--primitive-gold-500);
  transform: translateX(-50%) translateY(-22px) rotate(-1deg);
}

.welcome-title {
  font-family: var(--font-serif);
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--primitive-ink-800);
  margin: 0 0 0.5rem 0;
}

.welcome-desc {
  font-size: 0.85rem;
  color: var(--primitive-ink-500);
  text-align: center;
  margin: 0 0 1.5rem 0;
  line-height: 1.6;
  max-width: 280px;
}

/* 快捷建议（始终可见，位于输入区上方） */
.ai-suggestions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border-top: 1px solid var(--primitive-paper-300);
  flex-shrink: 0;
}

.suggestion-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.6rem;
  background: var(--primitive-paper-50);
  border: 1px solid var(--primitive-paper-400);
  border-radius: var(--radius-default);
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: var(--font-ui);
}

.suggestion-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.suggestion-btn:not(:disabled):hover {
  border-color: var(--primitive-copper-300);
  box-shadow: 0 2px 8px rgba(153, 107, 61, 0.1);
  background: var(--primitive-paper-100);
}

.suggestion-btn:not(:disabled):active {
  transform: scale(0.98);
}

.suggestion-icon {
  display: inline-flex;
  align-items: center;
}

.suggestion-icon .icon {
  width: 13px;
  height: 13px;
}

.suggestion-label {
  font-size: 0.75rem;
  color: var(--primitive-ink-600);
  font-weight: 500;
}

/* 消息样式 */
.ai-message {
  width: 100%;
  animation: messageSlide 0.35s ease-out;
}

@keyframes messageSlide {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.user-bubble {
  max-width: 85%;
  margin-left: auto;
  padding: 0.75rem 1rem;
  background: var(--gradient-primary);
  color: var(--primitive-paper-100);
  border-radius: var(--radius-md);
  border-bottom-right-radius: var(--radius-xs);
  font-size: 0.9rem;
  line-height: 1.6;
  box-shadow: 0 2px 8px rgba(153, 107, 61, 0.2);
}

.ai-response {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--primitive-paper-50);
  border-radius: var(--radius-default);
  border: 1px solid var(--primitive-paper-300);
}

.response-marker {
  display: inline-flex;
  align-items: center;
  color: var(--primitive-copper-400);
  flex-shrink: 0;
}

.response-marker .icon {
  width: 14px;
  height: 14px;
}

.response-content {
  flex: 1;
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--primitive-ink-700);
}

.response-content :deep(p) {
  margin: 0.5em 0;
}

.response-content :deep(p:first-child) {
  margin-top: 0;
}

.response-content :deep(p:last-child) {
  margin-bottom: 0;
}

.response-content :deep(strong) {
  font-weight: 600;
  color: var(--primitive-ink-800);
}

.response-content :deep(em) {
  font-style: italic;
  color: var(--primitive-copper-600);
}

.response-content :deep(ul),
.response-content :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.4em;
}

.response-content :deep(li) {
  margin: 0.25em 0;
}

/* 加载态 */
.ai-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--primitive-paper-50);
  border-radius: var(--radius-default);
  border: 1px solid var(--primitive-paper-300);
}

.loading-dots {
  display: flex;
  gap: 4px;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  background: var(--primitive-copper-400);
  border-radius: 50%;
  animation: dotPulse 1.4s ease-in-out infinite;
}

.loading-dots span:nth-child(1) { animation-delay: 0s; }
.loading-dots span:nth-child(2) { animation-delay: 0.15s; }
.loading-dots span:nth-child(3) { animation-delay: 0.3s; }

@keyframes dotPulse {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.loading-text {
  font-size: 0.8rem;
  color: var(--primitive-ink-400);
  font-family: var(--font-ui);
}

/* 输入区 */
.ai-input-area {
  padding: 1rem 1.25rem;
  background: var(--primitive-paper-100);
  border-top: 1px solid var(--primitive-paper-400);
  position: relative;
  z-index: 1;
}

.input-decoration {
  position: absolute;
  top: 0;
  left: 1.25rem;
  right: 1.25rem;
  height: 1px;
  background: linear-gradient(90deg,
    transparent 0%,
    var(--primitive-copper-200) 20%,
    var(--primitive-copper-300) 50%,
    var(--primitive-copper-200) 80%,
    transparent 100%
  );
  transform: translateY(-0.5px);
}

.ai-input-wrapper {
  display: flex;
  gap: 0.6rem;
  align-items: center;
}

.ai-input {
  flex: 1;
  padding: 0.75rem 1rem;
  background: var(--primitive-paper-50);
  border: 1px solid var(--primitive-paper-400);
  border-radius: var(--radius-full);
  font-size: 0.9rem;
  font-family: var(--font-ui);
  color: var(--primitive-ink-800);
  outline: none;
  transition: all 0.2s ease;
}

.ai-input::placeholder {
  color: var(--primitive-ink-400);
}

.ai-input:focus {
  border-color: var(--primitive-copper-400);
  box-shadow: 0 0 0 3px rgba(153, 107, 61, 0.1);
}

.ai-input:disabled {
  background: var(--primitive-paper-200);
  cursor: not-allowed;
}

.ai-send-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primitive-paper-300);
  border: none;
  border-radius: 50%;
  color: var(--primitive-ink-400);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.ai-send-btn svg {
  width: 18px;
  height: 18px;
}

.ai-send-btn.active {
  background: var(--gradient-primary);
  color: var(--primitive-paper-100);
  box-shadow: 0 4px 12px rgba(153, 107, 61, 0.3);
}

.ai-send-btn.active:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 16px rgba(153, 107, 61, 0.4);
}

.ai-send-btn:disabled {
  cursor: not-allowed;
}

/* ─────────────────────────────────────────────────────────────────────────────
   过渡动画
   ───────────────────────────────────────────────────────────────────────────── */

.notification-fade-enter-active {
  animation: notifEnter 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.notification-fade-leave-active {
  animation: notifLeave 0.25s ease-out;
}

@keyframes notifEnter {
  from {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes notifLeave {
  to {
    opacity: 0;
    transform: translateY(5px) scale(0.98);
  }
}

.ai-panel-slide-enter-active {
  animation: panelEnter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.ai-panel-slide-leave-active {
  animation: panelLeave 0.25s ease-in;
}

@keyframes panelEnter {
  from {
    opacity: 0;
    transform: translateX(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes panelLeave {
  to {
    opacity: 0;
    transform: translateX(20px) scale(0.98);
  }
}

.message-flow-enter-active {
  animation: messageSlide 0.35s ease-out;
}

.message-flow-leave-active {
  animation: messageSlide 0.2s ease-in reverse;
}

/* ─────────────────────────────────────────────────────────────────────────────
   响应式
   ───────────────────────────────────────────────────────────────────────────── */

@media (min-width: 1400px) {
  .review-right-panel {
    width: 260px;
  }

  .ai-panel-overlay {
    padding-right: 280px;
  }
}

@media (max-width: 1200px) {
  .review-right-panel {
    width: 200px;
  }

  .ai-panel-overlay {
    padding-right: 220px;
  }

  .ai-panel {
    width: 380px;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端样式
   ═══════════════════════════════════════════════════════════════════════════ */

.review-right-panel.is-mobile {
  position: fixed;
  top: auto;
  right: auto;
  /* 定位在按钮栏上方 */
  bottom: calc(var(--button-bar-height-mobile) + env(safe-area-inset-bottom) + 12px);
  left: 12px;
  width: auto;
  height: auto;
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  z-index: 150;
}

/* 拼写模式：定位在虚拟键盘 + 固定输入框上方 */
.review-right-panel.is-mobile.is-spelling {
  bottom: calc(var(--spelling-keyboard-height, 260px) + var(--spelling-input-height, 0px) + 12px);
}

/* 移动端控制栏 */
.mobile-control-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* 通知徽章 */
.mobile-notif-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: var(--primitive-paper-100);
  border: 1px solid var(--primitive-paper-400);
  border-radius: var(--radius-full);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.25s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.mobile-notif-badge:active {
  transform: scale(0.96);
}

.mobile-notif-badge.badge-positive {
  border-color: var(--primitive-olive-300);
}

.mobile-notif-badge.badge-negative {
  border-color: var(--primitive-brick-300);
}

.badge-word {
  font-family: var(--font-serif);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--primitive-ink-700);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-change {
  font-family: var(--font-data);
  font-size: 0.8rem;
  font-weight: 700;
}

.badge-change.change--positive {
  color: var(--primitive-olive-600);
}

.badge-change.change--negative {
  color: var(--primitive-brick-600);
}

.badge-change.change--neutral {
  color: var(--primitive-gold-600);
}

/* Lapse 模式徽章 */
.mobile-lapse-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: linear-gradient(145deg,
    rgba(45, 55, 72, 0.95),
    rgba(26, 32, 44, 0.92)
  );
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-full);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: all 0.25s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  color: var(--primitive-paper-100);
}

.mobile-lapse-badge:active {
  transform: scale(0.96);
}

.mobile-lapse-badge .badge-word {
  color: var(--primitive-paper-100);
}

.mobile-lapse-badge.badge-correct {
  border-color: rgba(127, 209, 127, 0.3);
}

.mobile-lapse-badge.badge-wrong {
  border-color: rgba(255, 155, 155, 0.3);
}

.mobile-lapse-badge.badge-graduated {
  border-color: rgba(255, 215, 122, 0.3);
}

.lapse-badge-level {
  font-family: var(--font-data);
  font-size: 0.75rem;
  font-weight: 600;
  opacity: 0.8;
}

/* AI 助手按钮 */
.mobile-ai-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 0.875rem;
  background: linear-gradient(145deg,
    var(--primitive-copper-400),
    var(--primitive-copper-500)
  );
  border: none;
  border-radius: var(--radius-full);
  color: var(--primitive-paper-100);
  box-shadow: 0 4px 16px rgba(153, 107, 61, 0.3);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.mobile-ai-btn:active {
  transform: scale(0.96);
}

.mobile-ai-btn.is-active {
  background: linear-gradient(145deg,
    var(--primitive-copper-500),
    var(--primitive-gold-600)
  );
}

.ai-btn-icon {
  display: inline-flex;
  align-items: center;
}

.ai-btn-icon .icon {
  width: 14px;
  height: 14px;
}

.ai-btn-label {
  font-family: var(--font-ui);
  font-size: 0.85rem;
  font-weight: 600;
}

/* ─────────────────────────────────────────────────────────────────────────────
   移动端通知面板
   ───────────────────────────────────────────────────────────────────────────── */

.mobile-notif-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 1rem;
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}

.mobile-notif-panel {
  width: 100%;
  max-width: 400px;
  background: linear-gradient(145deg,
    rgba(58, 50, 42, 0.95),
    rgba(42, 36, 30, 0.92)
  );
  border-radius: var(--radius-xl);
  padding: 1.25rem;
  color: var(--primitive-paper-100);
  box-shadow:
    0 10px 40px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 253, 247, 0.06);
  border: 1px solid rgba(255, 253, 247, 0.06);
}

.mobile-notif-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.notif-header-word {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 600;
}

.notif-close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: var(--primitive-paper-100);
  cursor: pointer;
}

.notif-close-btn svg {
  width: 18px;
  height: 18px;
}

.mobile-notif-main {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.notif-param-label {
  font-size: 0.85rem;
  opacity: 0.8;
}

.notif-param-change {
  font-size: 2rem;
  font-weight: 700;
  font-family: var(--font-data);
}

.mobile-notif-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.375rem 0;
  font-size: 0.8rem;
}

.detail-label {
  opacity: 0.7;
}

.detail-value {
  font-weight: 600;
  font-family: var(--font-data);
}

.mobile-notif-score {
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
}

.score-header {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.score-label {
  font-size: 0.7rem;
  opacity: 0.7;
}

.score-value {
  font-size: 1.5rem;
  font-weight: 700;
  font-family: var(--font-data);
}

.score-time {
  font-size: 0.7rem;
  opacity: 0.7;
}

.score-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  overflow: hidden;
}

.score-bar .bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease, background 0.3s ease;
}

.spell-bar .bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.mobile-spelling-scores {
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.spell-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.spell-name {
  font-size: 0.7rem;
  opacity: 0.8;
}

.spell-bar {
  height: 5px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  overflow: hidden;
}

.spell-bar .bar-fill {
  background: var(--gradient-success);
}

.mobile-notif-forgot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(255, 155, 155, 0.15);
  border-radius: var(--radius-sm);
}

.forgot-icon {
  display: inline-flex;
  align-items: center;
  color: #FF9B9B;
}

.forgot-icon .icon {
  width: 14px;
  height: 14px;
}

.forgot-text {
  font-size: 0.9rem;
  color: #FF9B9B;
  font-weight: 500;
}

/* ─────────────────────────────────────────────────────────────────────────────
   移动端 Lapse 追踪面板
   ───────────────────────────────────────────────────────────────────────────── */

.mobile-lapse-panel {
  width: 100%;
  max-width: 400px;
  background: linear-gradient(145deg,
    rgba(58, 50, 42, 0.95),
    rgba(42, 36, 30, 0.92)
  );
  border-radius: var(--radius-xl);
  padding: 1.25rem;
  color: var(--primitive-paper-100);
  box-shadow:
    0 10px 40px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 253, 247, 0.06);
  border: 1px solid rgba(255, 253, 247, 0.06);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.mobile-lapse-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lapse-header-word {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 600;
}

.lapse-header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.mobile-lapse-header .lapse-result-badge {
  font-size: 0.75rem;
  padding: 0.2rem 0.6rem;
}

.mobile-lapse-reaction,
.mobile-lapse-gap {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.mobile-lapse-reaction .reaction-value {
  font-size: 1.4rem;
}

.mobile-lapse-reaction .reaction-hint {
  font-size: 0.7rem;
}

.mobile-lapse-gap .step-dot {
  width: 16px;
  height: 16px;
}

.mobile-lapse-gap .gap-segment {
  margin-top: 7px; /* 16px / 2 - 2px / 2 = 7px */
  margin-inline: 4px;
}

.mobile-lapse-gap .step-gap {
  font-size: 0.65rem;
}

/* ─────────────────────────────────────────────────────────────────────────────
   移动端 AI 面板
   ───────────────────────────────────────────────────────────────────────────── */

.mobile-ai-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 1000;
}

.mobile-ai-panel {
  position: absolute;
  inset: 0;
  background: var(--primitive-paper-100);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mobile-ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--primitive-paper-400);
  background: linear-gradient(to bottom,
    var(--primitive-paper-100),
    var(--primitive-paper-200)
  );
}

.mobile-ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: linear-gradient(to bottom,
    var(--primitive-paper-200),
    var(--primitive-paper-100) 30%
  );
  -webkit-overflow-scrolling: touch;
}

.mobile-ai-suggestions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border-top: 1px solid var(--primitive-paper-300);
  flex-shrink: 0;
}

.mobile-ai-input-area {
  padding: 0.75rem 1rem;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
  background: var(--primitive-paper-100);
  border-top: 1px solid var(--primitive-paper-400);
}

/* ─────────────────────────────────────────────────────────────────────────────
   移动端过渡动画
   ───────────────────────────────────────────────────────────────────────────── */

.mobile-notif-slide-enter-active {
  animation: mobileNotifEnter 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.mobile-notif-slide-leave-active {
  animation: mobileNotifLeave 0.25s ease-in;
}

@keyframes mobileNotifEnter {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes mobileNotifEnter {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.mobile-notif-slide-enter-active .mobile-notif-panel {
  animation: notifPanelEnter 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.mobile-notif-slide-leave-active .mobile-notif-panel {
  animation: notifPanelLeave 0.25s ease-in;
}

@keyframes notifPanelEnter {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes notifPanelLeave {
  to {
    opacity: 0;
    transform: translateY(50%);
  }
}

@keyframes mobileNotifLeave {
  to {
    opacity: 0;
  }
}

.mobile-ai-slide-enter-active {
  animation: mobileAIEnter 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.mobile-ai-slide-leave-active {
  animation: mobileAILeave 0.25s ease-in;
}

@keyframes mobileAIEnter {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes mobileAILeave {
  to {
    opacity: 0;
    transform: translateY(100%);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   滚动条样式
   ───────────────────────────────────────────────────────────────────────────── */

.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: var(--primitive-copper-300);
  border-radius: 2px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: var(--primitive-copper-400);
}
</style>

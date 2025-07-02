<script setup lang="ts">
/**
 * UserProfile — 藏书票风格的用户头像 + 退出菜单
 * 设计灵感：古典藏书票（Ex Libris）、火漆印章
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuth } from '@/shared/composables/useAuth'
import AppIcon from '@/shared/components/controls/Icons.vue'

interface Props {
  expanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  expanded: false
})

const { userEmail, userAvatarUrl, userName, signOut } = useAuth()

const showPopover = ref(false)
const loggingOut = ref(false)

// 动态计算 popover 位置
const popoverStyle = computed(() => {
  // 桌面端：固定在导航栏旁边
  // 移动端：居中显示
  if (typeof window !== 'undefined' && window.innerWidth <= 768) {
    return {}
  }
  return {
    bottom: '20px',
    left: '64px'
  }
})

function togglePopover() {
  showPopover.value = !showPopover.value
}

async function handleSignOut() {
  loggingOut.value = true
  try {
    await signOut()
    window.location.href = '/login'
  } catch {
    loggingOut.value = false
  }
}

// ESC 键关闭
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && showPopover.value) {
    showPopover.value = false
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="user-profile" @click.stop>
    <!-- 头像按钮 - 藏书票风格 -->
    <button
      class="avatar-btn"
      :class="{ expanded: props.expanded }"
      @click="togglePopover"
      :title="userName"
    >
      <span class="avatar-frame">
        <img
          v-if="userAvatarUrl"
          :src="userAvatarUrl"
          :alt="userName"
          class="avatar-img"
          referrerpolicy="no-referrer"
        />
        <span v-else class="avatar-fallback">
          {{ (userName || userEmail || '?').charAt(0).toUpperCase() }}
        </span>
      </span>
      <span class="avatar-ring"></span>
    </button>

    <!-- 用户名（展开时显示，v-show 与其他 nav label 保持一致，避免 DOM 插入闪烁） -->
    <transition name="name-slide">
      <span v-show="props.expanded" class="user-name-inline">
        {{ userName || userEmail?.split('@')[0] || '用户' }}
      </span>
    </transition>

    <!-- 藏书票式 Popover -->
    <Teleport to="body">
      <Transition name="popover-appear">
        <div
          v-if="showPopover"
          class="popover-overlay"
          @click="showPopover = false"
        >
          <div
            class="bookplate-popover"
            :style="popoverStyle"
            @click.stop
          >
            <!-- 装饰边框 -->
            <div class="bookplate-border">
              <div class="border-corner border-corner--tl"></div>
              <div class="border-corner border-corner--tr"></div>
              <div class="border-corner border-corner--bl"></div>
              <div class="border-corner border-corner--br"></div>
            </div>

            <!-- 顶部装饰 -->
            <div class="bookplate-header">
              <span class="header-flourish">我的账户</span>
            </div>

            <!-- 用户信息 -->
            <div class="bookplate-content">
              <div class="user-avatar-large">
                <img
                  v-if="userAvatarUrl"
                  :src="userAvatarUrl"
                  :alt="userName"
                  class="avatar-large-img"
                  referrerpolicy="no-referrer"
                />
                <span v-else class="avatar-large-fallback">
                  {{ (userName || '?').charAt(0).toUpperCase() }}
                </span>
              </div>
              <span class="user-name">{{ userName }}</span>
              <span class="user-email">{{ userEmail }}</span>
            </div>

            <!-- 分隔装饰 -->
            <div class="bookplate-divider">
              <span class="divider-ornament"><AppIcon name="sparkle" /></span>
            </div>

            <!-- 退出按钮 -->
            <button
              class="signout-btn"
              :disabled="loggingOut"
              @click="handleSignOut"
            >
              <svg class="signout-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span class="signout-text">{{ loggingOut ? '退出中...' : '退出登录' }}</span>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   UserProfile - 藏书票风格
   灵感：Ex Libris 藏书票、火漆印章、古典铜版画
   ═══════════════════════════════════════════════════════════════════════════ */

.user-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   头像按钮 - 印章风格
   ═══════════════════════════════════════════════════════════════════════════ */

.avatar-btn {
  position: relative;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.avatar-btn:hover {
  transform: scale(1.08);
}

.avatar-btn:active {
  transform: scale(0.95);
}

/* expanded 状态保持同尺寸，避免展开时跳变 */

/* 头像外框 */
.avatar-frame {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--primitive-copper-400);
  background: var(--primitive-paper-100);
  box-shadow:
    0 2px 8px rgba(139, 105, 20, 0.15),
    inset 0 1px 2px rgba(255, 255, 255, 0.5);
  z-index: 2;
}

/* 装饰性外环 */
.avatar-ring {
  position: absolute;
  inset: -3px;
  border: 1px dashed var(--primitive-copper-300);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;
  z-index: 1;
}

.avatar-btn:hover .avatar-ring {
  opacity: 1;
  animation: ring-rotate 12s linear infinite;
}

@keyframes ring-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-family: 'Crimson Pro', Georgia, serif;
  font-size: 16px;
  font-weight: 700;
  color: var(--primitive-copper-600);
  background: linear-gradient(135deg, var(--primitive-paper-100) 0%, var(--primitive-paper-200) 100%);
}

/* 展开时的用户名 */
.user-name-inline {
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 500;
  color: var(--primitive-ink-600);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.name-slide-enter-active {
  transition: opacity 0.3s ease 0.1s, transform 0.3s ease 0.1s;
}

.name-slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.name-slide-enter-from {
  opacity: 0;
  transform: translateX(-8px);
}

.name-slide-leave-to {
  opacity: 0;
  transform: translateX(-4px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Popover 遮罩层
   ═══════════════════════════════════════════════════════════════════════════ */

.popover-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(2px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   藏书票风格 Popover
   ═══════════════════════════════════════════════════════════════════════════ */

.bookplate-popover {
  position: fixed;
  width: 240px;
  padding: 24px 20px;
  background:
    linear-gradient(135deg, rgba(255, 253, 247, 0.98) 0%, rgba(250, 247, 242, 0.99) 100%);
  border-radius: 4px;
  box-shadow:
    0 12px 40px rgba(139, 105, 20, 0.15),
    0 4px 12px rgba(0, 0, 0, 0.08),
    inset 0 0 40px rgba(139, 105, 20, 0.02);
  text-align: center;
  z-index: 201;
}

/* 装饰边框 */
.bookplate-border {
  position: absolute;
  inset: 8px;
  border: 1px solid var(--primitive-copper-200);
  border-radius: 2px;
  pointer-events: none;
}

.border-corner {
  position: absolute;
  width: 12px;
  height: 12px;
  border-color: var(--primitive-copper-400);
  border-style: solid;
  border-width: 0;
}

.border-corner--tl {
  top: -1px;
  left: -1px;
  border-top-width: 2px;
  border-left-width: 2px;
}

.border-corner--tr {
  top: -1px;
  right: -1px;
  border-top-width: 2px;
  border-right-width: 2px;
}

.border-corner--bl {
  bottom: -1px;
  left: -1px;
  border-bottom-width: 2px;
  border-left-width: 2px;
}

.border-corner--br {
  bottom: -1px;
  right: -1px;
  border-bottom-width: 2px;
  border-right-width: 2px;
}

/* 顶部装饰 */
.bookplate-header {
  margin-bottom: 16px;
}

.header-flourish {
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  color: var(--primitive-copper-500);
  letter-spacing: 0.08em;
}

/* 用户信息区 */
.bookplate-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.user-avatar-large {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--primitive-copper-400);
  box-shadow:
    0 4px 12px rgba(139, 105, 20, 0.12),
    inset 0 2px 4px rgba(255, 255, 255, 0.5);
  margin-bottom: 4px;
}

.avatar-large-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-large-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-family: 'Crimson Pro', Georgia, serif;
  font-size: 24px;
  font-weight: 700;
  color: var(--primitive-copper-600);
  background: linear-gradient(135deg, var(--primitive-paper-100) 0%, var(--primitive-paper-200) 100%);
}

.user-name {
  font-family: 'Crimson Pro', Georgia, serif;
  font-size: 16px;
  font-weight: 600;
  color: var(--primitive-ink-800);
  letter-spacing: 0.02em;
}

.user-email {
  font-family: var(--font-ui);
  font-size: 11px;
  color: var(--primitive-ink-400);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 分隔装饰 */
.bookplate-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 16px 0;
}

.divider-ornament {
  display: inline-flex;
  align-items: center;
  color: var(--primitive-copper-400);
  opacity: 0.6;
}

.divider-ornament .icon {
  width: 8px;
  height: 8px;
}

/* 退出按钮 */
.signout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  border: 1px solid var(--primitive-paper-400);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: all 0.25s ease;
}

.signout-btn:hover:not(:disabled) {
  border-color: var(--primitive-brick-300);
  background: rgba(155, 59, 59, 0.04);
}

.signout-btn:hover:not(:disabled) .signout-icon {
  color: var(--primitive-brick-500);
}

.signout-btn:hover:not(:disabled) .signout-text {
  color: var(--primitive-brick-600);
}

.signout-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.signout-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.signout-icon {
  color: var(--primitive-ink-500);
  transition: color 0.25s ease;
}

.signout-text {
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  color: var(--primitive-ink-600);
  letter-spacing: 0.03em;
  transition: color 0.25s ease;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Popover 动画
   ═══════════════════════════════════════════════════════════════════════════ */

.popover-appear-enter-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.popover-appear-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.popover-appear-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(8px);
}

.popover-appear-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(4px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   响应式 - 移动端
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .user-profile {
    padding: 4px 0;
  }

  .avatar-btn {
    width: 24px;
    height: 24px;
  }

  .avatar-frame {
    border-width: 1.5px;
  }

  .avatar-ring {
    display: none;
  }

  .avatar-fallback {
    font-size: 12px;
  }

  .user-name-inline {
    display: none;
  }

  /* 移动端 popover 居中 */
  .bookplate-popover {
    top: 50% !important;
    left: 50% !important;
    bottom: auto !important;
    transform: translate(-50%, -50%);
    width: calc(100vw - 48px);
    max-width: 300px;
    padding: 28px 24px;
  }

  .popover-appear-enter-from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }

  .popover-appear-leave-to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.95);
  }

  .popover-appear-enter-active,
  .popover-appear-leave-active {
    transform-origin: center center;
  }

  .user-avatar-large {
    width: 48px;
    height: 48px;
  }

  .avatar-large-fallback {
    font-size: 20px;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   减少动画偏好
   ═══════════════════════════════════════════════════════════════════════════ */

@media (prefers-reduced-motion: reduce) {
  .avatar-btn,
  .avatar-ring,
  .signout-btn {
    transition: none;
  }

  .avatar-btn:hover .avatar-ring {
    animation: none;
    opacity: 1;
  }

  .popover-appear-enter-active,
  .popover-appear-leave-active,
  .name-slide-enter-active,
  .name-slide-leave-active {
    transition: opacity 0.1s ease;
  }

  .popover-appear-enter-from,
  .popover-appear-leave-to {
    transform: none;
  }
}
</style>

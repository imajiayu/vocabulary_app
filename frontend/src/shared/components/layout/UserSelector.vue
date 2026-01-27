<script setup lang="ts">
/**
 * 用户选择器 - 藏书票/印章风格
 * 以中国传统印章形式展示"马"和"苗"两个用户
 */
import { ref } from 'vue'
import { useUserSelection } from '@/shared/composables/useUserSelection'

interface Props {
  expanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  expanded: false
})

const { currentUserId, validUserIds, switchUser, getUserName } = useUserSelection()

// 切换动画状态
const isStamping = ref(false)

const handleSwitch = (userId: number) => {
  if (userId === currentUserId.value) return

  // 触发印章盖下动画
  isStamping.value = true

  setTimeout(() => {
    switchUser(userId as 1 | 2)
  }, 300)
}
</script>

<template>
  <div class="user-stamps" :class="{ expanded: props.expanded }">
    <!-- 印章容器 -->
    <div class="stamps-row">
      <button
        v-for="userId in validUserIds"
        :key="userId"
        class="stamp-seal"
        :class="{
          active: currentUserId === userId,
          stamping: isStamping && currentUserId !== userId
        }"
        @click="handleSwitch(userId)"
        :title="`切换到「${getUserName(userId)}」`"
        :aria-label="`切换到${getUserName(userId)}`"
        :aria-pressed="currentUserId === userId"
      >
        <span class="seal-character">{{ getUserName(userId) }}</span>
        <span class="seal-border"></span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   藏书票/印章风格用户选择器
   灵感：中国传统篆刻印章、藏书票、书法
   ═══════════════════════════════════════════════════════════════════════════ */

.user-stamps {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
}

.stamps-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ── 印章按钮 ── */
.stamp-seal {
  position: relative;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.stamp-seal:hover {
  transform: scale(1.08);
}

.stamp-seal:active {
  transform: scale(0.95);
}

/* ── 印章边框 ── */
.seal-border {
  position: absolute;
  inset: 0;
  border: 2px solid var(--primitive-paper-500);
  border-radius: 4px;
  transition: all 0.3s ease;
  /* 印章的不规则感 */
  clip-path: polygon(
    2% 0%, 98% 0%, 100% 2%, 100% 98%,
    98% 100%, 2% 100%, 0% 98%, 0% 2%
  );
}

/* ── 印章文字 ── */
.seal-character {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-family: "Noto Serif SC", "Songti SC", "SimSun", serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--primitive-paper-500);
  transition: all 0.3s ease;
  /* 篆刻感 */
  text-shadow: none;
}

/* ═══════════════════════════════════════════════════════════════════════════
   非活动状态 - 未盖的印章（淡色轮廓）
   ═══════════════════════════════════════════════════════════════════════════ */

.stamp-seal:not(.active) {
  opacity: 0.5;
}

.stamp-seal:not(.active):hover {
  opacity: 0.8;
}

.stamp-seal:not(.active) .seal-border {
  border-style: dashed;
  border-color: var(--primitive-ink-300);
}

.stamp-seal:not(.active) .seal-character {
  color: var(--primitive-ink-400);
}

/* ═══════════════════════════════════════════════════════════════════════════
   活动状态 - 已盖的印章（朱红色、有质感）
   ═══════════════════════════════════════════════════════════════════════════ */

.stamp-seal.active {
  opacity: 1;
}

.stamp-seal.active .seal-border {
  border-color: #b8433e;
  background: linear-gradient(
    135deg,
    rgba(184, 67, 62, 0.12) 0%,
    rgba(184, 67, 62, 0.08) 100%
  );
  box-shadow:
    0 1px 3px rgba(184, 67, 62, 0.2),
    inset 0 0 0 1px rgba(184, 67, 62, 0.1);
}

.stamp-seal.active .seal-character {
  color: #b8433e;
  /* 印泥的轻微渗透效果 */
  text-shadow:
    0 0 1px rgba(184, 67, 62, 0.3),
    0 0 2px rgba(184, 67, 62, 0.1);
  /* 印章的微微不规则感 */
  filter: url(#seal-texture);
}

/* ═══════════════════════════════════════════════════════════════════════════
   印章盖下动画
   ═══════════════════════════════════════════════════════════════════════════ */

.stamp-seal.stamping {
  animation: stamp-down 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes stamp-down {
  0% {
    transform: scale(1) translateY(0);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.15) translateY(-2px);
    opacity: 0.8;
  }
  100% {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   展开状态
   ═══════════════════════════════════════════════════════════════════════════ */

.user-stamps.expanded {
  padding: 8px 12px;
}

.user-stamps.expanded .stamps-row {
  flex-direction: row;
  gap: 8px;
}

.user-stamps.expanded .stamp-seal {
  width: 36px;
  height: 36px;
}

.user-stamps.expanded .seal-character {
  font-size: 20px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .user-stamps {
    padding: 8px 0;
  }

  .stamp-seal {
    width: 28px;
    height: 28px;
  }

  .seal-character {
    font-size: 16px;
  }

  .user-stamps.expanded .stamp-seal {
    width: 32px;
    height: 32px;
  }

  .user-stamps.expanded .seal-character {
    font-size: 18px;
  }
}

@media (max-width: 480px) {
  .user-stamps {
    padding: 6px 0;
  }

  .stamps-row {
    gap: 2px;
  }

  .stamp-seal {
    width: 24px;
    height: 24px;
  }

  .seal-character {
    font-size: 14px;
  }

  .seal-border {
    border-width: 1.5px;
  }

  .user-stamps.expanded .stamp-seal {
    width: 28px;
    height: 28px;
  }

  .user-stamps.expanded .seal-character {
    font-size: 16px;
  }

  .user-stamps.expanded .stamps-row {
    gap: 6px;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   减少动画偏好
   ═══════════════════════════════════════════════════════════════════════════ */

@media (prefers-reduced-motion: reduce) {
  .stamp-seal {
    transition: opacity 0.15s ease;
  }

  .stamp-seal:hover {
    transform: none;
  }

  .stamp-seal.stamping {
    animation: none;
  }
}
</style>

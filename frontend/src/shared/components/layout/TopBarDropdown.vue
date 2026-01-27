<template>
  <div class="topbar-dropdown" ref="dropdownRef">
    <button
      class="dropdown-toggle"
      :class="{ active: isOpen }"
      @click="toggle"
      aria-haspopup="true"
      :aria-expanded="isOpen"
    >
      <span class="toggle-icon">
        <span class="icon-line" :class="{ rotated: isOpen }"></span>
        <span class="icon-line" :class="{ hidden: isOpen }"></span>
        <span class="icon-line" :class="{ 'rotated-reverse': isOpen }"></span>
      </span>
    </button>

    <Transition name="dropdown-reveal">
      <div v-if="isOpen" class="dropdown-menu" role="menu">
        <!-- 装饰性顶部边框 -->
        <div class="menu-decoration"></div>

        <button
          v-for="(item, index) in items"
          :key="item.key"
          class="dropdown-item"
          :class="{ disabled: item.disabled }"
          :disabled="item.disabled"
          :style="{ '--item-index': index }"
          role="menuitem"
          @click="handleItemClick(item)"
        >
          <AppIcon v-if="item.icon" :name="item.icon" class="item-icon" />
          <span class="item-label">{{ item.label }}</span>
          <span class="item-arrow">→</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import AppIcon from '@/shared/components/controls/Icons.vue'

export interface DropdownItem {
  key: string
  label: string
  icon?: 'home' | 'plus-circle' | 'chart' | 'menu' | 'plus' | 'expand' | 'close' | 'delete' | 'check' | 'edit' | 'trash' | 'upload' | 'file' | 'volume' | 'eye' | 'backspace' | 'refresh' | 'alert' | 'keyboard' | 'book' | 'bookmark' | 'lightbulb' | 'shuffle' | 'pen' | 'link' | 'zap' | 'tag' | 'book-open'
  disabled?: boolean
  action: () => void
}

interface Props {
  items: DropdownItem[]
}

defineProps<Props>()

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const toggle = () => {
  isOpen.value = !isOpen.value
}

const handleItemClick = (item: DropdownItem) => {
  if (item.disabled) return
  isOpen.value = false
  item.action()
}

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   TopBar Dropdown - 编辑室风格下拉菜单
   ═══════════════════════════════════════════════════════════════════════════ */

.topbar-dropdown {
  position: relative;
}

/* ── 触发按钮 ── */
.dropdown-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--primitive-paper-400);
  background: var(--primitive-paper-50);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.dropdown-toggle:hover {
  background: var(--primitive-paper-100);
  border-color: var(--primitive-copper-200);
}

.dropdown-toggle.active {
  background: var(--primitive-copper-100);
  border-color: var(--primitive-copper-300);
}

/* ── 汉堡图标动画 ── */
.toggle-icon {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
  width: 16px;
  height: 16px;
}

.icon-line {
  width: 100%;
  height: 2px;
  background: var(--primitive-copper-500);
  border-radius: 1px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: center;
}

.icon-line.rotated {
  transform: translateY(6px) rotate(45deg);
}

.icon-line.hidden {
  opacity: 0;
  transform: scaleX(0);
}

.icon-line.rotated-reverse {
  transform: translateY(-6px) rotate(-45deg);
}

/* ── 下拉菜单 ── */
.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 160px;
  background: var(--primitive-paper-50);
  border: 1px solid var(--primitive-paper-400);
  border-radius: var(--radius-md);
  box-shadow:
    0 8px 24px rgba(139, 105, 20, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  z-index: 10001;
}

/* 装饰性顶部边框 */
.menu-decoration {
  height: 2px;
  background: linear-gradient(
    90deg,
    var(--primitive-copper-300),
    var(--primitive-gold-400),
    var(--primitive-copper-300)
  );
}

/* ── 菜单项 ── */
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: var(--primitive-ink-700);
  font-family: var(--font-ui);
  font-size: 0.875rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  position: relative;
}

.dropdown-item:not(:last-child)::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 1rem;
  right: 1rem;
  height: 1px;
  background: var(--primitive-paper-300);
}

.dropdown-item:hover:not(.disabled) {
  background: var(--primitive-paper-200);
  color: var(--primitive-copper-700);
}

.dropdown-item:active:not(.disabled) {
  background: var(--primitive-paper-300);
}

.dropdown-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 图标 */
.item-icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  fill: currentColor;
}

/* 标签 */
.item-label {
  flex: 1;
}

/* 箭头 */
.item-arrow {
  font-size: 0.75rem;
  color: var(--primitive-ink-400);
  opacity: 0;
  transform: translateX(-4px);
  transition: all 0.2s ease;
}

.dropdown-item:hover:not(.disabled) .item-arrow {
  opacity: 1;
  transform: translateX(0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   下拉动画
   ═══════════════════════════════════════════════════════════════════════════ */

.dropdown-reveal-enter-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-reveal-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-reveal-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.96);
}

.dropdown-reveal-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

/* 菜单项交错动画 */
.dropdown-reveal-enter-active .dropdown-item {
  animation: item-slide-in 0.3s ease forwards;
  animation-delay: calc(var(--item-index) * 0.05s);
  opacity: 0;
}

@keyframes item-slide-in {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   响应式适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 480px) {
  .dropdown-toggle {
    width: 32px;
    height: 32px;
  }

  .toggle-icon {
    width: 14px;
    height: 14px;
    gap: 3px;
  }

  .icon-line {
    height: 1.5px;
  }

  .icon-line.rotated {
    transform: translateY(4.5px) rotate(45deg);
  }

  .icon-line.rotated-reverse {
    transform: translateY(-4.5px) rotate(-45deg);
  }

  .dropdown-menu {
    min-width: 140px;
  }

  .dropdown-item {
    padding: 0.625rem 0.875rem;
    font-size: 0.8125rem;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   无障碍支持
   ═══════════════════════════════════════════════════════════════════════════ */

@media (prefers-reduced-motion: reduce) {
  .dropdown-toggle,
  .icon-line,
  .dropdown-item,
  .item-arrow {
    transition: none;
  }

  .dropdown-reveal-enter-active,
  .dropdown-reveal-leave-active {
    transition: none;
  }

  .dropdown-reveal-enter-active .dropdown-item {
    animation: none;
    opacity: 1;
  }
}
</style>

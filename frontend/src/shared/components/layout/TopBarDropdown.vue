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
  icon?: 'menu' | 'home' | 'plus-circle' | 'chart' | 'plus' | 'expand' | 'close' | 'delete' | 'check' | 'edit' | 'trash' | 'upload' | 'file' | 'volume' | 'eye' | 'backspace' | 'refresh' | 'alert' | 'keyboard' | 'book' | 'lightbulb' | 'shuffle' | 'pen' | 'book-open' | 'mic' | 'settings'
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
   TopBar Dropdown - 紧凑型移动端菜单
   设计理念：最小化、功能性、不占用过多视觉空间
   ═══════════════════════════════════════════════════════════════════════════ */

/* 容器：使用 inline-flex 防止被父容器拉伸 */
.topbar-dropdown {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  /* 不设置高度，让内容决定 */
}

/* 触发按钮：紧凑的圆角方形 */
.dropdown-toggle {
  /* 使用 inline-flex 确保尺寸由内容决定 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* 移动端紧凑尺寸 */
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  max-width: 28px;
  max-height: 28px;
  /* 重置所有可能的间距 */
  padding: 0;
  margin: 0;
  /* 视觉样式 */
  border: 1px solid var(--primitive-paper-400);
  background: var(--primitive-paper-50);
  border-radius: 6px;
  /* 交互 */
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  /* 过渡 */
  transition: background 0.15s ease, border-color 0.15s ease;
}

.dropdown-toggle:hover {
  background: var(--primitive-paper-100);
  border-color: var(--primitive-copper-200);
}

.dropdown-toggle:active,
.dropdown-toggle.active {
  background: var(--primitive-copper-50);
  border-color: var(--primitive-copper-300);
}

/* 汉堡图标 */
.toggle-icon {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2.5px;
  width: 12px;
  height: 12px;
}

.icon-line {
  width: 100%;
  height: 1.5px;
  background: var(--primitive-copper-500);
  border-radius: 1px;
  transition: transform 0.2s ease, opacity 0.2s ease;
  transform-origin: center;
}

.icon-line.rotated {
  transform: translateY(4px) rotate(45deg);
}

.icon-line.hidden {
  opacity: 0;
  transform: scaleX(0);
}

.icon-line.rotated-reverse {
  transform: translateY(-4px) rotate(-45deg);
}

/* ═══════════════════════════════════════════════════════════════════════════
   下拉菜单
   ═══════════════════════════════════════════════════════════════════════════ */

.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 140px;
  background: var(--primitive-paper-50);
  border: 1px solid var(--primitive-paper-400);
  border-radius: 8px;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.08),
    0 2px 4px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  z-index: 10001;
}

.menu-decoration {
  height: 2px;
  background: linear-gradient(
    90deg,
    var(--primitive-copper-300),
    var(--primitive-gold-400),
    var(--primitive-copper-300)
  );
}

/* 菜单项 */
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: none;
  background: transparent;
  color: var(--primitive-ink-700);
  font-family: var(--font-ui);
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;
  -webkit-tap-highlight-color: transparent;
  position: relative;
}

.dropdown-item:not(:last-child)::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0.75rem;
  right: 0.75rem;
  height: 1px;
  background: var(--primitive-paper-300);
}

.dropdown-item:hover:not(.disabled) {
  background: var(--primitive-paper-200);
}

.dropdown-item:active:not(.disabled) {
  background: var(--primitive-paper-300);
}

.dropdown-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.item-icon {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
  fill: currentColor;
}

.item-label {
  flex: 1;
}

.item-arrow {
  font-size: 0.625rem;
  color: var(--primitive-ink-400);
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-item:hover:not(.disabled) .item-arrow {
  opacity: 1;
  transform: translateX(0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   动画
   ═══════════════════════════════════════════════════════════════════════════ */

.dropdown-reveal-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-reveal-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.dropdown-reveal-enter-from,
.dropdown-reveal-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   无障碍
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
}
</style>

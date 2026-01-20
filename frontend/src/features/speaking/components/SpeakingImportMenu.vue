<template>
  <div v-if="show" class="import-menu">
    <button @click="emit('import', 1)" class="menu-item">
      <AppIcon name="file" class="menu-icon" />
      <span>导入 Part 1</span>
    </button>
    <button @click="emit('import', 2)" class="menu-item">
      <AppIcon name="file" class="menu-icon" />
      <span>导入 Part 2&3</span>
    </button>
    <div class="menu-hint">
      <div class="hint-title">文件格式说明：</div>
      <div class="hint-item">• 文件类型：.txt (UTF-8编码)</div>
      <div class="hint-item">• 第一行是主题名称</div>
      <div class="hint-item">• 接下来几行是问题</div>
      <div class="hint-item">• 主题之间用空行分隔</div>
      <div class="hint-example">
        <div class="example-title">示例：</div>
        <div class="example-content">
          Work<br>Do you work or study?<br>What do you do?<br><br>Hometown<br>Where are you from?<br>Do you like your hometown?
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '@/shared/components/controls/Icons.vue'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'import', part: 1 | 2): void
}>()
</script>

<style scoped>
.import-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: var(--spacing-sm);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-default);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 1000;
  min-width: 280px;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0.75rem 1rem;
  border: none;
  background: var(--color-bg-primary);
  cursor: pointer;
  transition: background 0.2s ease;
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
}

.menu-item:hover {
  background: var(--color-purple-light);
}

.menu-icon {
  width: 1rem;
  height: 1rem;
  color: var(--color-purple);
}

.menu-hint {
  padding: 0.75rem 1rem;
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border-light);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.hint-title {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.hint-item {
  margin-bottom: 0.25rem;
  padding-left: 0.5rem;
}

.hint-example {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.example-title {
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.5rem;
}

.example-content {
  padding: 0.5rem;
  background: white;
  border-radius: 0.25rem;
  border: 1px solid rgba(0, 0, 0, 0.1);
  font-family: monospace;
  font-size: 0.7rem;
  line-height: 1.6;
  color: #334155;
}

@media (max-width: 480px) {
  .import-menu {
    right: 0;
    left: auto;
  }
}
</style>

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
  margin-top: 0.5rem;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 1000;
  min-width: 280px;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  background: white;
  cursor: pointer;
  transition: background 0.2s ease;
  font-size: 0.875rem;
  color: #374151;
}

.menu-item:hover {
  background: rgba(102, 126, 234, 0.1);
}

.menu-icon {
  width: 1rem;
  height: 1rem;
  color: #667eea;
}

.menu-hint {
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.5;
}

.hint-title {
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.5rem;
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

@media (max-width: 768px) {
  .import-menu {
    right: 0;
    left: auto;
  }
}
</style>

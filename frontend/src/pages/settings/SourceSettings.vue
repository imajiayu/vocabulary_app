<template>
  <section id="sources" class="settings-section">
    <h1 class="section-title">词汇来源设置</h1>
    <p class="section-description">管理自定义的词汇来源（最少1个，最多3个）</p>

    <div class="settings-group">
      <!-- 当前 Sources 列表 -->
      <div class="sources-list">
        <div
          v-for="(source, index) in localSources"
          :key="index"
          class="source-item"
        >
          <div class="source-info">
            <span class="source-name">{{ source }}</span>
            <span class="source-count">{{ sourceStats[source] || 0 }} 个单词</span>
          </div>
          <button
            class="btn-delete"
            :disabled="localSources.length <= 1 || isDeleting"
            @click="confirmDelete(source)"
          >
            🗑️ 删除
          </button>
        </div>
      </div>

      <!-- 添加新 Source -->
      <div class="add-source-section">
        <input
          v-model="newSourceName"
          type="text"
          placeholder="输入新的来源名称（如 TOEFL）"
          maxlength="20"
          :disabled="localSources.length >= 3 || isAdding"
          @keyup.enter="addSource"
        />
        <button
          class="btn-add"
          :disabled="!canAddSource || isAdding"
          @click="addSource"
        >
          <span v-if="!isAdding">➕ 添加来源</span>
          <span v-else>⏳ 添加中...</span>
        </button>
      </div>

      <p class="hint">
        ⚠️ 提示：删除来源会同时删除该来源的所有单词及相关记录，操作不可撤销！
      </p>
    </div>

    <!-- 成功提示 -->
    <transition name="fade">
      <div v-if="successMessage" class="save-success">
        ✅ {{ successMessage }}
      </div>
    </transition>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '@/shared/api'
import { useSettings } from '@/shared/composables/useSettings'
import { logger } from '@/shared/utils/logger'

interface Emits {
  (e: 'save-success'): void
}

const emit = defineEmits<Emits>()

const { updateSettings } = useSettings()

const localSources = ref<string[]>([])
const sourceStats = ref<Record<string, number>>({})
const newSourceName = ref('')
const isAdding = ref(false)
const isDeleting = ref(false)
const successMessage = ref('')

const canAddSource = computed(() => {
  const name = newSourceName.value.trim()
  return (
    name.length > 0 &&
    localSources.value.length < 3 &&
    !localSources.value.includes(name)
  )
})

const showSuccess = (message: string) => {
  successMessage.value = message
  setTimeout(() => {
    successMessage.value = ''
  }, 3000)
}

const addSource = async () => {
  const name = newSourceName.value.trim()
  if (!canAddSource.value) return

  try {
    isAdding.value = true

    // 直接调用 API 添加 source
    const newSources = [...localSources.value, name]
    await updateSettings({
      sources: {
        customSources: newSources
      }
    })

    // 更新本地状态
    localSources.value.push(name)
    newSourceName.value = ''

    showSuccess(`已添加来源"${name}"`)
    emit('save-success')
  } catch (error: unknown) {
    logger.error('添加失败:', error)
    const message = error instanceof Error ? error.message : '请重试'
    alert(`添加失败：${message}`)
  } finally {
    isAdding.value = false
  }
}

const confirmDelete = async (source: string) => {
  const wordCount = sourceStats.value[source] || 0
  const message = `确定要删除来源"${source}"吗？\n\n这将删除 ${wordCount} 个单词及相关记录，操作不可撤销！`

  if (!confirm(message)) return

  try {
    isDeleting.value = true
    await api.config.deleteSource(source)

    // 从列表中移除
    const index = localSources.value.indexOf(source)
    if (index > -1) {
      localSources.value.splice(index, 1)
    }

    // 刷新统计
    await loadSourceStats()

    showSuccess(`已成功删除来源"${source}"`)
    emit('save-success')
  } catch (error: unknown) {
    logger.error('删除失败:', error)
    const message = error instanceof Error ? error.message : '请重试'
    alert(`删除失败：${message}`)
  } finally {
    isDeleting.value = false
  }
}

const loadSourceStats = async () => {
  try {
    sourceStats.value = await api.config.getSourcesStats()
  } catch (error) {
    logger.error('加载统计失败:', error)
  }
}

onMounted(async () => {
  const settings = await api.settings.getSettings()
  localSources.value = [...(settings.sources?.customSources || ['IELTS', 'GRE'])]
  await loadSourceStats()
})
</script>

<style scoped>
.settings-section {
  margin-bottom: 64px;
}

.section-title {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.section-description {
  font-size: 16px;
  color: var(--color-text-secondary);
  margin: 0 0 32px 0;
}

.settings-group {
  background: white;
  border-radius: var(--radius-xl);
  padding: 32px;
  margin-bottom: 24px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.sources-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.source-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

.source-item:hover {
  background: var(--color-bg-tertiary);
  border-color: rgba(102, 126, 234, 0.2);
}

.source-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.source-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.source-count {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.btn-delete {
  padding: 8px 16px;
  border: 1px solid #fee2e2;
  background: #fef2f2;
  color: #dc2626;
  border-radius: var(--radius-default);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-delete:hover:not(:disabled) {
  background: #fee2e2;
  transform: translateY(-1px);
}

.add-source-section {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.add-source-section input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-md);
  font-size: 15px;
  transition: all 0.2s;
}

.add-source-section input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.add-source-section input:disabled {
  background: var(--color-bg-tertiary);
  cursor: not-allowed;
}

.btn-add {
  padding: 12px 24px;
  background: var(--gradient-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-add:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
}

.hint {
  font-size: 13px;
  color: #92400e;
  margin: 0;
  padding: 12px;
  background: #fef3c7;
  border: 1px solid #fde047;
  border-radius: var(--radius-default);
}

.save-success {
  margin-top: 16px;
  padding: 12px 16px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: var(--radius-default);
  color: #15803d;
  font-size: 14px;
  font-weight: 500;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 480px) {
  .settings-group {
    padding: 20px 16px;
  }

  .section-title {
    font-size: 28px;
  }

  .add-source-section {
    flex-direction: column;
  }
}
</style>

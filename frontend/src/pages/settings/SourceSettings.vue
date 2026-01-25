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
          <BaseButton
            variant="danger"
            size="sm"
            :disabled="localSources.length <= 1 || isDeleting"
            @click="confirmDelete(source)"
          >
            <template #icon><BaseIcon name="Trash2" size="sm" /></template>
            删除
          </BaseButton>
        </div>
      </div>

      <!-- 添加新 Source -->
      <div class="add-source-section">
        <BaseInput
          v-model="newSourceName"
          placeholder="输入新的来源名称（如 TOEFL）"
          :disabled="localSources.length >= 3 || isAdding"
          @keyup.enter="addSource"
        />
        <BaseButton
          variant="primary"
          :disabled="!canAddSource || isAdding"
          :loading="isAdding"
          @click="addSource"
        >
          <template #icon><BaseIcon name="Plus" size="sm" /></template>
          {{ isAdding ? '添加中...' : '添加来源' }}
        </BaseButton>
      </div>

      <BaseAlert type="warning">
        提示：删除来源会同时删除该来源的所有单词及相关记录，操作不可撤销！
      </BaseAlert>
    </div>

    <!-- 成功提示 -->
    <transition name="fade">
      <BaseAlert v-if="successMessage" type="success" class="save-alert">
        {{ successMessage }}
      </BaseAlert>
    </transition>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '@/shared/api'
import { useSettings } from '@/shared/composables/useSettings'
import { logger } from '@/shared/utils/logger'
import { BaseAlert, BaseButton, BaseInput, BaseIcon } from '@/shared/components/base'

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

.add-source-section {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: flex-start;
}

.add-source-section :deep(.input-wrapper) {
  flex: 1;
}


.save-alert {
  margin-top: var(--space-4);
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

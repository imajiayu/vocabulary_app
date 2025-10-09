<template>
  <div>
    <!-- 移动端遮罩 - 点击外部区域收回抽屉 -->
    <div
      v-if="props.expanded && isMobile"
      class="overlay"
      @click="toggleSidebar"
    />

    <div class="sidebar" :class="{
      expanded: props.expanded,
      'nav-expanded': props.navExpanded
    }">
      <!-- 切换按钮 -->
      <div class="sidebar-tab" :class="{ dragging: isDragging }" @click="toggleSidebar">
        <AppIcon
          :name="props.expanded ? 'close' : 'expand'"
          :class="props.expanded ? 'icon-dark' : 'icon-light'"
          class="sidebar-arrow"
        />
      </div>

      <!-- 标题 -->
      <header class="sidebar-header">
        <h2>题目目录</h2>
        <div class="header-actions">
          <button
            class="action-btn clear-btn"
            @click="handleClearQuestions"
            :disabled="loading">
            <AppIcon name="trash" class="btn-icon" />
            <span class="tooltip">清除全部</span>
          </button>
          <button
            class="action-btn import-btn"
            @click="toggleImportMenu"
            :disabled="loading">
            <AppIcon name="upload" class="btn-icon" />
            <span class="tooltip">手动导入</span>
          </button>
          <!-- 导入菜单 -->
          <div v-if="showImportMenu" class="import-menu">
            <button @click="triggerFileInput(1)" class="menu-item">
              <AppIcon name="file" class="menu-icon" />
              <span>导入 Part 1</span>
            </button>
            <button @click="triggerFileInput(2)" class="menu-item">
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
                <div class="example-content">Work<br>Do you work or study?<br>What do you do?<br><br>Hometown<br>Where are you from?<br>Do you like your hometown?</div>
              </div>
            </div>
          </div>
          <!-- 隐藏的文件输入 -->
          <input
            ref="fileInputRef"
            type="file"
            accept=".txt"
            style="display: none"
            @change="handleFileSelected"
          />
        </div>
      </header>

      <!-- 内容 -->
      <div class="sidebar-content">
        <Loading v-if="loading" />
        <div v-else class="directory-tree">
          <PartItem
            v-for="part in partGroups"
            :key="`part-${part.number}`"
            :part="part"
            :is-expanded="expandedParts.has(part.number)"
            :expanded-topics="expandedTopics"
            :selected-question-id="props.selectQuestionId"
            @toggle-expanded="togglePart"
            @toggle-topic="toggleTopic"
            @add-topic="handleAddTopic"
            @edit-topic="handleEditTopic"
            @delete-topic="handleDeleteTopic"
            @add-question="handleAddQuestion"
            @edit-question="handleEditQuestion"
            @question-select="selectQuestion"
            @question-delete="handleDeleteQuestion"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import AppIcon from '@/shared/components/ui/Icons.vue'
import Loading from '@/shared/components/ui/Loading.vue'
import PartItem from './PartItem.vue'
import type { Question, TopicGroup, PartGroup } from '@/shared/types'
import { api } from '@/shared/api'

const props = defineProps<{ 
  selectQuestionId: number | undefined, 
  expanded: boolean,
  navExpanded: boolean
}>()
const emit = defineEmits(['question-selected', 'sidebar-expanded'])

// 状态管理
const loading = ref(false)
const topics = ref<TopicGroup[]>([])
const selectedQuestion = ref<Question | null>(null)
const isMobile = ref(false)
const isDragging = ref(false)
const showImportMenu = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedPart = ref<1 | 2>(1)

// 展开状态 - 默认全部折叠
const expandedParts = ref(new Set<number>())
const expandedTopics = ref(new Set<number>())

// 计算属性
const partGroups = computed((): PartGroup[] => {
  return [1, 2].map(number => ({
    number,
    topics: topics.value
      .filter(t => t.part === number)
      .sort((a, b) => a.id - b.id)
  }))
})

// 基础方法
const toggleSidebar = () => {
  if (isMobile.value && !props.expanded) {
    isDragging.value = true
    // 在动画完成后重置拖拽状态
    setTimeout(() => {
      isDragging.value = false
    }, 300)
  }

  const newExpandedState = !props.expanded

  // 展开时重新拉取数据，收起时清空数据
  if (newExpandedState) {
    loadTopics()
    emit('sidebar-expanded', newExpandedState)
  } else {
    // 先清空数据，然后延时发出收起事件
    clearData()
    setTimeout(() => {
      emit('sidebar-expanded', newExpandedState)
    }, 50)
  }
}

const togglePart = (partNumber: number) => {
  expandedParts.value.has(partNumber)
    ? expandedParts.value.delete(partNumber)
    : expandedParts.value.add(partNumber)
}

const toggleTopic = (topicId: number) => {
  expandedTopics.value.has(topicId)
    ? expandedTopics.value.delete(topicId)
    : expandedTopics.value.add(topicId)
}

const selectQuestion = async (question: Question) => {
  selectedQuestion.value = question
  emit('question-selected', question)
}

// 根据选中的问题自动展开对应的part和topic
const expandToSelectedQuestion = (questionId: number | undefined) => {
  if (!questionId || topics.value.length === 0) return

  // 查找选中问题所属的topic和part
  for (const topic of topics.value) {
    const question = topic.questions?.find(q => q.id === questionId)
    if (question) {
      // 展开对应的part和topic
      expandedParts.value.add(topic.part)
      expandedTopics.value.add(topic.id)

      // 滚动到问题位置
      nextTick(() => {
        scrollToQuestion(questionId)
      })
      break
    }
  }
}

// 滚动到指定问题
const scrollToQuestion = (questionId: number) => {
  nextTick(() => {
    const questionElement = document.querySelector(`[data-question-id="${questionId}"]`)
    if (questionElement) {
      questionElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  })
}

// 数据操作方法
const loadTopics = async () => {
  loading.value = true
  try {
    const data = await api.speaking.getTopics()
    // 确保数据是数组格式
    if (Array.isArray(data)) {
      topics.value = JSON.parse(JSON.stringify(data))
    } else {
      console.error('API返回的数据格式不正确:', data)
      topics.value = []
    }
  } catch (e) {
    console.error('加载目录失败:', e)
    topics.value = []
  } finally {
    loading.value = false
  }
}

// 清空数据
const clearData = () => {
  topics.value = []
  expandedParts.value.clear()
  expandedTopics.value.clear()
  selectedQuestion.value = null
}

// 新增主题
const handleAddTopic = async (partNumber: number, title: string) => {
  loading.value = true
  try {
    const newTopic = await api.speaking.createTopic({ part: partNumber, title })
    topics.value = [...topics.value, { ...newTopic }]
    expandedTopics.value = new Set([...expandedTopics.value, newTopic.id])
    expandedTopics.value.add(newTopic.id)
  } catch (e) {
    console.error('添加主题失败:', e)
  } finally {
    loading.value = false
  }
}

// 新增问题
const handleAddQuestion = async (topicId: number, questionText: string) => {
  loading.value = true
  try {
    const newQuestion = await api.speaking.createQuestion({ topic_id: topicId, question_text: questionText })
    const index = topics.value.findIndex(t => t.id === topicId)
    if (index !== -1) {
      topics.value[index] = {
        ...topics.value[index],
        questions: [...topics.value[index].questions, newQuestion]
      }
      topics.value = [...topics.value]
      expandedTopics.value.add(topicId)
    }
  } catch (e) {
    console.error('添加问题失败:', e)
  } finally {
    loading.value = false
  }
}

// 编辑主题
const handleEditTopic = async (topicId: number, newTitle: string) => {
  loading.value = true
  try {
    const updatedTopic = await api.speaking.updateTopic(topicId, { title: newTitle })
    topics.value = topics.value.map(topic =>
      topic.id === topicId ? { ...updatedTopic } : topic
    )
  } catch (e) {
    console.error('编辑主题失败:', e)
  } finally {
    loading.value = false
  }
}

// 编辑问题
const handleEditQuestion = async (questionId: number, newText: string) => {
  loading.value = true
  try {
    const updatedQuestion = await api.speaking.updateQuestion(questionId, { question_text: newText })
    topics.value = topics.value.map(topic => {
      if (topic.questions.some(q => q.id === questionId)) {
        return {
          ...topic,
          questions: topic.questions.map(q =>
            q.id === questionId ? updatedQuestion : q
          )
        }
      }
      return topic
    })
  } catch (e) {
    console.error('编辑问题失败:', e)
  } finally {
    loading.value = false
  }
}

// 删除主题
const handleDeleteTopic = async (topicId: number) => {
  if (!confirm('确定要删除此主题及其所有问题吗？')) return
  loading.value = true
  try {
    // 检查要删除的主题是否包含当前选中的问题
    const topicToDelete = topics.value.find(t => t.id === topicId)
    const shouldClearSelection = topicToDelete?.questions?.some(q => q.id === selectedQuestion.value?.id)

    await api.speaking.deleteTopic(topicId)
    topics.value = topics.value.filter(t => t.id !== topicId)
    expandedTopics.value = new Set(
      [...expandedTopics.value].filter(id => id !== topicId)
    )

    // 如果删除的主题包含当前选中的问题，清空选择
    if (shouldClearSelection) {
      selectedQuestion.value = null
      emit('question-selected', null)
    }
  } catch (e) {
    console.error('删除主题失败:', e)
  } finally {
    loading.value = false
  }
}

// 删除问题
const handleDeleteQuestion = async (questionId: number) => {
  if (!confirm('确定要删除此问题吗？')) return
  loading.value = true
  try {
    await api.speaking.deleteQuestion(questionId)
    topics.value = topics.value.map(topic => ({
      ...topic,
      questions: topic.questions.filter(q => q.id !== questionId)
    }))

    // 如果删除的是当前选中的问题，清空选择并通知父组件
    if (selectedQuestion.value?.id === questionId) {
      selectedQuestion.value = null
      emit('question-selected', null)
    }
  } catch (e) {
    console.error('删除问题失败:', e)
  } finally {
    loading.value = false
  }
}

// 切换导入菜单
const toggleImportMenu = () => {
  showImportMenu.value = !showImportMenu.value
}

// 清除所有题目
const handleClearQuestions = async () => {
  if (!confirm('确定要清除所有题目、主题和记录吗？此操作不可恢复！')) return

  loading.value = true
  try {
    await api.speaking.clearAllQuestions()
    // 清空本地数据
    clearData()
    alert('所有题目已清除')
  } catch (e) {
    console.error('清除题目失败:', e)
    alert('清除题目失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 触发文件选择
const triggerFileInput = (part: 1 | 2) => {
  selectedPart.value = part
  showImportMenu.value = false
  fileInputRef.value?.click()
}

// 处理文件选择
const handleFileSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  // 验证文件类型
  if (!file.name.endsWith('.txt')) {
    alert('请选择 .txt 格式的文件')
    input.value = ''
    return
  }

  loading.value = true
  try {
    // 读取文件内容
    const text = await file.text()

    // 解析题目
    const topicsData = parseQuestionsText(text, selectedPart.value)

    if (topicsData.length === 0) {
      alert('文件中没有找到有效的题目')
      return
    }

    // 调用导入API
    const result = await api.speaking.importQuestionsFromData(topicsData, selectedPart.value)

    alert(`导入成功！\n新增主题数：${result.topics_count}\n新增问题数：${result.questions_count}`)

    // 重新加载数据
    await loadTopics()
  } catch (e) {
    console.error('导入题目失败:', e)
    alert(`导入题目失败：${e instanceof Error ? e.message : '未知错误'}`)
  } finally {
    loading.value = false
    // 清空文件选择
    input.value = ''
  }
}

// 解析题目文本
const parseQuestionsText = (text: string, part: 1 | 2): Array<{ title: string; questions: string[] }> => {
  const topics: Array<{ title: string; questions: string[] }> = []
  const blocks = text.trim().split('\n\n')

  for (const block of blocks) {
    const lines = block.split('\n').map(line => line.trim()).filter(line => line)
    if (lines.length === 0) continue

    if (part === 1) {
      // Part 1 格式：主题名称 + 问题列表
      if (lines[0].includes('Part 1') || lines[0].startsWith('##')) continue

      const title = lines[0]
      const questions = lines.slice(1)

      if (questions.length > 0) {
        topics.push({ title, questions })
      }
    } else {
      // Part 2&3 格式：Describe开头的描述 + 提示点
      if (lines[0].startsWith('Describe')) {
        const title = lines[0]
        const questionContent = lines.slice(1).join('\n')
        topics.push({ title, questions: [title + '\n' + questionContent] })
      }
    }
  }

  return topics
}

// 监听选中问题变化，自动展开
watch(() => props.selectQuestionId, (newQuestionId) => {
  if (newQuestionId && topics.value.length > 0) {
    expandToSelectedQuestion(newQuestionId)
  }
}, { immediate: true })

// 监听topics数据加载完成，如果有选中的问题则展开
watch(topics, (newTopics) => {
  if (newTopics.length > 0 && props.selectQuestionId) {
    nextTick(() => {
      expandToSelectedQuestion(props.selectQuestionId)
    })
  }
}, { immediate: true })

// 监听展开状态变化，处理外部控制的展开/收起
watch(() => props.expanded, (newExpanded, oldExpanded) => {
  if (newExpanded !== oldExpanded) {
    if (newExpanded) {
      loadTopics()
    } else {
      // 延时清空数据，确保动画流畅
      setTimeout(() => {
        clearData()
      }, 10)
    }
  }
})

// 检测移动端
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

// 点击外部区域关闭导入菜单
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (showImportMenu.value && !target.closest('.header-actions')) {
    showImportMenu.value = false
  }
}

// 生命周期
onMounted(async () => {
  await nextTick()
  // 检测移动端
  checkMobile()
  window.addEventListener('resize', checkMobile)
  document.addEventListener('click', handleClickOutside)

  // 如果初始状态是展开的，则加载数据
  if (props.expanded) {
    setTimeout(() => {
      loadTopics()
    }, 400)
  }
})

// 清理资源
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  document.removeEventListener('click', handleClickOutside)
})

// 提供给外部调用的清空选择方法
const clearSelection = () => {
  selectedQuestion.value = null
  emit('question-selected', null)
}

defineExpose({
  loadTopics,
  toggleSidebar,
  selectQuestion,
  clearSelection
})
</script>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 48px;
  width: 320px;
  height: 100vh;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 2px 0 20px rgba(0, 0, 0, 0.05);
  transform: translateX(-100%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.sidebar.expanded {
  transform: translateX(0);
}

.sidebar.nav-expanded {
  left: 280px;
}

.sidebar-tab {
  position: absolute;
  top: 50%;
  right: -32px;
  transform: translateY(-50%);
  width: 32px;
  height: 80px;
  background: #667eea;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 移动端触摸优化 */
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
  border-radius: 0 8px 8px 0;
  box-shadow: 2px 0 6px rgba(0, 0, 0, 0.15);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 101;
}

.sidebar-tab:hover {
  background: white;
  transform: translateY(-50%) scale(1.05);
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.2);
}

.sidebar-tab.expanded {
  background: white;
}

.sidebar-tab.expanded:hover {
  background: #667eea;
  transform: translateY(-50%) scale(1.05);
}

/* 图标的颜色动画优化 */
.sidebar-tab:hover .icon-light {
  color: #667eea;
}

.sidebar-tab.expanded:hover .icon-dark {
  color: white;
}

.icon-light {
  color: white;
  transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.icon-dark {
  color: #1e293b;
  transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-header {
  flex-shrink: 0;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid rgba(102, 126, 234, 0.1);
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05));
}

.sidebar-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #667eea;
  letter-spacing: -0.025em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;
}

.action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
  position: relative;
}

.action-btn:hover:not(:disabled) {
  background: rgba(102, 126, 234, 0.1);
  transform: scale(1.05);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn .tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  margin-top: 0.25rem;
  padding: 0.375rem 0.625rem;
  background: rgba(30, 41, 59, 0.95);
  color: white;
  font-size: 0.75rem;
  border-radius: 0.375rem;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.action-btn:hover:not(:disabled) .tooltip {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.clear-btn .btn-icon {
  color: #ef4444;
}

.import-btn .btn-icon {
  color: #667eea;
}

.btn-icon {
  width: 1rem;
  height: 1rem;
}

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

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 0;
  display: flex;
  flex-direction: column;
}

.directory-tree {
  padding: 0 16px;
  animation: fadeInUp 0.5s ease forwards;
}

/* 添加入场动画 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 优化滚动条样式 */
.sidebar-content {
  scrollbar-width: thin;
  scrollbar-color: rgba(102, 126, 234, 0.3) transparent;
}

.sidebar-content::-webkit-scrollbar {
  width: 4px;
  display: block;
}

.sidebar-content::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-content::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.3);
  border-radius: 2px;
  transition: background 0.2s ease;
}

.sidebar-content::-webkit-scrollbar-thumb:hover {
  background: rgba(102, 126, 234, 0.5);
}

.overlay {
  display: none;
}

/* Loading组件在sidebar中的样式优化 */
.sidebar-content :deep(.min-h-screen) {
  min-height: auto;
  height: auto;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

/* 桌面端恢复正常的拖拽手柄显示 */
@media (min-width: 769px) {
  .sidebar-tab {
    opacity: 1 !important;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

/* 移动端响应式适配 - 底部抽屉设计 */
@media (max-width: 768px) {
  .sidebar {
    /* 底部抽屉布局 */
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: 65vh; /* 降低抽屉高度 */
    max-height: 65vh;
    transform: translateY(100%); /* 默认隐藏在底部 */
    border-radius: 20px 20px 0 0;
    border-right: none;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.15);
    /* 移动端优化滚动 */
    -webkit-overflow-scrolling: touch;
    z-index: 100; /* 确保抽屉在遮罩层上方 */
  }

  .sidebar.expanded {
    transform: translateY(0);
  }

  .sidebar.nav-expanded {
    /* 移动端不受导航栏影响 */
    left: 0;
  }

  .sidebar-tab {
    /* 顶部中央的拖拽手柄 */
    position: absolute;
    top: -40px;
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    width: 80px;
    height: 40px;
    background: #667eea;
    border-radius: 20px 20px 0 0;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 -5px 15px rgba(0, 0, 0, 0.1);
    min-width: 80px;
    min-height: 40px;
    z-index: 101; /* 确保拖拽手柄在遮罩层上方 */
    /* 初始状态隐藏，避免模式切换时的跳动 */
    opacity: 0;
    transition: opacity 0.5s ease 0.3s; /* 延迟显示避免跳动 */
  }

  /* 抽屉渲染完成后显示拖拽手柄 */
  .sidebar:not(.expanded) .sidebar-tab {
    opacity: 1;
  }

  /* 拖拽时立即隐藏手柄 */
  .sidebar-tab.dragging {
    opacity: 0 !important;
    pointer-events: none;
    transition: opacity 0.1s ease;
  }

  .sidebar-tab .sidebar-arrow {
    /* 箭头旋转为垂直方向 - 初始状态朝上 */
    transform: rotate(-90deg);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar.expanded .sidebar-tab {
    /* 展开时隐藏拖拽手柄 */
    opacity: 0;
    pointer-events: none;
    transform: translateX(-50%) translateY(-10px);
  }

  .sidebar.expanded .sidebar-tab .sidebar-arrow {
    transform: rotate(90deg);
  }

  /* 移动端禁用hover效果，使用active替代 */
  .sidebar-tab:hover {
    background: #667eea;
    transform: translateX(-50%);
    box-shadow: 0 -5px 15px rgba(0, 0, 0, 0.1);
  }

  .sidebar-tab:active {
    background: #5a6fd8;
    transform: translateX(-50%) scale(0.95);
  }

  .sidebar-tab.expanded {
    background: white;
  }

  .sidebar-tab.expanded:hover {
    background: #667eea;
    transform: translateX(-50%);
  }

  .sidebar-header {
    /* 添加顶部拖拽指示器 */
    position: relative;
  }

  .sidebar-header::before {
    content: '';
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 4px;
    background: rgba(102, 126, 234, 0.3);
    border-radius: 2px;
  }

  .sidebar-header h2 {
    font-size: 16px;
    padding-top: 8px;
  }

  .header-actions {
    display: flex;
    gap: 0.25rem;
  }

  .action-btn {
    width: 28px;
    height: 28px;
  }

  .btn-icon {
    width: 0.875rem;
    height: 0.875rem;
  }

  .import-menu {
    right: 0;
    left: auto;
  }

  .directory-tree {
    padding: 0 12px;
  }

  /* 移动端Loading组件居中 */
  .sidebar-content :deep(.min-h-screen) {
    min-height: auto;
    height: auto;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .overlay {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh; /* 覆盖整个屏幕 */
    background: transparent; /* 透明背景 */
    z-index: 99; /* 在抽屉下方，但高于其他内容 */
    pointer-events: auto;
  }
}

/* 小屏手机进一步优化 */
@media (max-width: 480px) {
  .sidebar {
    height: 70vh; /* 小屏幕高度 */
    max-height: 70vh;
  }


  .sidebar-tab {
    width: 70px;
    height: 35px;
    top: -35px;
  }

  .sidebar-header {
    height: 40px;
    padding: 0 16px;
  }

  .sidebar-header h2 {
    font-size: 14px;
  }

  .sidebar-content {
    padding: 12px 0;
  }

  .directory-tree {
    padding: 0 8px;
  }
}

/* 超小屏幕适配 */
@media (max-width: 360px) {
  .sidebar {
    height: 75vh; /* 超小屏幕高度 */
    max-height: 75vh;
  }


  .sidebar-tab {
    width: 60px;
    height: 30px;
    top: -30px;
  }

  .sidebar-header {
    height: 44px;
    padding: 0 20px;
  }

  .sidebar-header h2 {
    font-size: 16px;
  }

  .directory-tree {
    padding: 0 16px;
  }
}

/* 横屏适配 - 移动端底部抽屉 */
@media (max-width: 768px) and (max-height: 500px) and (orientation: landscape) {
  .sidebar {
    height: 60vh; /* 横屏时高度更小 */
    max-height: 60vh;
  }


  .sidebar-tab {
    width: 60px;
    height: 25px;
    top: -25px;
  }

  .sidebar-header {
    height: 36px;
    padding: 0 12px;
  }

  .sidebar-header h2 {
    font-size: 14px;
  }

  .sidebar-content {
    padding: 8px 0;
  }

  .directory-tree {
    padding: 0 8px;
  }
}
</style>
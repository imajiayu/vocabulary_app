# API 模块使用指南

本项目的API模块提供了统一的接口来处理所有后端API调用，包括错误处理、类型安全和代码复用。

## 模块结构

```
src/api/
├── client.ts         # HTTP客户端基础类
├── words.ts          # 单词相关API
├── speaking.ts       # 口语练习API
├── stats.ts          # 统计数据API
├── config.ts         # 配置相关API
├── index.ts          # 统一导出
└── README.md         # 本文档
```

## 基本使用

### 导入API模块

```typescript
// 导入统一的API对象
import { api } from '@/api'

// 或者导入特定的API类
import { WordsApi, SpeakingApi } from '@/api'
```

### 单词API使用示例

```typescript
// 获取单词详情
const word = await api.words.getWord(123)

// 获取复习单词列表
const reviewWords = await api.words.getReviewWords({
  mode: 'mode_review',
  limit: 50,
  shuffle: true
})

// 创建新单词
const newWord = await api.words.createWord({
  word: 'example',
  definition: {
    phonetic: { us: '/ɪɡˈzæmpl/' },
    definitions: ['a thing characteristic of its kind'],
    examples: [{ en: 'for example', zh: '例如' }]
  },
  source: 'IELTS'
})

// 提交复习结果（返回更新后的完整单词数据，包含related_words）
const updatedWord = await api.words.submitWordResult(wordId, {
  remembered: true,
  elapsed_time: 1500,
  is_spelling: false
})
// updatedWord 包含最新的学习数据和关联词
```

### 口语练习API使用示例

```typescript
// 获取话题列表
const topics = await api.speaking.getTopics()

// 创建新话题
const topic = await api.speaking.createTopic({
  title: 'Family',
  part: 1
})

// 语音转文字
const result = await api.speaking.speechToText(audioFile)
if (result.success) {
  console.log('转录文本:', result.text)
}

// 获取AI反馈
const feedback = await api.speaking.getAiFeedback(
  'What is your favorite food?',
  'I like pizza because it tastes good.'
)
```

### 统计API使用示例

```typescript
// 获取首页摘要
const summary = await api.stats.getIndexSummary()

// 获取详细统计数据
const stats = await api.stats.getStats()

// 获取学习进度数据
const progress = await api.stats.getLearningProgress('2024-01-01', '2024-12-31')
```

### 配置API使用示例

```typescript
// 切换单词源
const switchResult = await api.config.switchSource('GRE')

// 获取应用设置
const settings = await api.config.getSettings()

// 更新设置
const updatedSettings = await api.config.updateSettings({
  daily_review_limit: 100,
  auto_play_audio: true
})
```

## 错误处理

API模块提供了统一的错误处理机制：

```typescript
import { ApiError } from '@/api'

try {
  const word = await api.words.getWord(123)
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API错误:', error.message)
    console.error('状态码:', error.status)
  } else {
    console.error('未知错误:', error)
  }
}
```

## 在组件中使用

### Vue组件示例

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/api'
import type { Word } from '@/types'

const words = ref<Word[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const loadWords = async () => {
  try {
    loading.value = true
    error.value = null

    const response = await api.words.getReviewWords({
      mode: 'mode_review',
      limit: 20
    })

    words.value = response.words
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadWords()
})
</script>
```

### 在Pinia Store中使用

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'

export const useWordsStore = defineStore('words', () => {
  const words = ref<Word[]>([])

  const loadWords = async (params: WordQueryParams) => {
    const response = await api.words.getReviewWords(params)
    words.value = response.words
    return response
  }

  const createWord = async (wordData: CreateWordPayload) => {
    const newWord = await api.words.createWord(wordData)
    words.value.push(newWord)
    return newWord
  }

  return {
    words,
    loadWords,
    createWord
  }
})
```

## 类型安全

所有API方法都提供了完整的TypeScript类型支持：

```typescript
import type {
  WordQueryParams,
  CreateWordPayload,
  SpeechToTextResponse
} from '@/api'

// 参数类型检查
const params: WordQueryParams = {
  mode: 'mode_review', // 只能是指定的几个值
  limit: 50,
  shuffle: true
}

// 返回值类型推断
const word = await api.words.getWord(123) // word 自动推断为 Word 类型
```

## 性能优化建议

1. **批量操作**: 尽量使用批量API而不是循环调用单个API
2. **缓存策略**: 对于不经常变化的数据考虑缓存
3. **错误重试**: 对于网络错误可以考虑自动重试机制
4. **加载状态**: 始终为API调用提供加载状态反馈

## 扩展API模块

要添加新的API端点，请遵循现有的模式：

1. 在相应的模块文件中添加新方法
2. 定义相关的TypeScript接口
3. 在 `index.ts` 中导出新的类型
4. 更新本文档

```typescript
// 示例：在 words.ts 中添加新方法
static async searchWords(query: string): Promise<Word[]> {
  return get<Word[]>(`/api/words/search?q=${encodeURIComponent(query)}`)
}
```
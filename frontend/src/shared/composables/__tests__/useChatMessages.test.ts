import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import type { Word } from '@/shared/types'

// 隔离依赖：测试只关心切词时的会话保留逻辑，不触发真实 LLM/Supabase 调用
vi.mock('@/shared/api', () => ({
  api: {
    vocabularyAssistance: {
      sendMessage: vi.fn(async () => ({ response: 'mock' })),
    },
  },
}))

vi.mock('@/shared/composables/useSettings', () => ({
  useSettings: () => ({
    settings: ref({}),
    loadSettings: vi.fn(async () => {}),
  }),
}))

import { useChatMessages } from '../useChatMessages'

function makeWord(id: number, word: string): Word {
  return { id, word } as unknown as Word
}

describe('useChatMessages — 单次复习会话内按单词保留聊天', () => {
  it('错题模式下同一单词被反复遍历时应恢复其聊天记录', async () => {
    const currentWord = ref<Word | null>(makeWord(1, 'apple'))
    const { messages } = useChatMessages(currentWord, ref(true))

    // 在单词 1 上产生一段对话
    messages.value.push({ role: 'user', content: 'hi' })
    messages.value.push({ role: 'assistant', content: 'hello' })

    // 切到单词 2：单词 1 的对话应被暂存，当前清空
    currentWord.value = makeWord(2, 'banana')
    await nextTick()
    expect(messages.value).toEqual([])

    // 再次复习到单词 1：聊天记录应被恢复
    currentWord.value = makeWord(1, 'apple')
    await nextTick()
    expect(messages.value).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ])
  })

  it('不同单词的聊天记录互不串扰', async () => {
    const currentWord = ref<Word | null>(makeWord(1, 'apple'))
    const { messages } = useChatMessages(currentWord, ref(true))

    messages.value.push({ role: 'user', content: 'on-1' })

    currentWord.value = makeWord(2, 'banana')
    await nextTick()
    messages.value.push({ role: 'user', content: 'on-2' })

    currentWord.value = makeWord(1, 'apple')
    await nextTick()
    expect(messages.value).toEqual([{ role: 'user', content: 'on-1' }])

    currentWord.value = makeWord(2, 'banana')
    await nextTick()
    expect(messages.value).toEqual([{ role: 'user', content: 'on-2' }])
  })
})

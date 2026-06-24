import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// 隔离上游 LLM：只测解析/对齐/prompt 注入逻辑，不打真实网络。
vi.mock('@/shared/services/ai', () => ({
  callAI: vi.fn(),
  streamAI: vi.fn(),
}))

import { callAI } from '@/shared/services/ai'
import {
  getParagraphFeedback,
  getFinalScores,
  ieltsRoundOverall,
} from '@/shared/services/writing-ai'

const callAIMock = callAI as unknown as Mock

/** 取最近一次 callAI 调用的 systemPrompt（第一个参数） */
function lastSystemPrompt(): string {
  const calls = callAIMock.mock.calls
  return calls[calls.length - 1][0] as string
}

beforeEach(() => {
  callAIMock.mockReset()
})

describe('ieltsRoundOverall — IELTS 官方分项→总分舍入', () => {
  it.each([
    [6.0, 6],
    [6.2, 6],     // 小数 < .25 → 向下
    [6.25, 6.5],  // [.25,.75) → .5
    [6.5, 6.5],
    [6.74, 6.5],
    [6.75, 7],    // ≥ .75 → 向上
    [6.875, 7],
    [8.0, 8],
  ])('avg=%s → %s', (avg, expected) => {
    expect(ieltsRoundOverall(avg)).toBe(expected)
  })

  it('非有限数返回 0', () => {
    expect(ieltsRoundOverall(NaN)).toBe(0)
  })
})

describe('getParagraphFeedback — 段落对齐', () => {
  it('优先按 LLM 回显的 index 对齐（即使数组乱序）', async () => {
    callAIMock.mockResolvedValue(
      JSON.stringify([
        { index: 2, improved: 'B+', issues: [{ quote: 'Para B', message: 'mb' }], changed: true },
        { index: 1, improved: 'A+', issues: [{ quote: 'Para A', message: 'ma' }], changed: true },
      ])
    )

    const result = await getParagraphFeedback('题目', 'Para A.\n\nPara B.', 2)

    expect(result).toHaveLength(2)
    expect(result[0].improved).toBe('A+') // index 1 → 第 0 段
    expect(result[0].issues).toEqual([{ quote: 'Para A', message: 'ma' }])
    expect(result[1].improved).toBe('B+') // index 2 → 第 1 段
    expect(result[1].issues).toEqual([{ quote: 'Para B', message: 'mb' }])
  })

  it('index 缺失时退化为位置对齐', async () => {
    callAIMock.mockResolvedValue(
      JSON.stringify([
        { improved: 'X', notes: 'nx', changed: true },
        { improved: 'Y', notes: 'ny', changed: true },
      ])
    )

    const result = await getParagraphFeedback('题目', 'A.\n\nB.', 2)

    expect(result[0].improved).toBe('X')
    expect(result[1].improved).toBe('Y')
  })

  it('返回项多于原文段落数 → 截断到段落数', async () => {
    callAIMock.mockResolvedValue(
      JSON.stringify([
        { index: 1, improved: 'A+', notes: 'a' },
        { index: 2, improved: 'B+', notes: 'b' },
        { index: 3, improved: '幻觉段', notes: 'c' },
      ])
    )

    const result = await getParagraphFeedback('题目', 'A.\n\nB.', 2)
    expect(result).toHaveLength(2)
  })

  it('返回项少于段落数 → 缺失段用原文 + 默认说明补齐', async () => {
    callAIMock.mockResolvedValue(
      JSON.stringify([{ index: 1, improved: 'A+', notes: 'a', changed: true }])
    )

    const result = await getParagraphFeedback('题目', 'A.\n\nB para.', 2)

    expect(result).toHaveLength(2)
    expect(result[1].improved).toBe('B para.') // 原文兜底
    expect(result[1].issues).toEqual([]) // 缺失段无标注
    expect(result[1].changed).toBe(false)
  })

  it('清洗 issues：丢弃缺 quote/message 或非字符串的非法项', async () => {
    callAIMock.mockResolvedValue(
      JSON.stringify([
        {
          index: 1,
          improved: 'A+',
          issues: [
            { quote: 'good', message: '用词不当' }, // 合法
            { quote: '', message: '空 quote' }, // 丢弃
            { quote: 'x' }, // 缺 message，丢弃
            { message: '缺 quote' }, // 缺 quote，丢弃
            'not an object', // 丢弃
          ],
          changed: true,
        },
      ])
    )

    const result = await getParagraphFeedback('题目', 'A good text.', 2)
    expect(result[0].issues).toEqual([{ quote: 'good', message: '用词不当' }])
  })

  it('issues 缺失/非数组时降级为空数组', async () => {
    callAIMock.mockResolvedValue(
      JSON.stringify([{ index: 1, improved: 'A+', changed: true }])
    )
    const result = await getParagraphFeedback('题目', 'A.', 2)
    expect(result[0].issues).toEqual([])
  })

  it('LLM 未填 changed 时按原/改字符串对比兜底推断', async () => {
    callAIMock.mockResolvedValue(
      JSON.stringify([
        { index: 1, improved: 'Same text.', notes: '无改动' }, // 与原文一致
        { index: 2, improved: 'Improved!', notes: '有改动' },
      ])
    )

    const result = await getParagraphFeedback('题目', 'Same text.\n\nOriginal.', 2)
    expect(result[0].changed).toBe(false)
    expect(result[1].changed).toBe(true)
  })

  it('数组被包一层对象（{feedback:[...]}）时能兜底解开', async () => {
    callAIMock.mockResolvedValue(
      JSON.stringify({ feedback: [{ index: 1, improved: 'A+', notes: 'a' }] })
    )
    const result = await getParagraphFeedback('题目', 'A.', 2)
    expect(result[0].improved).toBe('A+')
  })

  it('把大纲注入 prompt；无大纲时用占位符', async () => {
    callAIMock.mockResolvedValue(JSON.stringify([{ index: 1, improved: 'A', notes: 'n' }]))

    await getParagraphFeedback('题目', 'A.', 2, '我的大纲：引言+两个论点')
    expect(lastSystemPrompt()).toContain('我的大纲：引言+两个论点')

    await getParagraphFeedback('题目', 'A.', 2, null)
    expect(lastSystemPrompt()).toContain('（学生未提供大纲）')
  })

  it('解析失败抛出友好错误', async () => {
    callAIMock.mockResolvedValue('这不是 JSON')
    await expect(getParagraphFeedback('题目', 'A.', 2)).rejects.toThrow('AI 反馈格式错误')
  })
})

describe('getFinalScores — 评分与 prompt 注入', () => {
  const validScores = JSON.stringify({
    scores: {
      taskAchievement: 7,
      coherenceCohesion: 6,
      lexicalResource: 6.5,
      grammaticalRange: 6,
    },
    summary: '总评',
  })

  it('overall 由前端按 IELTS 规则计算（不取 LLM）', async () => {
    callAIMock.mockResolvedValue(validScores)
    const { scores, summary } = await getFinalScores('题目', 'one two three', 2)

    // avg = (7+6+6.5+6)/4 = 6.375 → 6.5
    expect(scores.overall).toBe(6.5)
    expect(scores.taskAchievement).toBe(7)
    expect(summary).toBe('总评')
  })

  it('Task 1 选 TASK1 rubric + 下限 150；不含 Task 2 标记', async () => {
    callAIMock.mockResolvedValue(validScores)
    await getFinalScores('题目', 'a b c', 1)
    const sp = lastSystemPrompt()
    expect(sp).toContain('Task Achievement（任务完成度）')
    expect(sp).not.toContain('Task Response（任务回应）')
    expect(sp).toContain('建议字数下限 150 词')
  })

  it('Task 2 选 TASK2 rubric + 下限 250', async () => {
    callAIMock.mockResolvedValue(validScores)
    await getFinalScores('题目', 'a b c', 2)
    const sp = lastSystemPrompt()
    expect(sp).toContain('Task Response（任务回应）')
    expect(sp).toContain('建议字数下限 250 词')
  })

  it('把实际词数注入 prompt', async () => {
    callAIMock.mockResolvedValue(validScores)
    await getFinalScores('题目', 'one two three four', 2) // 4 词
    expect(lastSystemPrompt()).toContain('实际词数：4 词')
  })

  it('解析失败抛出友好错误', async () => {
    callAIMock.mockResolvedValue('坏 JSON')
    await expect(getFinalScores('题目', 'a', 2)).rejects.toThrow('AI 评分格式错误')
  })
})

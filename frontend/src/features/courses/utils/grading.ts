/**
 * 练习题评分算法
 */

import type { RubricItem } from '../types/lesson'

// ── Levenshtein 距离（填空题模糊匹配） ──

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = []
  for (let i = 0; i <= m; i++) {
    dp[i] = [i]
    for (let j = 1; j <= n; j++) {
      dp[i][j] = i === 0 ? j : 0
    }
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// ── 文本归一化 ──

export function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[.,;:!?，。；：！？、（）()\[\]【】{}"'"'—\-–…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Rubric 批改结果 ──

export type GradeStatus = 'perfect' | 'acceptable' | 'error' | 'missing'

export interface GradeItemResult {
  en: string
  ideal: string
  note: string
  status: GradeStatus
  acceptText?: string
  errorText?: string
}

export interface GradeResult {
  score: number
  total: number
  results: GradeItemResult[]
}

// ── Rubric 批改 ──

export function gradeWithRubric(userText: string, rubric: RubricItem[]): GradeResult {
  const normUser = normalize(userText)
  const results: GradeItemResult[] = []
  const totalPoints = rubric.length
  let score = 0

  for (const item of rubric) {
    const entry: GradeItemResult = {
      en: item.en,
      ideal: item.ideal,
      note: item.note || '',
      status: 'missing'
    }

    // 检查常见错误
    if (item.wrong?.length) {
      for (const w of item.wrong) {
        if (normUser.includes(normalize(w))) {
          entry.status = 'error'
          entry.errorText = w
          break
        }
      }
    }

    // 检查理想翻译
    const ideals = item.ideal.split('/').map(s => normalize(s.trim())).filter(Boolean)
    for (const ideal of ideals) {
      if (normUser.includes(ideal)) {
        entry.status = 'perfect'
        score += 1
        break
      }
    }

    // 可接受的翻译
    if (entry.status !== 'perfect' && item.accept?.length) {
      for (const a of item.accept) {
        const acceptNorms = a.split('/').map(s => normalize(s.trim()))
        if (acceptNorms.some(an => normUser.includes(an))) {
          entry.status = 'acceptable'
          entry.acceptText = a
          score += 0.7
          break
        }
      }
    }

    // 英文原文作为部分分
    if (entry.status === 'missing' || entry.status === 'error') {
      const enNorm = normalize(item.en)
      if (enNorm.length > 3 && normUser.includes(enNorm)) {
        if (entry.status !== 'error') {
          entry.status = 'acceptable'
          entry.acceptText = item.en + '（原文）'
          score += 0.3
        }
      }
    }

    results.push(entry)
  }

  return { score, total: totalPoints, results }
}

// ── 填空题匹配 ──

export function matchFillBlank(userVal: string, answer: string, acceptList: string[] = []): boolean {
  const accepted = [answer.toLowerCase(), ...acceptList.map(a => a.toLowerCase().trim())]
  const userNorm = userVal.toLowerCase().trim()

  // 精确匹配
  if (accepted.includes(userNorm)) return true

  // 模糊匹配（长词允许 Levenshtein <= 1）
  if (userNorm.length > 4) {
    for (const a of accepted) {
      if (a.length > 4 && levenshtein(userNorm, a) <= 1) return true
    }
  }

  return false
}

/**
 * 把完整 Lesson 压缩成一段适合喂给 LLM 的摘要。
 *
 * 约束：
 * - 控制在 1500 字以内，避免每轮聊天都带大段课时 JSON 拖累成本
 * - 只保留结构化信息（vocab / grammar heading / summary points），丢掉 html/样式
 * - 对 vocab-table / grammar block 里可能带 HTML 的字段，剥除标签
 */

import type {
  Lesson,
  Section,
  Block,
  VocabGroup,
  ExampleGroup,
  TableCell,
} from '../types/lesson'

const MAX_VOCAB_ITEMS = 40
const MAX_SUMMARY_CHARS = 1500

/** 去掉 HTML 标签、合并空白；返回纯文本 */
function stripHtml(s: string | undefined | null): string {
  if (!s) return ''
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function summarizeVocabGroups(groups: VocabGroup[]): string[] {
  const lines: string[] = []
  let count = 0
  for (const g of groups) {
    if (count >= MAX_VOCAB_ITEMS) break
    if (g.heading) lines.push(`  · ${stripHtml(g.heading)}`)
    for (const w of g.words) {
      if (count >= MAX_VOCAB_ITEMS) break
      lines.push(`  - ${stripHtml(w.word)} — ${stripHtml(w.def)}`)
      count++
    }
  }
  return lines
}

function summarizeVocabTable(columns: string[], rows: string[][]): string[] {
  const lines: string[] = []
  const header = columns.map(stripHtml).join(' | ')
  if (header) lines.push(`  ${header}`)
  let count = 0
  for (const row of rows) {
    if (count >= MAX_VOCAB_ITEMS) break
    lines.push(`  - ${row.map(stripHtml).join(' | ')}`)
    count++
  }
  return lines
}

function summarizeBlocks(blocks: Block[] | undefined, maxItems = 6): string[] {
  if (!blocks) return []
  const lines: string[] = []
  let count = 0
  for (const b of blocks) {
    if (count >= maxItems) break
    if (b.type === 'h3' || b.type === 'h4') {
      lines.push(`  · ${stripHtml(b.text)}`)
      count++
    } else if (
      b.type === 'p' ||
      b.type === 'tip' ||
      b.type === 'note' ||
      b.type === 'error-warn' ||
      b.type === 'grammar-box'
    ) {
      const text = stripHtml(b.html || b.text)
      if (text) {
        lines.push(`  - ${text}`)
        count++
      }
    } else if (b.type === 'ul' || b.type === 'ol') {
      for (const item of b.items) {
        if (count >= maxItems) break
        lines.push(`  - ${stripHtml(item)}`)
        count++
      }
    } else if (b.type === 'table') {
      if (b.headers) lines.push(`  ${b.headers.map(stripHtml).join(' | ')}`)
      for (const row of b.rows) {
        if (count >= maxItems) break
        const cells = row.map((cell: TableCell) =>
          typeof cell === 'string' ? stripHtml(cell) : `${stripHtml(cell.en)} → ${stripHtml(cell.zh)}`,
        )
        lines.push(`  - ${cells.join(' | ')}`)
        count++
      }
    }
  }
  return lines
}

function summarizeExampleGroups(groups: ExampleGroup[]): string[] {
  const lines: string[] = []
  let count = 0
  for (const g of groups) {
    if (count >= 10) break
    if (g.heading) lines.push(`  · ${stripHtml(g.heading)}`)
    for (const item of g.items) {
      if (count >= 10) break
      lines.push(`  - ${stripHtml(item.text)} — ${stripHtml(item.translation)}`)
      count++
    }
  }
  return lines
}

function summarizeSection(section: Section): string[] {
  const lines: string[] = []
  switch (section.type) {
    case 'vocab-preload':
      lines.push('[词汇预加载]')
      lines.push(...summarizeVocabGroups(section.groups))
      break
    case 'vocab-table':
      lines.push(`[词汇表] ${stripHtml(section.heading) || ''}`.trim())
      if (section.intro) lines.push(`  ${stripHtml(section.intro)}`)
      lines.push(...summarizeVocabTable(section.columns, section.rows))
      break
    case 'grammar':
      lines.push(`[语法] ${stripHtml(section.heading) || ''}`.trim())
      lines.push(...summarizeBlocks(section.blocks, 10))
      break
    case 'examples':
      lines.push(`[例句] ${stripHtml(section.heading) || ''}`.trim())
      if (section.intro) lines.push(`  ${stripHtml(section.intro)}`)
      lines.push(...summarizeExampleGroups(section.groups))
      break
    case 'exercises':
      // 练习题本体不进摘要（学生正在做的就是它），只保留标题
      lines.push(`[练习] ${stripHtml(section.heading) || ''}`.trim())
      break
    case 'summary':
      lines.push(`[本节要点] ${stripHtml(section.heading) || ''}`.trim())
      if (section.title) lines.push(`  · ${stripHtml(section.title)}`)
      if (section.points) {
        for (const p of section.points) lines.push(`  - ${stripHtml(p)}`)
      } else if (section.html) {
        lines.push(`  ${stripHtml(section.html)}`)
      }
      if (section.next) lines.push(`  下节预告：${stripHtml(section.next)}`)
      break
    case 'sentence-analysis':
      lines.push(`[句子分析] ${stripHtml(section.heading) || ''}`.trim())
      for (const item of section.items.slice(0, 5)) {
        lines.push(`  - ${stripHtml(item.sentence)}`)
        if (item.translation) lines.push(`    ${stripHtml(item.translation)}`)
      }
      break
  }
  return lines
}

/**
 * 把整节课压成一段文本摘要，用于作为 AI 助手的上下文。
 */
export function summarizeLessonForAI(lesson: Lesson | null | undefined): string {
  if (!lesson) return ''
  const lines: string[] = []
  lines.push(`标题：${stripHtml(lesson.title)}`)
  if (lesson.objective) lines.push(`目标：${stripHtml(lesson.objective)}`)

  for (const section of lesson.sections) {
    const block = summarizeSection(section)
    if (block.length) {
      lines.push('')
      lines.push(...block)
    }
  }

  const full = lines.join('\n').trim()
  if (full.length <= MAX_SUMMARY_CHARS) return full
  return full.slice(0, MAX_SUMMARY_CHARS - 1) + '…'
}

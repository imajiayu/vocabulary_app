/**
 * JSON 课时数据结构的 TypeScript 类型定义
 */

// ── 顶层课时结构 ──

export interface Lesson {
  title: string
  objective?: string
  sections: Section[]
}

// ── Section 联合类型 ──

export type Section =
  | VocabPreloadSection
  | VocabTableSection
  | GrammarSection
  | ExamplesSection
  | ExercisesSection
  | SummarySection
  | SentenceAnalysisSection

// ── 各 Section 定义 ──

export interface VocabPreloadSection {
  type: 'vocab-preload'
  groups: VocabGroup[]
}

export interface VocabGroup {
  heading?: string
  words: VocabWord[]
}

export interface VocabWord {
  word: string
  def: string
}

export interface VocabTableSection {
  type: 'vocab-table'
  heading?: string
  intro?: string
  columns: string[]
  rows: string[][]
}

export interface GrammarSection {
  type: 'grammar'
  heading?: string
  blocks: Block[]
}

export interface ExamplesSection {
  type: 'examples'
  heading?: string
  intro?: string
  groups: ExampleGroup[]
}

export interface ExampleGroup {
  heading?: string
  items: ExampleItem[]
}

export interface ExampleItem {
  text: string
  translation: string
}

export interface ExercisesSection {
  type: 'exercises'
  heading?: string
  groups: ExerciseGroup[]
}

export type ExerciseGroup = QuizGroup | FillBlankGroup | TranslationGroup

export interface QuizGroup {
  style: 'quiz'
  title?: string
  instruction?: string
  questions: QuizQuestion[]
}

export interface QuizQuestion {
  prompt: string
  options: string[]
  answer: string
  explanation?: string
  hints?: string[]
}

export interface FillBlankGroup {
  style: 'fill-blank'
  title?: string
  instruction?: string
  questions: FillBlankQuestion[]
}

export interface FillBlankQuestion {
  prompt: string
  answer: string
  accept?: string[]
  explanation?: string
  hints?: string[]
}

export interface TranslationGroup {
  style: 'translation'
  title?: string
  instruction?: string
  questions: TranslationQuestion[]
}

export interface TranslationQuestion {
  source: string
  reference?: string
  rubric?: RubricItem[]
}

export interface RubricItem {
  en: string
  ideal: string
  accept?: string[]
  wrong?: string[]
  note?: string
}

export interface SummarySection {
  type: 'summary'
  heading?: string
  /** 直接 HTML 内容 */
  html?: string
  /** 要点列表（与 html 二选一） */
  points?: string[]
  /** 下节预告 */
  next?: string
}

export interface SentenceAnalysisSection {
  type: 'sentence-analysis'
  heading?: string
  items: SentenceAnalysisItem[]
}

export interface SentenceAnalysisItem {
  title?: string
  sentence: string
  structure?: string[]
  translation?: string
}

// ── Block 联合类型（GrammarSection 内部） ──

export type Block =
  | ParagraphBlock
  | HeadingBlock
  | TipBlock
  | NoteBlock
  | ErrorWarnBlock
  | GrammarBoxBlock
  | ListBlock
  | TableBlock
  | DetailsBlock

/** ContentBlock 子联合：共享 html/text 结构的内容块 */
export type ContentBlock =
  | ParagraphBlock
  | HeadingBlock
  | TipBlock
  | NoteBlock
  | ErrorWarnBlock
  | GrammarBoxBlock

export interface ParagraphBlock {
  type: 'p'
  html?: string
  text?: string
}

export interface HeadingBlock {
  type: 'h3' | 'h4'
  text: string
}

export interface TipBlock {
  type: 'tip'
  html?: string
  text?: string
}

export interface NoteBlock {
  type: 'note'
  html?: string
  text?: string
}

export interface ErrorWarnBlock {
  type: 'error-warn'
  html?: string
  text?: string
}

export interface GrammarBoxBlock {
  type: 'grammar-box'
  html?: string
  text?: string
}

export interface ListBlock {
  type: 'ul' | 'ol'
  items: string[]
}

export interface TableBlock {
  type: 'table'
  headers?: string[]
  rows: string[][]
  /** 第一列是否为单词样式 */
  firstColWord?: boolean
}

export interface DetailsBlock {
  type: 'details'
  summary?: string
  html: string
}

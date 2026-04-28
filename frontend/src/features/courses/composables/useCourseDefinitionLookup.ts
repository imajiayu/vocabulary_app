/**
 * 跨课程释义索引
 *
 * 课程 JSON 里 `<span class="uk-word|term" data-def="...">...</span>` 是单词点击气泡释义的唯一来源；
 * 但选中任意文本"添加"时拿不到 DOM 上的 data-def，且非 d1 课时存在大量漏标。
 * 本模块按 lang 扫描所有课时 JSON，把单词和词组的释义建成内存索引，
 * 供 `addSelection` 和 `handleWordClick` 在缺失释义时兜底查询。
 */

import type { SourceLang } from '@/shared/types'
import { ukrainianLessons, legalEnglishLessons } from '../data/lessons'

interface CourseSource {
  basePath: string
  lessonIds: string[]
}

const COURSE_BY_LANG: Partial<Record<SourceLang, CourseSource>> = {
  uk: { basePath: '/uk', lessonIds: ukrainianLessons.map(l => l.id) },
  en: { basePath: '/legal', lessonIds: legalEnglishLessons.map(l => l.id) },
}

const cache: Partial<Record<SourceLang, Map<string, string>>> = {}
const buildPromises: Partial<Record<SourceLang, Promise<Map<string, string>>>> = {}

const SPAN_RE = /<span\s+class="(?:uk-word|term)"[^>]*data-def="([^"]*)"[^>]*>([^<]+)<\/span>/g

function normalize(s: string): string {
  return s.normalize('NFC').trim().toLowerCase()
}

function decodeHtml(s: string): string {
  return s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function harvest(node: unknown, sink: (word: string, def: string) => void) {
  if (node == null) return
  if (typeof node === 'string') {
    SPAN_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = SPAN_RE.exec(node)) !== null) {
      const def = decodeHtml(m[1])
      const word = decodeHtml(m[2])
      if (def && word) sink(word, def)
    }
    return
  }
  if (Array.isArray(node)) {
    for (const x of node) harvest(x, sink)
    return
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>
    // vocab-preload section: words[].def 是结构化数据，不是 html，单独处理
    if (obj.type === 'vocab-preload' && Array.isArray(obj.groups)) {
      for (const g of obj.groups as Array<{ words?: Array<{ word?: string; def?: string }> }>) {
        if (Array.isArray(g.words)) {
          for (const w of g.words) {
            if (w?.word && w?.def) sink(String(w.word), String(w.def))
          }
        }
      }
    }
    for (const v of Object.values(obj)) harvest(v, sink)
  }
}

async function build(lang: SourceLang): Promise<Map<string, string>> {
  const config = COURSE_BY_LANG[lang]
  if (!config) return new Map()
  const map = new Map<string, string>()
  await Promise.all(
    config.lessonIds.map(async id => {
      try {
        const res = await fetch(`${config.basePath}/${id}.json`)
        if (!res.ok) return
        const json = await res.json()
        harvest(json, (word, def) => {
          const key = normalize(word)
          if (key && def && !map.has(key)) map.set(key, def)
        })
      } catch {
        /* 单个课时失败不影响整体索引 */
      }
    })
  )
  return map
}

/**
 * 查询单词或词组在课程里的释义（normalize 后精确匹配）
 * 第一次调用时并行 fetch 所有课时构建索引，之后直接读内存
 */
export async function lookupCourseDefinition(
  text: string,
  lang: SourceLang
): Promise<string | undefined> {
  const key = normalize(text)
  if (!key) return undefined
  const cached = cache[lang]
  if (cached) return cached.get(key)
  if (!buildPromises[lang]) {
    buildPromises[lang] = build(lang).then(m => {
      cache[lang] = m
      return m
    })
  }
  const map = await buildPromises[lang]!
  return map.get(key)
}

/**
 * 后台预热索引：进入课时页时调用，等用户选词时已构建完毕
 */
export function prefetchCourseDefinitions(lang: SourceLang): void {
  if (cache[lang] || buildPromises[lang]) return
  buildPromises[lang] = build(lang).then(m => {
    cache[lang] = m
    return m
  })
}

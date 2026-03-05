/**
 * Supabase Edge Function: fetch-definition
 *
 * 根据 lang 参数选择词典源：
 * - en (默认): 有道词典（CORS 代理 + HTML 解析）
 * - uk: 英语 Wiktionary（MediaWiki API + HTML 解析）
 *
 * 返回结构化的 { phonetic, definitions, examples }，不做加粗处理
 */

import { DOMParser, Element } from 'https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DefinitionResult {
  phonetic: { us?: string; uk?: string; ipa?: string }
  definitions: string[]
  examples: { en: string; zh: string }[]
}

// ═══════════════════════════════════════════════════════════════════
// 有道词典 (English)
// ═══════════════════════════════════════════════════════════════════

async function fetchFromYoudao(word: string): Promise<DefinitionResult> {
  const url = `https://dict.youdao.com/w/eng/${encodeURIComponent(word)}/`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }

  const html = await response.text()
  const doc = new DOMParser().parseFromString(html, 'text/html')
  if (!doc) throw new Error('无法解析 HTML')

  // 音标
  let phoneticUs = ''
  let phoneticUk = ''
  const pronounces = doc.querySelectorAll('h2.wordbook-js .baav .pronounce')
  for (const p of pronounces) {
    const el = p as Element
    const phon = el.querySelector('span.phonetic')
    if (phon) {
      const text = phon.textContent.trim()
      const parentText = el.textContent
      if (parentText.includes('英')) {
        phoneticUk = text
      } else if (parentText.includes('美')) {
        phoneticUs = text
      }
    }
  }

  // 释义
  const explainLis = doc.querySelectorAll('#phrsListTab div.trans-container ul li')
  const definitions: string[] = []
  for (const li of explainLis) {
    const text = li.textContent.trim()
    if (text) definitions.push(text)
  }
  if (definitions.length === 0) {
    definitions.push('暂无释义')
  }

  // 例句（最多 3 条，不做加粗）
  const examples: { en: string; zh: string }[] = []
  const exampleItems = doc.querySelectorAll('#bilingual ul.ol li')
  let count = 0
  for (const li of exampleItems) {
    if (count >= 3) break
    const ps = (li as Element).querySelectorAll('p')
    if (ps.length >= 2) {
      const eng = ps[0].textContent.replace(/\n+$/, '')
      const zh = ps[1].textContent.replace(/\n+$/, '')
      if (eng && zh) {
        examples.push({ en: eng, zh: zh })
        count++
      }
    }
  }

  return {
    phonetic: { us: phoneticUs, uk: phoneticUk },
    definitions,
    examples,
  }
}

// ═══════════════════════════════════════════════════════════════════
// Wiktionary (Ukrainian / non-English)
// ═══════════════════════════════════════════════════════════════════

/**
 * 从英语 Wiktionary 获取乌克兰语单词的释义
 *
 * 流程：
 * 1. 调用 MediaWiki parse API 获取页面渲染 HTML
 * 2. 按 <h2> 切分语言段落，定位 Ukrainian 段落
 * 3. 提取 IPA 音标、释义列表、用例
 */
async function fetchFromWiktionary(word: string, langSection: string): Promise<DefinitionResult> {
  const apiUrl = `https://en.wiktionary.org/w/api.php?` +
    `action=parse&page=${encodeURIComponent(word)}&format=json&prop=text&redirects=1`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  let response: Response
  try {
    response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }

  const json = await response.json()
  if (json.error) {
    throw new Error(json.error.info || '未找到 Wiktionary 词条')
  }

  const fullHtml: string = json.parse?.text?.['*']
  if (!fullHtml) throw new Error('无法获取页面内容')

  // 按 <h2> 切分语言段落，定位目标语言段
  const sectionHtml = extractLanguageSection(fullHtml, langSection)
  if (!sectionHtml) throw new Error(`未找到 ${langSection} 语言段落`)

  const doc = new DOMParser().parseFromString(`<div>${sectionHtml}</div>`, 'text/html')
  if (!doc) throw new Error('无法解析段落 HTML')

  // IPA 音标
  let ipa = ''
  const ipaSpan = doc.querySelector('.IPA')
  if (ipaSpan) {
    ipa = ipaSpan.textContent.trim()
  }

  // 释义：<ol> 中的 <li>（跳过嵌套在其他 <li> 中的子列表）
  const definitions: string[] = []
  const ols = doc.querySelectorAll('ol')
  for (const ol of ols) {
    // 跳过嵌套在 <li> 内的 <ol>（子释义列表）
    const parent = (ol as Element).parentElement
    if (parent && parent.tagName === 'LI') continue

    for (const child of (ol as Element).children) {
      if (child.tagName !== 'LI') continue
      if (definitions.length >= 6) break

      // 克隆节点，移除嵌套列表和例句区域后取纯文本
      const clone = child.cloneNode(true) as Element
      for (const nested of clone.querySelectorAll('ol, ul, dl, .nyms-toggle')) {
        (nested as Element).remove()
      }
      const text = clone.textContent.replace(/\s+/g, ' ').trim()
      if (text) definitions.push(text)
    }
  }

  if (definitions.length === 0) {
    definitions.push('暂无释义')
  }

  // 例句：Wiktionary 用 .h-usage-example 包裹例句
  // .e-example = 原文句子，.e-translation = 翻译
  const examples: { en: string; zh: string }[] = []
  const exDivs = doc.querySelectorAll('.h-usage-example')
  let exCount = 0
  for (const div of exDivs) {
    if (exCount >= 3) break
    const exEl = (div as Element).querySelector('.e-example')
    const trEl = (div as Element).querySelector('.e-translation')
    if (exEl) {
      examples.push({
        en: exEl.textContent.trim(),
        zh: trEl?.textContent.trim() || '',
      })
      exCount++
    }
  }

  return {
    phonetic: { ipa },
    definitions,
    examples,
  }
}

/**
 * 从完整 HTML 中提取指定语言的段落
 * Wiktionary 页面按 <h2> 分隔不同语言
 */
function extractLanguageSection(fullHtml: string, langName: string): string | null {
  // 查找所有 <h2> 的位置
  const h2Regex = /<h2[\s>]/gi
  const positions: number[] = []
  let match
  while ((match = h2Regex.exec(fullHtml)) !== null) {
    positions.push(match.index)
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i]
    const end = i + 1 < positions.length ? positions[i + 1] : fullHtml.length
    const section = fullHtml.substring(start, end)

    if (section.includes(`id="${langName}"`)) {
      return section
    }
  }

  return null
}

// ═══════════════════════════════════════════════════════════════════

/** 语言代码 → Wiktionary 语言段落名 */
const LANG_SECTION_MAP: Record<string, string> = {
  uk: 'Ukrainian',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { word, lang } = body

    if (!word || typeof word !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: '缺少 word 参数' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let result: DefinitionResult

    const langSection = LANG_SECTION_MAP[lang]
    if (langSection) {
      result = await fetchFromWiktionary(word, langSection)
    } else {
      result = await fetchFromYoudao(word)
    }

    return new Response(
      JSON.stringify({ success: true, definition: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in fetch-definition:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || '服务器错误' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

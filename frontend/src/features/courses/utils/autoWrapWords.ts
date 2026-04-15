/**
 * 把 HTML 片段中的目标语种单词自动包成可点击 span。
 * 已被手工标注（.uk-word / .term / .tts-word）的词组原样保留；
 * code / pre / input / textarea / script / style 内部不处理。
 */

type Lang = 'uk' | 'en'

const WORD_PATTERNS: Record<Lang, RegExp> = {
  // 西里尔字母，至少 2 个字符（含撇号连接如 м'яч）
  uk: /[\u0400-\u04FF]+(?:['\u2019][\u0400-\u04FF]+)*/gu,
  // 拉丁字母，允许连字符 / 撇号连接（self-executing / don't）
  en: /[A-Za-z]+(?:[-'\u2019][A-Za-z]+)*/g
}

const SKIP_CLASS_RE = /(^|\s)(uk-word|term|tts-word)(\s|$)/
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'INPUT', 'TEXTAREA'])

function shouldSkip(node: Text): boolean {
  let p: HTMLElement | null = node.parentElement
  while (p) {
    if (SKIP_TAGS.has(p.tagName)) return true
    const cls = typeof p.className === 'string' ? p.className : ''
    if (cls && SKIP_CLASS_RE.test(cls)) return true
    if (p.hasAttribute('data-no-wrap')) return true
    p = p.parentElement
  }
  return false
}

export function autoWrapWords(
  html: string | undefined | null,
  wordClass: string,
  lang: Lang
): string {
  if (!html) return ''
  if (typeof document === 'undefined') return html
  const pattern = WORD_PATTERNS[lang]
  if (!pattern) return html

  const container = document.createElement('div')
  container.innerHTML = html

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
  const textNodes: Text[] = []
  let n: Node | null = walker.nextNode()
  while (n) { textNodes.push(n as Text); n = walker.nextNode() }

  for (const t of textNodes) {
    if (shouldSkip(t)) continue
    const text = t.nodeValue || ''
    if (!text) continue
    pattern.lastIndex = 0
    // 无匹配快速跳过（避免 fragment 构造开销）
    if (!pattern.test(text)) continue
    pattern.lastIndex = 0

    const frag = document.createDocumentFragment()
    let last = 0
    let m: RegExpExecArray | null
    let wrapped = false
    while ((m = pattern.exec(text)) !== null) {
      if (m[0].length < 2) continue  // 跳过单字母（乌语语法演示 / 零散字符）
      if (m.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, m.index)))
      }
      const span = document.createElement('span')
      span.className = wordClass
      span.textContent = m[0]
      frag.appendChild(span)
      last = m.index + m[0].length
      wrapped = true
    }
    if (!wrapped) continue
    if (last < text.length) {
      frag.appendChild(document.createTextNode(text.slice(last)))
    }
    t.replaceWith(frag)
  }

  return container.innerHTML
}

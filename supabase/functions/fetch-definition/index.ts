/**
 * Supabase Edge Function: fetch-definition
 *
 * 从有道词典爬取单词释义（CORS 代理 + HTML 解析）
 * 返回结构化的 { phonetic, definitions, examples }，不做加粗处理
 */

import { DOMParser, Element } from 'https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DefinitionResult {
  phonetic: { us: string; uk: string }
  definitions: string[]
  examples: { en: string; zh: string }[]
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 认证由 Supabase 网关的 verify_jwt 处理，函数内无需重复验证

    const body = await req.json()
    const { word } = body

    if (!word || typeof word !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: '缺少 word 参数' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 请求有道词典，10s 超时
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
    if (!doc) {
      return new Response(
        JSON.stringify({ success: false, error: '无法解析 HTML' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    const result: DefinitionResult = {
      phonetic: { us: phoneticUs, uk: phoneticUk },
      definitions,
      examples,
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

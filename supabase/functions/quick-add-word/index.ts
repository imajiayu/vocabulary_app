/**
 * Supabase Edge Function: quick-add-word
 *
 * iOS 快捷指令快速添加单词到词库。
 * 支持多用户，通过 API Key 区分。
 *
 * 环境变量 QUICK_ADD_USERS: JSON 映射
 * { "key1": { "user_id": "uuid", "default_source": "IELTS" }, ... }
 *
 * GET  /quick-add-word → 返回用户的 source 列表 + 默认值
 * POST /quick-add-word → { "word": "apple", "source": "IELTS" }
 *   - 同步调用 fetch-definition Edge Function 拿释义并入库
 *   - 返回 message 中包含每个已添加单词的简短释义
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

interface UserConfig {
  user_id: string
  default_source: string
}

interface DefinitionObject {
  phonetic?: { us?: string; uk?: string; ipa?: string }
  definitions?: string[]
  examples?: { en: string; zh: string }[]
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function authenticate(req: Request): UserConfig | Response {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  let users: Record<string, UserConfig>
  try {
    users = JSON.parse(Deno.env.get('QUICK_ADD_USERS') || '{}')
  } catch {
    return json({ success: false, error: 'QUICK_ADD_USERS config invalid' }, 500)
  }

  if (!token || !users[token]) {
    return json({ success: false, error: 'Unauthorized' }, 401)
  }

  return users[token]
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

// 单词加粗（移植自 frontend/src/shared/utils/definition.ts）
function boldWordInSentence(sentence: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `(?<!<strong>)(?<!\\p{L})(${escaped})(?!\\p{L})(?!<\\/strong>)`, 'giu'
  )
  return sentence.replace(pattern, '<strong>$1</strong>')
}

function applyBoldToDefinition(def: DefinitionObject, word: string): DefinitionObject {
  if (!def.examples?.length) return def
  return {
    ...def,
    examples: def.examples.map(ex => ({ ...ex, en: boldWordInSentence(ex.en, word) })),
  }
}

// 调用同项目下的 fetch-definition Edge Function
async function fetchDefinition(word: string, lang: string): Promise<DefinitionObject | null> {
  try {
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fetch-definition`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ word, lang }),
    })
    if (!resp.ok) return null
    const body = await resp.json()
    if (!body.success || !body.definition) return null
    return body.definition as DefinitionObject
  } catch {
    return null
  }
}

// 从释义对象中提取简短文本，用于返回 message
function shortDefinitionText(def: DefinitionObject | null): string {
  if (!def?.definitions?.length) return ''
  const first = def.definitions[0].replace(/\s+/g, ' ').trim()
  if (!first || first === '暂无释义') return ''
  return first.length > 60 ? `${first.slice(0, 60)}…` : first
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authResult = authenticate(req)
  if (authResult instanceof Response) return authResult
  const user = authResult

  const supabase = getSupabase()

  // 读取 user_config（GET 和 POST 都要用）
  const { data: cfgRow } = await supabase
    .from('user_config')
    .select('config')
    .eq('user_id', user.user_id)
    .single()

  const sources: string[] = cfgRow?.config?.sources?.sourceOrder || []
  const customSources: Record<string, string> = cfgRow?.config?.sources?.customSources || {}

  // GET: 返回 source 列表
  if (req.method === 'GET') {
    return json({
      success: true,
      sources,
      default_source: user.default_source,
    })
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405)
  }

  // POST: 添加单词
  let words: string[]
  let source: string
  try {
    const body = await req.json()
    if (body.word) {
      words = [body.word]
    } else if (Array.isArray(body.words)) {
      words = body.words
    } else {
      throw new Error('Missing "word" or "words" field')
    }
    source = body.source || user.default_source
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 400)
  }

  // 该 source 对应的语言（找不到默认 en）
  const lang = customSources[source] || 'en'

  // 语言特定的字符规范化：
  // - 乌克兰语：ASCII ' (U+0027) 与智能右单引号 ' (U+2019) 在词内一律应为修饰字母撇号 ʼ (U+02BC)
  //   （与前端 frontend/src/shared/config/sourceLanguage.ts UK_CONFIG.normalizeInput 保持一致）
  const langNormalize = (w: string): string => {
    if (lang === 'uk') return w.replace(/['’]/g, 'ʼ')
    return w
  }

  // 标准化：NFC + 语言特定 + trim + lowercase + 去重
  const normalized = [...new Set(
    words.map(w => langNormalize(w.normalize('NFC')).trim().toLowerCase()).filter(w => w.length > 0)
  )]

  if (normalized.length === 0) {
    return json({ success: false, error: 'No valid words provided' }, 400)
  }

  // 并行抓释义（每个词独立失败处理，互不影响）
  const definitions = await Promise.all(
    normalized.map(async (word) => {
      const raw = await fetchDefinition(word, lang)
      return raw ? applyBoldToDefinition(raw, word) : null
    })
  )

  const today = new Date().toISOString().split('T')[0]

  const added: { word: string; def: string }[] = []
  const duplicates: string[] = []
  const errors: string[] = []

  for (let i = 0; i < normalized.length; i++) {
    const word = normalized[i]
    const def = definitions[i]
    const row = {
      user_id: user.user_id,
      word,
      definition: def ? JSON.stringify(def) : '{}',
      source,
      date_added: today,
      next_review: today,
      stop_review: 0,
    }

    const { error } = await supabase.from('words').insert(row)
    if (!error) {
      added.push({ word, def: shortDefinitionText(def) })
    } else if (error.code === '23505') {
      duplicates.push(word)
    } else {
      errors.push(`${word}: ${error.message}`)
    }
  }

  const parts: string[] = []
  if (added.length > 0) {
    const addedText = added
      .map(({ word, def }) => (def ? `${word} (${def})` : word))
      .join(', ')
    parts.push(`已添加: ${addedText}`)
  }
  if (duplicates.length > 0) parts.push(`已存在: ${duplicates.join(', ')}`)
  if (errors.length > 0) parts.push(`错误: ${errors.join('; ')}`)

  return json({
    success: errors.length === 0,
    message: parts.join(' | '),
    added: added.map(a => a.word),
    duplicates,
    errors,
  })
})

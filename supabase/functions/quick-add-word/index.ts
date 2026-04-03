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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authResult = authenticate(req)
  if (authResult instanceof Response) return authResult
  const user = authResult

  const supabase = getSupabase()

  // GET: 从 user_config 读取 source 列表
  if (req.method === 'GET') {
    const { data } = await supabase
      .from('user_config')
      .select('config')
      .eq('user_id', user.user_id)
      .single()

    const sources: string[] = data?.config?.sources?.sourceOrder || []

    return json({
      success: true,
      sources,
      default_source: user.default_source,
    })
  }

  // 仅接受 POST
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

  // 标准化：trim + lowercase + NFC + 去重
  const normalized = [...new Set(
    words.map(w => w.normalize('NFC').trim().toLowerCase()).filter(w => w.length > 0)
  )]

  if (normalized.length === 0) {
    return json({ success: false, error: 'No valid words provided' }, 400)
  }

  const today = new Date().toISOString().split('T')[0]
  const rows = normalized.map(word => ({
    user_id: user.user_id,
    word,
    definition: '{}',
    source,
    date_added: today,
    next_review: today,
    stop_review: 0,
  }))

  const added: string[] = []
  const duplicates: string[] = []
  const errors: string[] = []

  for (const row of rows) {
    const { error } = await supabase.from('words').insert(row)
    if (!error) {
      added.push(row.word)
    } else if (error.code === '23505') {
      duplicates.push(row.word)
    } else {
      errors.push(`${row.word}: ${error.message}`)
    }
  }

  const parts: string[] = []
  if (added.length > 0) parts.push(`已添加: ${added.join(', ')}`)
  if (duplicates.length > 0) parts.push(`已存在: ${duplicates.join(', ')}`)
  if (errors.length > 0) parts.push(`错误: ${errors.join('; ')}`)

  return json({
    success: errors.length === 0,
    message: parts.join(' | '),
    added,
    duplicates,
    errors,
  })
})

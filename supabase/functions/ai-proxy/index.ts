/**
 * Supabase Edge Function: ai-proxy
 *
 * OpenAI 兼容的 chat/completions 代理，把上游 API key 收敛到服务端。
 * 支持流式（SSE 透传）和非流式两种模式。
 *
 * 环境变量：
 *   AI_BASE_URL — 上游 API base，如 https://api.deepseek.com
 *   AI_API_KEY  — 上游 API key
 *   AI_MODEL    — 模型名，如 deepseek-chat（前端传入的 model 会被强制覆盖）
 */

import { createClient } from 'npm:@supabase/supabase-js@2.95.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// 白名单：前端只能传这些字段，避免滥用（tools / user / top_p / n 等不放行）
const ALLOWED_FIELDS = ['messages', 'temperature', 'max_tokens', 'stream', 'response_format'] as const

function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function jsonError(msg: string, status = 200): Response {
  // 沿用项目约定：错误也返回 HTTP 200 + {success:false}，避免 supabase.functions.invoke 丢失 body
  // 401/405/400 仍用对应 status，方便手写 fetch 分支感知
  return new Response(
    JSON.stringify({ success: false, error: msg }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonError('Method not allowed', 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonError('Unauthorized: missing Authorization', 401)

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return jsonError('Unauthorized', 401)

    const aiBaseUrl = Deno.env.get('AI_BASE_URL')
    const aiApiKey = Deno.env.get('AI_API_KEY')
    const aiModel = Deno.env.get('AI_MODEL')
    if (!aiBaseUrl || !aiApiKey || !aiModel) {
      return jsonError('AI proxy not configured (missing AI_BASE_URL / AI_API_KEY / AI_MODEL)', 500)
    }

    let raw: Record<string, unknown>
    try {
      raw = await req.json()
    } catch {
      return jsonError('Invalid JSON body', 400)
    }

    const filtered: Record<string, unknown> = {}
    for (const k of ALLOWED_FIELDS) {
      if (k in raw) filtered[k] = raw[k]
    }
    if (!Array.isArray(filtered.messages) || filtered.messages.length === 0) {
      return jsonError('messages required', 400)
    }
    // 服务端强制注入 model，忽略前端传入值
    filtered.model = aiModel

    const isStream = filtered.stream === true

    const upstream = await fetch(`${aiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiApiKey}`,
      },
      body: JSON.stringify(filtered),
    })

    if (isStream) {
      if (!upstream.ok || !upstream.body) {
        const errText = await upstream.text().catch(() => '')
        // 流式失败也要用 SSE 单帧返回，前端 streamAI 统一按 SSE 解析识别 error
        const sse = `data: ${JSON.stringify({ error: `Upstream ${upstream.status}: ${errText}` })}\n\n`
        return new Response(sse, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        })
      }
      return new Response(upstream.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          // 防中间层缓冲流式响应
          'X-Accel-Buffering': 'no',
        },
      })
    }

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '')
      return jsonResponse({ success: false, error: `Upstream ${upstream.status}: ${errText}` })
    }
    const data = await upstream.json()
    return jsonResponse({ success: true, data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return jsonError(`ai-proxy 内部错误: ${msg}`, 500)
  }
})

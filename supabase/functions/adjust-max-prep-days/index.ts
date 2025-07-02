/**
 * Supabase Edge Function: adjust-max-prep-days
 *
 * 当 maxPrepDays 设置变小时，调整超出范围的单词复习时间
 * 移植自 backend/database/vocabulary/word_review.py:230-289
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AdjustRequest {
  maxPrepDays: number
}

interface AdjustResponse {
  success: boolean
  affected: {
    interval: number
    next_review: number
    spell_next_review: number
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 验证用户身份（网关 verify_jwt 已关闭，由函数内 getUser 验证）
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const userId = user.id

    // 解析请求体
    const body: AdjustRequest = await req.json()
    const { maxPrepDays } = body

    if (typeof maxPrepDays !== 'number' || maxPrepDays < 1) {
      return new Response(
        JSON.stringify({ success: false, error: 'maxPrepDays 必须是正整数' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Service role 客户端（绕过 RLS，执行批量更新）
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 计算最大日期
    const today = new Date()
    const maxDate = new Date(today)
    maxDate.setDate(maxDate.getDate() + maxPrepDays)
    const maxDateStr = maxDate.toISOString().split('T')[0]

    // 1. 调整 interval 超过 maxPrepDays 的单词
    const { data: intervalData, error: intervalError } = await supabase
      .from('words')
      .update({
        interval: maxPrepDays,
        next_review: maxDateStr
      })
      .eq('user_id', userId)
      .eq('stop_review', 0)
      .gt('interval', maxPrepDays)
      .select('id')

    if (intervalError) {
      throw new Error(`调整 interval 失败: ${intervalError.message}`)
    }
    const affectedInterval = intervalData?.length || 0

    // 2. 调整 next_review 超出范围的单词
    const { data: nextReviewData, error: nextReviewError } = await supabase
      .from('words')
      .update({ next_review: maxDateStr })
      .eq('user_id', userId)
      .eq('stop_review', 0)
      .not('next_review', 'is', null)
      .gt('next_review', maxDateStr)
      .lte('interval', maxPrepDays)  // 排除已经被第1步处理的
      .select('id')

    if (nextReviewError) {
      throw new Error(`调整 next_review 失败: ${nextReviewError.message}`)
    }
    const affectedNextReview = nextReviewData?.length || 0

    // 3. 调整 spell_next_review 超出范围的单词
    const { data: spellData, error: spellError } = await supabase
      .from('words')
      .update({ spell_next_review: maxDateStr })
      .eq('user_id', userId)
      .eq('stop_review', 0)
      .not('spell_next_review', 'is', null)
      .gt('spell_next_review', maxDateStr)
      .select('id')

    if (spellError) {
      throw new Error(`调整 spell_next_review 失败: ${spellError.message}`)
    }
    const affectedSpellNextReview = spellData?.length || 0

    const response: AdjustResponse = {
      success: true,
      affected: {
        interval: affectedInterval,
        next_review: affectedNextReview,
        spell_next_review: affectedSpellNextReview
      }
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in adjust-max-prep-days:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || '服务器错误' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

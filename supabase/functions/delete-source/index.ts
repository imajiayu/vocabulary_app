/**
 * Supabase Edge Function: delete-source
 *
 * 级联删除指定 source 及其所有关联数据
 * 移植自 backend/api/settings.py:67-114
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteSourceRequest {
  sourceName: string
}

interface DeleteSourceResponse {
  success: boolean
  message: string
  deleted_words: number
  deleted_progress: number
  remaining_sources: string[]
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
    const body: DeleteSourceRequest = await req.json()
    const { sourceName } = body

    if (!sourceName || typeof sourceName !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'sourceName 不能为空' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Service role 客户端（绕过 RLS，执行级联删除）
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. 获取当前用户配置
    const { data: configData, error: configError } = await supabase
      .from('user_config')
      .select('config')
      .eq('user_id', userId)
      .single()

    if (configError) {
      throw new Error(`获取用户配置失败: ${configError.message}`)
    }

    const config = configData?.config || {}
    const customSources: string[] = config?.sources?.customSources || ['IELTS', 'GRE']

    // 验证：至少保留 1 个 source
    if (customSources.length <= 1) {
      return new Response(
        JSON.stringify({ success: false, error: '至少需要保留1个source' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 验证：source 存在
    if (!customSources.includes(sourceName)) {
      return new Response(
        JSON.stringify({ success: false, error: `source '${sourceName}' 不存在` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. 删除 words 表中该 source 的记录
    const { data: deletedWords, error: wordsError } = await supabase
      .from('words')
      .delete()
      .eq('user_id', userId)
      .eq('source', sourceName)
      .select('id')

    if (wordsError) {
      throw new Error(`删除单词失败: ${wordsError.message}`)
    }
    const deletedWordsCount = deletedWords?.length || 0

    // 3. 删除 current_progress 表中该 source 的记录
    const { data: deletedProgress, error: progressError } = await supabase
      .from('current_progress')
      .delete()
      .eq('user_id', userId)
      .eq('source', sourceName)
      .select('id')

    if (progressError) {
      throw new Error(`删除进度失败: ${progressError.message}`)
    }
    const deletedProgressCount = deletedProgress?.length || 0

    // 4. 更新 user_config 中的 customSources
    const remainingSources = customSources.filter(s => s !== sourceName)
    const updatedConfig = {
      ...config,
      sources: {
        ...config.sources,
        customSources: remainingSources
      }
    }

    const { error: updateError } = await supabase
      .from('user_config')
      .update({ config: updatedConfig })
      .eq('user_id', userId)

    if (updateError) {
      throw new Error(`更新配置失败: ${updateError.message}`)
    }

    const response: DeleteSourceResponse = {
      success: true,
      message: `成功删除 source '${sourceName}'`,
      deleted_words: deletedWordsCount,
      deleted_progress: deletedProgressCount,
      remaining_sources: remainingSources
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in delete-source:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || '服务器错误' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

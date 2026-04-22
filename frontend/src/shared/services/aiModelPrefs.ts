/**
 * AI 模型偏好 — 按 caller 解析用户配置的 model（文本/STT/TTS）
 *
 * 读取：
 *   - 文本：user_config.config.aiModels[caller]
 *   - STT： user_config.config.aiSttModel
 *   - TTS： user_config.config.aiTtsModel
 *
 * 缺省：
 *   - 文本：AI_CALLERS[caller].defaultModel
 *   - STT： AI_STT_DEFAULT
 *   - TTS： AI_TTS_DEFAULT
 *
 * 模块级缓存避免每次 AI 调用都打 Supabase。Settings 页面保存后须调用
 * invalidateAiModelPrefs() 让下次调用重新拉取。
 */

import {
  AI_CALLERS,
  AI_STT_DEFAULT,
  AI_TTS_DEFAULT,
  type AiCaller,
} from '@/shared/constants/ai-callers'
import { SettingsSupabaseApi } from '@/shared/api/settings-supabase'

interface AiPrefs {
  text: Record<string, string>
  stt: string
  tts: string
}

let cache: AiPrefs | null = null
let pending: Promise<AiPrefs> | null = null

async function loadFromSupabase(): Promise<AiPrefs> {
  try {
    const settings = await SettingsSupabaseApi.getSettings()
    return {
      text: (settings.aiModels && typeof settings.aiModels === 'object') ? settings.aiModels : {},
      stt: (settings.aiSttModel ?? '').trim(),
      tts: (settings.aiTtsModel ?? '').trim(),
    }
  } catch {
    return { text: {}, stt: '', tts: '' }
  }
}

async function ensureLoaded(): Promise<AiPrefs> {
  if (cache) return cache
  if (!pending) {
    pending = loadFromSupabase().then(r => {
      cache = r
      pending = null
      return r
    })
  }
  return pending
}

/** 文本 model — 优先级：user_config.aiModels[caller] > AI_CALLERS[caller].defaultModel */
export async function resolveModelForCaller(caller: AiCaller): Promise<string> {
  const prefs = await ensureLoaded()
  const user = prefs.text[caller]?.trim()
  return user || AI_CALLERS[caller].defaultModel
}

/** STT model — 优先级：user_config.aiSttModel > AI_STT_DEFAULT */
export async function resolveSttModel(): Promise<string> {
  const prefs = await ensureLoaded()
  return prefs.stt || AI_STT_DEFAULT
}

/** TTS model — 优先级：user_config.aiTtsModel > AI_TTS_DEFAULT */
export async function resolveTtsModel(): Promise<string> {
  const prefs = await ensureLoaded()
  return prefs.tts || AI_TTS_DEFAULT
}

/** Settings 页面保存后调用 */
export function invalidateAiModelPrefs(): void {
  cache = null
  pending = null
}

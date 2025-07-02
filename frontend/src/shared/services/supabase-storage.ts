/**
 * Supabase Storage 服务
 * 用于音频文件的上传和删除
 */

import { supabase } from '@/shared/config/supabase'
import { getCurrentUserId } from '@/shared/composables/useAuth'
import { logger } from '@/shared/utils/logger'

const AUDIO_BUCKET = 'speaking-audios'

/**
 * 上传音频文件到 Supabase Storage
 * @param file 音频文件
 * @returns 公开访问 URL
 */
export async function uploadAudio(file: File): Promise<string> {
  // 生成带时间戳和用户ID的文件名
  const timestamp = Date.now()
  const extension = file.name.split('.').pop() || 'wav'
  const userId = getCurrentUserId()
  const filename = `user_${userId}/recording_${timestamp}.${extension}`

  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(filename, file, {
      contentType: file.type || 'audio/wav',
      upsert: false
    })

  if (error) {
    throw new Error(`上传音频失败: ${error.message}`)
  }

  // 获取公开访问 URL
  const { data } = supabase.storage
    .from(AUDIO_BUCKET)
    .getPublicUrl(filename)

  return data.publicUrl
}

/**
 * 从 Supabase Storage 删除音频文件
 * @param url 音频文件的公开 URL
 */
export async function deleteAudio(url: string): Promise<void> {
  const filename = extractFilename(url)
  if (!filename) {
    logger.warn('无法从 URL 提取文件名:', url)
    return
  }

  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .remove([filename])

  if (error) {
    logger.error('删除音频失败:', error.message)
  }
}

/**
 * 从 Supabase Storage URL 提取文件路径
 * @param url 完整的 URL
 * @returns 相对于 bucket 的文件路径，如果无法解析则返回 null
 */
export function extractFilename(url: string): string | null {
  if (!url) return null

  try {
    // URL 格式: https://xxx.supabase.co/storage/v1/object/public/speaking-audios/user_1/recording_xxx.wav
    // 需要提取 bucket 名称之后的完整路径: user_1/recording_xxx.wav
    const bucketMarker = `/${AUDIO_BUCKET}/`
    const index = url.indexOf(bucketMarker)
    if (index === -1) return null
    return url.slice(index + bucketMarker.length) || null
  } catch {
    return null
  }
}

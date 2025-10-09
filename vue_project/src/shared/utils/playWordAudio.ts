// src/utils/playWordAudio.ts

let currentAudio: HTMLAudioElement | null = null
let currentRetryController: AbortController | null = null

/**
 * 播放单词音频（US / UK）
 * @param word 单词文本
 * @param region 'us' | 'uk'，默认 'us'
 * @param maxRetries 最大重试次数，默认5次
 * @param retryDelay 重试延迟（毫秒），默认300ms
 */
export async function playWordAudio(
  word: string,
  region: 'us' | 'uk' = 'us',
  maxRetries: number = 5,
  retryDelay: number = 300
) {
  if (!word) return

  // 取消之前的重试任务
  if (currentRetryController) {
    currentRetryController.abort()
    currentRetryController = null
  }

  // 停止上一个音频
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio.src = ''
    currentAudio = null
  }

  // 构建音频 URL
  const type = region === 'us' ? 2 : 1
  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`

  // 创建重试控制器
  const retryController = new AbortController()
  currentRetryController = retryController

  // 带重试的播放逻辑
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 检查是否被取消
    if (retryController.signal.aborted) {
      return
    }

    // 创建新的 Audio 播放
    const audio = new Audio(url)
    currentAudio = audio

    try {
      await audio.play()

      // 播放成功，清理重试控制器
      if (currentRetryController === retryController) {
        currentRetryController = null
      }

      // 播放结束后清理
      audio.onended = () => {
        if (currentAudio === audio) {
          currentAudio = null
        }
      }
      audio.onpause = () => {
        if (currentAudio === audio) {
          currentAudio = null
        }
      }

      return // 播放成功，退出
    } catch (err) {
      // 清理失败的音频对象
      if (currentAudio === audio) {
        currentAudio = null
      }

      // 检查是否被取消
      if (retryController.signal.aborted) {
        return
      }

      // 判断是否是最后一次尝试
      if (attempt === maxRetries) {
        console.error(`播放音频失败，已重试 ${maxRetries} 次`, err)
        // 清理重试控制器
        if (currentRetryController === retryController) {
          currentRetryController = null
        }
        return
      }

      // 不是最后一次，等待后重试
      console.warn(`播放音频失败 (尝试 ${attempt + 1}/${maxRetries + 1})，${retryDelay}ms 后重试...`, err)

      // 等待指定时间后重试
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, retryDelay)
        // 如果被取消，清除定时器
        retryController.signal.addEventListener('abort', () => {
          clearTimeout(timer)
          resolve()
        })
      })
    }
  }
}

/**
 * 停止当前音频播放（可选）
 */
export function stopWordAudio() {
  // 取消重试任务
  if (currentRetryController) {
    currentRetryController.abort()
    currentRetryController = null
  }

  // 停止音频
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio.src = ''
    currentAudio = null
  }
}

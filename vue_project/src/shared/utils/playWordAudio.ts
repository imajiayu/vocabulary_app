// src/utils/playWordAudio.ts

let currentAudio: HTMLAudioElement | null = null

/**
 * 播放单词音频（US / UK）
 * @param word 单词文本
 * @param region 'us' | 'uk'，默认 'us'
 */
export async function playWordAudio(word: string, region: 'us' | 'uk' = 'us') {
  if (!word) return

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

  // 创建新的 Audio 播放
  const audio = new Audio(url)
  currentAudio = audio

  try {
    await audio.play()
  } catch (err) {
    console.error('播放音频失败', err)
  }

  // 播放结束后清理
  audio.onended = () => {
    currentAudio = null
  }
  audio.onpause = () => {
    currentAudio = null
  }
}

/**
 * 停止当前音频播放（可选）
 */
export function stopWordAudio() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio.src = ''
    currentAudio = null
  }
}

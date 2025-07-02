/**
 * 文本处理工具函数
 */

/**
 * 统计英文单词数
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length
}

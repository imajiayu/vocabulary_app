/**
 * 解析 JSON 响应（处理可能的 markdown 代码块）
 */
export function parseJsonResponse<T>(response: string): T {
  // 移除可能的 markdown 代码块标记
  let cleaned = response.trim()

  // 处理 ```json ... ``` 格式
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }

  cleaned = cleaned.trim()

  return JSON.parse(cleaned)
}

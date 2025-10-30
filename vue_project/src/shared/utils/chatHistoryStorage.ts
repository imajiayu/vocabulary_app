/**
 * 聊天记录存储管理工具
 * 使用 localStorage 存储以单词为 key 的聊天记录
 */

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
}

interface WordChatHistory {
  messages: ChatMessage[]
  lastAccess: number
  expiresAt: number
}

interface ChatHistoryStore {
  [word: string]: WordChatHistory
}

const STORAGE_KEY = 'vocabulary-assistance-history'
const EXPIRY_HOURS = 24 // 24小时后过期
const MAX_MESSAGES_PER_WORD = 20 // 每个单词最多保存20条消息（10轮对话）

/**
 * 聊天历史存储管理器
 */
export class ChatHistoryStorage {
  /**
   * 获取所有聊天历史
   */
  private static getStore(): ChatHistoryStore {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      return data ? JSON.parse(data) : {}
    } catch (error) {
      console.error('读取聊天历史失败:', error)
      return {}
    }
  }

  /**
   * 保存聊天历史
   */
  private static saveStore(store: ChatHistoryStore): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    } catch (error) {
      console.error('保存聊天历史失败:', error)
      // 如果存储失败（可能是容量满了），尝试清理过期记录后重试
      this.cleanExpired()
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
      } catch (retryError) {
        console.error('重试保存失败:', retryError)
      }
    }
  }

  /**
   * 获取指定单词的聊天记录
   * @param word 单词
   * @returns 聊天消息数组，如果过期或不存在则返回空数组
   */
  static getMessages(word: string): ChatMessage[] {
    if (!word) return []

    const store = this.getStore()
    const history = store[word]

    if (!history) return []

    // 检查是否过期
    const now = Date.now()
    if (now > history.expiresAt) {
      // 已过期，删除并返回空数组
      delete store[word]
      this.saveStore(store)
      return []
    }

    // 更新最后访问时间
    history.lastAccess = now
    this.saveStore(store)

    return history.messages
  }

  /**
   * 保存单词的聊天记录
   * @param word 单词
   * @param messages 聊天消息数组
   */
  static saveMessages(word: string, messages: ChatMessage[]): void {
    if (!word) return

    const store = this.getStore()
    const now = Date.now()

    // 限制消息数量，保留最近的消息
    const limitedMessages = messages.slice(-MAX_MESSAGES_PER_WORD)

    // 添加时间戳
    const messagesWithTimestamp = limitedMessages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp || now
    }))

    store[word] = {
      messages: messagesWithTimestamp,
      lastAccess: now,
      expiresAt: now + EXPIRY_HOURS * 60 * 60 * 1000
    }

    this.saveStore(store)
  }

  /**
   * 追加新消息到指定单词的聊天记录
   * @param word 单词
   * @param message 新消息
   */
  static appendMessage(word: string, message: ChatMessage): void {
    const existingMessages = this.getMessages(word)
    const newMessage = {
      ...message,
      timestamp: message.timestamp || Date.now()
    }
    this.saveMessages(word, [...existingMessages, newMessage])
  }

  /**
   * 清空指定单词的聊天记录
   * @param word 单词
   */
  static clearMessages(word: string): void {
    if (!word) return

    const store = this.getStore()
    delete store[word]
    this.saveStore(store)
  }

  /**
   * 清理所有过期的聊天记录
   * @returns 清理的记录数
   */
  static cleanExpired(): number {
    const store = this.getStore()
    const now = Date.now()
    let cleanedCount = 0

    Object.keys(store).forEach(word => {
      if (now > store[word].expiresAt) {
        delete store[word]
        cleanedCount++
      }
    })

    if (cleanedCount > 0) {
      this.saveStore(store)
      console.log(`清理了 ${cleanedCount} 条过期的聊天记录`)
    }

    return cleanedCount
  }

  /**
   * 清空所有聊天记录
   */
  static clearAll(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
      console.log('已清空所有聊天记录')
    } catch (error) {
      console.error('清空聊天记录失败:', error)
    }
  }

  /**
   * 获取存储统计信息
   */
  static getStats(): {
    totalWords: number
    totalMessages: number
    oldestAccess: number | null
    storageSize: number
  } {
    const store = this.getStore()
    const words = Object.keys(store)

    let totalMessages = 0
    let oldestAccess: number | null = null

    words.forEach(word => {
      totalMessages += store[word].messages.length
      if (oldestAccess === null || store[word].lastAccess < oldestAccess) {
        oldestAccess = store[word].lastAccess
      }
    })

    // 估算存储大小（字节）
    const storageSize = new Blob([JSON.stringify(store)]).size

    return {
      totalWords: words.length,
      totalMessages,
      oldestAccess,
      storageSize
    }
  }
}

/**
 * 应用启动时自动清理过期记录
 */
export function initChatHistoryStorage(): void {
  ChatHistoryStorage.cleanExpired()
}

// 统一的WebSocket服务管理
import { ref, onUnmounted } from 'vue'
import { io, type Socket } from 'socket.io-client'

// WebSocket事件类型常量
export const WebSocketEvents = {
  // 单词相关事件
  WORD_UPDATED: 'wordUpdated',
  WORD_CREATED: 'wordCreated',
  WORD_DELETED: 'wordDeleted',

  // 语音转录相关事件
  TRANSCRIPTION_UPDATE: 'transcription_update',
  TRANSCRIPTION_STARTED: 'transcription_started',
  TRANSCRIPTION_STOPPED: 'transcription_stopped',
  CHUNK_PROCESSED: 'chunk_processed',

  // 关系生成进度事件
  RELATION_GENERATION_PROGRESS: 'relation_generation_progress',
  RELATION_GENERATION_COMPLETE: 'relation_generation_complete',
  RELATION_GENERATION_ERROR: 'relation_generation_error',

  // 复习参数更新事件
  REVIEW_PARAMS_UPDATED: 'review_params_updated',

  // 通用事件
  ERROR: 'error',
  CONNECTED: 'connected',
  SESSION_STATUS: 'session_status',
} as const

export type WebSocketEventType = typeof WebSocketEvents[keyof typeof WebSocketEvents]

// 事件回调类型定义
export type EventCallback = (data: any) => void
export type EventListeners = Record<string, EventCallback[]>

// WebSocket连接配置
interface WebSocketConfig {
  url?: string
  autoConnect?: boolean
  transports?: string[]
}

// 动态获取WebSocket服务器URL
function getWebSocketUrl(): string {
  const { hostname, protocol, port } = window.location
  // 在开发环境下，通过Vite代理连接WebSocket
  // 这样可以避免HTTPS前端连接HTTP后端的混合内容问题
  return `${protocol}//${hostname}${port ? ':' + port : ''}`
}

// 默认配置
const DEFAULT_CONFIG: WebSocketConfig = {
  url: getWebSocketUrl(),
  autoConnect: true,
  transports: ['websocket', 'polling']
}

/**
 * 统一的WebSocket服务类
 * 提供连接管理、事件监听、数据发送等功能
 */
export class WebSocketService {
  private socket: Socket | null = null
  private eventListeners: EventListeners = {}
  private config: WebSocketConfig

  // 响应式状态
  public readonly isConnected = ref(false)
  public readonly connectionError = ref<string | null>(null)

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 建立WebSocket连接
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      console.log('[WebSocket] Already connected')
      return
    }

    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.config.url!, {
          transports: this.config.transports,
          autoConnect: this.config.autoConnect,
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 10000,
        })

        // 如果autoConnect为false，需要手动连接
        if (!this.config.autoConnect) {
          this.socket.connect()
        }

        this.socket.on('connect', () => {
          this.isConnected.value = true
          this.connectionError.value = null
          this.setupEventListeners()
          resolve()
        })

        this.socket.on('connect_error', (error: Error) => {
          console.error('[WebSocket] Connection failed:', error)
          this.connectionError.value = error.message
          this.isConnected.value = false
          reject(error)
        })

        this.socket.on('disconnect', () => {
          this.isConnected.value = false
        })

        // 监听通用错误事件
        this.socket.on(WebSocketEvents.ERROR, (data: { message: string }) => {
          console.error('[WebSocket] Server error:', data.message)
          this.triggerListeners(WebSocketEvents.ERROR, data)
        })

      } catch (error) {
        console.error('[WebSocket] Failed to create connection:', error)
        reject(error)
      }
    })
  }

  /**
   * 断开WebSocket连接
   */
  disconnect(): void {
    if (this.socket) {
      try {
        // 先禁用重连，防止断开后立即重连
        if (this.socket.io) {
          this.socket.io.reconnection(false)
        }

        // 移除所有事件监听器
        this.socket.removeAllListeners()

        // 断开连接
        this.socket.disconnect()

        // 强制关闭底层连接
        if (this.socket.io && this.socket.io.engine) {
          this.socket.io.engine.close()
        }

        console.log('[WebSocket] Connection properly closed')

      } catch (error) {
        console.error('[WebSocket] Error during disconnect:', error)
      } finally {
        this.socket = null
        this.isConnected.value = false
        this.connectionError.value = null
      }
    }

    // 清空本地事件监听器
    this.eventListeners = {}
  }

  /**
   * 发送数据到服务器
   */
  emit(event: string, data?: any): void {
    if (!this.socket?.connected) {
      return
    }

    this.socket.emit(event, data)
  }

  /**
   * 监听特定事件
   */
  on(event: WebSocketEventType, callback: EventCallback): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = []
    }
    this.eventListeners[event].push(callback)

    // 如果已经连接，立即为这个事件设置Socket.IO监听器
    if (this.socket?.connected && this.eventListeners[event].length === 1) {
      this.socket.on(event, (data: any) => {
        this.triggerListeners(event, data)
      })
    }
  }

  /**
   * 移除事件监听器
   */
  off(event: WebSocketEventType, callback?: EventCallback): void {
    if (!this.eventListeners[event]) return

    if (callback) {
      const index = this.eventListeners[event].indexOf(callback)
      if (index > -1) {
        this.eventListeners[event].splice(index, 1)
      }
    } else {
      // 移除所有监听器
      this.eventListeners[event] = []
    }
  }

  /**
   * 设置Socket.IO事件监听器
   */
  private setupEventListeners(): void {
    if (!this.socket) return

    // 为所有注册的事件设置Socket.IO监听器
    Object.keys(this.eventListeners).forEach(event => {
      this.socket!.on(event, (data: any) => {
        this.triggerListeners(event, data)
      })
    })
  }

  /**
   * 触发事件回调
   */
  private triggerListeners(event: string, data: any): void {
    const listeners = this.eventListeners[event] || []
    listeners.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error(`[WebSocket] Error in event listener for ${event}:`, error)
      }
    })
  }

  /**
   * 获取当前连接状态
   */
  get connected(): boolean {
    return this.socket?.connected ?? false
  }

  /**
   * 获取会话ID
   */
  get sessionId(): string | undefined {
    return this.socket?.id
  }
}

/**
 * 全局WebSocket服务实例
 */
export const globalWebSocket = new WebSocketService()

/**
 * Vue组合函数：WebSocket连接管理
 */
export function useWebSocket(config?: Partial<WebSocketConfig>) {
  const wsService = config ? new WebSocketService(config) : globalWebSocket

  // 组件卸载时自动断开连接（仅对新创建的实例）
  if (config) {
    onUnmounted(() => {
      wsService.disconnect()
    })
  }

  return {
    // 状态
    isConnected: wsService.isConnected,
    connectionError: wsService.connectionError,
    get connected() { return wsService.connected },
    get sessionId() { return wsService.sessionId },

    // 方法
    connect: () => wsService.connect(),
    disconnect: () => wsService.disconnect(),
    emit: (event: string, data?: any) => wsService.emit(event, data),
    on: (event: WebSocketEventType, callback: EventCallback) => wsService.on(event, callback),
    off: (event: WebSocketEventType, callback?: EventCallback) => wsService.off(event, callback),
  }
}

// 全局转录WebSocket实例，避免重复创建
let transcriptionWebSocketInstance: ReturnType<typeof useWebSocket> | null = null

/**
 * Vue组合函数：语音转录WebSocket
 */
export function useTranscriptionWebSocket() {
  // 重用同一个WebSocket包装器实例
  if (!transcriptionWebSocketInstance) {
    transcriptionWebSocketInstance = useWebSocket() // 使用全局实例，确保连接正常
  }
  const ws = transcriptionWebSocketInstance
  const realtimeTranscription = ref('')

  // 设置转录特定的事件监听
  const setupTranscriptionListeners = () => {
    ws.on(WebSocketEvents.TRANSCRIPTION_UPDATE, (data: {
      text: string
      accumulated_text: string
      chunk_count: number
    }) => {
      realtimeTranscription.value = data.accumulated_text
    })

    ws.on(WebSocketEvents.TRANSCRIPTION_STARTED, (_data: any) => {
      // Transcription started
    })

    ws.on(WebSocketEvents.TRANSCRIPTION_STOPPED, (data: { final_text?: string }) => {
      if (data.final_text) {
        realtimeTranscription.value = data.final_text
      }
    })
  }

  // 转录控制方法
  const startTranscription = () => {
    if (!ws.connected) {
      return
    }
    ws.emit('start_transcription', {})
    realtimeTranscription.value = ''
  }

  const stopTranscription = () => {
    ws.emit('stop_transcription', {})
  }

  const sendPCM16Data = (pcm16Data: Int16Array) => {
    if (!ws.connected) return

    try {
      const uint8Array = new Uint8Array(pcm16Data.buffer)
      const base64Data = btoa(String.fromCharCode(...uint8Array))

      ws.emit('audio_chunk', {
        audio_data: base64Data,
        data_type: 'pcm16',
        sample_rate: 16000,
        channels: 1,
        timestamp: Date.now()
      })
    } catch (error) {
      console.error('[Transcription] Failed to send PCM16 data:', error)
    }
  }

  const resetTranscription = () => {
    realtimeTranscription.value = ''
  }

  // 确保WebSocket连接的方法
  const ensureConnection = async () => {
    if (!ws.connected) {
      await ws.connect()
    }
  }

  return {
    // 基础WebSocket功能
    ...ws,

    // 转录特定功能
    realtimeTranscription,
    setupTranscriptionListeners,
    startTranscription,
    stopTranscription,
    sendPCM16Data,
    resetTranscription,
    ensureConnection,
  }
}

/**
 * Vue组合函数：单词管理WebSocket
 */
export function useWordManagementWebSocket() {
  const ws = useWebSocket() // 使用全局实例

  // 单词事件监听器
  const onWordUpdated = (callback: (data: { id: number; definition: any }) => void) => {
    ws.on(WebSocketEvents.WORD_UPDATED, callback)
  }

  const onWordCreated = (callback: (data: any) => void) => {
    ws.on(WebSocketEvents.WORD_CREATED, callback)
  }

  const onWordDeleted = (callback: (data: { id: number }) => void) => {
    ws.on(WebSocketEvents.WORD_DELETED, callback)
  }

  return {
    // 基础WebSocket功能
    ...ws,

    // 单词特定事件监听
    onWordUpdated,
    onWordCreated,
    onWordDeleted,
  }
}

/**
 * Vue组合函数：关系生成进度WebSocket
 */
export function useRelationGenerationWebSocket() {
  const ws = useWebSocket() // 使用全局实例

  // 关系生成进度事件监听器
  const onProgress = (callback: (data: {
    relation_type: string
    current: number
    total: number
    percent: number
    message: string
  }) => void) => {
    ws.on(WebSocketEvents.RELATION_GENERATION_PROGRESS, callback)
  }

  const onComplete = (callback: (data: {
    relation_type: string
    total_count: number
    message: string
  }) => void) => {
    ws.on(WebSocketEvents.RELATION_GENERATION_COMPLETE, callback)
  }

  const onError = (callback: (data: {
    relation_type: string
    message: string
  }) => void) => {
    ws.on(WebSocketEvents.RELATION_GENERATION_ERROR, callback)
  }

  return {
    // 基础WebSocket功能
    ...ws,

    // 关系生成特定事件监听
    onProgress,
    onComplete,
    onError,
  }
}
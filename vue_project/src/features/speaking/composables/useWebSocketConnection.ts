// 兼容性封装：使用统一的WebSocket服务
import { useTranscriptionWebSocket } from '@/shared/services/websocket'

/**
 * @deprecated 使用 useTranscriptionWebSocket 替代
 * 为了保持向后兼容性而保留的封装
 */
export const useWebSocketConnection = () => {
  const transcription = useTranscriptionWebSocket()

  // 设置转录监听器
  transcription.setupTranscriptionListeners()

  // 重写连接方法来确保连接后事件监听器正确设置
  const connectWebSocket = async () => {
    try {
      await transcription.ensureConnection()
      // 连接成功后再次设置事件监听器以确保它们正确注册
      transcription.setupTranscriptionListeners()
    } catch (error) {
      console.error('[useWebSocketConnection] Connection failed:', error)
      throw error
    }
  }

  return {
    socket: transcription.sessionId, // 兼容性：返回sessionId而不是socket对象
    isConnected: transcription.isConnected,
    realtimeTranscription: transcription.realtimeTranscription,
    connectWebSocket,
    disconnectWebSocket: transcription.disconnect,
    startTranscription: transcription.startTranscription,
    stopTranscription: transcription.stopTranscription,
    sendPCM16Data: transcription.sendPCM16Data,
    resetTranscription: transcription.resetTranscription
  }
}
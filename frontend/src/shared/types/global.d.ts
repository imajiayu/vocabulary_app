/**
 * 全局类型声明 - 浏览器 API 扩展
 */

// Web Audio API - Safari 兼容性
interface Window {
  webkitAudioContext: typeof AudioContext
}

// ScriptProcessorNode audioprocess 事件（已废弃但仍在使用）
interface AudioProcessingEvent extends Event {
  readonly inputBuffer: AudioBuffer
  readonly outputBuffer: AudioBuffer
  readonly playbackTime: number
}

// 确保 ScriptProcessorNode 的事件监听器类型正确
interface ScriptProcessorNode {
  addEventListener(
    type: 'audioprocess',
    listener: (this: ScriptProcessorNode, ev: AudioProcessingEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void
}

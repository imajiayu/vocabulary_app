// 向后兼容 re-export — 所有实现已拆分到 ./audio/ 模块
export {
  playWordAudio,
  stopWordAudio,
  preloadWordAudio,
  preloadMultipleWordAudio,
  clearPreloadCache,
  getPreloadCacheStats,
  deleteTtsCache,
  deleteTtsCacheSource,
} from './audio'

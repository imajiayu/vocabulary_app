/**
 * 环境变量配置
 * 集中管理所有环境相关的配置
 */

// API 基础 URL
// 开发环境：空字符串（使用 Vite 代理）
// 生产环境：后端服务器完整 URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// 是否为开发环境
export const isDev = import.meta.env.DEV

// 是否为生产环境
export const isProd = import.meta.env.PROD

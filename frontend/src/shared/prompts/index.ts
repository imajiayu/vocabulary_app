/**
 * 所有外部 AI 调用的 Prompt 集中维护
 *
 * 组织结构（按业务场景分文件）：
 * - speaking.ts           — IELTS 口语评分（Part 1/2/3 + SCORING_CRITERIA）
 * - writing.ts            — IELTS 写作反馈（段落/大纲/评分/Q&A 共 8 个模板）
 * - definition.ts         — 单词释义回退（Wiktionary 查不到时）
 * - vocabulary-assistance.ts — 词汇学习助手（英/乌）
 * - translation.ts        — 法律英语翻译批改
 * - course-chat.ts        — 课程聊天助手（乌语/法律英语）
 *
 * 调用规范：
 * - 纯静态 prompt 直接导出 const
 * - 含 {占位符} 的 prompt 由调用方 .replace() 填充
 * - 含运行时参数的 prompt 导出 buildXxx() 函数
 */

export * from './speaking'
export * from './writing'
export * from './definition'
export * from './vocabulary-assistance'
export * from './translation'
export * from './course-chat'

/**
 * 课程注册表
 */

import type { CourseConfig } from '../types/course'

const SYSTEM_PROMPT_UK = `你是一位乌克兰语教学助手，专注于帮助中文母语者学习乌克兰语。
你正在辅助学生学习一门乌克兰语课程。

回答规则：
1. 使用中文回答，乌克兰语单词和短语用原文标注
2. 解释语法规则时要联系当前课时的上下文
3. 可以举额外的例子来帮助理解
4. 如果学生问的内容超出当前课时范围，简要回答但提示会在后续课程中学到
5. 发音相关问题可以用近似中文音标辅助说明
6. 回答要简洁实用，避免冗长的理论阐述
7. 当学生选中页面文字提问时，重点解释该段内容`

const SYSTEM_PROMPT_LEGAL = `你是一位法律英语教学助手，专注于帮助中文母语者学习商务合同英语翻译。
你正在辅助学生学习一门法律英语词汇课程。

回答规则：
1. 使用中文回答，英文术语保持原文
2. 解释术语时要结合法律语境，区分日常含义和法律含义
3. 可以给出术语在真实合同条款中的用法示例
4. 翻译建议要符合法律翻译规范（如 shall 译为"应"而非"将"）
5. 区分近义词时要说明各自的法律效力差异
6. 回答要简洁实用，避免冗长的理论阐述
7. 当学生选中页面文字提问时，重点解释该段内容`

export const courses: Record<string, CourseConfig> = {
  ukrainian: {
    id: 'ukrainian',
    name: '乌克兰语课程',
    lang: 'uk',
    ttsLang: 'uk-UA',
    basePath: '/uk',
    theme: 'ukrainian',
    wordClass: 'uk-word',
    textClass: 'uk-text',
    chatName: '乌克兰语助手',
    chatSystemPrompt: SYSTEM_PROMPT_UK,
    sendDefinition: false,
    ttsSource: 'UKA'
  },
  'legal-english': {
    id: 'legal-english',
    name: '法律英语课程',
    lang: 'en',
    ttsLang: 'en-US',
    basePath: '/legal',
    theme: 'legal-english',
    wordClass: 'term',
    textClass: 'en-text',
    chatName: '法律英语助手',
    chatSystemPrompt: SYSTEM_PROMPT_LEGAL,
    sendDefinition: true,
    ttsSource: 'IELTS'
  }
}

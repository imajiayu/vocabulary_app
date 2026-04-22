/**
 * 课程注册表
 * 课程聊天的 Prompt 维护在 shared/prompts/course-chat.ts
 */

import type { CourseConfig } from '../types/course'
import { COURSE_CHAT_PROMPT_UK, COURSE_CHAT_PROMPT_LEGAL } from '@/shared/prompts/course-chat'

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
    chatSystemPrompt: COURSE_CHAT_PROMPT_UK,
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
    chatSystemPrompt: COURSE_CHAT_PROMPT_LEGAL,
    sendDefinition: true,
    ttsSource: 'IELTS'
  }
}

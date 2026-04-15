/**
 * 课时索引数据
 *
 * 静态数据，课程增加新课时时需更新此文件
 */

export interface LessonMeta {
  week: number
  day: number
  /** 文件名（不含扩展名），如 'w1d1' */
  id: string
  title: string
  topic: string
  /** 词汇预载页 */
  vocab?: boolean
  /** 复习日 */
  review?: boolean
}

export interface FutureWeek {
  week: number
  title: string
  topic: string
}

// ── 乌克兰语课程 ──

export const ukrainianLessons: LessonMeta[] = [
  // 第1周：名词性别
  { week: 1, day: 1, id: 'w1d1', title: '本周词汇预载', topic: '添加本周单词到背单词App', vocab: true },
  { week: 1, day: 2, id: 'w1d2', title: '名词三种性别概述', topic: '阳性/阴性/中性判断规则' },
  { week: 1, day: 3, id: 'w1d3', title: '阴性名词 -а/-я 规则', topic: '与阳性对比练习' },
  { week: 1, day: 4, id: 'w1d4', title: '中性名词 -о/-е/-я 规则', topic: '三种性别综合辨析' },
  { week: 1, day: 5, id: 'w1d5', title: '软音符号(ь)结尾名词', topic: '阳性或阴性判断' },
  { week: 1, day: 6, id: 'w1d6', title: '常见例外与特殊名词', topic: 'тато/батько 等特例' },
  { week: 1, day: 7, id: 'w1d7', title: '复习日', topic: '名词性别综合练习', review: true },

  // 第2周：名词复数
  { week: 2, day: 1, id: 'w2d1', title: '本周词汇预载', topic: '添加本周单词到背单词App', vocab: true },
  { week: 2, day: 2, id: 'w2d2', title: '性别判断强化训练', topic: '大量新词汇性别分类' },
  { week: 2, day: 3, id: 'w2d3', title: '阳性名词复数', topic: '-и/-і、飘忽元音、辅音交替' },
  { week: 2, day: 4, id: 'w2d4', title: '阴性名词复数', topic: '-а→-и、-я→-і、-ь→-і' },
  { week: 2, day: 5, id: 'w2d5', title: '中性名词复数', topic: '-о→-а、-е→-я、同形复数' },
  { week: 2, day: 6, id: 'w2d6', title: '不规则复数', topic: '幼崽-ата/-ята、完全不规则' },
  { week: 2, day: 7, id: 'w2d7', title: '复习日', topic: '性别 + 复数综合练习', review: true },

  // 第3周：主格与宾格
  { week: 3, day: 1, id: 'w3d1', title: '本周词汇预载', topic: '添加本周单词到背单词App', vocab: true },
  { week: 3, day: 2, id: 'w3d2', title: '什么是「格」？主格入门', topic: '7格总览 + 主格 Називний 的角色' },
  { week: 3, day: 3, id: 'w3d3', title: '宾格入门：无生命阳性', topic: '宾格 = 主格的简单情况' },
  { week: 3, day: 4, id: 'w3d4', title: '宾格:有生命阳性', topic: '-а/-я 词尾 + 飘忽元音' },
  { week: 3, day: 5, id: 'w3d5', title: '宾格:阴性名词', topic: 'а→у / я→ю / ь 不变' },
  { week: 3, day: 6, id: 'w3d6', title: '宾格:中性名词 + 三性综合', topic: '中性宾格 = 主格 + 综合判断' },
  { week: 3, day: 7, id: 'w3d7', title: '复习日', topic: '主格与宾格综合练习', review: true },
]

export const ukrainianFutureWeeks: FutureWeek[] = [
  { week: 4, title: '动词现在时变位', topic: 'Дієвідмінювання дієслів' },
  { week: 5, title: '动词变位巩固 + 日常对话', topic: '简单日常对话' },
  { week: 6, title: '属格', topic: 'Родовий відмінок' },
  { week: 7, title: '形容词性数配合', topic: 'Прикметники' },
  { week: 8, title: '与格', topic: 'Давальний відмінок' },
  { week: 9, title: '工具格', topic: 'Орудний відмінок' },
  { week: 10, title: '方位格', topic: 'Місцевий відмінок' },
  { week: 11, title: '动词过去时', topic: 'Минулий час' },
  { week: 12, title: '综合复习', topic: '整合所有语法知识' },
]

export const ukrainianWeekTitles: Record<number, string> = {
  1: '名词性别（Рід іменників）',
  2: '名词性别巩固 + 名词复数',
  3: '主格与宾格（Називний і Знахідний відмінок）',
}

// ── 法律英语课程 ──

export const legalEnglishLessons: LessonMeta[] = [
  // 第1周：合同基础与结构
  { week: 1, day: 1, id: 'w1d1', title: '本周词汇预载', topic: '添加本周术语到背单词App', vocab: true },
  { week: 1, day: 2, id: 'w1d2', title: '合同总体结构', topic: 'title, preamble, recitals, definitions, operative provisions' },
  { week: 1, day: 3, id: 'w1d3', title: '合同当事人', topic: 'party, hereinafter, whereas, witnesseth' },
  { week: 1, day: 4, id: 'w1d4', title: '定义条款', topic: 'shall mean, material, affiliate, hereof/thereof' },
  { week: 1, day: 5, id: 'w1d5', title: '合同标的与履行', topic: 'deliverables, due diligence, scope of work' },
  { week: 1, day: 6, id: 'w1d6', title: '合同生效与期限', topic: 'commencement, expiration, renewal, termination' },
  { week: 1, day: 7, id: 'w1d7', title: '复习日', topic: '合同基础与结构综合练习', review: true },

  // 第2周：权利与义务条款
  { week: 2, day: 1, id: 'w2d1', title: '本周词汇预载', topic: '添加本周术语到背单词App', vocab: true },
  { week: 2, day: 2, id: 'w2d2', title: '情态动词的法律含义', topic: 'obligation, duty, right, discretion, binding' },
  { week: 2, day: 3, id: 'w2d3', title: '保证与陈述', topic: 'warrant, represent, covenant, undertake' },
  { week: 2, day: 4, id: 'w2d4', title: '条件与前提', topic: 'condition precedent, subject to, provided that' },
  { week: 2, day: 5, id: 'w2d5', title: '豁免与责任限制', topic: 'limitation of liability, disclaimer, indemnify' },
  { week: 2, day: 6, id: 'w2d6', title: '保密条款', topic: 'confidential information, trade secret, injunctive relief' },
  { week: 2, day: 7, id: 'w2d7', title: '复习日', topic: '权利与义务条款综合练习', review: true },

  // 第3周：支付与对价条款
  { week: 3, day: 1, id: 'w3d1', title: '本周词汇预载', topic: '添加本周术语到背单词App', vocab: true },
  { week: 3, day: 2, id: 'w3d2', title: '对价基础', topic: 'consideration, mutual/adequate/nominal consideration, quid pro quo' },
  { week: 3, day: 3, id: 'w3d3', title: '支付条款', topic: 'payment terms, invoice, net 30/60, installment, advance payment, retention' },
  { week: 3, day: 4, id: 'w3d4', title: '利息与违约金', topic: 'interest, default interest, liquidated damages, per annum, accrue, grace period' },
  { week: 3, day: 5, id: 'w3d5', title: '税费与扣款', topic: 'tax, withholding tax, gross-up, VAT, duty, set-off, deduction, remit, levy' },
]

export const legalEnglishFutureWeeks: FutureWeek[] = [
  { week: 4, title: '违约与救济', topic: 'Breach & Remedies' },
  { week: 5, title: '知识产权条款', topic: 'Intellectual Property' },
  { week: 6, title: '担保与赔偿条款', topic: 'Warranties & Indemnification' },
  { week: 7, title: '终止与退出条款', topic: 'Termination & Exit' },
  { week: 8, title: '合规与监管条款', topic: 'Compliance & Regulatory' },
  { week: 9, title: '公司治理条款', topic: 'Corporate Governance' },
  { week: 10, title: '国际贸易合同', topic: 'International Trade' },
  { week: 11, title: '合同起草技巧', topic: 'Drafting Skills' },
  { week: 12, title: '综合复习与实战', topic: 'Comprehensive Review' },
]

export const legalEnglishWeekTitles: Record<number, string> = {
  1: '合同基础与结构（Contract Fundamentals）',
  2: '权利与义务条款（Rights & Obligations）',
  3: '支付与对价条款（Payment & Consideration）',
}

// ── 按课程 ID 获取数据 ──

export function getLessonsByCourse(courseId: string) {
  switch (courseId) {
    case 'ukrainian':
      return { lessons: ukrainianLessons, futureWeeks: ukrainianFutureWeeks, weekTitles: ukrainianWeekTitles }
    case 'legal-english':
      return { lessons: legalEnglishLessons, futureWeeks: legalEnglishFutureWeeks, weekTitles: legalEnglishWeekTitles }
    default:
      return { lessons: [], futureWeeks: [], weekTitles: {} }
  }
}

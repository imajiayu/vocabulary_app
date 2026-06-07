import { describe, test, expect } from 'vitest'
import { isDefinitionEmpty, mergeDefinitionFillingGaps, NO_DEFINITION_PLACEHOLDER } from '../definition'
import type { DefinitionObject } from '@/shared/types'

describe('isDefinitionEmpty', () => {
  test('definitions 缺失视为空', () => {
    expect(isDefinitionEmpty({})).toBe(true)
    expect(isDefinitionEmpty({ phonetic: { us: '[test]' } })).toBe(true)
  })

  test('definitions 为空数组视为空', () => {
    expect(isDefinitionEmpty({ definitions: [] })).toBe(true)
  })

  test('只有占位符 "暂无释义" 视为空', () => {
    expect(isDefinitionEmpty({ definitions: [NO_DEFINITION_PLACEHOLDER] })).toBe(true)
    expect(isDefinitionEmpty({ definitions: ['  暂无释义  '] })).toBe(true)
  })

  test('全是空白字符串视为空', () => {
    expect(isDefinitionEmpty({ definitions: ['', '   '] })).toBe(true)
  })

  test('有道占位释义即使带例句也视为空（例句不算释义 → 应触发 AI 回退）', () => {
    const youdaoEmptyButHasExamples: DefinitionObject = {
      definitions: [NO_DEFINITION_PLACEHOLDER],
      examples: [
        { en: 'agrees to indemnify and hold harmless', zh: '同意赔偿并使免受损害' },
        { en: 'free and clear of any defects', zh: '不含任何瑕疵' },
      ],
    }
    expect(isDefinitionEmpty(youdaoEmptyButHasExamples)).toBe(true)
  })

  test('占位符 + 空白混合视为空', () => {
    expect(isDefinitionEmpty({ definitions: ['', NO_DEFINITION_PLACEHOLDER, '  '] })).toBe(true)
  })

  test('有真实释义时不视为空', () => {
    expect(isDefinitionEmpty({ definitions: ['n. jury'] })).toBe(false)
  })

  test('真实释义与占位符混合时不视为空', () => {
    const def: DefinitionObject = { definitions: [NO_DEFINITION_PLACEHOLDER, 'phr. free of defects'] }
    expect(isDefinitionEmpty(def)).toBe(false)
  })
})

describe('mergeDefinitionFillingGaps', () => {
  test('已有释义时保留原释义，仅补齐音标与例句', () => {
    const existing: DefinitionObject = { definitions: ['赔偿并使免受损害'] }
    const fetched: DefinitionObject = {
      definitions: [NO_DEFINITION_PLACEHOLDER],
      phonetic: { us: '[ɪnˈdemnɪfaɪ]' },
      examples: [{ en: 'agrees to indemnify and hold harmless', zh: '同意赔偿并使免受损害' }],
    }
    const merged = mergeDefinitionFillingGaps(existing, fetched)
    expect(merged.definitions).toEqual(['赔偿并使免受损害'])
    expect(merged.phonetic).toEqual({ us: '[ɪnˈdemnɪfaɪ]' })
    expect(merged.examples).toHaveLength(1)
  })

  test('原释义为空时整体采用抓取结果', () => {
    const existing: DefinitionObject = {}
    const fetched: DefinitionObject = {
      definitions: ['n. jury'],
      phonetic: { ipa: '[test]' },
      examples: [{ en: 'a', zh: 'b' }],
    }
    expect(mergeDefinitionFillingGaps(existing, fetched)).toEqual(fetched)
  })

  test('原已有音标/例句则不被覆盖', () => {
    const existing: DefinitionObject = {
      definitions: ['赔偿'],
      phonetic: { us: '[原音标]' },
      examples: [{ en: '原例句', zh: '原译' }],
    }
    const fetched: DefinitionObject = {
      definitions: ['n. new'],
      phonetic: { us: '[新音标]' },
      examples: [{ en: 'new', zh: '新' }],
    }
    const merged = mergeDefinitionFillingGaps(existing, fetched)
    expect(merged.definitions).toEqual(['赔偿'])
    expect(merged.phonetic).toEqual({ us: '[原音标]' })
    expect(merged.examples).toEqual([{ en: '原例句', zh: '原译' }])
  })
})

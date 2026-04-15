/**
 * 课程 Vocab 添加 composable
 *
 * 职责：单词批量添加 + 检查已存在 + 负荷均衡调用。
 * Source 状态已抽离到 useCourseSource（模块级单例），此处仅消费。
 */

import { api } from '@/shared/api'
import type { ImportLoadBalanceParams } from '@/shared/api'
import { supabase } from '@/shared/config/supabase'
import { getCurrentUserId } from '@/shared/composables/useAuth'
import type { CourseConfig } from '../types/course'
import { useCourseSource } from './useCourseSource'

async function buildLoadBalanceParams(source: string): Promise<ImportLoadBalanceParams> {
  const settings = await api.settings.getSettings()
  const learning = settings.sourceSettings[source]?.learning
  const dailyLimit = learning?.dailyReviewLimit ?? 50
  const maxPrepDays = learning?.maxPrepDays ?? 90

  const [todayDue, futureLoads] = await Promise.all([
    api.words.getTodayDueCountDirect(source),
    api.words.getDailyReviewLoadsDirect(source, maxPrepDays)
  ])
  return {
    dailyLimit,
    loadsWithToday: [todayDue, ...futureLoads]
  }
}

export function useCourseVocabAdd(config: CourseConfig) {
  const {
    sourceList,
    selectedSource,
    hasSources,
    loadSources,
    setSelected: setSelectedSource
  } = useCourseSource(config)

  /**
   * 检查给定单词中哪些已经存在于当前 source 下
   */
  async function fetchExistingWords(words: string[]): Promise<Set<string>> {
    if (!selectedSource.value || words.length === 0) return new Set()
    const userId = getCurrentUserId()
    const normalized = words.map(w => w.normalize('NFC').trim().toLowerCase())
    const { data } = await supabase
      .from('words')
      .select('word')
      .eq('user_id', userId)
      .eq('source', selectedSource.value)
      .in('word', normalized)
    return new Set((data || []).map(r => r.word as string))
  }

  /**
   * 添加一组单词（逐个走负荷均衡），返回成功/失败的词
   */
  async function addWords(items: Array<{ word: string; def?: string }>): Promise<{
    added: string[]
    existed: string[]
    failed: string[]
  }> {
    const added: string[] = []
    const existed: string[] = []
    const failed: string[] = []

    if (!selectedSource.value || items.length === 0) {
      return { added, existed, failed }
    }

    const lbParams = await buildLoadBalanceParams(selectedSource.value)

    for (const item of items) {
      try {
        const options = config.sendDefinition && item.def
          ? { definition: { definitions: [item.def] } }
          : undefined
        await api.words.createWordDirect(
          item.word,
          selectedSource.value,
          lbParams,
          config.lang,
          options
        )
        added.push(item.word)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('已存在')) existed.push(item.word)
        else failed.push(item.word)
      }
    }

    return { added, existed, failed }
  }

  return {
    sourceList,
    selectedSource,
    hasSources,
    loadSources,
    setSelectedSource,
    fetchExistingWords,
    addWords
  }
}

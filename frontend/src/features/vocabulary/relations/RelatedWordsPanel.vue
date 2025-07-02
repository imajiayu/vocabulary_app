<template>
  <div v-if="relatedWords && relatedWords.length" class="related-words-panel">
    <div class="panel-header">
      <span class="header-label">相关词汇</span>
      <span class="header-count">{{ relatedWords.length }}</span>
    </div>

    <div class="relation-grid">
      <div
        v-for="type in activeTypes"
        :key="type"
        class="relation-group"
      >
        <div class="group-label" :class="type">
          <span class="label-icon"><AppIcon :name="typeIcons[type]" /></span>
          <span class="label-text">{{ typeLabels[type] }}</span>
        </div>
        <div class="word-list">
          <span
            v-for="rel in groupedWords[type]"
            :key="rel.id"
            class="word-chip"
            @mouseenter="(e) => handleMouseEnter(e, rel)"
            @mouseleave="handleMouseLeave"
            @click="(e) => handleClick(e, rel)"
          >
            {{ rel.word }}
          </span>
        </div>
      </div>
    </div>

    <!-- Tooltip - 桌面端 hover / 移动端点击 -->
    <WordTooltip
      v-if="tooltipWord"
      :word="tooltipWord"
      :visible="showTooltip"
      :position="tooltipPosition"
      :is-mobile="isMobile"
      @close="handleTooltipClose"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { Word, RelatedWord } from '@/shared/types'
import WordTooltip from '@/features/vocabulary/grid/WordTooltip.vue'
import AppIcon from '@/shared/components/controls/Icons.vue'
import { api } from '@/shared/api'
import { logger } from '@/shared/utils/logger'

const log = logger.create('RelatedWords')

interface Props {
  relatedWords?: RelatedWord[]
}

const props = defineProps<Props>()

const relationTypes = ['synonym', 'antonym', 'root', 'confused', 'topic'] as const
const typeLabels: Record<string, string> = {
  synonym: '同义',
  antonym: '反义',
  root: '词根',
  confused: '易混',
  topic: '主题',
}
const typeIcons = {
  synonym: 'synonym',
  antonym: 'antonym',
  root: 'word-root',
  confused: 'confused',
  topic: 'topic',
} as const

const groupedWords = computed(() => {
  const map: Record<string, RelatedWord[]> = {}
  relationTypes.forEach((t) => (map[t] = []))
  props.relatedWords?.forEach((w) => {
    if (map[w.relation_type]) map[w.relation_type].push(w)
  })
  return map
})

const activeTypes = computed(() => {
  return relationTypes.filter(type => groupedWords.value[type].length > 0)
})

// Tooltip 状态
const isMobile = ref(false)
const showTooltip = ref(false)
const tooltipPosition = ref({ x: 0, y: 0 })
const tooltipWord = ref<Word | undefined>(undefined)

// 缓存已获取的单词数据，避免重复请求
const wordCache = new Map<number, Word>()

// 定时器
const hoverTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const HOVER_DELAY = 300

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

const fetchAndShowTooltip = async (wordId: number, position: { x: number; y: number }) => {
  try {
    let word = wordCache.get(wordId)
    if (!word) {
      word = (await api.words.getWordDirect(wordId)) ?? undefined
      if (word) wordCache.set(wordId, word)
    }
    if (!word) return
    tooltipWord.value = word
    tooltipPosition.value = position
    showTooltip.value = true
  } catch (err) {
    log.error('Failed to fetch word for tooltip:', err)
  }
}

// 桌面端 hover
const handleMouseEnter = (e: MouseEvent, rel: RelatedWord) => {
  if (isMobile.value) return
  hoverTimer.value = setTimeout(() => {
    fetchAndShowTooltip(rel.id, { x: e.clientX, y: e.clientY })
  }, HOVER_DELAY)
}

const handleMouseLeave = () => {
  if (hoverTimer.value) {
    clearTimeout(hoverTimer.value)
    hoverTimer.value = null
  }
  // 移动端不通过 mouseleave 关闭，由用户点击抽屉外部关闭
  if (isMobile.value) return
  showTooltip.value = false
  tooltipWord.value = undefined
}

// 移动端点击
const handleClick = (e: MouseEvent, rel: RelatedWord) => {
  if (!isMobile.value) return
  fetchAndShowTooltip(rel.id, { x: 0, y: 0 })
}

const handleTooltipClose = () => {
  showTooltip.value = false
  tooltipWord.value = undefined
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  if (hoverTimer.value) clearTimeout(hoverTimer.value)
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Related Words Panel - Neo-Editorial 风格
   ═══════════════════════════════════════════════════════════════════════════ */

.related-words-panel {
  padding: 1.25rem 0;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.header-label {
  font-family: var(--font-ui);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.header-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.375rem;
  font-family: var(--font-data);
  font-size: 0.65rem;
  font-weight: 600;
  color: white;
  background: var(--color-primary);
  border-radius: var(--radius-full);
}

/* ── 关系分组网格 ── */
.relation-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.relation-group {
  flex: 1;
  min-width: 120px;
  max-width: 200px;
}

.group-label {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  margin-bottom: 0.5rem;
  font-family: var(--font-ui);
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: var(--radius-full);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

.group-label.synonym {
  background: var(--color-success-light);
  color: var(--color-success);
}

.group-label.antonym {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.group-label.root {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.group-label.confused {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.group-label.topic {
  background: var(--color-secondary-light);
  color: var(--color-secondary);
}

.label-icon {
  display: inline-flex;
  align-items: center;
}

.label-icon .icon {
  width: 12px;
  height: 12px;
}

.label-text {
  letter-spacing: 0.02em;
}

/* ── 单词列表 ── */
.word-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.word-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.625rem;
  font-family: var(--font-serif);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  cursor: default;
  transition: all 0.2s ease;
  user-select: none;
  -webkit-user-select: none;
}

.word-chip:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-primary);
  color: var(--color-primary);
  transform: translateY(-1px);
}

.word-chip:active {
  transform: translateY(0);
}

/* ══════════════════════════════════════════════════════════════════════════
   移动端适配
   ══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .related-words-panel {
    padding: 1rem 0;
  }

  .panel-header {
    margin-bottom: 0.75rem;
  }

  .relation-grid {
    gap: 0.75rem;
  }

  .relation-group {
    min-width: 100px;
    max-width: none;
    flex: 1 1 calc(50% - 0.375rem);
  }

  .group-label {
    padding: 0.2rem 0.5rem;
    font-size: 0.65rem;
  }

  .word-list {
    gap: 0.25rem;
  }

  .word-chip {
    padding: 0.3rem 0.5rem;
    font-size: 0.8rem;
    cursor: pointer;
  }

  /* 移动端移除 hover/active 样式 */
  .word-chip:hover,
  .word-chip:active {
    background: var(--color-bg-primary);
    border-color: var(--color-border-light);
    color: var(--color-text-primary);
    transform: none;
  }
}

</style>

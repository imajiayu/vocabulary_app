<template>
  <div v-if="relatedWords && relatedWords.length" class="related-words">
    <div class="relation-columns">
      <div v-for="type in relationTypes" :key="type" class="relation-column">
        <h5>{{ typeLabels[type] }}</h5>
        <ul>
          <li
            v-for="rel in groupedWords[type]"
            :key="rel.id"
            class="related-word-item"
            @click="handleClickWord(rel.id)"
          >
            <span class="word">{{ rel.word }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- modal - 使用 store 管理状态 -->
    <teleport to="body">
      <div v-if="wordEditorStore.isOpen" class="modal-wrapper">
        <div class="modal-overlay" @click="wordEditorStore.close()"></div>
        <WordEditorModal />
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RelatedWord } from '@/shared/types'
import WordEditorModal from '@/features/vocabulary/editor/WordEditorModal.vue'
import { api } from '@/shared/api'
import { useTimerPause } from '@/shared/composables/useTimerPause'
import { useWordEditorStore } from '@/features/vocabulary/stores/wordEditor'
import { logger } from '@/shared/utils/logger'

const log = logger.create('RelatedWords')

interface Props {
  relatedWords?: RelatedWord[]
}

const props = defineProps<Props>()

const relationTypes = ['synonym', 'antonym', 'root', 'confused', 'topic']
const typeLabels: Record<string, string> = {
  synonym: '同义词',
  antonym: '反义词',
  root: '同词根',
  confused: '易混淆',
  topic: '同主题',
}

// 分组
const groupedWords = computed(() => {
  const map: Record<string, RelatedWord[]> = {}
  relationTypes.forEach((t) => (map[t] = []))
  props.relatedWords?.forEach((w) => {
    if (map[w.relation_type]) map[w.relation_type].push(w)
  })
  return map
})

// Word Editor Store
const wordEditorStore = useWordEditorStore()

// 使用全局计时器暂停管理
const { requestPause, releasePause } = useTimerPause()

const handleClickWord = async (wordId: number) => {
  // 打开 modal 时请求暂停计时器
  requestPause()

  try {
    const data = await api.words.getWord(wordId)
    wordEditorStore.open(data)

    // 注册关闭回调
    wordEditorStore.onClose(() => {
      releasePause()
    })
  } catch (err) {
    log.error(err)
    releasePause()
  }
}
</script>

<style scoped>
.relation-column ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.related-words {
  margin-top: 1em;
  padding: 0.5em;
  border-top: 1px solid #ccc;
}

.relation-columns {
  display: flex;
  gap: 0.5em;
  width: 100%;
}

.relation-column {
  flex: 1;
  min-width: 0;
  width: 20%;
}

.related-word-item {
  margin: 0.25em 0;
  font-size: 0.9em;
  cursor: pointer;
}

.word {
  font-weight: bold;
}

/* Modal wrapper & overlay */
.modal-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.4);
}

/* 移动端适配 - 保持水平布局且字体更大 */
@media (max-width: 768px) {
  .relation-columns {
    gap: 0.25em;
  }

  .related-words {
    padding: 0.75em 0.125em;
  }

  .relation-column {
    width: 20%;
    min-width: 0;
  }

  .related-word-item {
    margin: 0.3em 0;
    font-size: 0.95em;
    word-break: break-word;
  }

  .word {
    font-size: 0.95em;
    font-weight: bold;
  }
}

/* 小屏幕适配 - 专门优化字体大小 */
@media (max-width: 480px) {
  .relation-columns {
    gap: 0.125em;
  }

  .related-words {
    padding: 0.5em 0.05em;
  }

  .relation-column {
    width: 20%;
    min-width: 0;
    text-align: center;
  }

  .related-word-item {
    margin: 0.25em 0;
    font-size: 0.9em;
    min-height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.125em;
    word-break: break-word;
    hyphens: auto;
  }

  .word {
    font-size: 0.9em;
    font-weight: bold;
    line-height: 1.2;
  }
}
</style>

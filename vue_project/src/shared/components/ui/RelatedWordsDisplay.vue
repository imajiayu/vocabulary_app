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

    <!-- modal -->
    <teleport to="body">
      <div v-if="isModalOpen" class="modal-wrapper">
        <div class="modal-overlay" @click="closeModal"></div>
        <WordDetailModal
          :word="selectedWord"
          :is-open="isModalOpen"
          @close="handleCloseModal"
          @request-close="closeModal"
          @word-deleted="handleWordDeleted"
        />
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { RelatedWord, Word } from '@/shared/types'
import WordDetailModal from '@/features/vocabulary/components/WordDetailModal.vue'
import { api } from '@/shared/api'
import { useTimerPause } from '@/shared/composables/useTimerPause'

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

// modal
const isModalOpen = ref(false)
const selectedWord = ref<Word | undefined>(undefined)

// 使用全局计时器暂停管理
const { requestPause, releasePause } = useTimerPause()

const handleClickWord = async (wordId: number) => {
  isModalOpen.value = true
  selectedWord.value = undefined
  // 打开 modal 时请求暂停计时器
  requestPause()

  try {
    const data = await api.words.getWord(wordId)
    selectedWord.value = data
  } catch (err) {
    console.error(err)
  }
}

const closeModal = () => {
  isModalOpen.value = false
  selectedWord.value = undefined
  // 关闭 modal 时释放暂停请求
  releasePause()
}

const handleCloseModal = (finalWord: Word | undefined) => {
  isModalOpen.value = false
  selectedWord.value = undefined
  // finalWord包含最新数据，但这个组件不需要更新列表
  // 关闭 modal 时释放暂停请求
  releasePause()
}

const handleWordDeleted = (wordId: number) => {
  // 关闭modal
  isModalOpen.value = false
  selectedWord.value = undefined
  // RelatedWordsDisplay不需要更新列表，因为相关词由后端管理
  // 关闭 modal 时释放暂停请求
  releasePause()
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

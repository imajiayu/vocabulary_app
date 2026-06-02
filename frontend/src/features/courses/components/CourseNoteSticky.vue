<template>
  <div v-if="notes.length" class="note-stack">
    <div
      v-for="note in notes"
      :key="note.key"
      class="note-item"
      :class="{ 'is-collapsed': collapsed[note.key] }"
    >
      <!-- 收起态：贴右边缘的小书签 -->
      <button
        v-if="collapsed[note.key]"
        type="button"
        class="note-tab"
        title="展开便笺"
        @click="toggle(note.key)"
      >
        <span class="note-tab-icon" aria-hidden="true">✶</span>
        <span class="note-tab-text">给宝宝的话</span>
      </button>

      <!-- 展开态：便笺卡片 -->
      <article v-else class="note-card">
        <header class="note-card-head" @click="toggle(note.key)">
          <span class="note-card-kicker">
            {{ note.author ? `来自 ${note.author}` : '给宝宝的话' }}
          </span>
          <span class="note-card-collapse" aria-hidden="true">×</span>
        </header>

        <p class="note-card-body">{{ note.body }}</p>

        <!-- 她已写过的回复 -->
        <div v-if="note.reply" class="note-reply-done">
          <span class="note-reply-label">你的回复</span>
          <p class="note-reply-text">{{ note.reply }}</p>
        </div>

        <!-- 回复输入 -->
        <div class="note-reply-box">
          <textarea
            v-model="drafts[note.key]"
            class="note-reply-input"
            :placeholder="note.reply ? '修改回复…' : '回复小狗……'"
            rows="2"
          />
          <button
            type="button"
            class="note-reply-send"
            :disabled="sending[note.key] || !(drafts[note.key] || '').trim()"
            @click="submitReply(note.key)"
          >
            {{ sending[note.key] ? '发送中…' : '发送' }}
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { useCourseNote } from '@/features/courses/composables/useCourseNote'
import { useToast } from '@/shared/composables/useToast'

const props = defineProps<{
  course: string
  lessonId: string
}>()

const { notes, fetchNotes, reply } = useCourseNote(props.course, props.lessonId)
const toast = useToast()

const collapsed = reactive<Record<string, boolean>>({})
const drafts = reactive<Record<string, string>>({})
const sending = reactive<Record<string, boolean>>({})

function collapseKey(noteKey: string): string {
  return `courseNote.collapsed.${props.course}.${noteKey}`
}

function toggle(noteKey: string) {
  const next = !collapsed[noteKey]
  collapsed[noteKey] = next
  try {
    localStorage.setItem(collapseKey(noteKey), next ? '1' : '0')
  } catch {
    // ignore
  }
}

async function submitReply(noteKey: string) {
  const text = (drafts[noteKey] || '').trim()
  if (!text || sending[noteKey]) return
  sending[noteKey] = true
  const ok = await reply(noteKey, text)
  sending[noteKey] = false
  if (ok) {
    drafts[noteKey] = ''
    toast.success('回复已送达 💌')
  } else {
    toast.error('回复发送失败，请稍后再试')
  }
}

onMounted(async () => {
  await fetchNotes()
  // 默认展开；按 localStorage 恢复每条便笺的收起状态
  for (const note of notes.value) {
    try {
      collapsed[note.key] = localStorage.getItem(collapseKey(note.key)) === '1'
    } catch {
      collapsed[note.key] = false
    }
  }
})
</script>

<style scoped>
.note-stack {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 60;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  pointer-events: none;
}

.note-item {
  pointer-events: auto;
}

/* ── 收起态：贴边书签 ── */
.note-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 7px;
  background: var(--course-accent, #7a2e2e);
  color: var(--course-accent-on, #fdfbf5);
  border: none;
  border-radius: 10px 0 0 10px;
  box-shadow: var(--shadow-md, 0 6px 18px rgba(0, 0, 0, 0.12));
  cursor: pointer;
  font-family: var(--font-serif, "Lora", serif);
  transition: padding-right 0.18s ease, box-shadow 0.18s ease;
}

.note-tab:hover {
  padding-right: 11px;
  box-shadow: 0 8px 22px -8px var(--course-accent-shadow, rgba(122, 46, 46, 0.4));
}

.note-tab-icon {
  font-size: 15px;
  line-height: 1;
}

.note-tab-text {
  writing-mode: vertical-rl;
  letter-spacing: 0.18em;
  font-size: 12px;
}

/* ── 展开态：便笺卡片 ── */
.note-card {
  width: 280px;
  max-width: calc(100vw - 32px);
  background: var(--course-highlight, #fbf3f3);
  border: 1px solid var(--course-accent-soft-strong, rgba(122, 46, 46, 0.14));
  border-right: none;
  border-radius: 14px 0 0 14px;
  box-shadow: var(--shadow-md, 0 6px 18px rgba(0, 0, 0, 0.12));
  padding: 16px 18px 18px;
  font-family: var(--font-serif, "Lora", serif);
  position: relative;
}

.note-card::before {
  /* 左侧装订色条，强调便笺感 */
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--course-accent, #7a2e2e);
  border-radius: 14px 0 0 14px;
}

.note-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  cursor: pointer;
}

.note-card-kicker {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--course-accent, #7a2e2e);
  font-weight: 600;
}

.note-card-collapse {
  font-size: 18px;
  line-height: 1;
  color: var(--color-text-tertiary, #9a8f80);
  transition: color 0.15s ease;
}

.note-card-head:hover .note-card-collapse {
  color: var(--course-accent, #7a2e2e);
}

.note-card-body {
  margin: 0;
  font-size: 15px;
  line-height: 1.7;
  color: var(--color-text-primary, #2c2620);
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── 她已写的回复 ── */
.note-reply-done {
  margin-top: 14px;
  padding: 10px 12px;
  background: var(--color-surface-card, #fffdf7);
  border-radius: 10px;
}

.note-reply-label {
  display: block;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-tertiary, #9a8f80);
  margin-bottom: 4px;
}

.note-reply-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-secondary, #5c534a);
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── 回复输入 ── */
.note-reply-box {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.note-reply-input {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  padding: 8px 10px;
  border: 1px solid var(--color-border-medium, #e0d8cc);
  border-radius: 8px;
  background: var(--color-surface-card, #fffdf7);
  font-family: var(--font-sans, "Inter", sans-serif);
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--color-text-primary, #2c2620);
}

.note-reply-input:focus {
  outline: none;
  border-color: var(--course-accent, #7a2e2e);
  box-shadow: 0 0 0 3px var(--course-accent-soft, rgba(122, 46, 46, 0.08));
}

.note-reply-send {
  align-self: flex-end;
  padding: 6px 16px;
  background: var(--course-accent, #7a2e2e);
  color: var(--course-accent-on, #fdfbf5);
  border: none;
  border-radius: 8px;
  font-family: var(--font-sans, "Inter", sans-serif);
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.note-reply-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── 移动端：收窄，避免遮挡正文 ── */
@media (max-width: 768px) {
  .note-stack {
    gap: 8px;
  }

  .note-card {
    width: 240px;
  }
}
</style>

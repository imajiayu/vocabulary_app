<template>
  <div v-if="notes.length" class="note-root">
    <!-- 浮窗卡片：从左下角向上弹开，限高内滚，不被顶栏遮挡 -->
    <transition name="note-pop">
      <section v-show="open" class="note-window">
        <header class="note-window-head">
          <span class="note-window-title">
            <span class="note-window-star" aria-hidden="true">✶</span>
            给宝宝的话
          </span>
          <button
            type="button"
            class="note-window-close"
            title="收起"
            aria-label="收起便笺"
            @click="close"
          >
            ×
          </button>
        </header>

        <div class="note-window-body">
          <article
            v-for="(note, i) in notes"
            :key="note.key"
            class="note-block"
            :class="{ 'is-divided': i > 0 }"
          >
            <span v-if="note.author" class="note-block-from">
              来自 {{ note.author }}
            </span>

            <p class="note-block-body">{{ note.body }}</p>

            <!-- 她已写过的回复 -->
            <div v-if="note.reply" class="note-reply-done">
              <span class="note-reply-label">
                你的回复
                <time v-if="note.repliedAt" class="note-reply-time">
                  {{ formatRepliedAt(note.repliedAt) }}
                </time>
              </span>
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
      </section>
    </transition>

    <!-- 浮标：常驻左下角，关着时带一颗小红点提示 -->
    <button
      type="button"
      class="note-fab"
      :class="{ 'is-open': open }"
      :title="open ? '收起便笺' : '给宝宝的话'"
      :aria-label="open ? '收起便笺' : '给宝宝的话'"
      @click="toggle"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v9A1.5 1.5 0 0 1 19.5 18h-15A1.5 1.5 0 0 1 3 16.5v-9Z"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
        />
        <path
          d="M4 7.5 12 13l8-5.5"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useCourseNote } from '@/features/courses/composables/useCourseNote'
import { useToast } from '@/shared/composables/useToast'

const props = defineProps<{
  course: string
  lessonId: string
}>()

const { notes, fetchNotes, reply } = useCourseNote(props.course, props.lessonId)
const toast = useToast()

const open = ref(false)
const drafts = reactive<Record<string, string>>({})
const sending = reactive<Record<string, boolean>>({})

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

/** 回复时间显示为本地「M月D日 HH:mm」，纯展示用途（非业务日期） */
function formatRepliedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const mm = d.getMonth() + 1
  const dd = d.getDate()
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}月${dd}日 ${hh}:${mi}`
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
  // 打开课时页时，只要这门课有便笺（_notes jsonb）就自动弹开
  if (notes.value.length) open.value = true
})
</script>

<style scoped>
/* ── 浮标：右下角，叠在 CourseChat 浮标上方 ── */
.note-fab {
  position: fixed;
  bottom: 90px;
  right: 28px;
  z-index: 10000;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--course-accent, #7a2e2e);
  color: var(--course-accent-on, #fdfbf5);
  border: none;
  border-radius: 50%;
  box-shadow: 0 8px 22px -8px var(--course-accent-shadow, rgba(122, 46, 46, 0.5));
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.note-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 26px -8px var(--course-accent-shadow, rgba(122, 46, 46, 0.55));
}

.note-fab.is-open {
  transform: scale(0.92);
  opacity: 0.85;
}

.note-fab svg {
  width: 22px;
  height: 22px;
}


/* ── 浮窗：从右下浮标上方弹出，bottom 锚定 + 限高内滚 ── */
.note-window {
  position: fixed;
  bottom: 154px;
  right: 28px;
  z-index: 10001;
  width: 400px;
  max-width: calc(100vw - 32px);
  /* 上限留出顶栏与两枚浮标的空间，向上生长绝不被顶栏遮挡 */
  max-height: calc(100vh - 200px);
  display: flex;
  flex-direction: column;
  background: var(--course-highlight, #fbf3f3);
  border: 1px solid var(--course-accent-soft-strong, rgba(122, 46, 46, 0.14));
  border-radius: 16px;
  box-shadow: 0 18px 48px -16px rgba(0, 0, 0, 0.28);
  font-family: var(--font-serif, "Lora", serif);
  overflow: hidden;
}

.note-window::before {
  /* 顶部装订色条，呼应便笺感 */
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 4px;
  background: var(--course-accent, #7a2e2e);
}

.note-window-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 14px 10px 18px;
}

.note-window-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--course-accent, #7a2e2e);
}

.note-window-star {
  font-size: 13px;
}

.note-window-close {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 50%;
  font-size: 19px;
  line-height: 1;
  color: var(--color-text-tertiary, #9a8f80);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.note-window-close:hover {
  color: var(--course-accent, #7a2e2e);
  background: var(--course-accent-soft, rgba(122, 46, 46, 0.08));
}

/* ── 可滚动内容区 ── */
.note-window-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 18px 18px;
  scrollbar-width: thin;
  scrollbar-color: var(--course-accent-soft-strong, rgba(122, 46, 46, 0.24)) transparent;
}

.note-window-body::-webkit-scrollbar {
  width: 5px;
}

.note-window-body::-webkit-scrollbar-track {
  background: transparent;
}

.note-window-body::-webkit-scrollbar-thumb {
  background: var(--course-accent-soft-strong, rgba(122, 46, 46, 0.24));
  border-radius: 3px;
}

/* 多条便笺时的分隔 */
.note-block.is-divided {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--course-accent-soft-strong, rgba(122, 46, 46, 0.2));
}

.note-block-from {
  display: block;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-tertiary, #9a8f80);
  margin-bottom: 6px;
}

.note-block-body {
  margin: 0;
  font-size: 15px;
  line-height: 1.75;
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
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-tertiary, #9a8f80);
  margin-bottom: 4px;
}

.note-reply-time {
  letter-spacing: 0.04em;
  text-transform: none;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-tertiary, #9a8f80);
  opacity: 0.8;
  white-space: nowrap;
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
  max-height: 30vh;
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

/* ── 弹出动画：从左下角放大浮现 ── */
.note-pop-enter-active {
  transition: transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.18s ease;
}

.note-pop-leave-active {
  transition: transform 0.16s ease, opacity 0.16s ease;
}

.note-pop-enter-from,
.note-pop-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.94);
  transform-origin: bottom right;
}

/* ── 移动端 ── */
@media (max-width: 768px) {
  .note-fab {
    bottom: 74px;
    right: 16px;
    width: 48px;
    height: 48px;
  }

  .note-window {
    left: 16px;
    right: 16px;
    bottom: 132px;
    width: auto;
    max-width: none;
    max-height: calc(100vh - 172px);
  }
}
</style>

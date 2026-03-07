# 代码审查与分步优化方案

> 审查日期：2026-03-07
> 审查范围：全代码库（后端、前端、Edge Functions、数据库迁移）
> 审查方法：4 个并行审查代理 + 人工验证关键发现

---

## 目录

- [总览](#总览)
- [Phase 1：数据安全与资源泄漏（Critical）](#phase-1数据安全与资源泄漏critical)
- [Phase 2：并发与原子性（Critical/Important）](#phase-2并发与原子性criticalimportant)
- [Phase 3：数据库优化（Important）](#phase-3数据库优化important)
- [Phase 4：前端健壮性（Important）](#phase-4前端健壮性important)
- [Phase 5：安全加固（Important）](#phase-5安全加固important)
- [Phase 6：小幅改进（Minor）](#phase-6小幅改进minor)
- [设计讨论](#设计讨论)

---

## 总览

| 严重程度 | 数量 | 涵盖领域 |
|----------|------|----------|
| Critical | 6 | 数据丢失、资源泄漏、操作原子性 |
| Important | 10 | 索引缺失、竞态条件、安全策略 |
| Minor | 4 | 语义修正、计时精度、统计准确性 |
| 设计讨论 | 2 | 业务逻辑语义、UX 细节 |

**问题分布**：

```
后端 ····· C1, C2, I10, M3, M4    （5 个）
前端 ····· C3, C4, C6, I2, I4, I9, M1, M2, D2  （9 个）
Edge Fn ·· C5, I3, I7             （3 个）
数据库 ··· I1, I5, I6, I8         （4 个）
跨领域 ··· D1                     （1 个）
```

---

## Phase 1：数据安全与资源泄漏（Critical）

> 优先级最高。涉及数据永久丢失和浏览器资源泄漏，应立即修复。

### 1.1 `_save_batch` 单次 DB 异常导致整个生成任务终止 + 数据丢失

**问题编号**：C1
**文件**：`backend/generators/base.py:131-139` + `backend/services/generation_service.py:341-343`
**置信度**：90

**问题描述**：

`_flush()` 将缓冲数据通过 `_on_save()` 写入数据库，`_save_batch` 如果抛出异常（网络抖动、连接超时），异常冒泡到 `_run_generation` 的 `except Exception`，整个任务标记为 `error` 并终止。由于缓冲区在调用后清空，这批数据永久丢失，后续未处理的单词也不再生成。

```python
# base.py — 当前代码
def _flush(self, force: bool = False):
    if not self._on_save:
        return
    if force or len(self._pending_relations) >= self.flush_threshold:
        if self._pending_relations or self._pending_logs:
            self._on_save(self._pending_relations, self._pending_logs)  # 可能抛异常
            self._pending_relations = []  # 异常时已执行到此处？
            self._pending_logs = []       # 实际上：异常会阻止执行到这里
```

注意：Python 中如果 `_on_save` 抛出异常，后两行赋值不会执行，所以缓冲区数据本身不会丢失。**真正的问题是异常冒泡导致整个长时任务终止**——一次瞬时 DB 故障就会中断可能运行数十分钟的生成任务。

**修复方案**：

在 `on_save` 闭包中捕获异常并重试，失败后记录日志但允许生成继续：

```python
# generation_service.py — _run_generation 中的 on_save 闭包
def on_save(relations, logs):
    max_retries = 3
    for attempt in range(max_retries):
        try:
            self._save_batch(user_id, relations, logs)
            return
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"Batch save retry {attempt + 1}/{max_retries}: {e}")
                time.sleep(1 * (attempt + 1))  # 退避
            else:
                logger.error(f"Batch save failed after {max_retries} retries, skipping batch: {e}")
                # 不 raise，允许生成继续；已保存的数据不受影响
                # 更新 task 的 error 计数供前端显示
                with task._lock:
                    task._stats['save_errors'] = task._stats.get('save_errors', 0) + 1
```

---

### 1.2 `ProcessPoolExecutor` 无法响应停止信号

**问题编号**：C2
**文件**：`backend/generators/synonym_generator.py:137-138`
**置信度**：95

**问题描述**：

`_compute_semantic_similarities` 使用 `ProcessPoolExecutor`，子进程不接收 `stop_event`。一旦进入该方法，用户点击"停止"需等待所有子进程完成（可能数分钟）。此外 `ProcessPoolExecutor` 在 daemon 线程中运行时，主进程退出时行为未定义。

```python
# 当前代码
with ProcessPoolExecutor(max_workers=n_workers) as executor:
    results = list(executor.map(_compute_similarity_batch, batches))
    # ↑ 阻塞到所有 batch 完成，期间无法检查 stop_event
```

**修复方案**：

改用 `submit` + `as_completed` 模式，在每批次完成后检查停止信号：

```python
def _compute_semantic_similarities(self, unprocessed):
    # ... 准备 batches ...

    similar_pairs = {}
    n_workers = min(os.cpu_count() or 4, 8)

    with ProcessPoolExecutor(max_workers=n_workers) as executor:
        futures = [
            executor.submit(_compute_similarity_batch, batch)
            for batch in batches
        ]

        for future in as_completed(futures):
            if self._is_stopped():
                # 取消尚未开始的任务
                for f in futures:
                    f.cancel()
                break
            try:
                batch_result = future.result(timeout=60)
                similar_pairs.update(batch_result)
            except Exception as e:
                logger.warning(f"Semantic batch failed: {e}")

    return similar_pairs
```

---

### 1.3 `AudioPlayer.vue` — Blob URL 内存泄漏

**问题编号**：C3
**文件**：`frontend/src/features/speaking/components/AudioPlayer.vue:74-84`
**置信度**：95

**问题描述**：

`audioSrc` 是 `computed`，每次 `props.audioFile` 变更为新的 `File` 时都调用 `URL.createObjectURL()`，旧 Blob URL 永远不被释放。`onUnmounted` 只释放最后一个。

```typescript
// 当前代码
const audioSrc = computed(() => {
  if (!props.audioFile) return ''
  if (typeof props.audioFile === 'string') return props.audioFile
  else if (props.audioFile instanceof File) {
    return URL.createObjectURL(props.audioFile)  // 每次求值都创建新 URL
  }
  return ''
})
```

**修复方案**：

用 `watchEffect` 替代 `computed`，在创建新 URL 前释放旧 URL：

```typescript
const audioSrc = ref('')

watchEffect((onCleanup) => {
  if (!props.audioFile) {
    audioSrc.value = ''
    return
  }

  if (typeof props.audioFile === 'string') {
    audioSrc.value = props.audioFile
    return
  }

  if (props.audioFile instanceof File) {
    const url = URL.createObjectURL(props.audioFile)
    audioSrc.value = url
    onCleanup(() => URL.revokeObjectURL(url))
  }
})
```

`watchEffect` 的 `onCleanup` 会在下次执行前和组件卸载时自动调用，完美解决泄漏问题。

---

### 1.4 `useAudioRecording.ts` — AudioContext 和媒体流泄漏

**问题编号**：C4
**文件**：`frontend/src/features/speaking/composables/useAudioRecording.ts:175-183`
**置信度**：92

**问题描述**：

`resetRecording()` 将 `mediaRecorder` 设为 `null` 但**没有调用 `.stop()`**。`recorder.onstop` 回调（负责关闭 AudioContext、断开 ScriptProcessorNode、停止媒体流）永远不会触发。

当 `VoicePractice` 组件在 `ANALYZING` 状态期间被卸载时（`handleIdleEntry()` → `resetRecording()`），此问题必现。用户看到的表现：麦克风指示灯持续亮着。

```typescript
// 当前代码
const resetRecording = () => {
  context.value.mediaRecorder = null  // 直接丢弃引用，onstop 不会触发
  context.value.audioChunks = []
  context.value.recordingTime = 0
  context.value.currentMimeType = 'audio/mp4'
  stopRecordingTimer()
  stopAudioDataTimer()
  isRecording.value = false
}
```

**修复方案**：

在清空引用前检查并停止正在运行的 recorder：

```typescript
const resetRecording = () => {
  const recorder = context.value.mediaRecorder
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop()  // 触发 onstop → 清理 AudioContext、stream、processor
  }
  context.value.mediaRecorder = null
  context.value.audioChunks = []
  context.value.recordingTime = 0
  context.value.currentMimeType = 'audio/mp4'
  stopRecordingTimer()
  stopAudioDataTimer()
  isRecording.value = false
}
```

---

### 1.5 `delete-source` Edge Function — 非原子多步操作

**问题编号**：C5
**文件**：`supabase/functions/delete-source/index.ts:96-138`
**置信度**：95

**问题描述**：

三步独立操作（删除 words → 删除 progress → 更新 config）无事务保护。若 step 1-2 成功但 step 3 失败：
- 数据已被删除，**不可恢复**
- `customSources` 仍保留该 source
- 用户看到一个空的 source，再次删除时 `deletedWords = 0`

PostgREST 的 `.update()` 对 0 行匹配静默成功（`updateError` 为 `null`），配置更新失败可能完全被吞掉。

**修复方案 A**（推荐）：改用数据库函数（事务保护）：

```sql
-- 新增迁移文件
CREATE OR REPLACE FUNCTION delete_source(
  p_user_id UUID,
  p_source TEXT,
  p_updated_config JSONB
) RETURNS JSONB AS $$
DECLARE
  deleted_words_count INT;
  deleted_progress_count INT;
BEGIN
  DELETE FROM words WHERE user_id = p_user_id AND source = p_source;
  GET DIAGNOSTICS deleted_words_count = ROW_COUNT;

  DELETE FROM current_progress WHERE user_id = p_user_id AND source = p_source;
  GET DIAGNOSTICS deleted_progress_count = ROW_COUNT;

  UPDATE user_config SET config = p_updated_config WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_config not found for user %', p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'deleted_words', deleted_words_count,
    'deleted_progress', deleted_progress_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**修复方案 B**（轻量）：调换顺序，先更新 config（可回退），再删除数据：

```typescript
// 先更新 config（失败则 throw，数据未动）
await supabase.from('user_config').update({ config: updatedConfig }).eq('user_id', userId).throwOnError()
// 再删除数据（config 已更新，即使下面失败，source 已不在列表中，不会 UI 残留）
await supabase.from('words').delete().eq('user_id', userId).eq('source', sourceName)
await supabase.from('current_progress').delete().eq('user_id', userId).eq('source', sourceName)
```

---

### 1.6 `BaseModal.vue` — 多 Modal 并存时滚动锁定互相干扰

**问题编号**：C6
**文件**：`frontend/src/shared/components/base/BaseModal.vue:91-114`
**置信度**：88

**问题描述**：

多个 BaseModal 实例直接操作 `document.body.style.overflow`。关闭顺序错乱时（如第二个 Modal 先关闭），会提前恢复背景滚动。`onUnmounted` 中无条件执行 `document.body.style.overflow = ''`。

**修复方案**：

使用模块级引用计数：

```typescript
// shared/utils/scrollLock.ts
let lockCount = 0

export function lockScroll() {
  lockCount++
  if (lockCount === 1) {
    document.body.style.overflow = 'hidden'
  }
}

export function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.body.style.overflow = ''
  }
}
```

```typescript
// BaseModal.vue
import { lockScroll, unlockScroll } from '@/shared/utils/scrollLock'

watch(() => props.modelValue, (open, wasOpen) => {
  if (open && !wasOpen) lockScroll()
  if (!open && wasOpen) unlockScroll()
})

onUnmounted(() => {
  if (props.modelValue) unlockScroll()
})
```

---

## Phase 2：并发与原子性（Critical/Important）

> 竞态条件和并发安全问题，可能在特定操作时序下触发。

### 2.1 `useReviewQueue.loadWords` — resetQueue 被后台加载静默阻止

**问题编号**：I2
**文件**：`frontend/src/features/vocabulary/stores/review/useReviewQueue.ts:76`
**置信度**：85

**问题描述**：

```typescript
if (isLoading.value || isBackgroundLoading.value) return  // 无论 resetQueue 与否，一律跳过
```

用户快速切换复习模式时，若恰好有后台加载在进行，新模式的队列加载被跳过。

**修复方案**：

为 `resetQueue` 情况添加取消/等待机制：

```typescript
let loadAbortController: AbortController | null = null

const loadWords = async (resetQueue = false, ...): Promise<void> => {
  if (resetQueue) {
    cancelPendingIndex()
    // 取消正在进行的加载
    if (loadAbortController) {
      loadAbortController.abort()
      loadAbortController = null
      isLoading.value = false
      isBackgroundLoading.value = false
    }
  }

  if (isLoading.value || isBackgroundLoading.value) return

  loadAbortController = new AbortController()
  // ... 后续逻辑中检查 loadAbortController.signal.aborted ...
}
```

---

### 2.2 `VoicePractice.vue` — 组件卸载时飞行中的 AI 请求未取消

**问题编号**：I4
**文件**：`frontend/src/features/speaking/components/VoicePractice.vue:349-351`
**置信度**：83

**问题描述**：

`onUnmounted` 中调用 `handleIdleEntry()` 重置状态，但 `processTranscriptionAndAnalysis` 的 async 函数仍在飞行中。完成后仍会 `emit` 事件到已卸载的父组件。

**修复方案**：

```typescript
let isMounted = true

onUnmounted(() => {
  isMounted = false
  handleIdleEntry()
})

// 在 processTranscriptionAndAnalysis 中的关键 await 之后：
const processTranscriptionAndAnalysis = async () => {
  // ...
  const result = await transcribeAudio(...)
  if (!isMounted) return  // 组件已卸载，放弃后续处理

  const feedback = await getAIFeedback(...)
  if (!isMounted) return

  // ... emit 等操作 ...
}
```

---

### 2.3 `_get_jwks_client` 无锁保护

**问题编号**：I10
**文件**：`backend/middleware/user_context.py:25-37`
**置信度**：85

**问题描述**：

Flask 多线程处理请求时，全局变量 + lazy init 的单例模式没有锁保护，两个并发请求可能各自创建 `PyJWKClient` 实例。

**修复方案**：

```python
import threading

_jwks_client: Optional[PyJWKClient] = None
_jwks_lock = threading.Lock()

def _get_jwks_client() -> Optional[PyJWKClient]:
    global _jwks_client
    if _jwks_client is not None:
        return _jwks_client
    with _jwks_lock:
        if _jwks_client is not None:  # double-checked locking
            return _jwks_client
        # ... 初始化逻辑 ...
        _jwks_client = PyJWKClient(...)
        return _jwks_client
```

---

## Phase 3：数据库优化（Important）

> 索引、约束和 RLS 策略的完善，涉及查询性能和数据完整性。

### 3.1 补充复习/拼写队列复合索引

**问题编号**：I1
**置信度**：90

**问题描述**：

`words` 表目前只有 `idx_words_user_id` 单列索引。以下高频查询均需要在命中 user_id 后全表扫描：
- 复习队列：`WHERE user_id=? AND stop_review=0 AND next_review <= CURRENT_DATE`
- 拼写队列：`WHERE user_id=? AND stop_spell=0 AND spell_next_review <= CURRENT_DATE`
- 负荷查询：`WHERE user_id=? AND source=? AND stop_review=0 AND next_review BETWEEN ...`

**迁移文件**：

```sql
-- supabase/migrations/2026XXXXXXXXXX_add_review_queue_indexes.sql

-- 复习队列索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_words_review_queue
  ON words (user_id, stop_review, next_review)
  WHERE stop_review = 0;

-- 拼写队列索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_words_spell_queue
  ON words (user_id, stop_spell, spell_next_review)
  WHERE stop_spell = 0;

-- 负荷查询索引（可选，进一步优化 loadBalancer 场景）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_words_source_review
  ON words (user_id, source, stop_review, next_review)
  WHERE stop_review = 0;
```

使用 partial index（`WHERE stop_review = 0`）减少索引大小：已停止复习的单词不进入索引。

---

### 3.2 补充 `review_history.user_id` 外键约束

**问题编号**：I5
**置信度**：82

**问题描述**：

`review_history.user_id` 缺少 `REFERENCES auth.users(id) ON DELETE CASCADE`，是所有表中唯一没有此外键的。用户账号删除后记录变成孤立数据。

**迁移文件**：

```sql
-- supabase/migrations/2026XXXXXXXXXX_add_review_history_fk.sql

ALTER TABLE review_history
  ADD CONSTRAINT review_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

---

### 3.3 加强 `speaking_questions` INSERT RLS 策略

**问题编号**：I6
**置信度**：80

**问题描述**：

INSERT 策略只检查 `auth.uid() = user_id`，未验证 `topic_id` 归属。认证用户可插入关联到其他用户话题的记录。

**迁移文件**：

```sql
-- supabase/migrations/2026XXXXXXXXXX_fix_speaking_questions_rls.sql

DROP POLICY IF EXISTS "insert_own" ON speaking_questions;

CREATE POLICY "insert_own" ON speaking_questions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM speaking_topics
      WHERE id = topic_id AND user_id = auth.uid()
    )
  );
```

---

### 3.4 限制 `ai_prompt_cache` 的写入权限

**问题编号**：I8
**置信度**：88

**问题描述**：

`anyone_can_insert` 允许任意认证用户向全局缓存插入内容。基于唯一约束 + `ON CONFLICT DO NOTHING`，第一个插入者"锁定"该词的缓存结果，恶意数据无法纠正。

**修复方案**（二选一）：

**方案 A**：仅允许 service_role 写入（通过 Edge Function 代理）：

```sql
DROP POLICY IF EXISTS "anyone_can_insert" ON ai_prompt_cache;

CREATE POLICY "service_can_insert" ON ai_prompt_cache FOR INSERT TO service_role
  WITH CHECK (true);
```

**方案 B**：记录插入者 + 允许覆盖自己的缓存：

```sql
-- 先添加 created_by 列
ALTER TABLE ai_prompt_cache ADD COLUMN created_by UUID REFERENCES auth.users(id);

DROP POLICY IF EXISTS "anyone_can_insert" ON ai_prompt_cache;

CREATE POLICY "insert_with_owner" ON ai_prompt_cache FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "update_own" ON ai_prompt_cache FOR UPDATE TO authenticated
  USING (created_by = auth.uid());
```

---

## Phase 4：前端健壮性（Important）

> 组件生命周期、定时器管理和网络请求的边界处理。

### 4.1 `fetch-definition` — `response.text()` 无超时保护

**问题编号**：I3
**文件**：`supabase/functions/fetch-definition/index.ts:30-43`
**置信度**：83

**问题描述**：

`AbortController` 的 10 秒超时只保护 `fetch()` 连接阶段。`finally` 中 `clearTimeout` 后，`response.text()` 的读取过程无超时保护。

**修复方案**：

使用 `AbortSignal.any()`（Deno 支持）或不在 finally 中提前清除 timeout：

```typescript
async function fetchFromYoudao(word: string): Promise<DefinitionResult> {
  const url = `https://dict.youdao.com/w/eng/${encodeURIComponent(word)}/`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    })
    // 不在此处 clearTimeout，让超时保护覆盖 response.text()
    const html = await response.text()
    clearTimeout(timeoutId)  // 读取完成后再清除
    // ... 解析逻辑 ...
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('请求超时')
    }
    throw e
  } finally {
    clearTimeout(timeoutId)  // 兜底清除
  }
}
```

同样修改 `wiktionaryParse` 函数中的 `response.json()` 调用。

---

### 4.2 `HeatMap.vue` — setTimeout 在组件卸载后仍可能执行

**问题编号**：I9
**文件**：`frontend/src/shared/components/charts/HeatMap.vue:132-143, 261-274`
**置信度**：85

**问题描述**：

多处 `setTimeout(() => renderChart(), 100/150/200)` 的重试逻辑，在组件卸载后仍可执行。

**修复方案**：

```typescript
let isDestroyed = false
const pendingTimers: number[] = []

const safeTimeout = (fn: () => void, delay: number) => {
  const id = window.setTimeout(() => {
    if (!isDestroyed) fn()
  }, delay)
  pendingTimers.push(id)
  return id
}

onBeforeUnmount(() => {
  isDestroyed = true
  pendingTimers.forEach(clearTimeout)
  // ... 其他清理 ...
})

// 替换所有 setTimeout 调用
// setTimeout(() => renderChart(), 100)  →  safeTimeout(() => renderChart(), 100)
```

---

### 4.3 `adjust-max-prep-days` 缺少上限和整数校验

**问题编号**：I7
**文件**：`supabase/functions/adjust-max-prep-days/index.ts:56`
**置信度**：85

**修复方案**：

```typescript
// 当前
if (typeof maxPrepDays !== 'number' || maxPrepDays < 1) {

// 修复
if (!Number.isInteger(maxPrepDays) || maxPrepDays < 1 || maxPrepDays > 365) {
  return new Response(
    JSON.stringify({ success: false, error: 'maxPrepDays 必须是 1-365 之间的整数' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

---

## Phase 5：安全加固（Important）

> TopicGenerator 停止时的日志完整性和 SynonymGenerator 统计准确性。

### 5.1 `TopicGenerator` 停止时 `remaining_topics` 中词条的 log 丢失

**问题编号**：M4 相关
**文件**：`backend/generators/topic_generator.py:76-127`
**置信度**：82

**问题描述**：

`stop_event` 触发后 break，`remaining_topics` 中剩余词没有 `_add_log`，下次运行时这些词会被重复处理。

**修复方案**：

```python
# topic_generator.py — generate() 方法内，break 后增加：
if self._is_stopped():
    # 对剩余词记录已处理的 log（部分处理）
    for wid in list(remaining_topics.keys()):
        self._add_log(wid, word_found_counts.get(wid, 0))
    break

self._flush(force=True)
```

---

## Phase 6：小幅改进（Minor）

> 代码质量和健壮性的细节完善。

### 6.1 `BaseModal.vue` — `titleId` 语义修正

**问题编号**：M1
**文件**：`frontend/src/shared/components/base/BaseModal.vue:82`

```typescript
// 当前（computed 包裹无响应式依赖的值）
const titleId = computed(() => `modal-title-${Math.random().toString(36).slice(2, 9)}`)

// 修复（直接用 const）
const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`
```

---

### 6.2 `ReviewCard.vue` — `animationend` 兜底超时

**问题编号**：M2
**文件**：`frontend/src/features/vocabulary/review/ReviewCard.vue:395`

```typescript
const onRevealEnter = (el: Element, done: () => void) => {
  const htmlEl = el as HTMLElement
  htmlEl.style.animation = `contentReveal ${duration} ...`

  // 添加超时兜底（prefers-reduced-motion 或动画被禁用时）
  const fallback = setTimeout(done, parseFloat(duration) * 1000 + 100)
  htmlEl.addEventListener('animationend', () => {
    clearTimeout(fallback)
    done()
  }, { once: true })
}
```

---

### 6.3 SSE idle 计时改用真实时间

**问题编号**：M3
**文件**：`backend/api/generation.py:71-115`

```python
# 当前：idle_seconds += 0.5（累加式，不准确）

# 修复：使用 monotonic clock
idle_start: Optional[float] = None

# 在循环内：
if changed:
    idle_start = None
else:
    if idle_start is None:
        idle_start = time.monotonic()
    elif time.monotonic() - idle_start >= MAX_IDLE_SECONDS:
        yield f"event: timeout\ndata: ...\n\n"
        break
```

---

### 6.4 BarChart/LineChart — ResizeObserver 中不必要的完整重绘

**问题编号**：D2
**文件**：`frontend/src/shared/components/charts/BarChart.vue:82`, `LineChart.vue:148`

```typescript
// 当前：resize 时完整重建 option + 播放动画
ro = new ResizeObserver(() => {
  if (chart) {
    chart.resize()
    render()  // ← 多余：每次 resize 触发 800ms 动画
  }
})

// 修复：resize 时只调用 resize()
ro = new ResizeObserver(() => {
  if (chart && !chart.isDisposed()) {
    chart.resize()
  }
})
```

---

## 设计讨论

以下两个问题涉及业务逻辑语义，需要确认设计意图后再决定是否修改。

### D1. SM-2 成功复习是否应清除 `lapse` 标记？

**文件**：`frontend/src/shared/core/reviewRepetition.ts:110`

**现状**：`score >= 3`（记住）时，`lapse` 字段原样透传。用户在普通复习模式连续多次答对一个带 lapse 标记的单词，它仍出现在 Lapse 队列中。只有走完 Lapse 模式的 ERP 流程（`clearLapseDirect`）才能清除。

**影响**：Lapse 队列可能虚高，包含实际已掌握的单词。

**两个方向**：
- **保持现状**（强制 ERP）：确保曾出错的单词必须经过专门的间隔强化训练才能"毕业"。在 UI 上明确告知用户 Lapse 模式的用途。
- **修改为清除**：`score >= 3` 时返回 `lapse: 0`。更符合用户直觉，但可能降低对出错单词的训练强度。

### D2. `useReviewProgress.cleanup()` 的可访问性

**文件**：`frontend/src/features/vocabulary/stores/review/useReviewProgress.ts:84-90`

`cleanup()` 未在 `review.ts` 的 return 对象中暴露。由于 Pinia Store 是单例，`beforeunload` 监听器只注册一次，当前不会泄漏。但设计上存在隐患——若未来需要 `$dispose()` Store 或在组件中使用此 Composable，监听器将无法被清除。

建议在 store 的 return 对象中暴露 cleanup，或在 store 的 `$reset` 中调用。

---

## 实施建议

| Phase | 工作量 | 风险 | 建议时机 |
|-------|--------|------|----------|
| Phase 1 | 中等 | 高（不修复有数据丢失风险） | 立即 |
| Phase 2 | 较小 | 中（特定操作时序下触发） | 本周 |
| Phase 3 | 较小 | 低（需要迁移文件） | 下次部署 |
| Phase 4 | 较小 | 低 | 下次部署 |
| Phase 5 | 较小 | 低 | 按需 |
| Phase 6 | 最小 | 极低 | 按需 |

建议按 Phase 顺序逐步修复，每个 Phase 完成后单独提交和测试。Phase 1 中的 C3（Blob URL）和 C4（AudioContext）修复最简单且效果最明显，可以作为第一批修复。

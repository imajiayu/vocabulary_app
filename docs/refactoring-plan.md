# 重构计划

> 基于全项目扫描（2026-04-03），覆盖前端 shared/features/pages/app 四层 + 后端 + 构建配置 + 安全审计。

---

## 目录

1. [概览与评分](#1-概览与评分)
2. [P0 — 必须修复](#2-p0--必须修复)
3. [P1 — 高优先级](#3-p1--高优先级)
4. [P2 — 中优先级](#4-p2--中优先级)
5. [P3 — 低优先级 / 技术债](#5-p3--低优先级--技术债)
6. [执行路线图](#6-执行路线图)

---

## 1. 概览与评分

| 维度 | 评分 | 说明 |
|------|------|------|
| **架构设计** | A | Feature-Sliced Design 清晰，前后端职责明确，无循环依赖 |
| **类型安全** | A- | strict 模式，几乎无 `any`；少量 `.value!` 和 `Promise<any>` |
| **安全性** | A- | 参数化 SQL、JWT 双算法、DOMPurify；CORS 默认 `*` 需收紧 |
| **代码简洁** | B | 多个超大组件（2900+/1700+ 行），重复的 desktop/mobile 模板 |
| **性能** | B | echarts 全量引入、RootGenerator O(n²)、watcher 未清理 |
| **错误处理** | B- | 全局 toast 通知，但无 error state UI、无重试、无 error boundary |
| **可维护性** | B+ | 魔数较多但集中、composable 粒度合理、store 拆分得当 |
| **可扩展性** | B+ | 配置项散落在各文件、缺少 feature flag 机制 |

**综合评级：B+** — 架构扎实，主要短板在组件体积和错误处理。

---

## 2. P0 — 必须修复

### 2.1 超大组件拆分

当前 6 个组件超过 1000 行，可维护性和代码审查效率严重受损。

| 组件 | 行数 | 拆分方案 |
|------|------|----------|
| **ReviewRightPanel.vue** | 2,934 | → `NotificationCard.vue` + `LapseTrackerCard.vue` + `AiPanel.vue` + `AiPanelMobile.vue` + 控制器 |
| **SettingsPage.vue** | 2,746 | → 提取 `useRelationGeneration.ts`（SSE）+ `useSourceDragDrop.ts` + `useSettingsForm.ts` + `useDefinitionProgress.ts` |
| **WordIndex.vue** | 1,720 | → 分离 desktop/mobile 变体 + 提取 `ActionCard.vue` + `useDragReorderSources.ts` |
| **ReviewCard.vue** | 1,260 | → 提取 `ReviewCardActions.vue` + `PhoneticsDisplay.vue` |
| **SpellingCard.vue** | 1,249 | → 合并 4 个重复 gallery-panel 为循环 + 提取 `useSpellingInput.ts` |
| **VoicePractice.vue** | 1,255 | → 提取录音/回放/反馈子组件 + 合并 4 个 watcher |

**目标**：每个组件 ≤ 500 行（模板 + 脚本 + 样式）。

### 2.2 AiChatPanel 使用 index 作 key

```vue
<!-- 当前（有 bug） -->
<div v-for="(msg, index) in messages" :key="index">

<!-- 修复 -->
<div v-for="msg in messages" :key="msg.id">
```

消息插入/删除时 index key 会导致 DOM 复用错误和动画异常。需为每条消息生成唯一 ID。

### 2.3 wordEditor.ts 拆分 + 错误状态

607 行的 store，含 6 个 callback 数组 + 无错误状态暴露。

- 拆分为 `useWordEditorBase`（open/close/edit）+ `useWordEditorSave`（保存 + 查重 + 定义获取 + TTS 清理）
- `fetchDefinitionAsync()` 添加 AbortController，组件卸载时取消
- 暴露 `error: Ref<Error | null>` 供 UI 展示

### 2.4 生产环境 CORS 收紧

```python
# 当前：默认允许所有来源
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")

# 修复：生产环境必须显式配置
CORS_ORIGINS = os.environ.get("CORS_ORIGINS")
if not CORS_ORIGINS:
    raise ValueError("CORS_ORIGINS must be set in production")
```

同时在 `backend/.env` 设置 `CORS_ORIGINS=https://mieltsm.top`。

---

## 3. P1 — 高优先级

### 3.1 全局错误处理体系

**现状**：所有 feature 的 API 调用仅 `log.warn()` 静默失败，无 error state UI，无重试。

**方案**：

1. 创建 `shared/composables/useAsyncAction.ts`：
   ```typescript
   function useAsyncAction<T>(fn: () => Promise<T>, options?: { maxRetries?: number }) {
     const error = ref<Error | null>(null)
     const isRetrying = ref(false)
     // 含指数退避重试
     return { execute, error, isRetrying, reset }
   }
   ```

2. 在 `App.vue` 添加全局 ErrorBoundary（Vue `onErrorCaptured`）

3. 各 feature store 暴露 `error` ref，UI 层展示 inline error + retry 按钮

### 3.2 watcher 清理与内存泄漏

以下文件存在 watch 未清理或异步请求未取消的问题：

| 文件 | 问题 | 修复 |
|------|------|------|
| `VoicePractice.vue` | 4 个独立 watcher 无 cleanup | 合并 + `onBeforeUnmount` 清理 |
| `useChatMessages.ts` | 3 个 watch + 无 abort | 添加 `stopWatch()` + AbortController |
| `useSourceSelection.ts` | `fetchAllSourcesStats()` 无取消 | 添加 AbortController |
| `WritingWorkspace.vue` | 多个 watch 链 | 合并 + 显式停止 |
| `wordEditor.ts` | `watch(() => currentWord.value?.word)` modal 关闭后仍运行 | 条件守卫或 `watchEffect` with scope |

### 3.3 Router 类型安全

```typescript
// 当前
const lazyPage = (loader: () => Promise<any>) => ...
const toDepth = (to.meta.depth as number) ?? ...

// 修复：声明 RouteMeta 接口
declare module 'vue-router' {
  interface RouteMeta {
    title: string
    depth?: number
    public?: boolean
  }
}
const lazyPage = (loader: () => Promise<{ default: Component }>) => ...
```

### 3.4 echarts 按需引入

当前全量 `import * as echarts` 约 500KB+。改为按需引入：

```typescript
import { use } from 'echarts/core'
import { BarChart, LineChart, PieChart, HeatmapChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([BarChart, LineChart, PieChart, HeatmapChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])
```

预计包体积减少 200-300KB。

### 3.5 RootGenerator O(n^2) 优化

```python
# 当前：所有单词两两比较
for i, w1 in enumerate(unprocessed):
    for w2 in words:  # 包含已处理单词
        ...

# 优化：仅比较新增子集
for i, w1 in enumerate(unprocessed):
    for j in range(i + 1, len(unprocessed)):
        w2 = unprocessed[j]
        ...
```

10k 词时从 ~100M 次比较降至 ~25M（4x 提速）。

### 3.6 前端 ESLint + Prettier 集成

当前 `package.json` 无 eslint/prettier 依赖，CI 也无 lint 步骤。

```bash
npm i -D eslint prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser \
  eslint-plugin-vue vue-eslint-parser
```

在 `deploy.yml` 的 `npm run build` 前添加 `npm run lint`。

---

## 4. P2 — 中优先级

### 4.1 魔数提取为配置常量

散落在 `core/`、`services/`、`api/` 的硬编码阈值统一到 `config/`：

```
config/
  algorithms.ts    # SM-2 阈值 (2.5, 3.0)、拼写强度 (5.0)、负荷均衡 (0.7)
  api.ts           # 分页大小 (1000)、统计缓存 TTL (5min)
  ai.ts            # DeepSeek base URL / model / 速率限制
  features.ts      # Feature flags（可选）
```

### 4.2 跨 feature 重复逻辑提取

| 重复逻辑 | 出现位置 | 提取目标 |
|----------|----------|----------|
| shuffle 洗牌 | vocabulary/review, speaking | `shared/utils/shuffle.ts` |
| 拖拽排序 | WordIndex, SettingsPage, WritingSidebar | `shared/composables/useDragReorder.ts` |
| 展开/折叠 Set | vocabulary, speaking, writing | `shared/composables/useExpandableItems.ts` |
| loading 双态 | 全部 feature store | `shared/composables/useLoadingState.ts` |
| confidence 评分 | 5 个 generator 各自实现 | `backend/generators/base.py` 提升为基类方法 |

### 4.3 Speech Recognition 策略模式

当前 3 个语音识别实现无公共接口：

```typescript
interface SpeechRecognizer {
  recognize(audio: Blob): Promise<string>
  abort(): void
  readonly isSupported: boolean
}

// GoogleCloudSTT implements SpeechRecognizer
// WebSpeechRecognition implements SpeechRecognizer
// 由 transcription.ts 作为 factory 选择最佳实现
```

### 4.4 AI 服务配置集中化

DeepSeek 配置散落在 `services/deepseek.ts`（base URL、model）、各 AI service（prompt 模板）：

- 移 API 配置到 `config/ai.ts`
- Speaking AI 的 200+ 行 prompt 提取到 `assets/prompts/speaking-feedback.txt`
- 添加简单速率限制（max 5 req/min per user）

### 4.5 stats.ts 类型收窄

Supabase 返回 `string | number | null`，当前用 `toNumber()`/`toInt()` 手动转换：

```typescript
// 当前：30+ 行中间类型 + 手动转换
interface StatsWordRaw { ease_factor: string | number | null; ... }

// 改进：统一转换层
function narrowStatsRow(raw: StatsWordRaw): StatsWord {
  return {
    ease_factor: Number(raw.ease_factor) || 0,
    ...
  }
}
```

### 4.6 RelationsApi 错误处理统一

```typescript
// 当前：RelationsApi 用 raw throw
throw new Error(`HTTP ${response.status}`)

// 统一为 throwIfError 模式或 ApiError 类
import { ApiError } from './client'
if (!response.ok) throw new ApiError(response.status, await response.text())
```

### 4.7 后端缺失数据库索引

```sql
CREATE INDEX idx_words_relations_user_type ON words_relations(user_id, relation_type);
CREATE INDEX idx_relation_gen_log_user ON relation_generation_log(user_id, relation_type);
```

### 4.8 TTS 缓存淘汰策略

当前无缓存上限，磁盘会持续增长。添加定时清理：

```python
TTS_CACHE_MAX_AGE_DAYS = int(os.getenv('TTS_CACHE_MAX_AGE_DAYS', '90'))
# 在 app startup 或 cron 中清理过期文件
```

### 4.9 CI/CD 加固

- 添加 `npm run lint` 步骤
- 添加 `npm run type-check`（已有 `vue-tsc -b`，确认在 pipeline 中）
- `systemctl reload` 失败后的重启 + 健康检查链

---

## 5. P3 — 低优先级 / 技术债

### 5.1 可访问性 (a11y)

- `ProgressNotification.vue` 缺少 `role="alert"` / `aria-live="polite"`
- 大部分交互组件无 `aria-` 属性
- 建议逐步为 `shared/components/` 下的基础组件补全 ARIA

### 5.2 `.value!` 非空断言

共 7 处（`wordEditor.ts` × 6，`useSettings.ts` × 1），改为显式守卫：

```typescript
// 当前
onWordUpdatedCallbacks.value.forEach(cb => cb({ ...currentWord.value! }))

// 改进
if (!currentWord.value) return
onWordUpdatedCallbacks.value.forEach(cb => cb({ ...currentWord.value }))
```

### 5.3 大型 Map 用 shallowRef

```typescript
// useWritingData.ts
// 当前：深度响应，每次 mutation 触发全组件重渲染
const allSessions = ref<Map<number, WritingSession[]>>(new Map())

// 改进
const allSessions = shallowRef<Map<number, WritingSession[]>>(new Map())
// mutation 后手动 triggerRef(allSessions)
```

### 5.4 颜色插值缓存

`statsColors.ts` 的 `calcEfColor()` 每次渲染重新计算，添加 Map 缓存：

```typescript
const cache = new Map<string, string>()
export function calcEfColor(ef: number): string {
  const key = ef.toFixed(2)
  return cache.get(key) ?? (cache.set(key, compute(ef)), cache.get(key)!)
}
```

### 5.5 后端通用异常捕获收窄

```python
# generation_service.py shutdown
except Exception:  # 过宽
# 改为
except (TimeoutError, CancelledError):
```

### 5.6 未使用代码清理

- `shared/utils/errorHandler.ts` 中 `handleApiError()` 未被调用 — 删除
- `types/writing.ts` 未在 `types/index.ts` 中导出 — 整合或重新导出

### 5.7 日期工具 DST 安全

```typescript
// 当前 addDays() 可能受 DST 影响
// 改进：显式 UTC
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}
```

### 5.8 SynonymGenerator batch size 动态化

```python
# 当前：硬编码 100
batch_size = 100

# 改进：根据数据量动态调整
batch_size = max(50, min(200, len(words) // n_workers))
```

### 5.9 TopicGenerator lru_cache 内存监控

`@lru_cache(50000)` 在 100k+ 词时可能占用大量内存。考虑改为有 TTL 的缓存或在生成完成后清理。

### 5.10 v-html XSS 防护确认

`AiChatPanel.vue` 使用 `v-html="formatMessage(msg.content)"`，确认 `formatMessage` 内部调用了 DOMPurify。如未调用，需添加：

```typescript
import DOMPurify from 'dompurify'
function formatMessage(content: string): string {
  return DOMPurify.sanitize(marked.parse(content))
}
```

---

## 6. 执行路线图

### 阶段一：基础加固（1-2 周）

- [ ] P0.2 — AiChatPanel key 修复（10 min）
- [ ] P0.4 — CORS 生产环境收紧（10 min）
- [ ] P1.3 — Router 类型安全（30 min）
- [ ] P1.6 — ESLint + Prettier 集成（2h）
- [ ] P1.1 — 全局错误处理 composable + ErrorBoundary（4h）
- [ ] P1.2 — watcher 清理 5 个文件（2h）
- [ ] P2.6 — RelationsApi 错误统一（30 min）

### 阶段二：组件拆分（2-3 周）

- [ ] P0.1 — ReviewRightPanel 拆分（1d）
- [ ] P0.1 — SettingsPage composable 提取（1d）
- [ ] P0.1 — WordIndex 拆分（0.5d）
- [ ] P0.1 — ReviewCard / SpellingCard 拆分（1d）
- [ ] P0.1 — VoicePractice 拆分（0.5d）
- [ ] P0.3 — wordEditor.ts 拆分（0.5d）

### 阶段三：性能优化（1 周）

- [ ] P1.4 — echarts 按需引入（2h）
- [ ] P1.5 — RootGenerator O(n²) 优化（2h）
- [ ] P2.1 — 魔数提取为配置（2h）
- [ ] P2.7 — 数据库索引（30 min）
- [ ] P2.8 — TTS 缓存淘汰（1h）
- [ ] P5.3 — shallowRef 优化（1h）

### 阶段四：代码质量提升（持续）

- [ ] P2.2 — 跨 feature 重复逻辑提取（1d）
- [ ] P2.3 — Speech Recognition 策略模式（0.5d）
- [ ] P2.4 — AI 服务配置集中化（2h）
- [ ] P2.5 — stats.ts 类型收窄（1h）
- [ ] P2.9 — CI/CD 加固（1h）
- [ ] P3.x — 其余低优先级逐步清理

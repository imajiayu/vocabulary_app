# 性能优化文档

> 基于 v1.4.0 代码库的全面性能分析，覆盖构建打包、运行时、网络层、后端服务四大维度。

---

## 目录

1. [当前性能概览](#1-当前性能概览)
2. [构建与打包](#2-构建与打包)
3. [前端运行时](#3-前端运行时)
4. [网络与缓存](#4-网络与缓存)
5. [后端服务](#5-后端服务)
6. [部署与基础设施](#6-部署与基础设施)
7. [优化路线图](#7-优化路线图)

---

## 1. 当前性能概览

### 1.1 构建产物

| 指标 | 值 | 评价 |
|------|-----|------|
| JS 总量 (gzip) | ~379 KB | 中等偏大 |
| CSS 总量 (gzip) | ~100 KB | 合理 |
| 全量加载 (gzip) | ~479 KB | 可优化 |
| JS Chunks 数 | 23 个 | 分割合理 |
| 最大 Chunk | echarts 196 KB (gzip) | 主要瓶颈 |
| 构建时间 | ~3.5s | 快速 |

### 1.2 关键用户路径预估耗时

| 场景 | 预估耗时 | 瓶颈 |
|------|----------|------|
| 首屏渲染 (登录后) | 200-400 ms | Supabase 认证 + 首批数据 |
| 复习页单词切换 | 5-10 ms | 纯前端计算，流畅 |
| 统计页加载 | 1-2 s | 10+ 并行查询 + ECharts 初始化 |
| 词表排序 (3000 词) | 100-150 ms | 前端 O(n log n) |
| 音频播放 (缓存命中) | < 50 ms | 内存缓存直接播放 |
| 音频播放 (首次加载) | 200-500 ms | 网络请求 + 解码 |

### 1.3 已有的优化措施

以下是代码库中**已做得很好**的部分：

- **路由全懒加载**：8 个页面全部使用 `() => import()` 动态加载
- **Vendor 分离**：vue-vendor (107 KB gzip) 和 echarts (196 KB gzip) 独立 chunk
- **图标树摇**：lucide-vue-next 从 17 MB node_modules 树摇到 8.67 KB
- **增量列表渲染**：WordGrid 使用 IntersectionObserver 哨兵模式，每批 100 条
- **复习队列分页**：BATCH_SIZE=20，阈值 5 触发后台加载
- **音频预加载**：提前预加载后续 5 个单词音频，MAX_CACHE=30
- **统计缓存**：5 分钟 TTL 内存缓存，手动失效
- **API 批量操作**：批量导入/更新/删除用单次请求
- **进度防抖持久化**：review index 防抖写库，避免 I/O 风暴
- **SM-2 纯前端计算**：不依赖后端，亚毫秒级响应
- **TTS 文件缓存**：nginx 静态服务，30 天过期，避免重复 API 调用
- **后端增量保存**：flush_threshold=200 缓冲，减少数据库往返
- **优雅关闭**：atexit + 10 秒 timeout 等待生成线程

---

## 2. 构建与打包

### 2.1 ECharts 体积过大 — 按需导入

**现状**：echarts chunk 584 KB (raw) / 196 KB (gzip)，是最大的单一依赖。

**问题**：当前 `manualChunks` 将整个 echarts 包打入一个 chunk，但只有 StatisticsPage 使用图表。

**方案**：改用 echarts 按需导入，只打包实际用到的图表类型和组件。

```typescript
// 替代 import * as echarts from 'echarts'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, HeatmapChart, PieChart, ScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, ... } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([BarChart, LineChart, HeatmapChart, PieChart, ScatterChart,
             GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])
```

**预期收益**：echarts gzip 从 ~196 KB 降到 ~80-100 KB（取决于实际使用的图表类型）。

### 2.2 构建目标不一致

**现状**：
- `vite.config.ts` → `target: 'es2015'`（兼容旧浏览器）
- `tsconfig.json` → `target: 'ES2020'`

**问题**：ES2015 目标会生成更多 polyfill 代码。IELTS 学习应用的用户群体基本都使用现代浏览器。

**方案**：统一为 `es2020`，减少不必要的降级代码。

```typescript
// vite.config.ts
build: {
  target: 'es2020',  // 从 es2015 升级
}
```

**预期收益**：JS 产物减少 5-10%（移除 async/await、optional chaining 等 polyfill）。

### 2.3 CSS 未压缩优化

**现状**：Vite 默认使用 esbuild 压缩 CSS，但未启用 CSS 相关的优化插件。

**方案**：可考虑添加 `vite-plugin-css-injected-by-js` 用于关键 CSS 内联，或使用 `lightningcss` 替代默认 CSS 压缩。

**优先级**：低。当前 CSS gzip 后仅 ~100 KB，收益有限。

---

## 3. 前端运行时

### 3.1 统计页 ECharts 延迟初始化

**现状**：StatisticsPage 同时初始化 10+ 个 ECharts 图表实例，每个实例需要 DOM 遍历和全局事件注册。

**问题**：首屏只能看到 2-3 个图表，其余在视口外的图表也被初始化，浪费 CPU。

**方案**：使用 IntersectionObserver 延迟初始化 off-screen 图表。

```typescript
// ChartCard.vue 伪代码
const chartRef = ref<HTMLElement>()
const isVisible = ref(false)

onMounted(() => {
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      isVisible.value = true
      observer.disconnect()  // 只初始化一次
    }
  }, { rootMargin: '100px' })  // 提前 100px 开始加载
  observer.observe(chartRef.value!)
})
```

**预期收益**：统计页首次渲染时间减少 40-60%（仅初始化可见图表）。

### 3.2 统计页并行查询优先级化

**现状**：进入统计页时并行发起 10+ 个 Supabase 查询，所有查询同等优先级。

**问题**：
- 浏览器对同一域名默认 6 个并发连接（HTTP/1.1），超过的请求排队等待
- 用户首先看到的概览数据和不可见的详细分布数据同时加载

**方案**：分层加载。

```
第一层（立即加载）：概览统计、每日活动
第二层（延迟 200ms）：分布图表数据
第三层（滚动到可见时）：热力图、详细分析
```

**预期收益**：首屏统计数据展示时间减少 30-50%。

### 3.3 统计缓存按 source 多份保留

**现状**：`StatsApi` 的 5 分钟缓存在切换 source 时被清除，重新全量加载。

**问题**：用户在不同 source 间来回切换时，每次都需要重新加载所有数据。

**方案**：保留多个 source 的缓存（LRU 上限 5 个）。

```typescript
// 当前：单 source 缓存
const statsCache = new Map<string, { data: StatsData; ts: number }>()

// 优化后：保留最近 5 个 source 的缓存
const MAX_CACHED_SOURCES = 5
// 超出时淘汰最久未访问的
```

**预期收益**：source 切换秒开（缓存命中时）。

### 3.4 音频预加载防抖

**现状**：`useAudioPreloader` 中每次 `currentIndex` 变化都触发预加载 watcher，仅有 100ms setTimeout。

**问题**：用户快速翻词时，短时间内触发多次预加载，产生不必要的网络请求。

**方案**：将 100ms setTimeout 替换为真正的 debounce（200-300ms）。

```typescript
// 当前
watch([wordQueue, currentIndex, audioType], () => {
  setTimeout(() => preloadUpcomingAudio(...), 100)
})

// 优化后：使用 debounce
import { watchDebounced } from '@vueuse/core'  // 或手写
watchDebounced([wordQueue, currentIndex, audioType], () => {
  preloadUpcomingAudio(...)
}, { debounce: 250 })
```

**预期收益**：快速翻词时减少 60-70% 的无效预加载请求。

### 3.5 Review Store Watcher 优化

**现状**：`useAudioPreloader` watch 监听整个 `wordQueue` 数组引用。

**问题**：Vue 的 reactive 数组在 push/splice 时会触发 watcher，即使内容变化与预加载无关。

**方案**：改为 shallow watch + 手工判断。

```typescript
watch(
  () => [wordQueue.value.length, currentIndex.value],
  ([newLen, newIdx], [oldLen, oldIdx]) => {
    if (newLen !== oldLen || newIdx !== oldIdx) {
      // 仅在长度或索引变化时预加载
    }
  }
)
```

**预期收益**：减少不必要的 watcher 触发，降低 GC 压力。

### 3.6 WordGrid 大数据集排序

**现状**：词表排序在主线程执行 `Array.sort()`，3000+ 词时约 100-150ms。

**问题**：排序期间 UI 无响应，用户感知到短暂卡顿。

**方案**（仅在词表 > 2000 时启用）：
- 短期：排序前插入 `requestAnimationFrame` + loading 指示
- 长期：Web Worker 执行排序

**优先级**：中。当前大部分用户词表 < 2000，影响有限。

---

## 4. 网络与缓存

### 4.1 缺少关键资源 preconnect

**现状**：`index.html` 仅对 Google Fonts 设置了 preconnect。

**问题**：首次访问时，Supabase API、后端 API、音频源等域名的 DNS 解析 + TCP 握手 + TLS 需要额外 100-200ms。

**方案**：

```html
<!-- index.html <head> 中添加 -->
<link rel="preconnect" href="https://oilcmmlkkmikmftqjlih.supabase.co" crossorigin>
<link rel="dns-prefetch" href="https://dict.youdao.com">
<link rel="dns-prefetch" href="https://mieltsm.top">
```

**预期收益**：首次 API 调用减少 100-200ms（DNS + TCP + TLS 提前建立）。

### 4.2 Google Fonts 加载优化

**现状**：4 个字体家族在 `<head>` 中同步加载，阻塞首屏渲染。

**问题**：
- 加载 4 个字体 CSS 文件串行执行
- Noto Serif SC（中文字体）体积较大，但仅在少数场景使用

**方案**：

```html
<!-- 关键字体 preload -->
<link rel="preload" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
      as="style" onload="this.onload=null;this.rel='stylesheet'">

<!-- 非关键字体延迟加载 -->
<link rel="stylesheet" href="...Noto+Serif+SC..." media="print" onload="this.media='all'">
```

**预期收益**：FCP (First Contentful Paint) 减少 200-300ms。

### 4.3 缺少 Service Worker / PWA

**现状**：应用无 Service Worker，无离线支持，无安装提示。

**问题**：
- 每次访问都需要全量请求静态资源（依赖浏览器 HTTP 缓存）
- 无法离线复习已加载的单词
- 移动端无法"添加到主屏幕"

**方案**：使用 `vite-plugin-pwa` 添加 Service Worker。

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

plugins: [
  vue(),
  VitePWA({
    registerType: 'autoUpdate',
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/oilcmmlkkmikmftqjlih\.supabase\.co/,
          handler: 'NetworkFirst',
          options: { cacheName: 'supabase-api', expiration: { maxEntries: 100 } }
        },
        {
          urlPattern: /\/tts-cache\//,
          handler: 'CacheFirst',
          options: { cacheName: 'tts-audio', expiration: { maxAgeSeconds: 30 * 24 * 3600 } }
        }
      ]
    }
  })
]
```

**预期收益**：
- 静态资源秒开（Service Worker 缓存）
- TTS 音频离线可用
- 移动端可安装

**优先级**：中高。对移动端用户体验提升显著。

### 4.4 Supabase 认证 Token 刷新

**现状**：`autoRefreshToken: true`，Supabase 客户端自动刷新 JWT。

**潜在问题**：Token 刷新发生在请求中间时，可能导致一次 401 错误 + 重试。

**建议**：无需修改，Supabase SDK 内部已处理。仅记录为观察项。

---

## 5. 后端服务

### 5.1 无线程池限制

**现状**：`generation_service.py` 每个生成任务创建新线程，无上限。

**问题**：理论上最大线程数 = 用户数 × 5 种关系类型，突发请求可导致线程爆炸。

**方案**：

```python
# generation_service.py
from concurrent.futures import ThreadPoolExecutor

_executor = ThreadPoolExecutor(max_workers=10, thread_name_prefix="gen")

def start_generation(self, ...):
    # 替换 threading.Thread 为 executor.submit
    future = _executor.submit(self._run_generation, ...)
```

**预期收益**：防止极端情况下的内存溢出，保障系统稳定性。

### 5.2 数据库连接池偏小

**现状**：`pool_size=5, max_overflow=10`（总计 15 个连接），`pool_timeout=30`。

**问题**：多用户并发生成时，生成线程的 `_save_batch()` 竞争数据库连接，可能触发 30 秒超时。

**方案**：

```python
# extensions.py
engine = create_engine(
    DATABASE_URL,
    pool_size=10,       # 5 → 10
    max_overflow=20,    # 10 → 20
    pool_timeout=30,
    pool_recycle=1800,
)
```

**预期收益**：消除多用户并发时的连接等待超时。

### 5.3 SSE 孤儿连接

**现状**：SSE 连接断开后，服务端 while True 循环继续运行直到 5 分钟超时。

**问题**：每个孤儿连接占用一个 gunicorn worker 线程。当前仅 2 个 worker，一个孤儿连接就消耗 50% 容量。

**方案**：添加心跳检测 + 客户端断开感知。

```python
# api/generation.py
def generate():
    yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
    # Flask 的 stream_with_context 在客户端断开时抛出 GeneratorExit
```

**预期收益**：及时释放断开的 SSE 连接，避免 worker 被占满。

### 5.4 TTS 文件 I/O 同步阻塞

**现状**：TTS 缓存保存使用同步文件操作（mkstemp → fdopen → chmod → rename），阻塞整个 Flask worker。

**问题**：高频 TTS 请求时，文件 I/O 成为瓶颈。

**评估**：实际场景中 TTS 缓存写入频率较低（每个单词只写一次），**优先级低**。

### 5.5 Gunicorn Worker 数量

**现状**：2 个 sync worker。

**问题**：
- SSE 长连接独占 worker，2 个 worker 意味着 1 个 SSE + 1 个普通请求就满载
- 无法处理并发生成任务

**方案**：

```ini
# 推荐配置
workers = 4
worker_class = gthread
threads = 4
# 总并发：4 workers × 4 threads = 16 并发
```

**预期收益**：并发处理能力从 2 提升到 16。

---

## 6. 部署与基础设施

### 6.1 部署期间服务中断

**现状**：CI/CD 流程串行执行 pip install → npm build → systemctl restart → nginx reload，期间服务不可用。

**问题**：部署耗时约 5-8 分钟，用户直接看到错误页面。

**方案（短期）**：调整部署顺序，缩短停机窗口。

```yaml
# 先构建，最后才重启（停机窗口仅几秒）
- npm ci && npm run build    # 构建（不影响线上）
- pip install -r requirements.txt  # 安装依赖
- systemctl restart vocabulary-backend  # 重启后端（< 2s）
- nginx -s reload            # 重载 nginx（< 1s）
```

**方案（长期）**：蓝绿部署。

**预期收益**：停机时间从分钟级降到秒级。

### 6.2 nginx 缓存头优化

**现状**：
- TTS 音频：`expires 30d`（已配置）
- 静态资源（JS/CSS）：依赖 Vite 的 content hash 文件名

**建议**：为带 hash 的静态资源添加长期缓存。

```nginx
# /etc/nginx/sites-enabled/vocabulary-app
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

**预期收益**：回访用户零网络请求加载静态资源。

### 6.3 nginx gzip 配置

**建议确认**：检查 nginx 是否启用了以下压缩配置。

```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml;
gzip_min_length 1024;
gzip_vary on;
```

---

## 7. 优化路线图

### P0 — 高收益、低成本（1-2 天）

| 编号 | 优化项 | 位置 | 预期收益 |
|------|--------|------|----------|
| P0-1 | 添加 Supabase preconnect | `frontend/index.html` | 首次 API 减少 100-200ms |
| P0-2 | 统一构建目标为 es2020 | `frontend/vite.config.ts` | JS 产物减少 5-10% |
| P0-3 | 音频预加载 debounce | `useAudioPreloader.ts` | 减少 60% 无效请求 |
| P0-4 | Gunicorn 升级为 gthread | systemd 配置 | 并发能力 2 → 16 |
| P0-5 | nginx 静态资源长缓存 | nginx 配置 | 回访零请求 |

### P1 — 中等收益（3-5 天）

| 编号 | 优化项 | 位置 | 预期收益 |
|------|--------|------|----------|
| P1-1 | ECharts 按需导入 | 统计相关组件 | echarts gzip 减少 ~50% |
| P1-2 | 统计页图表延迟初始化 | ChartCard 组件 | 统计页首渲染减少 40-60% |
| P1-3 | 统计页查询分层加载 | `stats.ts` | 首屏数据提前 30-50% |
| P1-4 | 统计缓存多 source 保留 | `stats.ts` | source 切换秒开 |
| P1-5 | 后端线程池限制 | `generation_service.py` | 防止线程爆炸 |
| P1-6 | 数据库连接池扩容 | `extensions.py` | 消除连接超时 |

### P2 — 长期改进（1-2 周）

| 编号 | 优化项 | 位置 | 预期收益 |
|------|--------|------|----------|
| P2-1 | PWA / Service Worker | `vite.config.ts` | 离线可用 + 秒开 |
| P2-2 | Google Fonts 异步加载 | `index.html` | FCP 减少 200-300ms |
| P2-3 | 部署零停机 | `deploy.yml` | 用户无感知部署 |
| P2-4 | WordGrid Web Worker 排序 | WordGrid 组件 | 大词表排序不卡顿 |
| P2-5 | SSE 心跳 + 断连检测 | `api/generation.py` | 释放 worker 资源 |

### 优化效果预估

实施 P0 + P1 后：

| 指标 | 当前 | 优化后 | 改善 |
|------|------|--------|------|
| 首屏加载 (gzip) | ~479 KB | ~350 KB | -27% |
| 统计页加载 | 1-2 s | 0.5-1 s | -50% |
| 回访静态资源 | 浏览器默认缓存 | immutable 长缓存 | 零请求 |
| 后端并发 | 2 | 16 | 8x |
| echarts chunk | 196 KB gzip | ~90 KB gzip | -54% |

---

## 附录：当前构建产物明细

```
构建输出 (gzip):
├── vue-vendor    107 KB    # Vue + Router + Pinia
├── echarts       196 KB    # 图表库（最大 chunk）
├── index          52 KB    # 主 bundle（Supabase + 通用）
├── markdown       21 KB    # marked 库
├── HomePage       19 KB    # 首页
├── ReviewPage     21 KB    # 复习页
├── WritingPage    15 KB    # 写作页
├── SettingsPage   12 KB    # 设置页
├── SpeakingPage   12 KB    # 口语页
├── VocabMgmt      14 KB    # 词汇管理
├── StatisticsPage  8 KB    # 统计页
├── WordEditor      9 KB    # 编辑器弹窗
├── review          8 KB    # 复习 store
├── Icons           3 KB    # lucide 图标
├── LoginPage       2 KB    # 登录页
└── 其他小 chunk   < 5 KB
```

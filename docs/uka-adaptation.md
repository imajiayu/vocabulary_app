# 乌克兰语 (uka) 单词模块适配清单

> 范围：仅单词模块（复习、拼写、导入、显示）。不含口语模块、关系生成。

---

## 0. 架构基础：source → 语言配置映射 ✅

**已完成**: `customSources` 已从 `string[]` 改为 `Record<string, string>`（source名 → 语言代码），每个 source 在创建时选择语言（'en' | 'uk'），创建后不可变更。涉及 types、settings-supabase、config、useSourceSelection、SettingsPage、delete-source Edge Function。老用户数据自动迁移。

**已完成**: `frontend/src/shared/config/sourceLanguage.ts` — 集中定义每个语言的行为配置（输入过滤、键盘布局、音频源、功能开关等）。所有语言感知的代码通过 `getSourceLangConfig(source, customSources)` 获取配置。

**配置文件**: `frontend/src/shared/config/sourceLanguage.ts`

```typescript
export type SourceLang = 'en' | 'uk'

export interface SourceLanguageConfig {
  lang: SourceLang
  inputPattern: RegExp                 // 拼写允许的字符
  sanitizePattern: RegExp              // watcher 净化正则
  keyboardLayout: string[][]           // 虚拟键盘行
  audioProvider: 'youdao' | 'google-tts'
  dictionaryProvider: 'youdao' | 'wiktionary'
  supportsRelations: boolean
  supportsAccentSwitch: boolean        // 是否显示 us/uk 口音切换
  promptLang: string                   // AI 助手 prompt 中的语言描述
}

const EN_CONFIG: SourceLanguageConfig = {
  lang: 'en',
  inputPattern: /^[a-zA-Z \-]$/,
  sanitizePattern: /[^a-zA-Z \-]/g,
  keyboardLayout: [
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L'],
    ['Z','X','C','V','B','N','M'],
  ],
  audioProvider: 'youdao',
  dictionaryProvider: 'youdao',
  supportsRelations: true,
  supportsAccentSwitch: true,
  promptLang: 'IELTS 英语',
}

const UK_CONFIG: SourceLanguageConfig = {
  lang: 'uk',
  inputPattern: /^[а-яА-ЯіІїЇєЄґҐʼ' \-]$/,
  sanitizePattern: /[^а-яА-ЯіІїЇєЄґҐʼ' \-]/g,
  keyboardLayout: [
    ['Й','Ц','У','К','Е','Н','Г','Ш','Щ','З','Х','Ї'],
    ['Ф','І','В','А','П','Р','О','Л','Д','Ж','Є'],
    ['Я','Ч','С','М','И','Т','Ь','Б','Ю','Ґ'],
  ],
  audioProvider: 'google-tts',
  dictionaryProvider: 'wiktionary',
  supportsRelations: false,
  supportsAccentSwitch: false,
  promptLang: '乌克兰语',
}

const SOURCE_LANGUAGE_MAP: Record<string, SourceLanguageConfig> = {
  uka: UK_CONFIG,
}

export function getSourceLanguageConfig(source: string): SourceLanguageConfig {
  return SOURCE_LANGUAGE_MAP[source] ?? EN_CONFIG
}
```

**使用方式**: 所有后续改动点都通过 `getSourceLanguageConfig(currentSource)` 获取配置。

---

## 1. 拼写输入：西里尔字母被封锁

**现状**：桌面端和移动端都硬编码只接受拉丁字母，西里尔字符被静默丢弃。

### 1.1 桌面端键盘过滤

**文件**: `frontend/src/features/vocabulary/spelling/SpellingCard.vue:448-451`

```typescript
// 当前：只允许英文字母
if (event.key.length === 1 && !/^[a-zA-Z \-]$/.test(event.key)) {
  event.preventDefault()
  return
}
```

**改法**: 根据当前 source 决定允许的字符集。uka 源允许西里尔字母 + 空格 + 连字符 + 撇号（乌克兰语中 `'` 是合法字母）。

### 1.2 输入 watcher 净化

**文件**: `frontend/src/features/vocabulary/spelling/SpellingCard.vue:592-597`

```typescript
// 当前：过滤非拉丁字符
watch(userInput, (val) => {
  const filtered = val.replace(/[^a-zA-Z \-]/g, '')
  if (filtered !== val) {
    userInput.value = filtered
  }
})
```

**改法**: 同 1.1，根据 source 使用对应的字符正则。

### 1.3 移动端虚拟键盘布局

**文件**: `frontend/src/features/vocabulary/spelling/SpellingKeyboard.vue:160-162`

```typescript
const ROW_1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'] as const
const ROW_2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'] as const
const ROW_3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'] as const
```

**改法**: 根据 source 动态选择键盘布局。乌克兰语标准布局 (ЙЦУКЕН)：

```
Row 1: Й Ц У К Е Н Г Ш Щ З Х Ї
Row 2: Ф І В А П Р О Л Д Ж Є
Row 3: Я Ч С М И Т Ь Б Ю Ґ
```

---

## 2. 发音音频：有道词典不支持乌克兰语

**现状**：音频 URL 硬编码为有道词典，类型只有 us/uk (美音/英音)。

### 2.1 音频播放源

**文件**: `frontend/src/shared/utils/playWordAudio.ts`

```typescript
// 当前：有道词典 API
`https://dict.youdao.com/dictvoice?audio=${word}&type=${type}`
```

**改法**: 根据 source 选择音频源。uka 源可使用 Google Translate TTS 或其他支持乌克兰语的服务。

### 2.2 AudioSettings 类型

**文件**: `frontend/src/shared/types/index.ts:179-183`

```typescript
export interface AudioSettings {
  accent: 'us' | 'uk'  // 仅英语口音
  autoPlayOnWordChange: boolean
  autoPlayAfterAnswer: boolean
}
```

**改法**: uka 源不需要 us/uk 口音选择，可以简化为单一发音。需要让音频设置对 uka 源合理（隐藏口音选择，或显示为"乌克兰语发音"）。

### 2.3 设置页面口音 UI

**文件**: `frontend/src/pages/SettingsPage.vue:315-333`

**改法**: 当 uka 源时隐藏或调整口音切换 UI。

### 2.4 音频预加载

**文件**: `frontend/src/features/vocabulary/stores/review/useAudioPreloader.ts`

**改法**: 预加载逻辑本身通用，但调用 `preloadWordAudio(word, accent)` 时需要传入正确的音频源参数。

---

## 3. 释义爬取：有道词典无乌克兰语

**现状**：Edge Function 从有道词典爬取英文释义。

### 3.1 Edge Function

**文件**: `supabase/functions/fetch-definition/index.ts`

```typescript
// 当前：爬取有道英文词典
const url = `https://dict.youdao.com/w/eng/${encodeURIComponent(word)}/`
```

**改法**: uka 源需要使用乌克兰语词典 API（如 Wiktionary API、或其他乌克兰语→中文/英文词典）。

### 3.2 释义数据结构

**文件**: `frontend/src/shared/types/index.ts:35-48`

```typescript
export interface DefinitionObject {
  phonetic?: { us?: string; uk?: string }  // 仅英语音标
  definitions?: string[]
  examples?: { en: string; zh: string }[]  // 仅英中双语
}
```

**改法**: uka 源的音标格式不同（无 us/uk 区分），例句可能是 uk(乌克兰语)/zh 或 uk/en 双语。需要决定数据结构是否扩展或复用现有字段。

---

## 4. 释义加粗：`\b` 不识别西里尔边界

**现状**：例句中目标单词的加粗用正则 `\b` 匹配单词边界。

**文件**: `frontend/src/shared/utils/definition.ts:11-15`

```typescript
const pattern = new RegExp(
  `(?<!<strong>)\\b(${escaped})\\b(?!<\\/strong>)`, 'gi'
)
```

**问题**: JS 正则的 `\b` 只识别 `[a-zA-Z0-9_]` 边界。对于西里尔字母 `\b` 不会在词与标点之间匹配，导致加粗失败。

**改法**: 用 Unicode 感知的边界替代 `\b`，例如 `(?<=^|[\s,.!?;:])` 和 `(?=$|[\s,.!?;:])` 或使用 Unicode property escapes `(?<=^|\P{L})` / `(?=$|\P{L})`。

---

## 5. Unicode 规范化缺失

**现状**：导入和比较时无 `.normalize()` 调用。

**影响位置**：
- `frontend/src/shared/api/words.ts:432` — 单词创建 `trim().toLowerCase()`
- `frontend/src/shared/api/words.ts:481` — 批量导入
- `frontend/src/features/vocabulary/spelling/SpellingCard.vue:343` — 拼写正确性判断

**问题**: 乌克兰语中相同字符可能有不同 Unicode 编码（NFC vs NFD）。例如 `ґ` 的预组合形式和分解形式视觉相同但字节不同，会导致：
- 数据库唯一约束误判（同一词插入两次）
- 拼写比较失败

**改法**: 在导入和比较入口处统一添加 `.normalize('NFC')`。

---

## 6. 关系生成：uka 源需跳过

**现状**：关系生成 UI 在设置页面，对所有源统一显示。

**文件**: `frontend/src/pages/SettingsPage.vue` — 关系生成控制区域

**改法**: 当选中 uka 源时，隐藏关系生成的 UI 控件（或显示"该源不支持关系生成"）。后端也应在 uka 源时拒绝生成请求。

---

## 7. AI 词汇助手：prompt 和快捷按钮硬编码英语

**现状**：系统提示词和快捷建议按钮全部面向英语 IELTS 词汇。

### 7.1 系统提示词

**文件**: `frontend/src/shared/api/vocabulary-assistance.ts:22-44`

```typescript
const VOCABULARY_ASSISTANT_PROMPT = `你是 IELTS 词汇学习助手，帮助用户理解和记忆词汇。
...
- 问"怎么用/用法/搭配"→ 给3个典型搭配 + 1个例句
- 问"怎么记/记忆"→ 给1个最有效的记忆法（词根拆解/联想/谐音）
...`
```

**问题**：
- "IELTS 词汇学习助手" 对乌克兰语无意义
- "词根拆解" 记忆法针对英语词根体系
- 整个 prompt 假设目标语言是英语

**改法**: 根据 source 的语言配置生成不同的 system prompt。uka 源应使用乌克兰语学习助手 prompt（如"帮助理解乌克兰语词汇的用法和语法特点"）。

### 7.2 快捷建议按钮

**文件**: `frontend/src/features/vocabulary/review/ReviewRightPanel.vue:788-793`

```typescript
const suggestions = [
  { icon: 'list-tree', label: '常用搭配', text: '这个词有哪些常用搭配？' },
  { icon: 'text-cursor', label: '造句示例', text: '如何用这个词造句？' },
  { icon: 'sparkle', label: '记忆方法', text: '有什么好的记忆方法？' },
  { icon: 'arrows-right-left', label: '近义反义', text: '它的同义词和反义词是什么？' }
]
```

**问题**: 按钮文案对乌克兰语仍然适用（搭配、造句、记忆、近反义都是通用概念），但触发的 AI prompt 需要适配语言上下文。

**改法**: 按钮文案可保持不变（都是中文 UI），但确保 `sendMessage` 传给 AI 的 system prompt 已按 source 切换。

### 7.3 AI 缓存

**文件**: `frontend/src/shared/api/ai-cache.ts`

**问题**: 缓存 key 是 `(word, prompt_type)`，不含 source/language 信息。如果英语和乌克兰语有同形词（如拉丁转写），缓存会冲突。

**改法**: 由于乌克兰语使用西里尔字母，与英语单词不会同形，实际冲突概率极低。暂不改动，但如果后续加入其他拉丁字母语言（如法语、德语），需要在缓存 key 中加入 source。

---

## 修改优先级

| 序号 | 项目 | 优先级 | 状态 |
|------|------|--------|------|
| 0 | 语言配置映射 (0) | P0 | ✅ `sourceLanguage.ts` 集中配置 |
| 1 | 拼写输入过滤 (1.1, 1.2) | P0 | ✅ `inputPattern` / `sanitizePattern` |
| 2 | 虚拟键盘布局 (1.3) | P0 | ✅ `rows` + `specialChars` props |
| 3 | 发音音频源 (2.1) | P0 | ✅ Google Cloud TTS (`ttsLang`) |
| 4 | 释义爬取 (3.1) | P0 | 未开始 |
| 5 | AI 词汇助手 prompt (7.1) | P1 | 未开始 |
| 6 | AudioSettings 类型适配 (2.2, 2.3) | P1 | ✅ 设置页注明"仅英语生效" |
| 7 | 释义数据结构 (3.2) | P1 | 未开始 |
| 8 | 释义加粗正则 (4) | P1 | 未开始 |
| 9 | Unicode 规范化 (5) | P1 | 未开始 |
| 10 | 关系生成 UI 屏蔽 (6) | P2 | ✅ `v-if="supportsRelations"` |

# 乌克兰语语法课程 — 生成指令

本文档是乌克兰语语法课程的生成指令，面向中文母语者。课程按周推进，每周包含词汇预载、语法讲解和复习，配合 Vocabulary App 进行词汇管理。

## 项目概述

基于文件的乌克兰语学习系统。Claude Code 根据学习进度，为用户生成每日课程 **JSON 数据文件**，由 Vue 前端 `LessonRenderer` 组件渲染。

**本项目只负责语法课程**，单词学习通过 vocabulary_app（mieltsm.top）管理。两个项目联动：课程中的实词必须来自用户已添加到 vocabulary_app 的词汇。

## 用户画像

- 在多邻国学习乌克兰语 100+ 天
- 已掌握：全部字母发音、基础问候语、数字与时间、基础动词、生活类名词（食物/动物/颜色）
- 语法基础：零（不了解词性、格变化等）
- 母语：中文

## Vocabulary App 联动

课程页面复用主站的 Supabase 登录会话（由 Vue 的 `useAuth` composable 管理），通过 `VocabPreloadSection.vue` 把单词写入 `words` 表。默认 source 为 `UKA`，用户可在页面下拉框中切换。

课程生成时，通过 Supabase REST API 获取用户已知词汇（需要 service key，见 `backend/.env` 中的 `SUPABASE_SERVICE_KEY`）。

## 课程生成工作流

每次用户请求生成课程时，按以下步骤执行：

1. **读取进度**：先读取 `courses/ukrainian/progress.md`，了解当前所在周次、天数、薄弱点
2. **获取已知词汇**：通过 Supabase REST API 获取用户已添加的乌克兰语单词（user_id 和 source 从课程上下文确定）
3. **参考大纲**：对照 `courses/ukrainian/curriculum.md` 确定今天的教学内容
4. **生成课程**：
   - **词汇预载日（第1天）**：生成前，先读取所有往期词汇预载 JSON（`frontend/public/uk/w*d1.json`）了解已教过哪些词汇，并通过 API 查询背单词 App 中的已知词汇。确保新词汇不与已教内容重复。列出本周所有新单词（含中文释义）到 `sections[0]` 的 `vocab-preload` 类型。参考 `courses/ukrainian/vocabulary/weekly-vocab.md`
   - **语法课程日（第2-6天）**：生成前，先读取本周的词汇预载 JSON（`frontend/public/uk/wXd1.json`）确认本周允许使用的词汇范围。在 `frontend/public/uk/` 目录下创建以周次天数命名的 `.json` 文件（如 `w3d5.json`）。**例句和练习中只使用已知词汇列表中的词**（语法功能词不受约束，详见下方"词汇约束规则"）。生成后对照 `courses/ukrainian/curriculum.md` 检查每道练习题是否超纲
   - **复习日（第7天）**：巩固本周内容，不引入新语法
5. **Schema 校验（强制）**：写完 JSON 立即执行 `python3 scripts/validate_course_schema.py`，退出码必须为 0。有违规项按"规范 JSON Schema"一节修复；若是历史格式批量违规，用 `python3 scripts/migrate_course_schema.py --write` 自动归一化后再校验。校验不过禁止提交
6. **更新进度**：课程生成后更新 `courses/ukrainian/progress.md`（推进天数、记录完成的课程）
7. **更新课时索引**：在 `frontend/src/features/courses/data/lessons.ts` 的 `ukrainianLessons` 数组中新增或更新对应条目
8. **部署**：课程生成后 git commit && git push 即可自动部署（GitHub Actions 触发前端构建），访问 https://mieltsm.top/uk/

## 词汇约束规则

### 核心原则

课程中的**实词**（名词/动词/形容词/副词）必须来自 API 返回的已知词汇列表。

### 语法功能词免检

以下功能词不受词汇约束，课程中可自由使用：
- 指示词：Це, тут, там, ось
- 人称代词：я, ти, він, вона, воно, ми, ви, вони
- 物主代词：мій/моя/моє, твій/твоя/твоє 等（按课程进度引入）
- 连词：і, а, але, що, бо, або
- 否定词：не, ні
- 疑问词：хто, що, де, як, коли, чому, скільки
- 介词：в/у, на, з/із, до, від, для, без, по, за, про, під, над, між
- 助动词 / бути 的各种形式
- 数词

### 词形变化允许

已知词汇的任何语法变体均可使用。例如：已知 книга → 可用 книги（复数）、книгу（宾格）、книзі（方位格）等变形。

### 前置词汇提醒

如果语法讲解需要特定类型的词但已知词汇中没有，在课程开头的 `<div class="objective">` 之后插入前置词汇提醒：

```html
<div class="note">
  <strong>前置词汇：</strong>以下单词在本课中会用到，请先确认已添加到 vocabulary_app：
  <span class="uk-word">词1</span>, <span class="uk-word">词2</span>, ...
</div>
```

## 进度追踪

课程完成进度通过 Vue 的 `CourseIndexPage` 的 checkbox 由用户手动标记，状态保存在 Supabase `course_progress` 表（跨设备同步）。

`courses/ukrainian/progress.md` 仍然用于记录当前周次/天数、薄弱点、待复习内容，供 Claude 生成课程时参考。

## 课程格式

每个课时是一个独立的 JSON 文件，存储在 `frontend/public/uk/wXdY.json`，由 `LessonRenderer.vue` 组件解析渲染。**不需要**配套的 HTML 文件、薄壳、或任何 script 标签。

## 规范 JSON Schema（强制）

> 权威来源：`frontend/src/features/courses/types/lesson.ts`。本节与该文件冲突时以 `.ts` 为准。
> 自动校验：`python3 scripts/validate_course_schema.py`（退出码 0/1，可纳入 CI）。
> 自动迁移（历史格式→规范）：`python3 scripts/migrate_course_schema.py --write`。

### 顶层

```json
{
  "title": "第X周 第Y天 — 课程标题",
  "objective": "本课学习目标（可选）",
  "sections": [ /* Section[] */ ]
}
```

### 7 种 Section（封闭集合，不得自创其它 `type`）

| `type` | 必填字段 | 可选字段 | 禁用字段 |
|---|---|---|---|
| `vocab-preload` | `groups[{heading?, words:[{word, def}]}]` | — | — |
| `vocab-table` | `columns[], rows[][]` | `heading`, `intro`, `firstColWord` | `blocks` |
| `grammar` | `blocks[]` | `heading` | — |
| `examples` | `groups[{heading?, items:[{text, translation}]}]` | `heading`, `intro` | `blocks`（纯内容应改用 `grammar`） |
| `exercises` | `groups[]` | `heading`, `blocks[]`（仅作引言段落） | 扁平的 `style`/`questions`/`items` |
| `summary` | `html` 或 `points[]`（二选一） | `heading`, `title`, `next` | `blocks` |
| `sentence-analysis` | `items[{title?, sentence, structure?, translation?}]` | `heading` | `blocks` |

### ExerciseGroup（`exercises.groups[]` 的元素）

```json
{
  "style": "quiz | fill-blank | translation",   // 必填，仅限此 3 值
  "title": "练习A：判断名词性别",                  // 可选
  "instruction": "选择每个名词的正确性别。",         // 可选
  "questions": [ /* 下面详述 */ ]                // 必填（不得写作 items）
}
```

**禁止的别名**：组里不能用 `heading`（应写 `title`）、`intro`（应写 `instruction`）、`items`（应写 `questions`）。

### 三种 Question

```json
// style: "quiz"
{ "prompt": "...", "options": ["阳性", "阴性", "中性"], "answer": "阳性",
  "explanation": "...", "hints": ["提示1", "提示2"] }

// style: "fill-blank"  —— prompt 内用 4 个下划线 "____" 作占位
{ "prompt": "Це ____. (桌子)", "answer": "стіл",
  "accept": ["стіл"], "explanation": "...", "hints": [] }

// style: "translation"
{ "source": "...", "reference": "...", "placeholder": "...",
  "rubric": [ { "en": "...", "ideal": "...", "accept": [...], "wrong": [...], "note": "..." } ] }
```

翻译题**禁止**再带 `dataSource`、`prompt`、`displayHtml` 等历史字段；`source` 即用于 AI 批改的唯一原文来源。

### Block 类型（`grammar.blocks`、`exercises.blocks` 共用）

允许的 `type` 值：`p | h3 | h4 | tip | note | error-warn | grammar-box | ul | ol | table | details`。

**禁止使用 `h2`**——`h2` 永远是 section 的 `heading` 字段，不得作为块出现。如需在一段内切出 `h2` 级标题，请拆成两个独立 section。

| Block `type` | 主字段 |
|---|---|
| `p` / `h3` / `h4` | `html` 或 `text` |
| `tip` / `note` / `error-warn` / `grammar-box` | `html` 或 `text` |
| `ul` / `ol` | `items: string[]` |
| `table` | `headers?: string[]`, `rows: string[][]`, `firstColWord?: boolean` |
| `details` | `summary?`, `html` |

### 常见违规与修复

- ❌ `exercises` 扁平 `{type, style, questions}` → ✅ 包到 `groups: [{style, questions}]`
- ❌ `exercises.groups[].items/heading/intro` → ✅ `questions/title/instruction`
- ❌ `vocab-table` 里 `blocks:[{type:"table"}]` → ✅ 直接 `columns` + `rows` 提到 section 顶层
- ❌ `summary.blocks:[...]` → ✅ 序列化为 `html` 字符串，或用 `points[] + next`
- ❌ `grammar.blocks` 里夹 `h2` → ✅ 按 `h2` 文本拆成新的 `grammar` section（`heading`）
- ❌ `examples.blocks`（无 `groups`）→ ✅ 把 section `type` 改成 `grammar`

**JSON 结构示例**（以语法课为例）：

```json
{
  "title": "第X周 第Y天 — 课程标题",
  "objective": "本课学习目标描述",
  "sections": [
    {
      "type": "grammar",
      "heading": "1. 语法讲解",
      "blocks": [
        { "type": "h3", "text": "小标题" },
        { "type": "p", "html": "段落，可含 <span class=\"uk-word\">乌克兰语</span>" },
        { "type": "table", "headers": ["例词", "词尾", "性别"], "firstColWord": true, "rows": [...] },
        { "type": "tip", "html": "<strong>记忆技巧：</strong>..." },
        { "type": "note", "html": "注意事项..." },
        { "type": "error-warn", "html": "<strong>常见错误：</strong>..." },
        { "type": "grammar-box", "html": "规则总结..." },
        { "type": "ul", "items": ["要点1", "要点2"] }
      ]
    },
    {
      "type": "examples",
      "heading": "2. 例句",
      "_comment": "可选 — 第1-2周不需要此环节，第3周起加入",
      "groups": [
        {
          "heading": "分组标题",
          "items": [
            { "text": "乌克兰语句子", "translation": "中文翻译" }
          ]
        }
      ]
    },
    {
      "type": "exercises",
      "heading": "2. 练习题（无例句时编号前移）",
      "groups": [
        {
          "style": "quiz",
          "title": "练习A：判断名词性别（10题）",
          "instruction": "说明文字",
          "questions": [
            {
              "prompt": "<span class=\"uk-word\" data-def=\"公园\">парк</span>",
              "options": ["阳性", "阴性", "中性"],
              "answer": "阳性",
              "explanation": "парк 以辅音 -к 结尾 → 阳性",
              "hints": ["看词尾是辅音还是元音"]
            }
          ]
        },
        {
          "style": "fill-blank",
          "title": "练习B：填写正确形式",
          "instruction": "根据语境填入正确的乌克兰语词形。",
          "questions": [
            {
              "prompt": "Це ____. (桌子)",
              "answer": "стіл",
              "accept": ["стіл"],
              "explanation": "стіл = 桌子（阳性，主格）",
              "hints": ["这是一个阳性名词", "以辅音结尾"]
            }
          ]
        }
      ]
    },
    {
      "type": "summary",
      "heading": "4. 今日小结",
      "html": "<p><strong>要点</strong></p><ol><li>...</li></ol><p><strong>下节预告：</strong>...</p>"
    }
  ]
}
```

**JSON section types**：
- `vocab-preload` — 词汇预载（d1 页面），含 `groups[].words[]`
- `vocab-table` — 词汇表格（自定义列），含 `columns` + `rows`
- `grammar` — 语法讲解，含 `blocks[]`（支持 p, h3, h4, table, ul, ol, tip, note, error-warn, grammar-box, details）
- `examples` — 例句，含 `groups[].items[]`（text + translation）
- `exercises` — 练习题，含 `groups[]`（style: quiz / fill-blank / translation）
- `summary` — 小结

**blocks 中的 html 字段**支持内联标签：`<span class="uk-word">`, `<strong>`, `<em>`, `<code>`。

**所有 `.uk-word` 元素必须带 `data-def` 属性**，包含该词在当前语境下的中文释义。这是单词点击气泡显示释义的首选来源（兜底见下方"释义解析优先级"）。词形变化的释义应标注语法信息（如"桌子（与格）"）。示例：
```html
<span class="uk-word" data-def="桌子">стіл</span>
<span class="uk-word" data-def="桌子（与格）">столу</span>
```
JSON 中的 html 字段同理：
```json
{ "type": "p", "html": "Це <span class=\"uk-word\" data-def=\"桌子\">стіл</span>" }
```
vocab-preload 的 JSON 数据中，`words[].def` 字段会由 `VocabPreloadSection.vue` 自动输出为 `data-def`，无需在 html 中重复标注。

### 释义解析优先级（前端运行时）

前端在课程页"点击单词"和"选中文本→添加"两条路径上，释义按以下顺序解析：

1. **DOM 节点上的 `data-def`** —— 当前课时直接命中，最准确（语境特化的释义如词形变化在这里才有意义）
2. **跨课程释义索引** —— `useCourseDefinitionLookup.ts` 在课时页加载时后台扫描同语言的所有课时 JSON（提取 `vocab-preload.words[].def` + 所有 html 里的 `<span class="uk-word" data-def="...">`），建成 `Map<normalize(word), def>`。当 DOM 缺 `data-def` 时按 normalize 后的文本（NFC + trim + lowercase）兜底匹配
3. 都没有 → 进入空白创建态，由用户/释义爬取填写

**索引不是放松规范的借口**：
- 索引只覆盖"在至少一个课时里已被正确标注过 `data-def`"的词。**首次出现的新词必须显式标 `data-def`**，否则索引里也没有数据
- 索引按精确文本匹配，词形变化（столу 之于 стіл）不会自动归并 —— 每个变体在 DOM 上仍要带自己的语境化 `data-def`
- 索引是兜底机制，给已经存在但偶尔漏标的词补救；不是免标许可

### 乌克兰语可点击标记规范

**课程中出现的所有乌克兰语单词**都必须用 `<span class="uk-word" data-def="释义">` 包裹，使其可点击（弹出气泡：释义 + 发音 + 添加到单词库）。`data-def` 是释义的唯一来源，必须填写。包括但不限于：
- 语法讲解正文中的例词（如"以辅音结尾的名词是阳性，如 `<span class="uk-word" data-def="桌子">стіл</span>`"）
- 语法表格中的乌克兰语单元格
- 练习题 `.quiz-prompt` 中的乌克兰语单词
- 练习选项 `<label>` 中的乌克兰语单词
- 提示框 `.tip` / `.note` / `.error-warn` 中的乌克兰语
- `.grammar-box` 中的乌克兰语例词

**词组 vs 单词规则**：
- **词汇预载课（w*d1）中定义的词组**，在所有课时中都保持词组整体标记（如 `<span class="uk-word">чоловічий рід</span>`）
- **不在 d1 词汇表中的词**，一律按单个单词标记（如 `<span class="uk-word">чоловічий</span> <span class="uk-word">рід</span>`）

**例句处理**：`.uk-text` 包裹的完整例句由 `useCourseTts` 自动拆词为可点击单词，其内部不再嵌套 `.uk-word`。拆出的每个单词同样支持气泡交互。

**练习题加粗规范**：quiz prompt 默认不加粗。如果练习说明（instruction）中提到"加粗的名词/单词"，必须在对应 prompt 中用 `<strong>` 标签显式包裹目标词，例如：`"prompt": "Це <strong><span class=\"uk-word\" data-def=\"桌子\">стіл</span></strong>."`。否则学生无法区分哪个词是需要关注的目标词。

### 交互练习（JSON）

每道 quiz 题包含 `prompt`（题目）、`options`（选项数组）、`answer`（正确答案，必须与某个选项完全匹配）、可选的 `explanation`（解析）和 `hints`（渐进提示数组）。`QuizExercise.vue` 自动处理判题逻辑和状态保存。

```json
{
  "style": "quiz",
  "title": "练习A：判断名词性别",
  "instruction": "选择每个名词的正确性别。",
  "questions": [
    {
      "prompt": "<span class=\"uk-word\" data-def=\"公园\">парк</span>",
      "options": ["阳性", "阴性", "中性"],
      "answer": "阳性",
      "explanation": "以辅音 -к 结尾 → 阳性"
    }
  ]
}
```

### 填空题格式（JSON）

填空题要求学生主动回忆词形，比选择题记忆效果更好。`prompt` 中用 `____`（4 个下划线）标记填空位置。

```json
{
  "style": "fill-blank",
  "title": "练习B：填写正确形式",
  "instruction": "根据语境填入正确的乌克兰语词形。",
  "questions": [
    {
      "prompt": "Це ____. (桌子)",
      "answer": "стіл",
      "accept": ["стіл"],
      "explanation": "стіл = 桌子（阳性，主格）",
      "hints": ["这是一个阳性名词"]
    },
    {
      "prompt": "____ книга тут. (这本)",
      "answer": "Ця",
      "accept": ["Ця", "ця"],
      "explanation": "книга 是阴性名词，指示代词用 ця"
    }
  ]
}
```

字段说明：
- `prompt`：题目文本，`____` 处自动渲染为输入框。括号中的中文为提示（告知应填什么意思的词）
- `answer`：标准答案
- `accept`：可接受的替代答案数组（如大小写变体）
- `explanation`：答案解析
- `hints`（可选）：渐进提示数组

判题逻辑：精确匹配（不区分大小写）+ 长词（>4 字符）允许 1 个字符偏差。

### 渐进提示（hints）

选择题和填空题均支持可选的 `hints` 数组。学生可在作答时点击「看提示」按钮逐条查看。

```json
{
  "prompt": "<span class=\"uk-word\" data-def=\"公园\">парк</span> — 什么性别？",
  "options": ["阳性", "阴性", "中性"],
  "answer": "阳性",
  "explanation": "парк 以辅音 -к 结尾 → 阳性",
  "hints": ["看词尾是辅音还是元音", "辅音结尾的名词通常是哪个性别？"]
}
```

提示编写原则：
- 每题 1-2 条，由模糊到具体
- 引导思考，不直接包含答案
- 简单题可不加 hints
- **JSON 中的引号**：JSON 值中不得出现未转义的双引号。中文引号改用 `「」`

## 教学原则

- **语言**：用中文讲解所有语法和说明
- **时长**：每课内容量对应 **45-60 分钟**学习时间
- **内容量要求**：
  - 每课至少 **15-20 个例句**（第1-2周免除，第3周起适用）
  - 每课至少 **25 道练习题**，**至少 2 种练习类型**（选择题 + 填空题），题型多样（性别判断、代词选择、找不同类、词形填空等）
  - 每课至少 **5 道填空题**（主动回忆比选择题记忆效果翻倍）
  - 较难题目须提供 `hints` 数组（1-2 条渐进提示）
- **循序渐进**：严格按 `courses/ukrainian/curriculum.md` 的周次主题推进，不跳跃
- **严格范围控制（最重要！）**：每周第2-7天课程中出现的实词，必须限定在**本周第1天词汇预载课 + 往期已教过的词汇**范围内（语法功能词免检，见上方"词汇约束规则"）。练习题**只能涉及当天及之前已教过的内容**，绝对不能出现还没学过的语法点。例如：第1周讲名词性别，练习就只能做性别判断，不能出现宾格变化（кашу/воду）、复数、格变化等后续才学的内容。生成前务必对照 `courses/ukrainian/curriculum.md` 检查每道题是否超纲
- **例句环节按学习阶段决定是否包含**：名词阶段（第1-2周）只学性别和复数，可用句式极其有限（Це + 名词、名词 + тут/там），例句没有实际学习价值，**不需要例句环节**。从第3周（格变化）起，句式开始丰富，此时加入例句环节才有意义。具体规则：
  - **第1-2周（名词性别 + 复数）**：不生成例句环节，课程结构为：语法讲解 → 练习题 → 小结
  - **第3周起（格变化、动词等）**：加入例句环节，句式按 curriculum.md 逐步放开
- **例句句式严格受限**（适用于包含例句的课程）：每周只能使用当前及之前已学过的句式
- **复习优先**：每节新课开头简要回顾上节课的重点（3-5分钟内容）
- **语法讲解要详细**：多举例、多对比、多解释"为什么"。不要只列规则，要用具体词汇演示规则，并解释例外情况
- **记忆技巧**：每个重要规则配助记口诀或类比（如与中文/英文对比），帮助记忆
- **实用导向**：例句和练习尽量使用日常对话场景
- **发音辅助**：核心词汇提供拉丁转写发音提示，点击可听 TTS 发音
- **错误预防**：标注中文母语者常犯的错误，用 `.error-warn` 框醒目提示

## 进度管理规则

- 每周安排 7 天：第1天词汇预载 + 5天新课（第2-6天） + 第7天复习
- 第1天（词汇预载日）：列出本周所有新单词，提供一键添加到背单词App的按钮
- 如果 `courses/ukrainian/progress.md` 中记录了薄弱点，在后续课程中增加相关练习
- 复习日（每周第7天）集中巩固本周内容，不引入新知识点

## 文件路径

- 课程大纲：`courses/ukrainian/curriculum.md`
- 学习进度：`courses/ukrainian/progress.md`
- 每周推荐词汇：`courses/ukrainian/vocabulary/weekly-vocab.md`
- **每日课程 JSON**：`frontend/public/uk/wXdY.json`（如 `w1d2.json` = 第1周第2天）
- **课时索引数据**：`frontend/src/features/courses/data/lessons.ts`（`ukrainianLessons` 数组，新增课时须同步更新）

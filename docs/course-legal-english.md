# 法律英语词汇课程 — 生成指令

本文档是法律英语词汇课程的生成指令，面向法律从业者（需要阅读和翻译英文商务合同的中文母语专业人士）。课程文件存放在 `courses/legal-english/` 目录下。

## 用户画像

- 法律从业者，需要阅读和翻译英文商务合同
- 英语基础良好（CET-6+），但缺乏法律英语专业训练
- 目标：准确理解和翻译商务合同条款
- 母语：中文

## 课程生成工作流

每次用户请求生成课程时，按以下步骤执行：

1. **读取进度**：先读取 `courses/legal-english/progress.md`，了解当前所在周次、天数、薄弱点
2. **参考大纲**：对照 `courses/legal-english/curriculum.md` 确定今天的教学内容
3. **检查错题**：读取 `courses/legal-english/mistakes.md`，在新课程中针对性复习
4. **生成课程**：
   - **词汇预载日（第1天）**：生成前，先读取所有往期词汇预载 JSON（`frontend/public/legal/w*d1.json`）了解已教过哪些词汇，并通过 Supabase REST API 查询背单词 App 中的已知词汇。确保新词汇不与已教内容重复。列出本周所有新术语（含中文释义）到 `sections[0]` 的 `vocab-preload` 类型
   - **语法课程日（第2-6天）**：生成前，先读取本周的词汇预载 JSON（`frontend/public/legal/wXd1.json`）确认本周允许使用的词汇范围。在 `frontend/public/legal/` 目录下创建以周次天数命名的 `.json` 文件（如 `w3d5.json`）。生成后对照 `courses/legal-english/curriculum.md` 检查每道练习题是否超纲
   - **复习日（第7天）**：巩固本周内容，不引入新知识点
5. **Schema 校验（强制）**：写完 JSON 立即执行 `python3 scripts/validate_course_schema.py`，退出码必须为 0。有违规项按"规范 JSON Schema"一节修复；若是历史格式批量违规，用 `python3 scripts/migrate_course_schema.py --write` 自动归一化后再校验。校验不过禁止提交
6. **更新进度**：课程生成后更新 `courses/legal-english/progress.md`（推进天数、记录完成的课程）
7. **更新词汇**：将课程中的新词汇追加到 `courses/legal-english/vocabulary/known_words.md`
8. **更新课时索引**：在 `frontend/src/features/courses/data/lessons.ts` 的 `legalEnglishLessons` 数组中新增或更新对应条目

## 部署方式

课程生成后 git commit && git push 即可自动部署（GitHub Actions 触发前端构建），访问 https://mieltsm.top/legal/

## 进度追踪

课程完成进度通过 Vue 的 `CourseIndexPage` 的 checkbox 由用户手动标记，状态保存在 Supabase `course_progress` 表（跨设备同步）。

`courses/legal-english/progress.md` 仍然用于记录当前周次/天数、薄弱点、待复习内容，供 Claude 生成课程时参考。

## 课程格式

每个课时是一个独立的 JSON 文件，存储在 `frontend/public/legal/wXdY.json`，由 `LessonRenderer.vue` 组件解析渲染。**不需要**配套的 HTML 文件、薄壳、或任何 script 标签。

## 规范 JSON Schema（强制）

> 权威来源：`frontend/src/features/courses/types/lesson.ts`。本节与该文件冲突时以 `.ts` 为准。
> 自动校验：`python3 scripts/validate_course_schema.py`（CI 友好，退出码 0/1）。
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
  "title": "练习A：术语选择",                    // 可选
  "instruction": "请从三个选项中选择...",          // 可选
  "questions": [ /* 下面详述 */ ]                // 必填（不得写作 items）
}
```

**禁止的别名**：组里不能用 `heading`（应写 `title`）、`intro`（应写 `instruction`）、`items`（应写 `questions`）。

### 三种 Question

```json
// style: "quiz"
{ "prompt": "...", "options": ["A", "B", "C"], "answer": "B",
  "explanation": "...", "hints": ["提示1", "提示2"] }

// style: "fill-blank"  —— prompt 内用 4 个下划线 "____" 作占位
{ "prompt": "The Provider ____ deliver.", "answer": "shall",
  "accept": ["shall"], "explanation": "...", "hints": [] }

// style: "translation" —— 参见下方“翻译练习”章节
{ "source": "...", "reference": "...", "placeholder": "...",
  "rubric": [ { "en": "...", "ideal": "...", "accept": [...], "wrong": [...], "note": "..." } ] }
```

翻译题**禁止**再带 `dataSource`、`prompt`、`displayHtml` 等历史字段；`source` 即用于 AI 批改的唯一原文来源。

### Block 类型（`grammar.blocks`、`exercises.blocks` 共用）

允许的 `type` 值：`p | h3 | h4 | tip | note | error-warn | grammar-box | ul | ol | table | details`。

**禁止使用 `h2`**——`h2` 永远是 section 的 `heading` 字段，不得作为块出现。如果需要在一段内切出 `h2` 级标题，请拆成两个独立 section。

| Block `type` | 主字段 |
|---|---|
| `p` / `h3` / `h4` | `html` 或 `text` |
| `tip` / `note` / `error-warn` / `grammar-box` | `html` 或 `text` |
| `ul` / `ol` | `items: string[]` |
| `table` | `headers?: string[]`, `rows: (string \| {en, zh})[][]`, `firstColWord?: boolean` |
| `details` | `summary?`, `html` |

### 常见违规与修复

- ❌ `exercises` 扁平 `{type, style, questions}` → ✅ 包到 `groups: [{style, questions}]`
- ❌ `exercises.groups[].items/heading/intro` → ✅ `questions/title/instruction`
- ❌ `vocab-table` 里 `blocks:[{type:"table"}]` → ✅ 直接 `columns` + `rows` 提到 section 顶层
- ❌ `summary.blocks:[...]` → ✅ 序列化为 `html` 字符串，或用 `points[] + next`
- ❌ `grammar.blocks` 里夹 `h2` → ✅ 按 `h2` 文本拆成新的 `grammar` section（`heading`）
- ❌ `examples.blocks`（无 `groups`）→ ✅ 把 section `type` 改成 `grammar`

**JSON 结构示例**：

```json
{
  "title": "第X周 第Y天 — 课程标题（English Title）",
  "objective": "本课学习目标",
  "sections": [
    {
      "type": "vocab-table",
      "heading": "1. 核心词汇",
      "intro": "说明文字",
      "columns": ["英文", "音标", "中文", "常见搭配"],
      "rows": [
        ["subject matter", "/ˈsʌbdʒekt ˈmætər/", "标的；标的物", "the subject matter of this Agreement"]
      ]
    },
    {
      "type": "grammar",
      "heading": "2. 固定搭配",
      "blocks": [
        { "type": "p", "html": "段落，可含 <span class=\"term\">术语</span>" },
        {
          "type": "table",
          "headers": ["英文表达", "中文翻译", "例句"],
          "firstColWord": false,
          "rows": [
            [
              "<span class=\"term\" data-def=\"责任限制\">limitation of liability</span>",
              "责任限制",
              {
                "en": "The <span class=\"en-text\">limitation of liability</span> set forth in this Section shall apply to the fullest extent permitted by applicable law.",
                "zh": "本条款规定的责任限制应在适用法律允许的最大范围内生效。"
              }
            ]
          ]
        },
        { "type": "tip", "html": "..." }
      ]
    },
    {
      "type": "sentence-analysis",
      "heading": "4. 长难句解析",
      "items": [
        {
          "title": "例句 1",
          "sentence": "Subject to the terms hereof, Provider shall deliver the Goods.",
          "structure": ["<em>Subject to...</em> — 介词短语作状语", "..."],
          "translation": "根据本协议条款，提供方应交付货物。"
        }
      ]
    },
    {
      "type": "exercises",
      "heading": "6. 练习题",
      "groups": [
        {
          "style": "quiz",
          "title": "练习A：术语选择",
          "questions": [
            {
              "prompt": "The Provider shall ____ the Services.",
              "options": ["perform", "performing", "performed"],
              "answer": "perform",
              "explanation": "perform obligations = 履行义务",
              "hints": ["shall 后面接什么形式？"]
            }
          ]
        },
        {
          "style": "fill-blank",
          "title": "练习B：填空题",
          "instruction": "根据语境填入最合适的法律英语术语。",
          "questions": [
            {
              "prompt": "The Provider ____ deliver the Goods within 30 days.",
              "answer": "shall",
              "accept": ["shall"],
              "explanation": "shall = 法律义务用词",
              "hints": ["表示义务的情态动词", "在法律翻译中译为「应」"]
            }
          ]
        },
        {
          "style": "translation",
          "title": "翻译练习：英译中",
          "questions": [
            {
              "source": "Subject to the terms and conditions hereof, Provider shall provide the Services.",
              "reference": "根据本协议的条款和条件，提供方应提供服务。",
              "rubric": [
                {"en": "Subject to", "ideal": "根据/依据", "accept": ["按照"], "wrong": ["受制于"], "note": "..."}
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "summary",
      "heading": "7. 今日小结",
      "html": "<p>要点总结...</p><p><strong>下节预告：</strong>...</p>"
    }
  ]
}
```

**JSON section types**：
- `vocab-preload` — 词汇预载（d1 页面），含 `groups[].words[]`
- `vocab-table` — 词汇表格（自定义列），含 `columns` + `rows`（第一列自动加 `.term` 可点击）
- `grammar` — 语法/讲解，含 `blocks[]`（支持 p, h3, h4, table, ul, ol, tip, note, error-warn, grammar-box, details）
- `examples` — 例句，含 `groups[].items[]`（text + translation）
- `exercises` — 练习题，含 `groups[]`（style: quiz / fill-blank / translation），翻译题支持 rubric
- `summary` — 小结
- `sentence-analysis` — 长难句拆解，含 `items[]`（sentence, structure, translation）

**blocks 中的 html 字段**支持内联标签：`<span class="term">`, `<strong>`, `<em>`, `<code>`。

**所有 `.term` 元素必须带 `data-def` 属性**，包含该术语的中文释义。这是单词点击气泡显示释义的首选来源（兜底见下方"释义解析优先级"）。示例：
```html
<span class="term" data-def="对价；约因">consideration</span>
```
JSON 中的 html 字段同理：
```json
{ "type": "p", "html": "<span class=\"term\" data-def=\"对价；约因\">consideration</span> 是合同成立的要素" }
```
vocab-preload 的 JSON 数据中，`words[].def` 字段会由 `VocabPreloadSection.vue` 自动输出为 `data-def`，无需在 html 中重复标注。

### 释义解析优先级（前端运行时）

前端在课程页"点击术语"和"选中文本→添加"两条路径上，释义按以下顺序解析：

1. **DOM 节点上的 `data-def`** —— 当前课时直接命中，最准确（语境特化的释义在这里才有意义）
2. **跨课程释义索引** —— `useCourseDefinitionLookup.ts` 在课时页加载时后台扫描同语言的所有课时 JSON（提取 `vocab-preload.words[].def` + 所有 html 里的 `<span class="term" data-def="...">`），建成 `Map<normalize(text), def>`。当 DOM 缺 `data-def` 时按 normalize 后的文本（NFC + trim + lowercase）兜底匹配，覆盖单词和词组
3. 都没有 → 进入空白创建态，由用户/释义爬取填写

**索引不是放松规范的借口**：
- 索引只覆盖"在至少一个课时里已被正确标注过 `data-def`"的词组/词。**首次出现的新术语必须显式标 `data-def`**，否则索引里也没有数据
- 索引按精确文本匹配；同一术语的不同形态（如 `executes` 与 `execute`）不会自动归并
- 索引是兜底机制，给已经存在但偶尔漏标的词补救；不是免标许可

### 英文术语可点击标记规范

**课程中出现的所有英文法律术语**都必须用 `<span class="term" data-def="释义">` 包裹，使其可点击（弹出气泡：释义 + 发音 + 添加到单词库）。`data-def` 是释义的唯一来源，必须填写。包括但不限于：
- 词汇表格中的英文术语单元格（用 `class="term"` 而非 td class）
- 语法/规则讲解中的英文术语
- 练习题 `.quiz-prompt` 中的英文术语
- 提示框中的英文术语
- `.grammar-box` 中的英文术语

**词组 vs 单词规则**：
- **词汇预载课（w*d1）中定义的词组**，在所有课时中都保持词组整体标记（如 `<span class="term">operative provisions</span>`）
- **不在 d1 词汇表中的词**，一律按单个单词标记（如 `<span class="term">operative</span> <span class="term">provisions</span>`）

**例外（禁止使用 `.term`）**：
1. `.en-text` 包裹的完整例句（由 tts.js 自动拆词处理），其内部不再嵌套 `.term`。拆出的每个单词同样支持气泡交互
2. **练习选项 `<label>` 中禁止使用 `<span class="term">`**——`.term` 有加粗 + 强调色样式，若部分选项使用而另一部分不使用，会直接暗示正确答案。选项文本一律使用纯文本

**练习题加粗规范**：`.quiz-prompt` 默认 `font-weight: normal`，不会自动加粗。如果练习说明（instruction）中提到"加粗的词/术语"，必须在对应 prompt 中用 `<strong>` 标签显式包裹目标词。否则学生无法区分哪个词是需要关注的目标词。

### 词汇表标记

```html
<table>
  <thead><tr><th>英文</th><th>音标</th><th>中文</th><th>常见搭配</th></tr></thead>
  <tbody>
    <tr>
      <td class="term">subject matter</td>
      <td>/ˈsʌbdʒekt ˈmætər/</td>
      <td>标的；标的物</td>
      <td>the subject matter of this Agreement</td>
    </tr>
  </tbody>
</table>
```

### 例句标记

```html
<p class="example">
  1. <span class="en-text">Subject to the terms hereof, Provider shall deliver the Goods.</span>
  <span class="translation">— 根据本协议条款，提供方应交付货物。</span>
</p>
```

### 长难句解析标记

```html
<div class="sentence-analysis">
  <h3>例句 1</h3>
  <blockquote><span class="en-text">合同原文长难句</span></blockquote>
  <p><strong>语法分析：</strong></p>
  <ul class="structure">
    <li><em>Subject to...</em> — 介词短语作状语</li>
    <!-- 更多结构分析 -->
  </ul>
  <div class="full-translation"><strong>参考译文：</strong>中文翻译</div>
</div>
```

### 单词记忆标记

```html
<h2>5. 单词记忆</h2>

<h3>5a. 闪卡自测</h3>
<p>看到英文术语，想一想中文意思，然后点击展开答案：</p>

<div class="flashcard-grid">
  <div class="flashcard">
    <details>
      <summary><span class="term">subject matter</span></summary>
      <div class="answer-content">标的；标的物</div>
    </details>
  </div>
</div>

<div class="exercise">
  <h3>5b. 配对选择：看中文选英文</h3>
  <div class="quiz-item" data-answer="subject matter" data-explanation="subject matter = 标的/标的物">
    <div class="quiz-prompt">1. 标的物</div>
    <div class="quiz-options">
      <label><input type="radio" name="m1" value="subject matter"> subject matter</label>
      <label><input type="radio" name="m1" value="deliverables"> deliverables</label>
      <label><input type="radio" name="m1" value="milestone"> milestone</label>
    </div>
  </div>
  <button class="grade-btn" disabled>判题</button>
</div>
```

### 交互练习标记（选择题）

```html
<div class="exercise">
  <h3>练习A：术语选择</h3>
  <div class="quiz-item" data-answer="perform" data-explanation="perform obligations = 履行义务">
    <div class="quiz-prompt">1. The Provider shall ____ the Services.</div>
    <div class="quiz-options">
      <label><input type="radio" name="a1" value="perform"> perform</label>
      <label><input type="radio" name="a1" value="performing"> performing</label>
      <label><input type="radio" name="a1" value="performed"> performed</label>
    </div>
  </div>
  <button class="grade-btn" disabled>判题</button>
</div>
```

### 翻译练习标记

翻译题使用 **DeepSeek AI 批改**：用户在页面输入翻译，点击"提交批改"后，前端调用 DeepSeek API，由 AI 对翻译进行详细批改（评分 + 逐条术语审查 + 参考译文 + 知识点说明）。如果 API 不可用，自动降级为本地 `data-rubric` 关键词匹配批改。

因此翻译题的 `data-rubric` 和 `data-reference` 属性**必须完整生成**，作为 AI 批改的评分参考和降级方案的数据来源。

```html
<div class="translation-exercise">
  <h3>翻译练习：英译中</h3>

  <div class="translate-item"
    data-source="Subject to the terms and conditions hereof, Provider shall provide the Services."
    data-reference="根据本协议的条款和条件，提供方应提供服务。"
    data-rubric='[
      {"en":"Subject to","ideal":"根据/依据","accept":["按照","遵照"],"wrong":["受制于"],"note":"Subject to 在合同中表示\"根据/在...条件下\""},
      {"en":"terms and conditions","ideal":"条款和条件/条款","accept":["条件"],"wrong":["术语"],"note":"terms = 条款，不是\"术语\""},
      {"en":"hereof","ideal":"本协议的","accept":["本合同的"],"wrong":[],"note":"hereof = of this (Agreement)"},
      {"en":"shall provide","ideal":"应提供/应当提供","accept":["须提供","将提供"],"wrong":["可以提供"],"note":"shall = 法律义务，不是\"可以\""}
    ]'>
    <div class="source-text">1. <span class="en-text">Subject to the terms and conditions hereof, Provider shall provide the Services.</span></div>
    <textarea placeholder="请输入中文翻译..."></textarea>
  </div>

  <button class="check-translation-btn" disabled>提交批改</button>
</div>
```

字段说明：
- `data-source`：原文（用于传给批改逻辑）
- `data-reference`：参考译文全文
- `data-rubric`：JSON 数组，每个元素定义一个评分点
  - `en`：原文中的关键术语
  - `ideal`：最佳翻译（多个用 / 分隔）
  - `accept`：可接受但不够规范的翻译
  - `wrong`：常见错误翻译
  - `note`：知识点说明

注意：`data-rubric` 值用单引号包裹，JSON 内用双引号。如 JSON 值中含单引号（如 arm's），使用 `&apos;` 转义。

### 填空题格式（JSON）

填空题要求学生主动回忆术语，比选择题记忆效果更好。`prompt` 中用 `____`（4 个下划线）标记填空位置，`FillBlankExercise.vue` 会自动替换为输入框。

```json
{
  "style": "fill-blank",
  "title": "练习B：术语填空",
  "instruction": "根据语境填入最合适的法律英语术语。",
  "questions": [
    {
      "prompt": "The Provider ____ deliver the Goods within 30 days.",
      "answer": "shall",
      "accept": ["shall"],
      "explanation": "shall = 法律义务用词，表示「应」",
      "hints": ["表示义务的情态动词", "在法律翻译中译为「应」"]
    },
    {
      "prompt": "All disputes arising ____ this Agreement shall be settled by arbitration.",
      "answer": "out of",
      "accept": ["out of", "from", "under"],
      "explanation": "arising out of = 因……产生的，是合同争议解决条款的常见用语"
    }
  ]
}
```

字段说明：
- `prompt`：题目文本，`____` 处自动渲染为输入框
- `answer`：标准答案
- `accept`：可接受的替代答案数组（判题时均视为正确）
- `explanation`：答案解析
- `hints`（可选）：渐进提示数组，学生答错或卡住时可逐条查看

判题逻辑：精确匹配（不区分大小写）+ 长词（>4 字符）允许 1 个字符偏差（Levenshtein 距离 ≤ 1）。

### 渐进提示（hints）

选择题和填空题均支持可选的 `hints` 数组。学生可在作答过程中点击「看提示」按钮逐条查看，辅助思考而非直接给出答案。

```json
{
  "prompt": "Which word expresses a mandatory obligation?",
  "options": ["shall", "may", "will", "can"],
  "answer": "shall",
  "explanation": "shall 在法律英语中表示强制义务",
  "hints": ["这个词在中文法律翻译中通常译为「应」", "它不是表示未来时态的词"]
}
```

提示编写原则：
- 每题 1-2 条提示，由模糊到具体（第一条给方向，第二条更直接）
- 提示引导思考，不直接包含答案
- 较简单的题目可不加 hints

## 生成后质量检查

课程生成完成后，必须逐题检查以下内容：

0. **Schema 校验**：`python3 scripts/validate_course_schema.py` 必须通过（退出码 0）。这是结构层的硬门槛，不通过说明 JSON 字段命名/嵌套不符合规范，后续内容校验无意义
1. **选项与答案匹配**（选择题）：`data-answer` / `answer` 的值必须与某个选项**完全一致**（区分大小写、单复数、时态）。常见错误：
   - 大小写不一致（如 `answer: "as used herein"` vs 选项 `"As used herein"`）
   - 单复数不一致（如 `answer: "operative provisions"` vs 选项 `"operative provision"`）
   - 动词形态不一致（如 `answer: "enter into"` vs 选项 `"entered into"`）
2. **填空题答案合理**：`answer` 是最标准的答案，`accept` 包含所有合理的替代答案。确保 `prompt` 中有且仅有一个 `____` 占位符
3. **答案解析完整性**：`explanation` 不仅要解释正确答案为什么对，还要说明**其他选项为什么不对**。格式示例：
   - `"perform = 履行（义务）。performing 是进行时形式，此处需要动词原形；performed 是过去式，shall 后接原形。"`
4. **答案正确性**：确认每道题的正确答案本身是正确的，不存在知识性错误
5. **JSON 中的引号**：JSON 值中不得出现未转义的双引号 `"`。中文引号改用 `「」`，或使用 `\"`

## 教学原则

- **语言**：用中文讲解所有语法和说明
- **例句大小写**：所有英文例句（`<span class="en-text">...</span>`、`sentence-analysis.sentence`、`translation.source` 等）一律使用正常 Sentence case，**不得模仿合同原文的全大写排版**（如 `IN NO EVENT SHALL...`、`PROVIDER MAKES NO WARRANTIES...` 等）。合同定义的专有方仍保留首字母大写（Provider, Client, Party, Agreement 等）
- **时长**：每课内容量对应 **45-60 分钟**学习时间
- **内容量要求**：
  - 每课 **12-18 个核心术语**
  - 每课 **6-8 个固定搭配**（"固定搭配"表格第 3 列「例句」**必须是双语**，格式 `{"en": "英文例句", "zh": "中文翻译"}`；英文部分用 `<span class="en-text">...</span>` 包裹便于发音/样式定位，中文是完整翻译——不得只写英文）
  - 每课 **2-3 个长难句解析**
  - 每课 **15-20 道练习题**，**至少 3 种练习类型**（选择题 + 填空题 + 翻译题）
  - 每课至少 **5 道填空题**（主动回忆比选择题记忆效果翻倍）
  - 每课 **2-3 道翻译题**（英译中/中译英各半，答案全部预生成）
  - 较难题目须提供 `hints` 数组（1-2 条渐进提示）
- **词性标注（强制）**：以下两处的**中文释义**前必须带词性前缀（如 `n.`、`v.`、`adj.`、`adv.`、`prep.`、`conj.`、`aux.`、`phr.`、`abbr.`），与释义之间用空格分隔：
  - **每周第1天词汇预载**（`w*d1.json`）中 `vocab-preload` 的每一个 `words[].def`
  - **每日课程第一张核心词汇表**（`vocab-table` 或 `grammar` 内 `headers: ["英文", "音标", "中文", "常见搭配"]` 的表格）的第3列「中文」单元格
  - 词性约定：
    - 单词：按标准词典词性（名词 `n.`、动词 `v.`、形容词 `adj.`、副词 `adv.`、介词 `prep.`、连词 `conj.`）
    - 情态动词：`aux.`（shall/may/must/will 等）
    - 名词短语：`n.`（subject matter, business day）
    - 动词短语：`v.`（enter into, set forth, hold harmless）
    - 介词短语：`prep.`（subject to, in accordance with, in consideration of）
    - 副词短语：`adv.`（hereinafter, thereof, hereof）
    - 连词/引导短语：`conj.`（provided that, whereas, notwithstanding）
    - 其它完整子句/惯用语：`phr.`（time is of the essence, in no event shall）
    - 缩写：`abbr.`（VAT, FX）
    - 同时兼多种词性：用 `/` 连写，如 `n./v.` `v./n.`
  - 示例：
    - `{"word": "preamble", "def": "n. 前言；序言"}`
    - `{"word": "enter into", "def": "v. 签订；订立"}`
    - `{"word": "subject to", "def": "prep. 以…为条件；受…约束"}`
    - `{"word": "shall", "def": "aux. 应当（法律义务）"}`
  - 其它辅助性表格（辨析表、搭配表、例句表等）不强制标注词性，除非语义需要
- **循序渐进**：严格按 `courses/legal-english/curriculum.md` 的周次主题推进，不跳跃
- **严格范围控制**：每周第2-7天课程中出现的词汇，必须限定在**本周第1天词汇预载课 + 往期已教过的词汇**范围内。练习题只能涉及当天及之前已教过的内容
- **复习优先**：每节新课开头简要回顾上节课的重点
- **词汇辨析要详细**：近义术语（provide/furnish/render）需详细对比使用场景
- **记忆技巧**：术语配词源分析或与日常英语的对比，帮助记忆
- **实用导向**：例句和练习直接取自真实合同条款
- **发音辅助**：核心术语提供音标，点击可听 TTS 发音
- **错误预防**：标注中文母语者常犯的翻译错误，用 `.error-warn` 框醒目提示
- **错题复习**：检查 `courses/legal-english/mistakes.md`，在新课程中安排薄弱点的针对性练习

## 进度管理规则

- 每周安排 7 天：第1天词汇预载 + 5天新课（第2-6天） + 第7天复习
- 第1天（词汇预载日）：列出本周所有新术语，提供一键添加到背单词App的按钮
- 如果 `courses/legal-english/progress.md` 中记录了薄弱点，在后续课程中增加相关练习
- 复习日（每周第7天）集中巩固本周内容，不引入新知识点
- `courses/legal-english/mistakes.md` 中标记"待复习"的知识点需在后续课程中安排练习

## 文件路径

- 课程大纲：`courses/legal-english/curriculum.md`
- 学习进度：`courses/legal-english/progress.md`
- 错题库：`courses/legal-english/mistakes.md`
- 词汇库：`courses/legal-english/vocabulary/known_words.md`
- **每日课程 JSON**：`frontend/public/legal/wXdY.json`（如 `w1d2.json` = 第1周第2天）
- **课时索引数据**：`frontend/src/features/courses/data/lessons.ts`（`legalEnglishLessons` 数组，新增课时须同步更新）

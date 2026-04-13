# 乌克兰语语法课程 — 生成指令

本文档是乌克兰语语法课程的生成指令，面向中文母语者。课程按周推进，每周包含词汇预载、语法讲解和复习，配合 Vocabulary App 进行词汇管理。

## 项目概述

基于文件的乌克兰语学习系统。Claude Code 根据学习进度，为用户生成每日课程文档（HTML 格式）。

**本项目只负责语法课程**，单词学习通过 vocabulary_app（mieltsm.top）管理。两个项目联动：课程中的实词必须来自用户已添加到 vocabulary_app 的词汇。

## 用户画像

- 在多邻国学习乌克兰语 100+ 天
- 已掌握：全部字母发音、基础问候语、数字与时间、基础动词、生活类名词（食物/动物/颜色）
- 语法基础：零（不了解词性、格变化等）
- 母语：中文

## Vocabulary App 联动

课程页面通过 `courses/shared/auth.js` 读取主站 Supabase 登录会话，使用认证用户的 ID 添加词汇。默认 source 为 `UKA`，用户可在页面下拉框中切换。

课程生成时，通过 Supabase REST API 获取用户已知词汇（需要 service key，见 `backend/.env` 中的 `SUPABASE_SERVICE_KEY`）。

## 课程生成工作流

每次用户请求生成课程时，按以下步骤执行：

1. **读取进度**：先读取 `courses/ukrainian/progress.md`，了解当前所在周次、天数、薄弱点
2. **获取已知词汇**：通过 Supabase REST API 获取用户已添加的乌克兰语单词（user_id 和 source 从课程上下文确定）
3. **参考大纲**：对照 `courses/ukrainian/curriculum.md` 确定今天的教学内容
4. **生成课程**：
   - **词汇预载日（第1天）**：生成前，先读取所有往期词汇预载课（`courses/ukrainian/lessons/w*d1.html`）了解已教过哪些词汇，并通过 API 查询背单词 App 中的已知词汇（见上方"Vocabulary App 联动配置"）。确保新词汇不与已教内容重复。生成词汇页面，列出本周所有新单词（含中文释义），引用 `templates/vocab.js` 实现一键添加到背单词App。参考 `courses/ukrainian/vocabulary/weekly-vocab.md` 中的词汇列表
   - **语法课程日（第2-6天）**：生成前，先读取本周的词汇预载课（`courses/ukrainian/lessons/wXd1.html`）确认本周允许使用的词汇范围。在 `courses/ukrainian/lessons/` 目录下创建以周次天数命名的 `.html` 文件（如 `w3d5.html`）。**例句和练习中只使用已知词汇列表中的词**（语法功能词不受约束，详见下方"词汇约束规则"）。生成后对照 `courses/ukrainian/curriculum.md` 检查每道练习题是否超纲
   - **复习日（第7天）**：巩固本周内容，不引入新语法
5. **更新进度**：课程生成后更新 `courses/ukrainian/progress.md`（推进天数、记录完成的课程）
6. **更新索引页**：在 `courses/ukrainian/lessons/index.html` 的 `lessons` 数组中，将对应条目的 `file` 从 `null` 改为实际文件名（如 `"w3d5.html"`）
7. **部署**：课程生成后 git commit && git push 即可自动部署，访问 https://mieltsm.top/uk/

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

课程完成进度通过 `courses/ukrainian/lessons/index.html` 中每课右侧的 **checkbox** 由用户手动标记，状态保存在浏览器 localStorage（key: `ukrainian_progress`）。不再使用日期自动判断完成状态。

`courses/ukrainian/progress.md` 仍然用于记录当前周次/天数、薄弱点、待复习内容，供 Claude 生成课程时参考。

## 课程格式

课程支持两种格式：**JSON 数据驱动**（推荐）和传统 HTML。新课程一律使用 JSON 格式。

### JSON 格式（推荐）

每个课时由两个文件组成：

1. **`wXdY.json`** — 纯内容数据（Claude 生成此文件）
2. **`wXdY.html`** — 薄壳 HTML（复制模板，改文件名即可）

**薄壳 HTML 模板**（13 行，写一次永不变）：

```html
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="templates/lesson.css">
</head>
<body>
<script src="templates/auth.js"></script>
<script src="templates/renderer.js"></script>
<script>CourseRenderer.load('wXdY.json')</script>
</body>
</html>
```

**JSON 结构**（以语法课为例）：

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

**所有 `.uk-word` 元素必须带 `data-def` 属性**，包含该词在当前语境下的中文释义。这是单词点击气泡显示释义的唯一来源。词形变化的释义应标注语法信息（如"桌子（与格）"）。示例：
```html
<span class="uk-word" data-def="桌子">стіл</span>
<span class="uk-word" data-def="桌子（与格）">столу</span>
```
JSON 中的 html 字段同理：
```json
{ "type": "p", "html": "Це <span class=\"uk-word\" data-def=\"桌子\">стіл</span>" }
```
vocab-preload 的 JSON 数据中，`words[].def` 字段会由 renderer.js 自动输出为 `data-def`，无需在 html 中重复标注。

### 传统 HTML 格式（已有课程）

已有课程仍为完整 HTML。结构骨架：

```html
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>第X周 第Y天 — 课程标题</title>
  <link rel="stylesheet" href="templates/lesson.css">
</head>
<body>
<!-- 课程内容 -->
<script src="templates/auth.js"></script>
<script src="templates/tts.js"></script>
<script src="templates/wordInteraction.js"></script>
<script src="templates/exercise.js"></script>
<script src="templates/nav.js"></script>
</body>
</html>
```

### 例句标记（第3周起适用）

```html
<p class="example">
  1. <span class="uk-text">Це стіл.</span>
  <span class="translation">— 这是桌子。</span>
</p>
```

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

**例句处理**：`.uk-text` 包裹的完整例句由 tts.js 自动拆词为可点击单词，其内部不再嵌套 `.uk-word`。拆出的每个单词同样支持气泡交互。

**练习题加粗规范**：`.quiz-prompt` 默认 `font-weight: normal`，不会自动加粗。如果练习说明（instruction）中提到"加粗的名词/单词"，必须在对应 prompt 中用 `<strong>` 标签显式包裹目标词，例如：`"prompt": "Це <strong><span class=\"uk-word\" data-def=\"桌子\">стіл</span></strong>."`。否则学生无法区分哪个词是需要关注的目标词。

### 交互练习标记

每道题用 `.quiz-item` 包裹，答案和解析存在 `data-answer` / `data-explanation` 属性中。每个 `.exercise` 末尾放判题按钮。`exercise.js` 自动处理判题逻辑。

```html
<div class="exercise">
  <h3>练习A：题目标题</h3>
  <p>说明文字</p>

  <div class="quiz-item" data-answer="阳性" data-explanation="以辅音 -к 结尾">
    <div class="quiz-prompt">1. парк</div>
    <div class="quiz-options">
      <label><input type="radio" name="a1" value="阳性"> 阳性</label>
      <label><input type="radio" name="a1" value="阴性"> 阴性</label>
      <label><input type="radio" name="a1" value="中性"> 中性</label>
    </div>
  </div>
  <!-- 更多 .quiz-item ... -->

  <button class="grade-btn" disabled>判题</button>
</div>
```

注意事项：
- 每个 `.exercise` 内的 radio `name` 属性需唯一（如 a1, a2, b1, b2...）
- `data-answer` 的值必须与某个 radio 的 `value` 完全匹配
- 所有题型（判断性别、选代词、选不同类）统一用 radio 按钮

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
- 每日课程：`courses/ukrainian/lessons/wXdY.html`（如 `w1d2.html` = 第1周第2天）

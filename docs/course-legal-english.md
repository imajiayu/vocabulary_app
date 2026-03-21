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
   - **词汇预载日（第1天）**：生成前，先读取所有往期词汇预载课（`courses/legal-english/lessons/w*d1.html`）了解已教过哪些词汇，并通过 Supabase REST API 查询背单词 App 中的已知词汇（user_id 和 source 从课程上下文确定）。确保新词汇不与已教内容重复。生成词汇页面，列出本周所有新术语（含中文释义），引用 `templates/vocab.js` 实现一键添加到背单词App
   - **语法课程日（第2-6天）**：生成前，先读取本周的词汇预载课（`courses/legal-english/lessons/wXd1.html`）确认本周允许使用的词汇范围。在 `courses/legal-english/lessons/` 目录下创建以周次天数命名的 `.html` 文件（如 `w3d5.html`）。生成后对照 `courses/legal-english/curriculum.md` 检查每道练习题是否超纲
   - **复习日（第7天）**：巩固本周内容，不引入新知识点
5. **更新进度**：课程生成后更新 `courses/legal-english/progress.md`（推进天数、记录完成的课程）
6. **更新词汇**：将课程中的新词汇追加到 `courses/legal-english/vocabulary/known_words.md`
7. **更新索引页**：在 `courses/legal-english/lessons/index.html` 的 `lessons` 数组中，将对应条目的 `file` 从 `null` 改为实际文件名（如 `"w3d5.html"`）

## 部署方式

课程生成后 git commit && git push 即可自动部署，访问 https://mieltsm.top/legal/

## 进度追踪

课程完成进度通过 `courses/legal-english/lessons/index.html` 中每课右侧的 **checkbox** 由用户手动标记，状态保存在浏览器 localStorage（key: `legal_english_progress`）。不再使用日期自动判断完成状态。

`courses/legal-english/progress.md` 仍然用于记录当前周次/天数、薄弱点、待复习内容，供 Claude 生成课程时参考。

## 课程格式模板（HTML）

每节课使用 HTML 格式，引用共享样式和脚本。

### HTML 结构骨架

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>第X周 第Y天 — 课程标题（English Title）</title>
  <link rel="stylesheet" href="templates/lesson.css">
</head>
<body>

<h1>第X周 第Y天 — 课程标题（English Title）</h1>

<div class="objective">
  <strong>学习目标：</strong>（1-2句话描述本课目标）
</div>

<p>上节回顾：（简要回顾上节课重点，2-3句话）</p>

<h2>1. 核心词汇</h2>
<!-- 词汇表格，英文术语用 class="term" 可点击发音 -->

<h2>2. 固定搭配</h2>
<!-- 法律固定搭配表格，含例句 -->

<h2>3. 词汇辨析</h2>
<!-- 易混淆词组的对比分析 -->

<h2>4. 长难句解析</h2>
<!-- 2-3 个真实合同长难句拆解，class="sentence-analysis" -->

<h2>5. 单词记忆</h2>
<!-- 5a. 闪卡自测 + 5b. 配对选择题 -->

<h2>6. 练习题</h2>
<!-- 选择题 + 翻译题，所有答案预先生成 -->

<h2>7. 今日小结</h2>
<!-- 用 class="summary-box" 包裹 -->

<script src="templates/tts.js"></script>
<script src="templates/exercise.js"></script>
<script src="templates/nav.js"></script>
</body>
</html>
```

### 英文术语可点击标记规范

**课程 HTML 中出现的任何英文法律术语**都必须用 `<span class="term">` 包裹，使其可点击发音。包括但不限于：
- 词汇表格中的英文术语单元格（用 `class="term"` 而非 td class）
- 语法/规则讲解中的英文术语
- 练习题 `.quiz-prompt` 中的英文术语
- 练习选项 `<label>` 中的英文术语
- 提示框中的英文术语
- `.grammar-box` 中的英文术语

**唯一例外**：`.en-text` 包裹的完整例句（由 tts.js 自动拆词处理），其内部不再嵌套 `.term`。

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
      <label><input type="radio" name="m1" value="subject matter"> <span class="term">subject matter</span></label>
      <label><input type="radio" name="m1" value="deliverables"> <span class="term">deliverables</span></label>
      <label><input type="radio" name="m1" value="milestone"> <span class="term">milestone</span></label>
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
      <label><input type="radio" name="a1" value="perform"> <span class="term">perform</span></label>
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

## 教学原则

- **语言**：用中文讲解所有语法和说明
- **时长**：每课内容量对应 **45-60 分钟**学习时间
- **内容量要求**：
  - 每课 **12-18 个核心术语**
  - 每课 **6-8 个固定搭配**
  - 每课 **2-3 个长难句解析**
  - 每课 **15-20 道练习题**（含选择题、翻译题）
  - 每课 **2-3 道翻译题**（英译中/中译英各半，答案全部预生成）
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
- 每日课程：`courses/legal-english/lessons/wXdY.html`（如 `w1d2.html` = 第1周第2天）

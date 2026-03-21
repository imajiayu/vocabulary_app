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

## 课程格式模板（HTML）

每节课使用 HTML 格式，引用共享样式和脚本。

### HTML 结构骨架

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

<h1>第X周 第Y天 — 课程标题</h1>

<div class="objective">
  <strong>学习目标：</strong>（1-2句话描述本课目标）
</div>

<!-- 如有前置词汇需求，在此插入 <div class="note"> -->

<h2>1. 语法讲解</h2>
<!-- 用中文清晰讲解语法规则，配合乌克兰语示例 -->
<!-- 使用 class="grammar-box" 包裹规则总结 -->
<!-- 使用 class="tip" / class="note" / class="error-warn" 包裹提示 -->

<h2>2. 例句</h2>
<!-- 乌克兰语部分用 <span class="uk-text">，JS 自动拆词并插入播放按钮 -->

<h2>3. 练习题</h2>
<!-- 用 class="exercise" 包裹每组练习，交互式 radio 判题 -->

<h2>4. 今日小结</h2>
<!-- 用 class="summary-box" 包裹 -->

<script src="templates/tts.js"></script>
<script src="templates/exercise.js"></script>
<script src="templates/nav.js"></script>
</body>
</html>
```

### 例句标记

```html
<p class="example">
  1. <span class="uk-text">Це стіл.</span>
  <span class="translation">— 这是桌子。</span>
</p>
```

### 乌克兰语可点击标记规范

**课程 HTML 中出现的任何乌克兰语单词/短语**都必须用 `<span class="uk-word">` 包裹，使其可点击发音。包括但不限于：
- 语法讲解正文中的例词（如"以辅音结尾的名词是阳性，如 `<span class="uk-word">стіл</span>`"）
- 语法表格中的乌克兰语单元格
- 练习题 `.quiz-prompt` 中的乌克兰语单词
- 练习选项 `<label>` 中的乌克兰语单词
- 提示框 `.tip` / `.note` / `.error-warn` 中的乌克兰语
- `.grammar-box` 中的乌克兰语例词

**唯一例外**：`.uk-text` 包裹的完整例句（由 tts.js 自动拆词处理），其内部不再嵌套 `.uk-word`。

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

## 教学原则

- **语言**：用中文讲解所有语法和说明
- **时长**：每课内容量对应 **45-60 分钟**学习时间
- **内容量要求**：
  - 每课至少 **15-20 个例句**
  - 每课至少 **25 道练习题**，题型多样（性别判断、代词选择、找不同类、配对等）
- **循序渐进**：严格按 `courses/ukrainian/curriculum.md` 的周次主题推进，不跳跃
- **严格范围控制（最重要！）**：每周第2-7天课程中出现的实词，必须限定在**本周第1天词汇预载课 + 往期已教过的词汇**范围内（语法功能词免检，见上方"词汇约束规则"）。练习题**只能涉及当天及之前已教过的内容**，绝对不能出现还没学过的语法点。例如：第1周讲名词性别，练习就只能做性别判断，不能出现宾格变化（кашу/воду）、复数、格变化等后续才学的内容。生成前务必对照 `courses/ukrainian/curriculum.md` 检查每道题是否超纲
- **例句句式严格受限**：每周只能使用当前及之前已学过的句式，具体约束如下：
  - **第1周（名词性别）**：例句只能用 `Це + 名词`、`名词 + тут/там`（...在这里/那里）、`名词 — це + 名词` 等不涉及格变化、形容词配合、物主代词的简单句式。**禁止**使用：物主代词（мій/моя/моє）、形容词配合（великий/велика/велике）、宾格变化（книгу/воду）、动词变位
  - **第2周（名词复数）**：可增加复数形式，但仍不涉及格变化和形容词
  - **第3周起**：按 curriculum.md 逐步放开
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

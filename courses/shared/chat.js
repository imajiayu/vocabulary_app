/* === 课程 AI 实时答疑聊天组件 === */
/* 乌克兰语 / 法律英语课程共用，不同 base prompt */

(function () {
  // --- 课程检测（排除 index 页面） ---
  var path = location.pathname;
  var isUk = path.indexOf('/uk/') === 0 || path.indexOf('/ukrainian/lessons/') !== -1;
  var isLegal = path.indexOf('/legal/') === 0 || path.indexOf('/legal-english/lessons/') !== -1;
  if (!isUk && !isLegal) return;
  var isIndex = path.endsWith('/') || path.endsWith('/index.html');
  if (isIndex) return;

  // --- DeepSeek API 配置 ---
  var DEEPSEEK_API_KEY = 'sk-089516ac71dd4ba79013056613441d1b';
  var DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
  var DEEPSEEK_MODEL = 'deepseek-chat';
  var MAX_HISTORY_ROUNDS = 10;

  // --- Base Prompt ---
  var SYSTEM_PROMPT_UK = [
    '你是一位乌克兰语教学助手，专注于帮助中文母语者学习乌克兰语。',
    '你正在辅助学生学习一门乌克兰语课程。',
    '',
    '回答规则：',
    '1. 使用中文回答，乌克兰语单词和短语用原文标注',
    '2. 解释语法规则时要联系当前课时的上下文',
    '3. 可以举额外的例子来帮助理解',
    '4. 如果学生问的内容超出当前课时范围，简要回答但提示会在后续课程中学到',
    '5. 发音相关问题可以用近似中文音标辅助说明',
    '6. 回答要简洁实用，避免冗长的理论阐述',
    '7. 当学生选中页面文字提问时，重点解释该段内容'
  ].join('\n');

  var SYSTEM_PROMPT_LEGAL = [
    '你是一位法律英语教学助手，专注于帮助中文母语者学习商务合同英语翻译。',
    '你正在辅助学生学习一门法律英语词汇课程。',
    '',
    '回答规则：',
    '1. 使用中文回答，英文术语保持原文',
    '2. 解释术语时要结合法律语境，区分日常含义和法律含义',
    '3. 可以给出术语在真实合同条款中的用法示例',
    '4. 翻译建议要符合法律翻译规范（如 shall 译为"应"而非"将"）',
    '5. 区分近义词时要说明各自的法律效力差异',
    '6. 回答要简洁实用，避免冗长的理论阐述',
    '7. 当学生选中页面文字提问时，重点解释该段内容'
  ].join('\n');

  var basePrompt = isUk ? SYSTEM_PROMPT_UK : SYSTEM_PROMPT_LEGAL;
  var courseName = isUk ? '乌克兰语助手' : '法律英语助手';

  // --- 状态 ---
  var chatHistory = []; // { role, content }[]
  var isOpen = false;
  var isStreaming = false;
  var abortController = null;

  // --- CSS 注入 ---
  var style = document.createElement('style');
  style.textContent = [
    /* 浮动按钮 */
    '#course-chat-fab {',
    '  position: fixed; bottom: 24px; right: 24px; z-index: 10000;',
    '  width: 48px; height: 48px; border-radius: 50%;',
    '  background: var(--accent, #2563eb); color: #fff; border: none;',
    '  cursor: pointer; font-size: 22px; line-height: 48px; text-align: center;',
    '  box-shadow: 0 2px 12px rgba(0,0,0,0.18);',
    '  transition: transform 0.2s, box-shadow 0.2s;',
    '}',
    '#course-chat-fab:hover { transform: scale(1.08); box-shadow: 0 4px 20px rgba(0,0,0,0.22); }',

    /* 聊天窗口 */
    '#course-chat-window {',
    '  display: none; position: fixed; bottom: 80px; right: 24px; z-index: 10001;',
    '  width: 400px; max-height: 520px; border-radius: 12px;',
    '  background: var(--card-bg, #fff); border: 1px solid var(--border, #e5e2dd);',
    '  box-shadow: 0 8px 32px rgba(0,0,0,0.15);',
    '  flex-direction: column; overflow: hidden;',
    '  font-family: "Noto Sans", "PingFang SC", "Microsoft YaHei", sans-serif;',
    '  font-size: 14px; line-height: 1.6;',
    '}',
    '#course-chat-window.open { display: flex; }',

    /* 标题栏 */
    '.chat-header {',
    '  display: flex; align-items: center; justify-content: space-between;',
    '  padding: 10px 14px; background: var(--accent, #2563eb); color: #fff;',
    '  font-size: 14px; font-weight: 600; flex-shrink: 0;',
    '}',
    '.chat-header-title { flex: 1; }',
    '.chat-header-btn {',
    '  background: none; border: none; color: rgba(255,255,255,0.85);',
    '  cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 4px;',
    '  transition: background 0.15s;',
    '}',
    '.chat-header-btn:hover { background: rgba(255,255,255,0.2); color: #fff; }',

    /* 消息列表 */
    '.chat-messages {',
    '  flex: 1; overflow-y: auto; padding: 12px 14px;',
    '  min-height: 200px; max-height: 360px;',
    '}',
    '.chat-msg { margin-bottom: 12px; display: flex; }',
    '.chat-msg.user { justify-content: flex-end; }',
    '.chat-msg.assistant { justify-content: flex-start; }',

    '.chat-bubble {',
    '  max-width: 85%; padding: 8px 12px; border-radius: 10px;',
    '  word-break: break-word; white-space: pre-wrap;',
    '}',
    '.chat-msg.user .chat-bubble {',
    '  background: var(--accent, #2563eb); color: #fff;',
    '  border-bottom-right-radius: 3px;',
    '}',
    '.chat-msg.assistant .chat-bubble {',
    '  background: var(--highlight, #eff6ff); color: var(--text, #2d2d2d);',
    '  border-bottom-left-radius: 3px;',
    '}',

    /* 消息内 markdown 样式 */
    '.chat-bubble code {',
    '  background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 3px;',
    '  font-family: "JetBrains Mono", monospace; font-size: 0.9em;',
    '}',
    '.chat-msg.user .chat-bubble code { background: rgba(255,255,255,0.2); }',
    '.chat-bubble pre {',
    '  background: rgba(0,0,0,0.06); padding: 8px; border-radius: 6px;',
    '  overflow-x: auto; margin: 6px 0; white-space: pre;',
    '}',
    '.chat-bubble pre code { background: none; padding: 0; }',
    '.chat-bubble strong { font-weight: 600; }',

    /* 加载指示器 */
    '.chat-loading { display: inline-block; }',
    '.chat-loading::after {',
    '  content: ""; display: inline-block; width: 4px; height: 14px;',
    '  background: var(--accent, #2563eb); margin-left: 2px;',
    '  animation: chat-blink 0.6s infinite;',
    '}',
    '@keyframes chat-blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }',

    /* 输入区 */
    '.chat-input-area {',
    '  display: flex; align-items: flex-end; gap: 8px;',
    '  padding: 10px 14px; border-top: 1px solid var(--border, #e5e2dd);',
    '  flex-shrink: 0; background: var(--card-bg, #fff);',
    '}',
    '.chat-input-area textarea {',
    '  flex: 1; border: 1px solid var(--border, #e5e2dd); border-radius: 8px;',
    '  padding: 8px 10px; font-size: 14px; line-height: 1.5; resize: none;',
    '  max-height: 80px; min-height: 36px; outline: none;',
    '  font-family: inherit; background: var(--card-bg, #fff); color: var(--text, #2d2d2d);',
    '  transition: border-color 0.15s;',
    '}',
    '.chat-input-area textarea:focus { border-color: var(--accent, #2563eb); }',
    '.chat-input-area textarea::placeholder { color: var(--text-light, #666); }',
    '.chat-send-btn {',
    '  background: var(--accent, #2563eb); color: #fff; border: none;',
    '  border-radius: 8px; padding: 8px 14px; cursor: pointer;',
    '  font-size: 14px; font-weight: 500; white-space: nowrap;',
    '  transition: opacity 0.15s;',
    '}',
    '.chat-send-btn:hover { opacity: 0.9; }',
    '.chat-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }',

    /* 选中文本浮动按钮 */
    '#course-chat-sel-btn {',
    '  display: none; position: absolute; z-index: 10002;',
    '  background: var(--accent, #2563eb); color: #fff;',
    '  border: none; border-radius: 6px; padding: 4px 10px;',
    '  font-size: 12px; cursor: pointer; white-space: nowrap;',
    '  box-shadow: 0 2px 8px rgba(0,0,0,0.18);',
    '  transition: opacity 0.15s;',
    '}',
    '#course-chat-sel-btn:hover { opacity: 0.9; }',

    /* 欢迎消息 */
    '.chat-welcome {',
    '  text-align: center; color: var(--text-light, #666);',
    '  padding: 20px 10px; font-size: 13px; line-height: 1.8;',
    '}',
    '.chat-welcome-hint {',
    '  font-size: 12px; color: #999; margin-top: 4px;',
    '}',

    /* 错误提示 */
    '.chat-error {',
    '  color: #dc2626; font-size: 13px; padding: 4px 8px;',
    '  background: #fef2f2; border-radius: 6px; margin-top: 4px;',
    '}',

    /* 移动端 */
    '@media (max-width: 600px) {',
    '  #course-chat-window.open {',
    '    width: 100%; height: 100%; bottom: 0; right: 0;',
    '    border-radius: 0; max-height: none;',
    '  }',
    '  .chat-messages { max-height: none; flex: 1; }',
    '  #course-chat-fab { bottom: 16px; right: 16px; }',
    '}',
  ].join('\n');
  document.head.appendChild(style);

  // --- DOM 构建辅助 ---
  function el(tag, className, textContent) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (textContent) e.textContent = textContent;
    return e;
  }

  // --- DOM 构建 ---

  // 浮动按钮
  var fab = document.createElement('button');
  fab.id = 'course-chat-fab';
  fab.title = '问 AI';
  fab.textContent = '?';
  document.body.appendChild(fab);

  // 聊天窗口
  var win = document.createElement('div');
  win.id = 'course-chat-window';

  // 标题栏
  var header = el('div', 'chat-header');
  var titleSpan = el('span', 'chat-header-title', courseName);
  var clearBtn = el('button', 'chat-header-btn');
  clearBtn.title = '清空对话';
  clearBtn.textContent = '\u{1F5D1}';
  var closeBtn = el('button', 'chat-header-btn');
  closeBtn.title = '关闭';
  closeBtn.textContent = '\u00D7';
  header.appendChild(titleSpan);
  header.appendChild(clearBtn);
  header.appendChild(closeBtn);
  win.appendChild(header);

  // 消息列表
  var msgList = el('div', 'chat-messages');

  function buildWelcome() {
    var w = el('div', 'chat-welcome');
    var greeting = isUk
      ? '你好！我是乌克兰语学习助手。'
      : '你好！我是法律英语学习助手。';
    w.appendChild(document.createTextNode(greeting));
    w.appendChild(document.createElement('br'));
    w.appendChild(document.createTextNode('有任何关于本节课的问题都可以问我。'));
    w.appendChild(document.createElement('br'));
    var hint = el('span', 'chat-welcome-hint', '提示：选中页面文字后点击"问 AI"可快速提问');
    w.appendChild(hint);
    return w;
  }

  msgList.appendChild(buildWelcome());
  win.appendChild(msgList);

  // 输入区
  var inputArea = el('div', 'chat-input-area');
  var textarea = document.createElement('textarea');
  textarea.rows = 1;
  textarea.placeholder = '输入你的问题…';
  var sendBtn = el('button', 'chat-send-btn', '发送');
  inputArea.appendChild(textarea);
  inputArea.appendChild(sendBtn);
  win.appendChild(inputArea);

  document.body.appendChild(win);

  // 选中文本浮动按钮
  var selBtn = document.createElement('button');
  selBtn.id = 'course-chat-sel-btn';
  selBtn.textContent = '问 AI';
  document.body.appendChild(selBtn);

  // --- 上下文提取 ---
  function extractLessonContext() {
    var parts = [];
    var title = document.title || '';
    if (title) parts.push('课时标题：' + title);

    var h1 = document.querySelector('h1');
    if (h1 && h1.textContent.trim() !== title.trim()) {
      parts.push('主标题：' + h1.textContent.trim());
    }

    var obj = document.querySelector('.objective');
    if (obj) parts.push('学习目标：' + obj.textContent.trim());

    var h2s = document.querySelectorAll('h2');
    if (h2s.length > 0) {
      var sections = [];
      h2s.forEach(function (h) { sections.push('- ' + h.textContent.trim()); });
      parts.push('章节结构：\n' + sections.join('\n'));
    }

    // 提取词汇表（前 30 个术语）
    var vocabTerms = [];
    document.querySelectorAll('.vocab-row, table tbody tr').forEach(function (row) {
      if (vocabTerms.length >= 30) return;
      var word = row.querySelector('.uk-word, .term');
      if (word) {
        var def = word.getAttribute('data-def') || '';
        vocabTerms.push(word.textContent.trim() + (def ? '（' + def + '）' : ''));
      }
    });
    if (vocabTerms.length) parts.push('本课词汇：' + vocabTerms.join('、'));

    // 提取语法规则要点
    var grammarParts = [];
    document.querySelectorAll('.grammar-box, .tip').forEach(function (box) {
      if (grammarParts.length >= 5) return;
      var text = box.textContent.trim().slice(0, 200);
      if (text) grammarParts.push(text);
    });
    if (grammarParts.length) parts.push('语法要点：\n' + grammarParts.join('\n'));

    // 提取错误警告
    var errorWarns = [];
    document.querySelectorAll('.error-warn').forEach(function (warn) {
      if (errorWarns.length >= 3) return;
      errorWarns.push(warn.textContent.trim().slice(0, 150));
    });
    if (errorWarns.length) parts.push('常见错误提醒：\n' + errorWarns.join('\n'));

    var context = parts.join('\n');
    if (context.length > 3000) context = context.slice(0, 3000) + '\u2026';
    return context;
  }

  function extractExerciseResults() {
    var STATE_VERSION = 8;
    var stateKey = 'exercise_v' + STATE_VERSION + '_' + location.pathname;
    try {
      var raw = localStorage.getItem(stateKey);
      if (!raw) return '';
      var state = JSON.parse(raw);
      var wrongItems = [];

      // 检查 quiz 错误
      document.querySelectorAll('.quiz-item').forEach(function (item, i) {
        var answer = item.getAttribute('data-answer') || '';
        var radioName = item.querySelector('input[type="radio"]');
        if (!radioName) return;
        var name = radioName.name;
        var userAnswer = state.radio && state.radio[name];
        if (userAnswer && userAnswer !== answer) {
          var prompt = item.querySelector('.quiz-prompt');
          wrongItems.push('选择题 ' + (i+1) + '：' +
            (prompt ? prompt.textContent.trim().slice(0, 80) : '') +
            '（你选了 ' + userAnswer + '，正确答案：' + answer + '）');
        }
      });

      // 检查填空错误
      document.querySelectorAll('.fill-blank-item').forEach(function (item, i) {
        var answer = (item.getAttribute('data-answer') || '').trim();
        var key = 'fb' + i;
        var userVal = state.fillBlank && state.fillBlank[key];
        if (userVal && userVal.toLowerCase().trim() !== answer.toLowerCase()) {
          var prompt = item.querySelector('.fill-blank-prompt');
          wrongItems.push('填空题 ' + (i+1) + '：' +
            (prompt ? prompt.textContent.trim().slice(0, 80) : '') +
            '（你填了 ' + userVal + '，正确答案：' + answer + '）');
        }
      });

      if (wrongItems.length) {
        return '\n\n学生做错的练习题：\n' + wrongItems.join('\n');
      }
    } catch (e) {}
    return '';
  }

  function buildSystemPrompt() {
    var context = extractLessonContext();
    var exerciseResults = extractExerciseResults();
    var prompt = basePrompt;
    if (context) {
      prompt += '\n\n当前课时信息：\n' + context;
    }
    if (exerciseResults) {
      prompt += exerciseResults;
      prompt += '\n\n当学生提问时，如果问题与做错的题目相关，可以主动关联分析，帮助他们理解错误原因。';
    }
    return prompt;
  }

  // --- 简易 Markdown 渲染 ---
  // 安全说明：先转义 HTML 实体（&, <, >），再应用 markdown 变换，
  // 因此不可能注入任意 HTML 标签。来源为 DeepSeek API 响应（受控），
  // 用户输入使用 textContent 渲染（不经过此函数）。
  function renderMarkdown(text) {
    var html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 代码块
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
      return '<pre><code>' + code.trim() + '</code></pre>';
    });

    // 行内代码
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 加粗
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // 换行
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  // --- 消息渲染 ---
  function addMessage(role, content) {
    // 移除欢迎消息
    var welcome = msgList.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    var msgDiv = el('div', 'chat-msg ' + role);
    var bubble = el('div', 'chat-bubble');

    if (role === 'assistant') {
      // AI 响应：HTML 已转义后的 markdown 渲染（安全，见 renderMarkdown 注释）
      bubble.innerHTML = renderMarkdown(content); // eslint-disable-line
    } else {
      bubble.textContent = content;
    }

    msgDiv.appendChild(bubble);
    msgList.appendChild(msgDiv);
    msgList.scrollTop = msgList.scrollHeight;
    return bubble;
  }

  // 创建流式消息占位
  function addStreamingMessage() {
    var welcome = msgList.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    var msgDiv = el('div', 'chat-msg assistant');
    var bubble = el('div', 'chat-bubble');
    var loading = el('span', 'chat-loading');
    bubble.appendChild(loading);
    msgDiv.appendChild(bubble);
    msgList.appendChild(msgDiv);
    msgList.scrollTop = msgList.scrollHeight;
    return { bubble: bubble, loading: loading };
  }

  // --- 流式 API 调用 ---
  function streamChat(userText) {
    if (isStreaming) return;
    isStreaming = true;
    sendBtn.disabled = true;
    sendBtn.textContent = '\u2026';

    // 添加用户消息
    addMessage('user', userText);
    chatHistory.push({ role: 'user', content: userText });

    // 截断历史（保留最近 MAX_HISTORY_ROUNDS 轮）
    var maxMessages = MAX_HISTORY_ROUNDS * 2;
    if (chatHistory.length > maxMessages) {
      chatHistory = chatHistory.slice(chatHistory.length - maxMessages);
    }

    // 构建消息
    var messages = [{ role: 'system', content: buildSystemPrompt() }];
    messages = messages.concat(chatHistory);

    // 创建流式占位
    var streamEl = addStreamingMessage();
    var fullContent = '';

    abortController = new AbortController();

    fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: messages,
        temperature: 0.7,
        stream: true
      }),
      signal: abortController.signal
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('API \u8BF7\u6C42\u5931\u8D25: ' + response.status);
      }
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      function read() {
        reader.read().then(function (result) {
          if (result.done) {
            finish();
            return;
          }
          buffer += decoder.decode(result.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop();

          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line.startsWith('data: ')) continue;
            var data = line.slice(6);
            if (data === '[DONE]') {
              finish();
              return;
            }
            try {
              var json = JSON.parse(data);
              var delta = json.choices[0].delta;
              if (delta && delta.content) {
                fullContent += delta.content;
                if (streamEl.loading && streamEl.loading.parentNode) {
                  streamEl.loading.remove();
                }
                // AI 响应流式渲染（HTML 已转义，安全，见 renderMarkdown 注释）
                streamEl.bubble.innerHTML = renderMarkdown(fullContent); // eslint-disable-line
                msgList.scrollTop = msgList.scrollHeight;
              }
            } catch (e) { /* 忽略解析错误 */ }
          }
          read();
        }).catch(function (err) {
          if (err.name !== 'AbortError') {
            showError(streamEl.bubble, err.message);
          }
          finish();
        });
      }

      read();
    }).catch(function (err) {
      if (err.name !== 'AbortError') {
        showError(streamEl.bubble, err.message);
      }
      finish();
    });

    function finish() {
      if (fullContent) {
        chatHistory.push({ role: 'assistant', content: fullContent });
      }
      if (streamEl.loading && streamEl.loading.parentNode) {
        streamEl.loading.remove();
      }
      if (!fullContent && streamEl.bubble) {
        streamEl.bubble.textContent = '';
        var errSpan = el('span', 'chat-error', '未收到回复，请重试');
        streamEl.bubble.appendChild(errSpan);
      }
      isStreaming = false;
      abortController = null;
      sendBtn.disabled = false;
      sendBtn.textContent = '发送';
      textarea.focus();
    }
  }

  function showError(bubble, msg) {
    var loading = bubble.querySelector('.chat-loading');
    if (loading) loading.remove();
    var err = el('div', 'chat-error', '出错了：' + msg);
    bubble.appendChild(err);
  }

  // --- 窗口开关 ---
  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      win.classList.add('open');
      fab.textContent = '\u00D7';
      textarea.focus();
    } else {
      win.classList.remove('open');
      fab.textContent = '?';
    }
  }

  function openChat() {
    if (!isOpen) toggleChat();
  }

  // --- 清空对话 ---
  function clearChat() {
    if (isStreaming && abortController) {
      abortController.abort();
    }
    chatHistory = [];
    msgList.textContent = '';
    msgList.appendChild(buildWelcome());
    isStreaming = false;
    sendBtn.disabled = false;
    sendBtn.textContent = '发送';
  }

  // --- 发送消息 ---
  function send() {
    var text = textarea.value.trim();
    if (!text || isStreaming) return;
    textarea.value = '';
    textarea.style.height = 'auto';
    streamChat(text);
  }

  // --- 事件绑定 ---
  fab.addEventListener('click', toggleChat);
  closeBtn.addEventListener('click', toggleChat);
  clearBtn.addEventListener('click', clearChat);
  sendBtn.addEventListener('click', send);

  textarea.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  // textarea 自动高度
  textarea.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });

  // ESC 关闭
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) toggleChat();
  });

  // --- 文本选中交互 ---
  var selectedText = '';

  document.addEventListener('mouseup', function (e) {
    // 忽略聊天窗口内的选中
    if (win.contains(e.target) || fab.contains(e.target) || selBtn.contains(e.target)) return;

    setTimeout(function () {
      var sel = window.getSelection();
      var text = sel ? sel.toString().trim() : '';

      if (text.length > 2 && text.length < 500) {
        selectedText = text;
        selBtn.style.display = 'block';
        var x = Math.min(e.pageX + 10, window.innerWidth - 80);
        var y = e.pageY - 36;
        selBtn.style.left = x + 'px';
        selBtn.style.top = y + 'px';
      } else {
        selBtn.style.display = 'none';
        selectedText = '';
      }
    }, 10);
  });

  // 点击其他区域隐藏选中按钮
  document.addEventListener('mousedown', function (e) {
    if (e.target !== selBtn) {
      selBtn.style.display = 'none';
    }
  });

  selBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    selBtn.style.display = 'none';
    openChat();
    textarea.value = '关于以下内容：\n"' + selectedText + '"\n\n请解释一下。';
    textarea.focus();
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
    selectedText = '';
    window.getSelection().removeAllRanges();
  });
})();

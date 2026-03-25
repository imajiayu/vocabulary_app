/**
 * 单词交互气泡 — 点击 .uk-word / .term 弹出 popover
 *
 * 功能：显示释义、发音、选择 source、添加到单词库
 * 依赖：auth.js（可选）、tts.js（CourseTTS.speak）
 * 释义来源：元素 data-def 属性 → Supabase words 表
 * source 选择与 vocab.js 共享 localStorage key（vocab_selected_source）
 */
(function () {
  var lang = (document.documentElement.lang || 'en').toLowerCase().slice(0, 2);
  var wordSelector = lang === 'uk' ? '.uk-word' : '.term';
  var DEFAULT_SOURCE = lang === 'uk' ? 'UKA' : 'IELTS';
  var SOURCE_STORAGE_KEY = 'vocab_selected_source';

  // --- Source 管理（与 vocab.js 共享）---
  var sourceList = [];
  var sourceListLoaded = false;

  function getSelectedSource() {
    try {
      return localStorage.getItem(SOURCE_STORAGE_KEY) || DEFAULT_SOURCE;
    } catch (e) {
      return DEFAULT_SOURCE;
    }
  }

  function setSelectedSource(val) {
    try { localStorage.setItem(SOURCE_STORAGE_KEY, val); } catch (e) {}
  }

  function loadSourceList() {
    if (sourceListLoaded) return Promise.resolve(sourceList);
    var auth = window.CourseAuth && window.CourseAuth.getAuth();
    if (!auth) {
      sourceList = [DEFAULT_SOURCE];
      sourceListLoaded = true;
      return Promise.resolve(sourceList);
    }
    return window.CourseAuth.supabaseFetch(
      '/rest/v1/word_source_stats?select=source&user_id=eq.' + auth.userId + '&order=source'
    ).then(function (r) { return r.json(); })
      .then(function (rows) {
        if (Array.isArray(rows)) {
          sourceList = rows.map(function (r) { return r.source; }).filter(Boolean);
        }
        if (sourceList.indexOf(DEFAULT_SOURCE) < 0) {
          sourceList.unshift(DEFAULT_SOURCE);
        }
        sourceListLoaded = true;
        return sourceList;
      }).catch(function () {
        sourceList = [DEFAULT_SOURCE];
        sourceListLoaded = true;
        return sourceList;
      });
  }

  // --- 添加单词到 Supabase ---
  function addWord(word, def) {
    var auth = window.CourseAuth && window.CourseAuth.getAuth();
    if (!auth) return Promise.reject(new Error('未登录'));
    var today = new Date().toISOString().slice(0, 10);
    var body = {
      user_id: auth.userId,
      word: word.normalize('NFC').trim().toLowerCase(),
      source: getSelectedSource(),
      date_added: today,
      next_review: today,
      stop_review: false
    };
    if (lang === 'en' && def) {
      body.definition = def;
    }
    return window.CourseAuth.supabaseFetch('/rest/v1/words', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (r.status === 201 || r.status === 409) return 'ok';
      throw new Error(r.status);
    });
  }

  // --- Popover ---
  var popoverEl = null;
  var activeWordEl = null;
  var popoverRefs = {};

  function createPopover() {
    if (popoverEl) return popoverEl;

    var root = document.createElement('div');
    root.className = 'word-popover';

    // 单词
    var wordDiv = document.createElement('div');
    wordDiv.className = 'word-popover-word';
    root.appendChild(wordDiv);
    popoverRefs.word = wordDiv;

    // 释义
    var defDiv = document.createElement('div');
    defDiv.className = 'word-popover-def';
    defDiv.textContent = '';
    root.appendChild(defDiv);
    popoverRefs.def = defDiv;

    // Source 选择行
    var sourceRow = document.createElement('div');
    sourceRow.className = 'word-popover-source';
    var sourceLabel = document.createElement('span');
    sourceLabel.textContent = '添加到：';
    sourceRow.appendChild(sourceLabel);
    var sourceSelect = document.createElement('select');
    sourceSelect.className = 'word-popover-source-select';
    sourceRow.appendChild(sourceSelect);
    root.appendChild(sourceRow);
    popoverRefs.sourceRow = sourceRow;
    popoverRefs.sourceSelect = sourceSelect;

    sourceSelect.addEventListener('change', function (e) {
      e.stopPropagation();
      setSelectedSource(sourceSelect.value);
    });
    sourceSelect.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    // 操作按钮
    var actions = document.createElement('div');
    actions.className = 'word-popover-actions';

    var speakBtn = document.createElement('button');
    speakBtn.className = 'word-popover-btn word-popover-speak';
    speakBtn.title = '发音';
    speakBtn.textContent = '🔊';
    actions.appendChild(speakBtn);

    var addBtn = document.createElement('button');
    addBtn.className = 'word-popover-btn word-popover-add';
    addBtn.title = '添加到单词库';
    addBtn.textContent = '➕';
    actions.appendChild(addBtn);
    popoverRefs.addBtn = addBtn;

    root.appendChild(actions);
    document.body.appendChild(root);
    popoverEl = root;

    // 发音
    speakBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var word = popoverRefs.word.textContent;
      if (word && window.CourseTTS) window.CourseTTS.speak(word, this);
    });

    // 添加
    addBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (addBtn.disabled) return;
      var auth = window.CourseAuth && window.CourseAuth.getAuth();
      if (!auth) {
        addBtn.textContent = '请先登录';
        addBtn.classList.add('word-popover-no-auth');
        setTimeout(function () {
          addBtn.textContent = '➕';
          addBtn.classList.remove('word-popover-no-auth');
        }, 2000);
        return;
      }
      addBtn.disabled = true;
      addBtn.textContent = '…';
      var word = popoverRefs.word.textContent;
      var def = popoverRefs.def.textContent;
      if (def === '无释义') def = '';
      addWord(word, def).then(function () {
        addBtn.textContent = '✓';
        addBtn.classList.add('word-popover-added');
      }).catch(function () {
        addBtn.textContent = '✗';
        setTimeout(function () { addBtn.textContent = '➕'; addBtn.disabled = false; }, 1500);
      });
    });

    return root;
  }

  function populateSourceSelect() {
    var select = popoverRefs.sourceSelect;
    var current = getSelectedSource();
    // 只在 source 列表变化时重建 options
    var optValues = Array.from(select.options).map(function (o) { return o.value; });
    if (optValues.length === sourceList.length &&
        optValues.every(function (v, i) { return v === sourceList[i]; })) {
      select.value = current;
      return;
    }
    select.textContent = '';
    sourceList.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      if (s === current) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function showPopover(wordEl) {
    var pop = createPopover();
    var word = wordEl.textContent.trim()
      .replace(/[.,!?;:…—–\-"«»()"。，！？：；]/g, '').trim();
    if (!word) return;

    activeWordEl = wordEl;
    popoverRefs.word.textContent = word;
    popoverRefs.def.textContent = '';

    // 重置添加按钮
    popoverRefs.addBtn.disabled = false;
    popoverRefs.addBtn.textContent = '➕';
    popoverRefs.addBtn.classList.remove('word-popover-added');
    popoverRefs.addBtn.classList.remove('word-popover-no-auth');

    // 填充 source 下拉框
    populateSourceSelect();

    // 定位
    pop.style.display = 'block';
    pop.style.opacity = '0';
    var rect = wordEl.getBoundingClientRect();
    var popW = pop.offsetWidth;
    var popH = pop.offsetHeight;
    var left = rect.left + rect.width / 2 - popW / 2;
    var top = rect.top - popH - 8;
    if (left < 8) left = 8;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    if (top < 8) top = rect.bottom + 8;
    pop.style.left = (left + window.scrollX) + 'px';
    pop.style.top = (top + window.scrollY) + 'px';
    pop.style.opacity = '1';

    // 释义：直接从 data-def 属性读取
    popoverRefs.def.textContent = wordEl.getAttribute('data-def') || '无释义';
  }

  function hidePopover() {
    if (popoverEl) {
      popoverEl.style.display = 'none';
      popoverEl.style.opacity = '0';
    }
    activeWordEl = null;
  }

  // --- 绑定事件 ---
  function bindWords() {
    // .uk-word / .term + .tts-word（句子中拆出的单词）
    document.querySelectorAll(wordSelector + ', .tts-word').forEach(function (el) {
      if (el.dataset.wordBound) return;
      if (el.closest('.quiz-options')) return;
      el.dataset.wordBound = '1';
      el.style.cursor = 'pointer';
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        if (activeWordEl === this) {
          hidePopover();
        } else {
          showPopover(this);
        }
      });
    });
  }

  document.addEventListener('click', function (e) {
    if (popoverEl && !popoverEl.contains(e.target)) hidePopover();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hidePopover();
  });

  // --- 初始化 ---
  function init() {
    loadSourceList();
    bindWords();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.CourseWordInteraction = { bindWords: bindWords };
})();

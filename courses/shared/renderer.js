/**
 * 课程渲染器 — 从 JSON 数据构建课时 DOM
 *
 * 用法：<script>CourseRenderer.load('w1d2.json')</script>
 *
 * 安全说明：本渲染器中的 innerHTML 仅用于课程 JSON 中的受控内容
 * （由 AI 生成并提交到 git 仓库），不包含任何用户输入。
 *
 * JSON section types:
 *   vocab-preload, vocab-table, grammar, examples,
 *   exercises, summary, sentence-analysis
 */
(function () {
  'use strict';

  var lang = (document.documentElement.lang || 'en').toLowerCase().slice(0, 2);
  var wordClass = lang === 'uk' ? 'uk-word' : 'term';
  var textClass = lang === 'uk' ? 'uk-text' : 'en-text';

  // --- 工具函数 ---
  // setContent: 课程 JSON 中的 html 字段包含受控的内联标签
  // （<span class="uk-word">, <strong>, <em>, <code>），非用户输入
  function setContent(element, textOrHtml) {
    if (typeof textOrHtml === 'string' && /<[a-z][\s\S]*>/i.test(textOrHtml)) {
      element.innerHTML = textOrHtml;
    } else {
      element.textContent = textOrHtml || '';
    }
  }

  function el(tag, cls, content) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (content !== undefined) setContent(e, content);
    return e;
  }

  function append(parent) {
    for (var i = 1; i < arguments.length; i++) {
      if (arguments[i]) parent.appendChild(arguments[i]);
    }
    return parent;
  }

  // --- Section 渲染器 ---

  function renderVocabPreload(sec) {
    var frag = document.createDocumentFragment();

    // vocab-actions bar
    var actions = el('div', 'vocab-actions');
    var addBtn = el('button', 'add-all-btn', '一键添加到背单词 App');
    addBtn.id = 'add-all-btn';
    actions.appendChild(addBtn);
    var prog = el('div', 'vocab-progress');
    var track = el('div', 'vocab-progress-track');
    var bar = document.createElement('div');
    bar.id = 'vocab-progress-bar';
    bar.style.width = '0%';
    track.appendChild(bar);
    prog.appendChild(track);
    var progText = el('div', 'vocab-progress-text');
    progText.textContent = '已添加：';
    var countSpan = document.createElement('span');
    countSpan.id = 'vocab-count';
    countSpan.textContent = '0/0';
    progText.appendChild(countSpan);
    prog.appendChild(progText);
    actions.appendChild(prog);
    frag.appendChild(actions);

    (sec.groups || []).forEach(function (group) {
      if (group.heading) frag.appendChild(el('h2', '', group.heading));
      var grid = el('div', 'vocab-grid');
      (group.words || []).forEach(function (w) {
        var row = el('div', 'vocab-row');
        row.dataset.word = w.word;
        var wordSpan = el('span', wordClass, w.word);
        if (w.def) wordSpan.setAttribute('data-def', w.def);
        append(row,
          wordSpan,
          el('span', 'vocab-def', w.def),
          el('span', 'vocab-status')
        );
        grid.appendChild(row);
      });
      frag.appendChild(grid);
    });
    return frag;
  }

  function renderVocabTable(sec) {
    var frag = document.createDocumentFragment();
    if (sec.heading) frag.appendChild(el('h2', '', sec.heading));
    if (sec.intro) frag.appendChild(el('p', '', sec.intro));

    var table = document.createElement('table');
    var thead = document.createElement('thead');
    var tr = document.createElement('tr');
    (sec.columns || []).forEach(function (col) {
      tr.appendChild(el('th', '', col));
    });
    thead.appendChild(tr);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    (sec.rows || []).forEach(function (row) {
      var rtr = document.createElement('tr');
      row.forEach(function (cell, i) {
        var td = el('td', i === 0 ? wordClass : '', cell);
        rtr.appendChild(td);
      });
      tbody.appendChild(rtr);
    });
    table.appendChild(tbody);
    frag.appendChild(table);
    return frag;
  }

  function renderBlock(block) {
    switch (block.type) {
      case 'p':
        return el('p', '', block.html || block.text || '');
      case 'h3':
        return el('h3', '', block.text || '');
      case 'h4':
        return el('h4', '', block.text || '');
      case 'tip':
        return el('div', 'tip', block.html || block.text || '');
      case 'note':
        return el('div', 'note', block.html || block.text || '');
      case 'error-warn':
        return el('div', 'error-warn', block.html || block.text || '');
      case 'grammar-box':
        return el('div', 'grammar-box', block.html || block.text || '');
      case 'ul':
      case 'ol': {
        var list = document.createElement(block.type);
        (block.items || []).forEach(function (item) {
          list.appendChild(el('li', '', item));
        });
        return list;
      }
      case 'table': {
        var t = document.createElement('table');
        if (block.headers) {
          var th = document.createElement('thead');
          var hr = document.createElement('tr');
          block.headers.forEach(function (h) { hr.appendChild(el('th', '', h)); });
          th.appendChild(hr);
          t.appendChild(th);
        }
        var tb = document.createElement('tbody');
        (block.rows || []).forEach(function (row) {
          var rr = document.createElement('tr');
          row.forEach(function (cell, i) {
            var cls = (i === 0 && block.firstColWord) ? wordClass : '';
            rr.appendChild(el('td', cls, cell));
          });
          tb.appendChild(rr);
        });
        t.appendChild(tb);
        return t;
      }
      case 'details': {
        var det = document.createElement('details');
        var sum = document.createElement('summary');
        sum.textContent = block.summary || '查看答案';
        det.appendChild(sum);
        var content = el('div', 'answer-content', block.html || '');
        det.appendChild(content);
        return det;
      }
      default:
        return el('p', '', block.html || block.text || '');
    }
  }

  function renderGrammar(sec) {
    var frag = document.createDocumentFragment();
    if (sec.heading) frag.appendChild(el('h2', '', sec.heading));
    (sec.blocks || []).forEach(function (block) {
      frag.appendChild(renderBlock(block));
    });
    return frag;
  }

  function renderExamples(sec) {
    var frag = document.createDocumentFragment();
    if (sec.heading) frag.appendChild(el('h2', '', sec.heading));
    if (sec.intro) frag.appendChild(el('p', '', sec.intro));

    (sec.groups || [sec]).forEach(function (group) {
      if (group.heading) frag.appendChild(el('h3', '', group.heading));
      (group.items || []).forEach(function (item, i) {
        var p = el('p', 'example');
        p.appendChild(document.createTextNode((i + 1) + '. '));
        p.appendChild(el('span', textClass, item.text));
        p.appendChild(document.createTextNode(' '));
        p.appendChild(el('span', 'translation', '\u2014 ' + item.translation));
        frag.appendChild(p);
      });
    });
    return frag;
  }

  function renderExercises(sec) {
    var frag = document.createDocumentFragment();
    if (sec.heading) frag.appendChild(el('h2', '', sec.heading));

    (sec.groups || []).forEach(function (group, gIdx) {
      if (group.style === 'quiz') {
        var exDiv = el('div', 'exercise');
        if (group.title) exDiv.appendChild(el('h3', '', group.title));
        if (group.instruction) exDiv.appendChild(el('p', '', group.instruction));

        (group.questions || []).forEach(function (q, qIdx) {
          var qItem = el('div', 'quiz-item');
          qItem.dataset.answer = q.answer;
          qItem.dataset.explanation = q.explanation || '';
          if (q.hints) qItem.dataset.hints = JSON.stringify(q.hints);

          qItem.appendChild(el('div', 'quiz-prompt',
            (qIdx + 1) + '. ' + (q.prompt || '')));

          var opts = el('div', 'quiz-options');
          var nameBase = 'g' + gIdx + 'q' + qIdx;
          (q.options || []).forEach(function (opt) {
            var label = document.createElement('label');
            var input = document.createElement('input');
            input.type = 'radio';
            input.name = nameBase;
            // strip HTML for value
            input.value = opt.replace(/<[^>]*>/g, '').trim();
            label.appendChild(input);
            var optSpan = document.createElement('span');
            setContent(optSpan, ' ' + opt);
            label.appendChild(optSpan);
            opts.appendChild(label);
          });
          qItem.appendChild(opts);
          exDiv.appendChild(qItem);
        });

        exDiv.appendChild(el('button', 'grade-btn', '判题')).disabled = true;
        frag.appendChild(exDiv);

      } else if (group.style === 'fill-blank') {
        var fbDiv = el('div', 'exercise fill-blank-exercise');
        if (group.title) fbDiv.appendChild(el('h3', '', group.title));
        if (group.instruction) fbDiv.appendChild(el('p', '', group.instruction));

        (group.questions || []).forEach(function (q, qIdx) {
          var fbItem = el('div', 'fill-blank-item');
          fbItem.dataset.answer = q.answer;
          if (q.accept) fbItem.dataset.accept = JSON.stringify(q.accept);
          fbItem.dataset.explanation = q.explanation || '';
          if (q.hints) fbItem.dataset.hints = JSON.stringify(q.hints);

          // 构建 prompt，将 ____ 替换为 input
          var promptDiv = el('div', 'fill-blank-prompt');
          var promptText = (qIdx + 1) + '. ' + (q.prompt || '');
          var parts = promptText.split('____');
          for (var pi = 0; pi < parts.length; pi++) {
            var span = document.createElement('span');
            setContent(span, parts[pi]);
            promptDiv.appendChild(span);
            if (pi < parts.length - 1) {
              var input = document.createElement('input');
              input.type = 'text';
              input.className = 'fill-blank-input';
              input.autocomplete = 'off';
              input.spellcheck = false;
              promptDiv.appendChild(input);
            }
          }
          fbItem.appendChild(promptDiv);
          fbDiv.appendChild(fbItem);
        });

        fbDiv.appendChild(el('button', 'grade-btn', '判题')).disabled = true;
        frag.appendChild(fbDiv);

      } else if (group.style === 'translation') {
        var texDiv = el('div', 'exercise translation-exercise');
        if (group.title) texDiv.appendChild(el('h3', '', group.title));
        if (group.instruction) texDiv.appendChild(el('p', '', group.instruction));

        (group.questions || []).forEach(function (q) {
          var tItem = el('div', 'translate-item');
          tItem.dataset.source = q.source || '';
          tItem.dataset.reference = q.reference || '';
          if (q.rubric) tItem.dataset.rubric = JSON.stringify(q.rubric);
          if (q.keyPoints) tItem.dataset.keyPoints = q.keyPoints;

          var src = el('div', 'source-text');
          src.appendChild(el('span', textClass, q.source || ''));
          tItem.appendChild(src);

          var textarea = document.createElement('textarea');
          textarea.placeholder = '在此输入译文…';
          tItem.appendChild(textarea);
          texDiv.appendChild(tItem);
        });

        var checkBtn = el('button', 'check-translation-btn', '提交批改');
        checkBtn.disabled = true;
        texDiv.appendChild(checkBtn);
        frag.appendChild(texDiv);
      }
    });
    return frag;
  }

  function renderSummary(sec) {
    var frag = document.createDocumentFragment();
    if (sec.heading) frag.appendChild(el('h2', '', sec.heading));
    var box;
    if (sec.html) {
      box = el('div', 'summary-box', sec.html);
    } else {
      box = el('div', 'summary-box');
      if (sec.points) {
        var ol = document.createElement('ol');
        sec.points.forEach(function (pt) { ol.appendChild(el('li', '', pt)); });
        box.appendChild(ol);
      }
      if (sec.next) {
        var p = el('p', '');
        setContent(p, '<strong>下节预告：</strong>' + sec.next);
        box.appendChild(p);
      }
    }
    frag.appendChild(box);
    return frag;
  }

  function renderSentenceAnalysis(sec) {
    var frag = document.createDocumentFragment();
    if (sec.heading) frag.appendChild(el('h2', '', sec.heading));
    (sec.items || []).forEach(function (item, i) {
      var box = el('div', 'sentence-analysis');
      box.appendChild(el('h3', '', item.title || ('\u957f\u96be\u53e5 ' + (i + 1))));
      if (item.sentence) {
        var bq = document.createElement('blockquote');
        bq.appendChild(el('span', textClass, item.sentence));
        box.appendChild(bq);
      }
      if (item.structure) {
        var ul = el('ul', 'structure');
        item.structure.forEach(function (s) { ul.appendChild(el('li', '', s)); });
        box.appendChild(ul);
      }
      if (item.translation) {
        var div = el('div', 'full-translation');
        setContent(div, '<strong>\u7ffb\u8bd1\uff1a</strong>' + item.translation);
        box.appendChild(div);
      }
      frag.appendChild(box);
    });
    return frag;
  }

  // --- Section 分发 ---
  var renderers = {
    'vocab-preload': renderVocabPreload,
    'vocab-table': renderVocabTable,
    'grammar': renderGrammar,
    'examples': renderExamples,
    'exercises': renderExercises,
    'summary': renderSummary,
    'sentence-analysis': renderSentenceAnalysis
  };

  // --- 动态加载脚本 ---
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  // --- 主入口 ---
  function load(jsonFile, opts) {
    opts = opts || {};
    return fetch(jsonFile).then(function (r) {
      if (!r.ok) throw new Error('Failed to load ' + jsonFile + ': ' + r.status);
      return r.json();
    }).then(function (data) {
      document.title = data.title || '';

      var container = document.createDocumentFragment();
      container.appendChild(el('h1', '', data.title));

      if (data.objective) {
        var obj = el('div', 'objective');
        setContent(obj, '<strong>\u5b66\u4e60\u76ee\u6807\uff1a</strong>' + data.objective);
        container.appendChild(obj);
      }

      (data.sections || []).forEach(function (sec) {
        var fn = renderers[sec.type];
        if (fn) {
          container.appendChild(fn(sec));
        } else {
          console.warn('Unknown section type:', sec.type);
        }
      });

      document.body.appendChild(container);

      // 确定需要的脚本
      var scripts = ['templates/tts.js', 'templates/wordInteraction.js'];
      var hasExercise = data.sections.some(function (s) { return s.type === 'exercises'; });
      var hasVocab = data.sections.some(function (s) { return s.type === 'vocab-preload'; });
      if (hasExercise) scripts.push('templates/exercise.js');
      if (hasVocab) scripts.push('templates/vocab.js');
      scripts.push('templates/nav.js');
      scripts.push('templates/chat.js');

      // 顺序加载（确保依赖关系）
      return scripts.reduce(function (chain, src) {
        return chain.then(function () { return loadScript(src); });
      }, Promise.resolve());
    }).then(function () {
      document.dispatchEvent(new Event('lesson-rendered'));
    }).catch(function (err) {
      console.error('CourseRenderer error:', err);
      document.body.appendChild(el('div', 'error-warn',
        '\u8bfe\u65f6\u52a0\u8f7d\u5931\u8d25\uff1a' + err.message));
    });
  }

  window.CourseRenderer = { load: load };
})();

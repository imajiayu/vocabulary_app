/* === 交互式练习判题脚本（含翻译详细批改 + localStorage 持久化） === */

(function () {
  // --- localStorage 持久化工具 ---
  var STATE_VERSION = 7;
  var pageKey = 'exercise_v' + STATE_VERSION + '_' + location.pathname;

  // 清除旧版本数据
  try {
    localStorage.removeItem('exercise_' + location.pathname);
    for (var v = 1; v < STATE_VERSION; v++) {
      localStorage.removeItem('exercise_v' + v + '_' + location.pathname);
    }
  } catch (e) {}

  // 模块级状态（持久化到 localStorage）
  var currentState = {
    radio: {},
    textarea: {},
    quizGraded: [],
    translateGraded: [],
    aiResults: {}
  };

  function saveState() {
    currentState.radio = {};
    document.querySelectorAll('.quiz-item input[type="radio"]:checked').forEach(function (r) {
      currentState.radio[r.name] = r.value;
    });
    currentState.textarea = {};
    document.querySelectorAll('.translate-item textarea').forEach(function (ta, i) {
      currentState.textarea['t' + i] = ta.value;
    });
    try { localStorage.setItem(pageKey, JSON.stringify(currentState)); } catch (e) {}
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(pageKey);
      if (raw) {
        var parsed = JSON.parse(raw);
        currentState = {
          radio: parsed.radio || {},
          textarea: parsed.textarea || {},
          quizGraded: parsed.quizGraded || [],
          translateGraded: parsed.translateGraded || [],
          aiResults: parsed.aiResults || {}
        };
        return currentState;
      }
      return null;
    } catch (e) { return null; }
  }

  // --- 文本工具 ---
  function normalize(s) {
    return s.toLowerCase()
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/[.,;:!?，。；：！？、（）()\[\]【】{}"'"'—\-–…]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // --- 详细翻译批改（data-rubric 格式） ---
  // rubric 格式：JSON 数组
  // [{"en":"term","ideal":"最佳翻译","accept":["可接受1","可接受2"],"wrong":["常见错误"],"note":"知识点说明"}]
  function gradeWithRubric(userText, rubric) {
    var normUser = normalize(userText);
    var results = [];
    var totalPoints = rubric.length;
    var score = 0;

    rubric.forEach(function (item) {
      var entry = { en: item.en, ideal: item.ideal, note: item.note || '', status: 'missing' };

      // 检查是否有常见错误
      if (item.wrong && item.wrong.length) {
        for (var w = 0; w < item.wrong.length; w++) {
          if (normUser.indexOf(normalize(item.wrong[w])) >= 0) {
            entry.status = 'error';
            entry.errorText = item.wrong[w];
            break;
          }
        }
      }

      // 检查理想翻译
      var ideals = item.ideal.split('/').map(function (s) { return normalize(s.trim()); }).filter(Boolean);
      for (var i = 0; i < ideals.length; i++) {
        if (normUser.indexOf(ideals[i]) >= 0) {
          entry.status = 'perfect';
          score += 1;
          break;
        }
      }

      // 如果没有完美匹配，检查可接受的翻译
      if (entry.status !== 'perfect' && item.accept && item.accept.length) {
        for (var a = 0; a < item.accept.length; a++) {
          var acceptNorms = item.accept[a].split('/').map(function (s) { return normalize(s.trim()); });
          for (var an = 0; an < acceptNorms.length; an++) {
            if (normUser.indexOf(acceptNorms[an]) >= 0) {
              entry.status = 'acceptable';
              entry.acceptText = item.accept[a];
              score += 0.7;
              break;
            }
          }
          if (entry.status === 'acceptable') break;
        }
      }

      // 也检查英文原文是否被直接使用（部分分）
      if (entry.status === 'missing' || entry.status === 'error') {
        var enNorm = normalize(item.en);
        if (enNorm.length > 3 && normUser.indexOf(enNorm) >= 0) {
          if (entry.status !== 'error') {
            entry.status = 'acceptable';
            entry.acceptText = item.en + '（原文）';
            score += 0.3;
          }
        }
      }

      results.push(entry);
    });

    return { score: score, total: totalPoints, results: results };
  }

  // --- 简单批改（data-key-points 格式，向后兼容） ---
  function gradeWithKeyPoints(userText, keyPointsStr) {
    var normUser = normalize(userText);
    var pairs = keyPointsStr.split('；').filter(Boolean);
    var rubric = pairs.map(function (pair) {
      var parts = pair.split('=').map(function (s) { return s.trim(); });
      return { en: parts[0] || '', ideal: parts[1] || '', accept: [], wrong: [], note: '' };
    });
    return gradeWithRubric(userText, rubric);
  }

  // --- 构建批改结果 HTML ---
  function buildGradeFeedback(item, userText) {
    var reference = item.getAttribute('data-reference');
    var rubricStr = item.getAttribute('data-rubric');
    var keyPoints = item.getAttribute('data-key-points');

    var feedbackDiv = item.querySelector('.translate-feedback');
    if (!feedbackDiv) {
      feedbackDiv = document.createElement('div');
      feedbackDiv.className = 'translate-feedback';
      item.appendChild(feedbackDiv);
    }
    feedbackDiv.textContent = '';

    // 评分
    var grade = null;
    if (userText.trim()) {
      if (rubricStr) {
        try { grade = gradeWithRubric(userText, JSON.parse(rubricStr)); } catch (e) {}
      }
      if (!grade && keyPoints) {
        grade = gradeWithKeyPoints(userText, keyPoints);
      }
    }

    // 评分结果
    if (grade) {
      var pct = grade.total > 0 ? Math.round(grade.score / grade.total * 100) : 0;
      var emoji = pct >= 90 ? '🎉' : pct >= 70 ? '👍' : pct >= 50 ? '💪' : '📚';

      var scoreDiv = document.createElement('div');
      scoreDiv.className = 'grade-score';
      var scoreStrong = document.createElement('strong');
      scoreStrong.textContent = emoji + ' 评分：' + pct + '分';
      scoreDiv.appendChild(scoreStrong);
      if (pct >= 70) scoreDiv.appendChild(document.createTextNode(' 核心意思正确！'));
      feedbackDiv.appendChild(scoreDiv);

      // 逐条批改
      var detailsDiv = document.createElement('div');
      detailsDiv.className = 'grade-details';
      grade.results.forEach(function (r) {
        var itemDiv = document.createElement('div');
        if (r.status === 'perfect') {
          itemDiv.className = 'grade-item grade-perfect';
          var code = document.createElement('code');
          code.textContent = r.en;
          itemDiv.appendChild(document.createTextNode('✅ '));
          itemDiv.appendChild(code);
          itemDiv.appendChild(document.createTextNode(' → ' + r.ideal + ' ✓'));
        } else if (r.status === 'acceptable') {
          itemDiv.className = 'grade-item grade-acceptable';
          var code = document.createElement('code');
          code.textContent = r.en;
          itemDiv.appendChild(document.createTextNode('⚠️ '));
          itemDiv.appendChild(code);
          itemDiv.appendChild(document.createTextNode(' → 你译为「' + (r.acceptText || '') + '」'));
          var br1 = document.createElement('br');
          itemDiv.appendChild(br1);
          var em1 = document.createElement('em');
          em1.textContent = r.ideal;
          itemDiv.appendChild(document.createTextNode('\u00A0\u00A0\u00A0\u00A0✅ 更规范的法律表达：'));
          itemDiv.appendChild(em1);
          if (r.note) {
            var br2 = document.createElement('br');
            itemDiv.appendChild(br2);
            itemDiv.appendChild(document.createTextNode('\u00A0\u00A0\u00A0\u00A0💡 ' + r.note));
          }
        } else if (r.status === 'error') {
          itemDiv.className = 'grade-item grade-error';
          var code = document.createElement('code');
          code.textContent = r.en;
          itemDiv.appendChild(document.createTextNode('❌ '));
          itemDiv.appendChild(code);
          itemDiv.appendChild(document.createTextNode(' → 你译为「' + (r.errorText || '') + '」← 翻译有误'));
          var br1 = document.createElement('br');
          itemDiv.appendChild(br1);
          var em1 = document.createElement('em');
          em1.textContent = r.ideal;
          itemDiv.appendChild(document.createTextNode('\u00A0\u00A0\u00A0\u00A0✅ 正确翻译：'));
          itemDiv.appendChild(em1);
          if (r.note) {
            var br2 = document.createElement('br');
            itemDiv.appendChild(br2);
            itemDiv.appendChild(document.createTextNode('\u00A0\u00A0\u00A0\u00A0💡 ' + r.note));
          }
        } else {
          itemDiv.className = 'grade-item grade-missing';
          var code = document.createElement('code');
          code.textContent = r.en;
          itemDiv.appendChild(document.createTextNode('❌ '));
          itemDiv.appendChild(code);
          itemDiv.appendChild(document.createTextNode(' → 遗漏'));
          var br1 = document.createElement('br');
          itemDiv.appendChild(br1);
          var em1 = document.createElement('em');
          em1.textContent = r.ideal;
          itemDiv.appendChild(document.createTextNode('\u00A0\u00A0\u00A0\u00A0✅ 应译为：'));
          itemDiv.appendChild(em1);
          if (r.note) {
            var br2 = document.createElement('br');
            itemDiv.appendChild(br2);
            itemDiv.appendChild(document.createTextNode('\u00A0\u00A0\u00A0\u00A0💡 ' + r.note));
          }
        }
        detailsDiv.appendChild(itemDiv);
      });
      feedbackDiv.appendChild(detailsDiv);
    }

    // 参考译文
    if (reference) {
      var refDiv = document.createElement('div');
      refDiv.className = 'grade-reference';
      var refStrong = document.createElement('strong');
      refStrong.textContent = '📖 参考译文：';
      refDiv.appendChild(refStrong);
      var bq = document.createElement('blockquote');
      bq.textContent = reference;
      refDiv.appendChild(bq);
      feedbackDiv.appendChild(refDiv);
    }

    // 关键知识点（仅在没有 rubric 时从 key-points 提取）
    if (keyPoints && !rubricStr) {
      var kpDiv = document.createElement('div');
      kpDiv.className = 'grade-keypoints';
      var kpStrong = document.createElement('strong');
      kpStrong.textContent = '💡 关键知识点：';
      kpDiv.appendChild(kpStrong);
      var ul = document.createElement('ul');
      keyPoints.split('；').filter(Boolean).forEach(function (kp) {
        var li = document.createElement('li');
        li.textContent = kp.trim();
        ul.appendChild(li);
      });
      kpDiv.appendChild(ul);
      feedbackDiv.appendChild(kpDiv);
    }
  }

  // --- 重做按钮 ---
  function addResetButton() {
    var container = document.querySelector('.summary-box') || document.body;
    var btn = document.createElement('button');
    btn.textContent = '🔄 重做所有练习';
    btn.style.cssText = 'display:block;width:100%;padding:12px;margin-top:20px;font-size:1em;font-weight:600;color:#fff;background:#6366f1;border:none;border-radius:8px;cursor:pointer;';
    btn.addEventListener('click', function () {
      try { localStorage.removeItem(pageKey); } catch (e) {}
      location.reload();
    });
    if (container.parentNode) {
      container.parentNode.insertBefore(btn, container.nextSibling);
    } else {
      document.body.appendChild(btn);
    }
  }

  // --- 主逻辑 ---
  function _initExercises() {
    var saved = loadState();
    addResetButton();

    /* ---- 客观题（radio 选择） ---- */
    document.querySelectorAll('.exercise').forEach(function (exercise, exIdx) {
      var items = exercise.querySelectorAll('.quiz-item');
      var btn = exercise.querySelector('.grade-btn');
      if (!items.length || !btn) return;

      var total = items.length;

      // 恢复已保存的选择
      if (saved && saved.radio) {
        items.forEach(function (item) {
          item.querySelectorAll('input[type="radio"]').forEach(function (r) {
            if (saved.radio[r.name] === r.value) r.checked = true;
          });
        });
      }

      exercise.addEventListener('change', function () {
        var answered = exercise.querySelectorAll('.quiz-item input[type="radio"]:checked').length;
        btn.disabled = answered < total;
        saveState();
      });
      var answered = exercise.querySelectorAll('.quiz-item input[type="radio"]:checked').length;
      btn.disabled = answered < total;
      btn.addEventListener('click', function () {
        triggerGrade(exercise, items, btn, total, exIdx);
        saveState();
      });

      // 恢复已判题的结果
      if (saved && saved.quizGraded && saved.quizGraded.indexOf(exIdx) >= 0) {
        triggerGrade(exercise, items, btn, total, exIdx);
      }
    });

    function triggerGrade(exercise, items, btn, total, exIdx) {
      exercise.querySelectorAll('.quiz-result').forEach(function (el) { el.remove(); });
      exercise.querySelectorAll('.correct-answer, .wrong-answer').forEach(function (el) {
        el.classList.remove('correct-answer', 'wrong-answer');
      });
      var correct = 0;
      items.forEach(function (item) {
        var answer = item.getAttribute('data-answer');
        var explanation = item.getAttribute('data-explanation');
        var selected = item.querySelector('input[type="radio"]:checked');
        var userAnswer = selected ? selected.value : '';
        var result = document.createElement('div');
        result.className = 'quiz-result';
        var strong = document.createElement('strong');
        if (userAnswer === answer) {
          correct++;
          result.classList.add('correct');
          strong.textContent = '✅ 正确！';
          result.appendChild(strong);
          if (explanation) result.appendChild(document.createTextNode(' ' + explanation));
        } else {
          result.classList.add('wrong');
          strong.textContent = '❌ 错误';
          result.appendChild(strong);
          if (userAnswer) {
            result.appendChild(document.createTextNode('（你选了 ' + userAnswer + '）。正确答案：'));
          } else {
            result.appendChild(document.createTextNode('。正确答案：'));
          }
          var answerStrong = document.createElement('strong');
          answerStrong.textContent = answer;
          result.appendChild(answerStrong);
          if (explanation) result.appendChild(document.createTextNode(' — ' + explanation));
        }
        item.appendChild(result);
        item.querySelectorAll('label').forEach(function (label) {
          var radio = label.querySelector('input[type="radio"]');
          if (radio.value === answer) label.classList.add('correct-answer');
          else if (radio.checked) label.classList.add('wrong-answer');
        });
      });
      btn.textContent = '重新判题 · ' + correct + '/' + total;
      btn.disabled = false;
      if (currentState.quizGraded.indexOf(exIdx) < 0) {
        currentState.quizGraded.push(exIdx);
      }
    }

    /* ---- 翻译题（详细批改） ---- */
    var allTranslateItems = document.querySelectorAll('.translate-item');
    var globalItemMap = new Map();
    allTranslateItems.forEach(function (item, i) {
      globalItemMap.set(item, i);
    });

    // 恢复 textarea（仅执行一次）
    if (saved && saved.textarea) {
      allTranslateItems.forEach(function (item, i) {
        var ta = item.querySelector('textarea');
        if (ta && saved.textarea['t' + i]) ta.value = saved.textarea['t' + i];
      });
    }

    document.querySelectorAll('.translation-exercise').forEach(function (exercise, texIdx) {
      var items = exercise.querySelectorAll('.translate-item');
      var btn = exercise.querySelector('.check-translation-btn');
      if (!items.length || !btn) return;

      exercise.addEventListener('input', function () {
        var filled = 0;
        items.forEach(function (item) {
          var input = item.querySelector('textarea');
          if (input && input.value.trim()) filled++;
        });
        btn.disabled = filled < items.length;
        saveState();
      });
      var filled = 0;
      items.forEach(function (item) {
        var input = item.querySelector('textarea');
        if (input && input.value.trim()) filled++;
      });
      btn.disabled = filled < items.length;
      btn.addEventListener('click', function () {
        triggerTranslationGrade(items, btn, texIdx);
      });

      // 恢复已批改的结果
      if (saved && saved.translateGraded && saved.translateGraded.indexOf(texIdx) >= 0) {
        restoreTranslationFeedback(items, btn);
      }
    });

    function restoreTranslationFeedback(items, btn) {
      items.forEach(function (item) {
        var globalIdx = globalItemMap.get(item);
        var savedResult = currentState.aiResults['' + globalIdx];
        if (!savedResult) return;

        var input = item.querySelector('textarea');
        var userText = input ? input.value.trim() : '';
        if (!userText) return;

        var reference = item.getAttribute('data-reference') || '';

        if (savedResult === 'fallback') {
          buildGradeFeedback(item, userText);
        } else {
          var feedbackDiv = document.createElement('div');
          feedbackDiv.className = 'translate-feedback';
          item.appendChild(feedbackDiv);
          renderAIFeedback(feedbackDiv, savedResult, reference);
        }
      });
      btn.textContent = '重新批改';
      btn.disabled = false;
    }

    // --- DeepSeek AI 批改 ---
    var DEEPSEEK_API_KEY = 'sk-089516ac71dd4ba79013056613441d1b';
    var DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
    var DEEPSEEK_MODEL = 'deepseek-chat';

    var GRADING_SYSTEM_PROMPT = [
      '你是一位资深法律翻译审校专家，专门批改商务合同英语翻译练习。',
      '',
      '## 批改要求',
      '1. 逐条审查翻译中的关键法律术语是否准确',
      '2. 评估整体句意是否完整、通顺',
      '3. 指出中文母语者常犯的法律翻译错误',
      '4. 给出 0-100 的分数',
      '',
      '## 输出格式',
      '严格按以下 JSON 格式输出，不要输出任何其他内容：',
      '{',
      '  "score": 75,',
      '  "summary": "一句话总评",',
      '  "items": [',
      '    {',
      '      "term": "原文关键术语",',
      '      "status": "perfect|acceptable|error|missing",',
      '      "userTranslation": "用户对该术语的翻译（如有）",',
      '      "idealTranslation": "最佳法律翻译",',
      '      "note": "知识点说明（为什么这样译）"',
      '    }',
      '  ],',
      '  "overallComments": "整体翻译的优缺点，给出改进建议"',
      '}',
      '',
      '## status 含义',
      '- perfect: 翻译准确，符合法律用语规范',
      '- acceptable: 意思正确但不够规范，或用了非法律场景的表达',
      '- error: 翻译错误，含义偏差',
      '- missing: 关键术语遗漏未译',
      '',
      '## 评分标准',
      '- 90-100: 法律术语全部准确，句意完整通顺，可直接用于正式合同',
      '- 70-89: 核心意思正确，个别术语不够规范但不影响理解',
      '- 50-69: 基本意思对，但有明显的法律术语翻译错误',
      '- 0-49: 存在严重误译或大量遗漏'
    ].join('\n');

    function buildAIPrompt(source, userTranslation, reference, rubric, direction) {
      var prompt = '## 翻译练习批改\n\n';
      prompt += '**翻译方向**：' + (direction === 'zh2en' ? '中译英' : '英译中') + '\n\n';
      prompt += '**原文**：\n' + source + '\n\n';
      prompt += '**学生翻译**：\n' + userTranslation + '\n\n';
      if (reference) {
        prompt += '**参考译文**：\n' + reference + '\n\n';
      }
      if (rubric) {
        prompt += '**评分要点**（重点审查这些术语的翻译）：\n';
        rubric.forEach(function (r) {
          prompt += '- `' + r.en + '`：最佳翻译「' + r.ideal + '」';
          if (r.accept && r.accept.length) prompt += '，可接受「' + r.accept.join('、') + '」';
          if (r.wrong && r.wrong.length) prompt += '，常见错误「' + r.wrong.join('、') + '」';
          if (r.note) prompt += '（' + r.note + '）';
          prompt += '\n';
        });
      }
      return prompt;
    }

    function renderAIFeedback(feedbackDiv, data, reference) {
      var pct = data.score || 0;
      var emoji = pct >= 90 ? '🎉' : pct >= 70 ? '👍' : pct >= 50 ? '💪' : '📚';

      // 清空并用 DOM 方法构建
      feedbackDiv.textContent = '';

      // 评分
      var scoreDiv = document.createElement('div');
      scoreDiv.className = 'grade-score';
      var scoreStrong = document.createElement('strong');
      scoreStrong.textContent = emoji + ' AI 评分：' + pct + ' 分';
      scoreDiv.appendChild(scoreStrong);
      if (data.summary) scoreDiv.appendChild(document.createTextNode(' — ' + data.summary));
      feedbackDiv.appendChild(scoreDiv);

      // 逐条批改
      if (data.items && data.items.length) {
        var detailsDiv = document.createElement('div');
        detailsDiv.className = 'grade-details';
        data.items.forEach(function (r) {
          var itemDiv = document.createElement('div');
          var code = document.createElement('code');
          code.textContent = r.term;
          if (r.status === 'perfect') {
            itemDiv.className = 'grade-item grade-perfect';
            itemDiv.appendChild(document.createTextNode('✅ '));
            itemDiv.appendChild(code);
            itemDiv.appendChild(document.createTextNode(' → ' + r.idealTranslation + ' ✓'));
          } else if (r.status === 'acceptable') {
            itemDiv.className = 'grade-item grade-acceptable';
            itemDiv.appendChild(document.createTextNode('⚠️ '));
            itemDiv.appendChild(code);
            itemDiv.appendChild(document.createTextNode(' → 你译为「' + (r.userTranslation || '') + '」'));
            itemDiv.appendChild(document.createElement('br'));
            var em = document.createElement('em');
            em.textContent = r.idealTranslation;
            itemDiv.appendChild(document.createTextNode('\u00A0\u00A0\u00A0\u00A0✅ 更规范的法律表达：'));
            itemDiv.appendChild(em);
            if (r.note) {
              itemDiv.appendChild(document.createElement('br'));
              itemDiv.appendChild(document.createTextNode('\u00A0\u00A0\u00A0\u00A0💡 ' + r.note));
            }
          } else if (r.status === 'error') {
            itemDiv.className = 'grade-item grade-error';
            itemDiv.appendChild(document.createTextNode('❌ '));
            itemDiv.appendChild(code);
            itemDiv.appendChild(document.createTextNode(' → 你译为「' + (r.userTranslation || '') + '」'));
            itemDiv.appendChild(document.createElement('br'));
            var em = document.createElement('em');
            em.textContent = r.idealTranslation;
            itemDiv.appendChild(document.createTextNode('\u00A0\u00A0\u00A0\u00A0✅ 正确翻译：'));
            itemDiv.appendChild(em);
            if (r.note) {
              itemDiv.appendChild(document.createElement('br'));
              itemDiv.appendChild(document.createTextNode('\u00A0\u00A0\u00A0\u00A0💡 ' + r.note));
            }
          } else {
            itemDiv.className = 'grade-item grade-missing';
            itemDiv.appendChild(document.createTextNode('❌ '));
            itemDiv.appendChild(code);
            itemDiv.appendChild(document.createTextNode(' → 遗漏'));
            itemDiv.appendChild(document.createElement('br'));
            var em = document.createElement('em');
            em.textContent = r.idealTranslation;
            itemDiv.appendChild(document.createTextNode('\u00A0\u00A0\u00A0\u00A0✅ 应译为：'));
            itemDiv.appendChild(em);
            if (r.note) {
              itemDiv.appendChild(document.createElement('br'));
              itemDiv.appendChild(document.createTextNode('\u00A0\u00A0\u00A0\u00A0💡 ' + r.note));
            }
          }
          detailsDiv.appendChild(itemDiv);
        });
        feedbackDiv.appendChild(detailsDiv);
      }

      // 总评
      if (data.overallComments) {
        var commentsDiv = document.createElement('div');
        commentsDiv.className = 'grade-keypoints';
        var commentsStrong = document.createElement('strong');
        commentsStrong.textContent = '💡 总评：';
        commentsDiv.appendChild(commentsStrong);
        var p = document.createElement('p');
        p.textContent = data.overallComments;
        commentsDiv.appendChild(p);
        feedbackDiv.appendChild(commentsDiv);
      }

      // 参考译文
      if (reference) {
        var refDiv = document.createElement('div');
        refDiv.className = 'grade-reference';
        var refStrong = document.createElement('strong');
        refStrong.textContent = '📖 参考译文：';
        refDiv.appendChild(refStrong);
        var bq = document.createElement('blockquote');
        bq.textContent = reference;
        refDiv.appendChild(bq);
        feedbackDiv.appendChild(refDiv);
      }
    }

    function callDeepSeek(source, userTranslation, reference, rubric, direction) {
      var userPrompt = buildAIPrompt(source, userTranslation, reference, rubric, direction);
      return fetch(DEEPSEEK_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            { role: 'system', content: GRADING_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      })
      .then(function (res) {
        if (!res.ok) throw new Error('API ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var content = data.choices[0].message.content;
        return JSON.parse(content);
      });
    }

    function triggerTranslationGrade(items, btn, texIdx) {
      btn.textContent = '⏳ AI 批改中...';
      btn.disabled = true;

      var promises = [];

      items.forEach(function (item) {
        var old = item.querySelector('.translate-feedback');
        if (old) old.remove();
        var input = item.querySelector('textarea');
        var userText = input ? input.value.trim() : '';

        if (!userText) {
          promises.push(Promise.resolve());
          return;
        }

        var globalIdx = globalItemMap.get(item);

        // 收集题目数据
        var sourceEl = item.querySelector('.source-text');
        var source = item.getAttribute('data-source') || '';
        if (!source && sourceEl) {
          var enSpan = sourceEl.querySelector('.en-text');
          source = enSpan ? enSpan.textContent.trim() : sourceEl.textContent.replace(/^\d+\.\s*/, '').trim();
        }
        var reference = item.getAttribute('data-reference') || '';
        var rubricStr = item.getAttribute('data-rubric');
        var rubric = null;
        try { if (rubricStr) rubric = JSON.parse(rubricStr); } catch (e) {}

        var direction = 'en2zh';
        if (/[\u4e00-\u9fff]/.test(source) && source.length > 2) direction = 'zh2en';

        // 显示加载状态
        var feedbackDiv = document.createElement('div');
        feedbackDiv.className = 'translate-feedback';
        var loadingDiv = document.createElement('div');
        loadingDiv.className = 'grade-score';
        loadingDiv.style.textAlign = 'center';
        loadingDiv.textContent = '⏳ DeepSeek AI 正在批改...';
        feedbackDiv.appendChild(loadingDiv);
        item.appendChild(feedbackDiv);

        // 调用 DeepSeek API，失败降级到本地 rubric
        var p = callDeepSeek(source, userText, reference, rubric, direction)
          .then(function (result) {
            renderAIFeedback(feedbackDiv, result, reference);
            currentState.aiResults['' + globalIdx] = result;
          })
          .catch(function (err) {
            console.warn('DeepSeek API failed, falling back to local rubric:', err);
            feedbackDiv.textContent = '';
            feedbackDiv.remove();
            buildGradeFeedback(item, userText);
            currentState.aiResults['' + globalIdx] = 'fallback';
          });

        promises.push(p);
      });

      Promise.all(promises).then(function () {
        btn.textContent = '重新批改';
        btn.disabled = false;
        if (currentState.translateGraded.indexOf(texIdx) < 0) {
          currentState.translateGraded.push(texIdx);
        }
        saveState();
      });
    }
  });
  } // end _initExercises

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initExercises);
  } else {
    _initExercises();
  }
})();

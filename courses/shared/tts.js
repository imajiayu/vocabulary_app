/**
 * 课程 TTS 模块 — 浏览器端按需调用 Google Cloud Text-to-Speech API
 *
 * 自动根据 <html lang> 属性选择语言和语速：
 * - uk → 乌克兰语（uk-UA, 0.85x）, 选择器 .uk-word / .uk-text
 * - en → 英语（en-US, 0.95x）, 选择器 .term / .en-text
 */
(function () {
  var API_KEY = 'AIzaSyCQArxclkv0KTmAgzG7BKBAJbOog2YLkhw';
  var TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

  var lang = (document.documentElement.lang || 'en').toLowerCase().slice(0, 2);
  var LANG_CONFIG = {
    uk: { languageCode: 'uk-UA', speakingRate: 0.85, wordSelector: '.uk-word', textSelector: '.uk-text' },
    en: { languageCode: 'en-US', speakingRate: 0.95, wordSelector: '.term',    textSelector: '.en-text' }
  };
  var cfg = LANG_CONFIG[lang] || LANG_CONFIG.en;

  var cache = {};
  var currentAudio = null;
  var currentEl = null;

  function speak(text, el) {
    text = text.trim();
    if (!text) return;

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      if (currentEl) currentEl.classList.remove('playing');
      if (currentEl === el) {
        currentAudio = null;
        currentEl = null;
        return;
      }
    }

    if (el) el.classList.add('playing');
    currentEl = el;

    if (cache[text]) {
      currentAudio = cache[text];
      currentAudio.currentTime = 0;
      currentAudio.play();
      currentAudio.onended = onEnd;
      return;
    }

    fetch(TTS_URL + '?key=' + API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: text },
        voice: { languageCode: cfg.languageCode, ssmlGender: 'FEMALE' },
        audioConfig: { audioEncoding: 'MP3', speakingRate: cfg.speakingRate },
      }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('TTS API ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var audio = new Audio('data:audio/mp3;base64,' + data.audioContent);
        cache[text] = audio;
        currentAudio = audio;
        audio.play();
        audio.onended = onEnd;
      })
      .catch(function (err) {
        console.error('TTS 错误:', err);
        if (currentEl) currentEl.classList.remove('playing');
        currentAudio = null;
        currentEl = null;
      });
  }

  function onEnd() {
    if (currentEl) currentEl.classList.remove('playing');
    currentAudio = null;
    currentEl = null;
  }

  function stripPunct(s) {
    return s.replace(/[.,!?;:…—–\-"'«»()"'。，！？：；]/g, '').trim();
  }

  function makeWordSpan(word) {
    var span = document.createElement('span');
    span.className = 'tts-word';
    span.textContent = word;
    span.addEventListener('click', function (e) {
      e.stopPropagation();
      var clean = stripPunct(this.textContent);
      if (clean) speak(clean, this);
    });
    return span;
  }

  document.addEventListener('DOMContentLoaded', function () {
    // 词汇表单词 — 点击发音
    document.querySelectorAll(cfg.wordSelector).forEach(function (el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function () {
        speak(this.textContent, this);
      });
    });

    // 例句 — 拆词 + 整句按钮
    document.querySelectorAll(cfg.textSelector).forEach(function (el) {
      var fullText = el.textContent.trim();
      var words = fullText.split(/\s+/);

      while (el.firstChild) el.removeChild(el.firstChild);
      words.forEach(function (w, i) {
        if (i > 0) el.appendChild(document.createTextNode(' '));
        el.appendChild(makeWordSpan(w));
      });

      var btn = document.createElement('button');
      btn.className = 'audio-btn';
      btn.textContent = '🔊';
      btn.title = '播放整句';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        speak(fullText, this);
      });
      el.after(btn);
    });
  });
})();

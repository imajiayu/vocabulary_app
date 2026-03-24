/**
 * 课程 TTS 模块 — 双语音频源
 *
 * 英语 (en): 有道词典 API（免费，无需 key）
 * 乌克兰语 (uk): 服务器缓存 (/tts-cache/) → Google Cloud TTS API → 自动上传缓存
 *
 * 暴露 window.CourseTTS.speak(text, el) 供 wordInteraction.js 调用
 * 自动处理 .uk-text / .en-text 例句的拆词和整句播放
 */
(function () {
  var lang = (document.documentElement.lang || 'en').toLowerCase().slice(0, 2);

  var LANG_CONFIG = {
    uk: { source: 'UKA', languageCode: 'uk-UA', speakingRate: 0.85, textSelector: '.uk-text' },
    en: { source: 'IELTS', languageCode: 'en-US', speakingRate: 0.95, textSelector: '.en-text' }
  };
  var cfg = LANG_CONFIG[lang] || LANG_CONFIG.en;

  var GOOGLE_TTS_KEY = 'AIzaSyCQArxclkv0KTmAgzG7BKBAJbOog2YLkhw';
  var cache = {};
  var currentAudio = null;
  var currentEl = null;

  // --- SHA-256（与后端 hashlib.sha256 一致）---
  function sha256Hex(text) {
    var data = new TextEncoder().encode(text);
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      return Array.from(new Uint8Array(buf)).map(function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    });
  }

  // --- 核心播放 ---
  function playAudio(audio) {
    currentAudio = audio;
    audio.currentTime = 0;
    audio.play().catch(function () {});
    audio.onended = onEnd;
  }

  function onEnd() {
    if (currentEl) currentEl.classList.remove('playing');
    currentAudio = null;
    currentEl = null;
  }

  function speak(text, el) {
    text = text.trim();
    if (!text) return;

    // 停止当前播放
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      if (currentEl) currentEl.classList.remove('playing');
      if (currentEl === el) { currentAudio = null; currentEl = null; return; }
    }

    if (el) el.classList.add('playing');
    currentEl = el;

    // 内存缓存命中
    if (cache[text]) { playAudio(cache[text]); return; }

    if (lang === 'en') {
      // 英语: 有道词典（免费 CDN，浏览器自动缓存）
      var url = 'https://dict.youdao.com/dictvoice?audio=' +
        encodeURIComponent(text) + '&type=2';
      var audio = new Audio(url);
      cache[text] = audio;
      playAudio(audio);
    } else {
      // 非英语: 服务器缓存 → Google TTS
      fetchNonEnglishAudio(text);
    }
  }

  function fetchNonEnglishAudio(text) {
    var source = cfg.source;
    sha256Hex(text).then(function (hash) {
      var cacheUrl = '/tts-cache/' + encodeURIComponent(source) + '/' + hash + '.mp3';
      return fetch(cacheUrl, { method: 'HEAD' }).then(function (resp) {
        if (resp.ok) {
          var audio = new Audio(cacheUrl);
          cache[text] = audio;
          playAudio(audio);
          return; // done
        }
        throw new Error('cache miss');
      });
    }).catch(function () {
      // 缓存未命中 → Google TTS API
      return fetch(
        'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + GOOGLE_TTS_KEY,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text: text },
            voice: { languageCode: cfg.languageCode, ssmlGender: 'FEMALE' },
            audioConfig: { audioEncoding: 'MP3', speakingRate: cfg.speakingRate }
          })
        }
      ).then(function (r) {
        if (!r.ok) throw new Error('TTS API ' + r.status);
        return r.json();
      }).then(function (data) {
        var audioContent = data.audioContent;
        var audio = new Audio('data:audio/mp3;base64,' + audioContent);
        cache[text] = audio;
        playAudio(audio);
        // 上传服务器缓存（fire-and-forget）
        uploadToCache(text, source, audioContent);
      });
    }).catch(function (err) {
      console.error('TTS error:', err);
      if (currentEl) currentEl.classList.remove('playing');
      currentAudio = null;
      currentEl = null;
    });
  }

  function uploadToCache(word, source, audioBase64) {
    var auth = window.CourseAuth && window.CourseAuth.getAuth();
    if (!auth) return;
    fetch('/api/tts/cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + auth.accessToken
      },
      body: JSON.stringify({ word: word, source: source, audio: audioBase64 })
    }).catch(function () {});
  }

  // --- 例句拆词 + 整句播放 ---
  function stripPunct(s) {
    return s.replace(/[.,!?;:…—–\-"'«»()"'。，！？：；]/g, '').trim();
  }

  function makeWordSpan(word) {
    var span = document.createElement('span');
    span.className = 'tts-word';
    span.textContent = word;
    // 点击交互由 wordInteraction.js 统一处理（弹出气泡）
    return span;
  }

  function initSentences() {
    document.querySelectorAll(cfg.textSelector).forEach(function (el) {
      if (el.dataset.ttsDone) return;
      el.dataset.ttsDone = '1';
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
  }

  // --- 初始化 ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSentences);
  } else {
    initSentences();
  }

  // --- 暴露 API ---
  window.CourseTTS = { speak: speak, initSentences: initSentences };
})();

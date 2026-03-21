/**
 * 课程进度跨设备同步 — 将 checkbox 进度同步到 Supabase
 *
 * 依赖：auth.js（必须先加载）
 *
 * 逻辑：
 * 1. 页面加载时：合并 localStorage + 服务端进度（并集）→ 写回两端 → 重新渲染
 * 2. checkbox 切换时：更新 localStorage + 异步写服务端
 * 3. 未登录时：仅使用 localStorage（优雅降级）
 */
(function () {
  var COURSE_MAP = {
    '/uk/': { course: 'ukrainian', storageKey: 'ukrainian_progress' },
    '/legal/': { course: 'legal-english', storageKey: 'legal_english_progress' }
  };

  var cfg = Object.entries(COURSE_MAP).find(function (e) {
    return location.pathname === e[0] || location.pathname === e[0] + 'index.html';
  });
  if (!cfg) return;
  cfg = cfg[1];

  // 等 DOM 加载 + 原始 renderAll 完成后再同步
  document.addEventListener('DOMContentLoaded', function () {
    // 延迟一帧，确保原始 renderAll() 已执行
    requestAnimationFrame(function () {
      syncFromServer();
    });

    // 包装全局 saveProgress：checkbox 变化时 toggleLesson() 会调用它
    // 注意：toggleLesson 中 event.stopPropagation() 阻止了事件冒泡，
    // 所以不能用 document 级别的 change 监听，必须 hook saveProgress
    if (typeof saveProgress === 'function') {
      var _orig = saveProgress;
      saveProgress = function (progress) {
        _orig(progress);
        pushToServer();
      };
    }
  });

  function syncFromServer() {
    var auth = window.CourseAuth && window.CourseAuth.getAuth();
    if (!auth) return;

    window.CourseAuth.supabaseFetch(
      '/rest/v1/course_progress?user_id=eq.' + auth.userId + '&course=eq.' + cfg.course + '&select=progress',
      { method: 'GET' }
    )
    .then(function (r) { return r.json(); })
    .then(function (rows) {
      if (!rows || !rows.length) {
        // 服务端无记录，把本地进度推上去
        pushToServer();
        return;
      }

      var serverProgress = rows[0].progress || {};
      var localProgress = loadLocal();

      // 合并：并集（任一标记完成即完成）
      var merged = Object.assign({}, serverProgress, localProgress);
      var changed = JSON.stringify(merged) !== JSON.stringify(localProgress) ||
                    JSON.stringify(merged) !== JSON.stringify(serverProgress);

      if (changed) {
        saveLocal(merged);
        // 重新渲染（调用 index.html 中的全局 renderAll）
        if (typeof renderAll === 'function') renderAll();
        pushProgress(auth, merged);
      }
    })
    .catch(function (err) {
      console.warn('进度同步失败:', err);
    });
  }

  function pushToServer() {
    var auth = window.CourseAuth && window.CourseAuth.getAuth();
    if (!auth) return;
    var progress = loadLocal();
    pushProgress(auth, progress);
  }

  function pushProgress(auth, progress) {
    window.CourseAuth.supabaseFetch('/rest/v1/course_progress', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({
        user_id: auth.userId,
        course: cfg.course,
        progress: progress,
        updated_at: new Date().toISOString()
      })
    }).catch(function (err) {
      console.warn('进度上传失败:', err);
    });
  }

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(cfg.storageKey)) || {}; }
    catch (e) { return {}; }
  }

  function saveLocal(progress) {
    try { localStorage.setItem(cfg.storageKey, JSON.stringify(progress)); }
    catch (e) {}
  }
})();

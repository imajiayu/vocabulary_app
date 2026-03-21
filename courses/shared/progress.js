/**
 * 课程进度持久化 — 直接读写 Supabase，不使用 localStorage
 *
 * 依赖：auth.js（必须先加载）
 *
 * 策略：
 * 1. 页面加载时：从 Supabase 拉取进度 → 写入内存 → renderAll()
 * 2. checkbox 切换时：saveProgress() 被调用 → 异步写 Supabase
 * 3. 未登录时：进度不持久化（仅当前会话有效）
 */
(function () {
  var COURSE_MAP = {
    '/uk/': 'ukrainian',
    '/legal/': 'legal-english'
  };

  var course = Object.entries(COURSE_MAP).find(function (e) {
    return location.pathname === e[0] || location.pathname === e[0] + 'index.html';
  });
  if (!course) return;
  course = course[1];

  document.addEventListener('DOMContentLoaded', function () {
    // 从 Supabase 加载进度
    requestAnimationFrame(function () {
      fetchProgress();
    });

    // hook saveProgress：每次 checkbox 变化写入 Supabase
    if (typeof saveProgress === 'function') {
      var _orig = saveProgress;
      saveProgress = function (progress) {
        _orig(progress);
        pushProgress(progress);
      };
    }
  });

  function fetchProgress() {
    var auth = window.CourseAuth && window.CourseAuth.getAuth();
    if (!auth) return;

    window.CourseAuth.supabaseFetch(
      '/rest/v1/course_progress?user_id=eq.' + auth.userId + '&course=eq.' + course + '&select=progress',
      { method: 'GET' }
    )
    .then(function (r) { return r.json(); })
    .then(function (rows) {
      if (!rows || !rows.length || !rows[0].progress) return;

      var progress = rows[0].progress;
      if (typeof _progress !== 'undefined') {
        _progress = progress;
      }
      if (typeof renderAll === 'function') renderAll();
    })
    .catch(function (err) {
      console.warn('进度加载失败:', err);
    });
  }

  function pushProgress(progress) {
    var auth = window.CourseAuth && window.CourseAuth.getAuth();
    if (!auth) return;

    window.CourseAuth.supabaseFetch('/rest/v1/course_progress', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({
        user_id: auth.userId,
        course: course,
        progress: progress,
        updated_at: new Date().toISOString()
      })
    }).catch(function (err) {
      console.warn('进度保存失败:', err);
    });
  }
})();

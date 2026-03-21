/**
 * 课程认证模块 — 从 localStorage 读取主站 Supabase 登录会话
 *
 * 课程页面与主站同域 (mieltsm.top)，Supabase SDK 将会话存在 localStorage 中，
 * 本模块直接读取，无需加载 Supabase SDK。
 *
 * 用法：
 *   const auth = CourseAuth.getAuth();  // { userId, accessToken } 或 null
 *   const data = await CourseAuth.supabaseFetch('/rest/v1/some_table?select=*');
 */
(function () {
  var SUPABASE_URL = 'https://oilcmmlkkmikmftqjlih.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pbGNtbWxra21pa21mdHFqbGloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NTY2MTksImV4cCI6MjA4NDIzMjYxOX0.XwVTOhOEQX3bE4OchnIh6n4B7lh191rxsMvRUq7fWGY';
  var STORAGE_KEY = 'sb-oilcmmlkkmikmftqjlih-auth-token';

  function getAuth() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var session = JSON.parse(raw);
      var token = session.access_token || (session.currentSession && session.currentSession.access_token);
      var user = session.user || (session.currentSession && session.currentSession.user);
      if (!token || !user || !user.id) return null;
      return { userId: user.id, accessToken: token };
    } catch (e) {
      return null;
    }
  }

  function supabaseFetch(path, options) {
    var auth = getAuth();
    var headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    };
    if (auth) {
      headers['Authorization'] = 'Bearer ' + auth.accessToken;
    }
    var opts = Object.assign({}, options || {});
    opts.headers = Object.assign(headers, opts.headers || {});
    return fetch(SUPABASE_URL + path, opts);
  }

  window.CourseAuth = {
    getAuth: getAuth,
    supabaseFetch: supabaseFetch,
    SUPABASE_URL: SUPABASE_URL,
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY
  };
})();

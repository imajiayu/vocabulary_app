/**
 * 词汇批量添加功能
 *
 * 依赖：auth.js（必须先加载）
 *
 * - userId 从 Supabase 认证会话获取（不再硬编码）
 * - source 由用户在页面上通过下拉框选择（从 Supabase 获取已有 source 列表）
 * - 未登录时禁用添加功能
 */
// 按 URL 路径决定默认 source 和是否发送 definition
const COURSE_DEFAULTS = {
  '/uk/':    { defaultSource: 'UKA',   sendDef: false },
  '/legal/': { defaultSource: 'IELTS', sendDef: true  }
};

const courseCfg = Object.entries(COURSE_DEFAULTS).find(([p]) => location.pathname.startsWith(p))?.[1];

const SOURCE_STORAGE_KEY = 'vocab_selected_source';
let selectedSource = (() => {
  try { return localStorage.getItem(SOURCE_STORAGE_KEY) || courseCfg?.defaultSource || ''; }
  catch (e) { return courseCfg?.defaultSource || ''; }
})();
let authUserId = null;

function injectAddButtons() {
  document.querySelectorAll('.vocab-row').forEach(row => {
    const status = row.querySelector('.vocab-status');
    if (status && !status.querySelector('.vocab-add-one')) {
      const btn = document.createElement('button');
      btn.className = 'vocab-add-one';
      btn.textContent = '+';
      btn.title = '添加到背单词 App';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        addOneWord(row, btn);
      });
      status.textContent = '';
      status.appendChild(btn);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const addBtn = document.getElementById('add-all-btn');
  if (!addBtn) return;

  // 确保 auth.js 已加载
  if (!window.CourseAuth) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'templates/auth.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  const auth = window.CourseAuth?.getAuth();

  if (!auth) {
    // 未登录：禁用功能，显示提示
    addBtn.textContent = '请先在主站登录';
    addBtn.disabled = true;
    addBtn.title = '请先访问 mieltsm.top 并登录 Google 账号';
    return;
  }

  authUserId = auth.userId;

  // 加载用户已有的 source 列表并渲染下拉框
  await renderSourceSelector(addBtn);

  // 为每个 vocab-row 注入单词添加按钮
  injectAddButtons();

  // 检查哪些词已添加（基于当前选择的 source）
  await checkExistingWords();

  addBtn.addEventListener('click', addAllWords);
});

async function renderSourceSelector(addBtn) {
  let sources = [];
  try {
    const resp = await window.CourseAuth.supabaseFetch(
      '/rest/v1/word_source_stats?select=source&user_id=eq.' + authUserId + '&order=source'
    );
    const rows = await resp.json();
    if (Array.isArray(rows)) {
      sources = rows.map(r => r.source).filter(Boolean);
    }
  } catch (e) {
    console.warn('获取 source 列表失败', e);
  }

  // 确保默认 source 在列表中
  if (courseCfg?.defaultSource && !sources.includes(courseCfg.defaultSource)) {
    sources.unshift(courseCfg.defaultSource);
  }

  if (sources.length === 0) return;

  // 创建下拉框
  const container = addBtn.parentElement;
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;';

  const label = document.createElement('span');
  label.textContent = '添加到：';
  label.style.cssText = 'font-size:0.95em;color:var(--text-light);';

  const select = document.createElement('select');
  select.id = 'source-select';
  select.style.cssText = 'padding:6px 12px;border:1px solid var(--border);border-radius:6px;font-size:0.95em;font-family:inherit;background:var(--card-bg);color:var(--text);';
  sources.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    if (s === selectedSource) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener('change', async () => {
    selectedSource = select.value;
    try { localStorage.setItem(SOURCE_STORAGE_KEY, selectedSource); } catch (e) {}
    // 重置所有词汇状态，重新检查
    document.querySelectorAll('.vocab-row').forEach(row => {
      row.classList.remove('vocab-added', 'vocab-failed');
    });
    injectAddButtons();
    const addBtn = document.getElementById('add-all-btn');
    if (addBtn) {
      addBtn.textContent = '一键添加全部';
      addBtn.disabled = false;
      addBtn.classList.remove('btn-done');
    }
    await checkExistingWords();
  });

  wrapper.appendChild(label);
  wrapper.appendChild(select);
  container.insertBefore(wrapper, addBtn);
}

async function checkExistingWords() {
  try {
    const resp = await window.CourseAuth.supabaseFetch(
      '/rest/v1/words?select=word&user_id=eq.' + authUserId +
      '&source=eq.' + encodeURIComponent(selectedSource)
    );
    const rows = await resp.json();
    if (Array.isArray(rows)) {
      const existing = new Set(rows.map(r => r.word));
      document.querySelectorAll('.vocab-row').forEach(row => {
        if (existing.has(row.dataset.word)) {
          markAdded(row);
        }
      });
      updateProgress();
    }
  } catch (e) {
    console.warn('无法检查已有词汇', e);
  }
}

function markAdded(row) {
  row.classList.add('vocab-added');
  const status = row.querySelector('.vocab-status');
  if (status) {
    status.textContent = '✓';
  }
}

function markFailed(row) {
  row.classList.add('vocab-failed');
  const status = row.querySelector('.vocab-status');
  if (status) {
    status.textContent = '✗';
  }
}

function updateProgress() {
  const total = document.querySelectorAll('.vocab-row').length;
  const added = document.querySelectorAll('.vocab-row.vocab-added').length;
  const bar = document.getElementById('vocab-progress-bar');
  const count = document.getElementById('vocab-count');
  const btn = document.getElementById('add-all-btn');

  if (bar) bar.style.width = `${Math.round(added / total * 100)}%`;
  if (count) count.textContent = `${added}/${total}`;

  if (added === total && btn) {
    btn.textContent = '全部已添加 ✓';
    btn.disabled = true;
    btn.classList.add('btn-done');
  }
}

function normalizeWord(word) {
  return word.normalize('NFC').trim().toLowerCase();
}

function getUtcToday() {
  return new Date().toISOString().slice(0, 10);
}

function buildBody(row) {
  const today = getUtcToday();
  const body = {
    user_id: authUserId,
    word: normalizeWord(row.dataset.word),
    source: selectedSource,
    date_added: today,
    next_review: today,
    stop_review: false
  };
  if (courseCfg?.sendDef) {
    body.definition = (row.querySelector('.vocab-def')?.textContent || '').trim();
  }
  return body;
}

async function addOneWord(row, btn) {
  if (row.classList.contains('vocab-added')) return;

  btn.disabled = true;
  btn.textContent = '…';

  try {
    const resp = await window.CourseAuth.supabaseFetch('/rest/v1/words', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify(buildBody(row))
    });
    if (resp.status === 201 || resp.status === 409) {
      markAdded(row);
    } else {
      markFailed(row);
    }
  } catch (e) {
    markFailed(row);
  }
  updateProgress();
}

async function addAllWords() {
  const btn = document.getElementById('add-all-btn');
  const rows = document.querySelectorAll('.vocab-row:not(.vocab-added)');
  if (rows.length === 0) return;

  btn.disabled = true;
  let added = 0, skipped = 0, failed = 0;

  for (const row of rows) {
    btn.textContent = `添加中... (${added + skipped + failed + 1}/${rows.length})`;
    try {
      const resp = await window.CourseAuth.supabaseFetch('/rest/v1/words', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify(buildBody(row))
      });
      if (resp.status === 201) {
        markAdded(row);
        added++;
      } else if (resp.status === 409) {
        markAdded(row);
        skipped++;
      } else {
        markFailed(row);
        failed++;
      }
    } catch (e) {
      markFailed(row);
      failed++;
    }
    updateProgress();
  }

  const parts = [`新增 ${added}`];
  if (skipped > 0) parts.push(`已存在 ${skipped}`);
  if (failed > 0) parts.push(`失败 ${failed}`);
  btn.textContent = parts.join('，');
  if (failed > 0) {
    btn.disabled = false;
    btn.textContent += '（点击重试）';
  }
}

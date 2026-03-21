// 词汇批量添加功能 — 根据 URL 路径自动选择课程配置
const VOCAB_API = '/api/external/words';

const COURSE_CONFIG = {
  '/uk/':    { userId: '2a7bf539-4881-4a24-ae0d-c5abad4e501d', source: 'UKA',   sendDef: false },
  '/legal/': { userId: 'f18e410b-400d-4492-bc3e-eb0e034eb366', source: 'IELTS', sendDef: true  }
};

const cfg = Object.entries(COURSE_CONFIG).find(([p]) => location.pathname.startsWith(p))?.[1];
if (!cfg) console.warn('vocab.js: 无法识别课程路径', location.pathname);

document.addEventListener('DOMContentLoaded', async () => {
  if (!cfg) return;
  const addBtn = document.getElementById('add-all-btn');
  if (!addBtn) return;

  // 为每个 vocab-row 注入单词添加按钮
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

  // 检查哪些词已添加
  try {
    const resp = await fetch(
      `${VOCAB_API}?user_id=${cfg.userId}&source=${cfg.source}`
    );
    const data = await resp.json();
    if (data.success) {
      const existing = new Set(data.data.words);
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

  addBtn.addEventListener('click', addAllWords);
});

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

function buildBody(row) {
  const body = { user_id: cfg.userId, word: row.dataset.word, source: cfg.source };
  if (cfg.sendDef) {
    body.definition = (row.querySelector('.vocab-def')?.textContent || '').trim();
  }
  return body;
}

async function addOneWord(row, btn) {
  if (row.classList.contains('vocab-added')) return;

  btn.disabled = true;
  btn.textContent = '…';

  try {
    const resp = await fetch(VOCAB_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      const resp = await fetch(VOCAB_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

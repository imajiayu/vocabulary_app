#!/usr/bin/env python3
"""
把 frontend/public/{legal,uk}/*.json 里的非规范写法统一迁移到规范 schema。

规范 schema 见 frontend/src/features/courses/types/lesson.ts。

用法：
    python3 scripts/migrate_course_schema.py            # dry-run，打印将要改的文件
    python3 scripts/migrate_course_schema.py --write    # 真正写入
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
COURSE_DIRS = [
    ROOT / 'frontend' / 'public' / 'legal',
    ROOT / 'frontend' / 'public' / 'uk',
]

# ── helpers ───────────────────────────────────────────────────────────────

def block_to_html(b: dict[str, Any]) -> str:
    t = b.get('type')
    inner = b.get('html') or b.get('text') or ''
    if t == 'p':
        return f'<p>{inner}</p>'
    if t in ('h3', 'h4'):
        return f'<{t}>{inner}</{t}>'
    if t in ('ol', 'ul'):
        items = b.get('items', [])
        lis = ''.join(f'<li>{x}</li>' for x in items)
        return f'<{t}>{lis}</{t}>'
    if t == 'tip':
        return f'<div class="course-tip">{inner}</div>'
    if t == 'note':
        return f'<div class="course-note">{inner}</div>'
    if t == 'grammar-box':
        return f'<div class="course-grammar-box">{inner}</div>'
    if t == 'error-warn':
        return f'<div class="course-error-warn">{inner}</div>'
    return inner


# 从 question 对象里剥掉的冗余字段（这些字段代码不用，且含义与标准字段重复）
STRIP_QUESTION_KEYS = {'dataSource', 'displayHtml'}


def clean_question(q: dict[str, Any], style: str) -> dict[str, Any]:
    return {k: v for k, v in q.items() if k not in STRIP_QUESTION_KEYS}


def normalize_group(g: dict[str, Any]) -> dict[str, Any]:
    style = g['style']
    out: dict[str, Any] = {'style': style}
    title = g.get('title') or g.get('heading')
    if title:
        out['title'] = title
    instr = g.get('instruction') or g.get('intro')
    if instr:
        out['instruction'] = instr
    qs = g.get('questions') or g.get('items') or []
    out['questions'] = [clean_question(q, style) for q in qs]
    return out


# ── per-section migrations ────────────────────────────────────────────────

def migrate_vocab_table(s: dict[str, Any]) -> dict[str, Any]:
    if 'columns' in s or 'blocks' not in s:
        return s
    tbl = next((b for b in s['blocks'] if b.get('type') == 'table'), None)
    if not tbl:
        return s
    new: dict[str, Any] = {'type': 'vocab-table'}
    if s.get('heading'):
        new['heading'] = s['heading']
    if s.get('intro'):
        new['intro'] = s['intro']
    new['columns'] = tbl.get('headers', [])
    new['rows'] = tbl.get('rows', [])
    if tbl.get('firstColWord'):
        new['firstColWord'] = True
    return new


def migrate_examples(s: dict[str, Any]) -> dict[str, Any]:
    # examples without groups → 退化为 grammar（其 blocks 直接渲染）
    if 'groups' in s or 'blocks' not in s:
        return s
    new: dict[str, Any] = {'type': 'grammar'}
    if s.get('heading'):
        new['heading'] = s['heading']
    new['blocks'] = s['blocks']
    return new


def migrate_summary(s: dict[str, Any]) -> dict[str, Any]:
    if 'blocks' not in s:
        return s
    new: dict[str, Any] = {'type': 'summary'}
    if s.get('heading'):
        new['heading'] = s['heading']
    if s.get('title'):
        new['title'] = s['title']
    html_parts = [block_to_html(b) for b in s['blocks']]
    new['html'] = '\n'.join(html_parts)
    if s.get('next'):
        new['next'] = s['next']
    return new


def split_grammar_on_h2(s: dict[str, Any]) -> list[dict[str, Any]]:
    """grammar section 里若夹着 h2，按 h2 拆成多段 grammar。"""
    blocks = s.get('blocks') or []
    if not any(b.get('type') == 'h2' for b in blocks):
        return [s]

    sections: list[dict[str, Any]] = []
    cur_heading: str | None = s.get('heading')
    cur_blocks: list[dict[str, Any]] = []

    def flush() -> None:
        if not cur_blocks and not cur_heading:
            return
        out: dict[str, Any] = {'type': 'grammar'}
        if cur_heading:
            out['heading'] = cur_heading
        out['blocks'] = list(cur_blocks)
        sections.append(out)

    for b in blocks:
        if b.get('type') == 'h2':
            flush()
            cur_heading = b.get('text') or b.get('html') or ''
            cur_blocks = []
        else:
            cur_blocks.append(b)
    flush()
    return sections


def migrate_grammar(s: dict[str, Any]) -> list[dict[str, Any]]:
    return split_grammar_on_h2(s)


def migrate_sentence_analysis(s: dict[str, Any]) -> dict[str, Any]:
    if 'blocks' not in s:
        return s
    # 若 items 已存在，直接丢弃 blocks（它们通常只是冗余小标题）
    if 'items' in s:
        new = {k: v for k, v in s.items() if k != 'blocks'}
        return new
    # 否则退化为 grammar
    new: dict[str, Any] = {'type': 'grammar'}
    if s.get('heading'):
        new['heading'] = s['heading']
    new['blocks'] = s['blocks']
    return new


# ── exercises migration（可能拆成多个 section） ────────────────────────────

def migrate_exercises(s: dict[str, Any]) -> list[dict[str, Any]]:
    # 扁平形式：section 顶层带 style + questions
    if 'style' in s and ('questions' in s or 'items' in s):
        flat_group = {
            'style': s['style'],
            'questions': s.get('questions') or s.get('items') or [],
        }
        if s.get('intro'):
            flat_group['instruction'] = s['intro']
        new: dict[str, Any] = {'type': 'exercises'}
        if s.get('heading'):
            new['heading'] = s['heading']
        new['groups'] = [normalize_group(flat_group)]
        return [new]

    # blocks 内嵌 exercise：拆分 content 与 exercise，遇 h2 切段
    if 'blocks' in s and 'groups' not in s:
        return split_mixed_exercises(s)

    # 标准：归一化 groups
    if 'groups' in s:
        new = {k: v for k, v in s.items() if k != 'groups'}
        new['groups'] = [normalize_group(g) for g in s['groups']]
        return [new]

    return [s]


def is_exercise_block(b: dict[str, Any]) -> bool:
    if b.get('type') in ('quiz', 'fill-blank', 'translation'):
        return True
    if 'style' in b and b.get('style') in ('quiz', 'fill-blank', 'translation') and not b.get('type'):
        return True
    return False


def exercise_block_to_group(b: dict[str, Any]) -> dict[str, Any]:
    style = b.get('style') or b.get('type')
    return normalize_group({
        'style': style,
        'title': b.get('title') or b.get('heading'),
        'instruction': b.get('instruction') or b.get('intro'),
        'questions': b.get('questions') or b.get('items') or [],
    })


def split_mixed_exercises(s: dict[str, Any]) -> list[dict[str, Any]]:
    sections: list[dict[str, Any]] = []
    cur_heading: str | None = s.get('heading')
    cur_blocks: list[dict[str, Any]] = []
    cur_groups: list[dict[str, Any]] = []

    def flush() -> None:
        if not cur_blocks and not cur_groups and not cur_heading:
            return
        out: dict[str, Any] = {'type': 'exercises'}
        if cur_heading:
            out['heading'] = cur_heading
        if cur_blocks:
            out['blocks'] = list(cur_blocks)
        if cur_groups:
            out['groups'] = list(cur_groups)
        else:
            # 没有 groups 的情况 → 退化为 grammar（保留 blocks）
            out = {'type': 'grammar'}
            if cur_heading:
                out['heading'] = cur_heading
            out['blocks'] = list(cur_blocks)
        sections.append(out)

    for b in s['blocks']:
        if b.get('type') == 'h2':
            # h2 作为新段标题：先冲刷当前
            flush()
            cur_heading = b.get('text') or b.get('html') or ''
            cur_blocks = []
            cur_groups = []
            continue
        if is_exercise_block(b):
            cur_groups.append(exercise_block_to_group(b))
        else:
            cur_blocks.append(b)

    flush()
    return sections


# ── dispatcher ────────────────────────────────────────────────────────────

def migrate_section(s: dict[str, Any]) -> list[dict[str, Any]]:
    t = s.get('type')
    if t == 'vocab-table':
        return [migrate_vocab_table(s)]
    if t == 'grammar':
        return migrate_grammar(s)
    if t == 'examples':
        # examples 可能被降级为 grammar；若是就继续按 grammar 拆 h2
        out = migrate_examples(s)
        if out.get('type') == 'grammar':
            return migrate_grammar(out)
        return [out]
    if t == 'summary':
        return [migrate_summary(s)]
    if t == 'sentence-analysis':
        out = migrate_sentence_analysis(s)
        if out.get('type') == 'grammar':
            return migrate_grammar(out)
        return [out]
    if t == 'exercises':
        return migrate_exercises(s)
    return [s]


def migrate_file(path: Path) -> tuple[dict[str, Any], bool]:
    data = json.loads(path.read_text(encoding='utf-8'))
    original = json.dumps(data, ensure_ascii=False, sort_keys=True)
    new_sections: list[dict[str, Any]] = []
    for s in data.get('sections', []):
        new_sections.extend(migrate_section(s))
    data['sections'] = new_sections
    changed = json.dumps(data, ensure_ascii=False, sort_keys=True) != original
    return data, changed


# ── entrypoint ────────────────────────────────────────────────────────────

def main(write: bool) -> int:
    total = 0
    changed_files: list[str] = []
    for d in COURSE_DIRS:
        for f in sorted(d.glob('*.json')):
            total += 1
            new_data, changed = migrate_file(f)
            if not changed:
                continue
            changed_files.append(str(f.relative_to(ROOT)))
            if write:
                f.write_text(
                    json.dumps(new_data, ensure_ascii=False, indent=2) + '\n',
                    encoding='utf-8',
                )
    mode = 'WROTE' if write else 'DRY-RUN'
    print(f'[{mode}] scanned {total} files, {len(changed_files)} changed:')
    for f in changed_files:
        print(f'  - {f}')
    return 0


if __name__ == '__main__':
    write = '--write' in sys.argv
    sys.exit(main(write))

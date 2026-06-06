#!/usr/bin/env python3
"""
严格校验 frontend/public/{legal,uk}/*.json 是否符合规范 schema。

规范 schema 的权威定义：frontend/src/features/courses/types/lesson.ts
渲染/判题实现：frontend/src/features/courses/components/（LessonRenderer + sections/blocks/exercises）
正文指南：docs/course-legal-english.md / docs/course-ukrainian.md

本校验分两层：
  1) 结构层 —— section/block/exercise 的类型枚举、容器键、历史别名/禁用字段
  2) 内容层 —— 题目级必填字段 + 与渲染器一致的判题不变式：
       · quiz   : options 必须是字符串数组（渲染器 stripHtml(opt) 不接受对象，会崩）；
                  stripHtml(answer) 必须恰好命中一个 stripHtml(option)
                  （QuizExercise.vue 的判题逻辑：`stripHtml(opt) === stripHtml(q.answer)`）
       · fill-blank: prompt 必须恰好包含一个 "____"（FillBlankExercise 按 "____" 切分，
                  但只校验一个 answer；0 个则无法作答，>1 个则多出的输入框无判题）
       · translation: 必须有 source（AI 批改的唯一原文来源）

用法：python3 scripts/validate_course_schema.py
退出码：0 = 全部通过，1 = 有违规项
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COURSE_DIRS = [
    ROOT / 'frontend' / 'public' / 'legal',
    ROOT / 'frontend' / 'public' / 'uk',
]

CANON_SECTION_TYPES = {
    'vocab-preload', 'vocab-table', 'grammar', 'examples',
    'exercises', 'summary', 'sentence-analysis',
}
ALLOWED_BLOCK_TYPES = {
    'p', 'h3', 'h4', 'tip', 'note', 'error-warn', 'grammar-box',
    'ul', 'ol', 'table', 'details',
}
# html|text 二选一即可的内容块（ContentBlock.vue 用 html||text 渲染）
CONTENT_BLOCK_TYPES = {'p', 'h3', 'h4', 'tip', 'note', 'error-warn', 'grammar-box'}
EXERCISE_STYLES = {'quiz', 'fill-blank', 'translation'}

_TAG_RE = re.compile(r'<[^>]*>')


def strip_html(s: str) -> str:
    """镜像 frontend utils/grading.ts 的 stripHtml：去标签 + trim。"""
    return _TAG_RE.sub('', s).strip()


def validate_file(path: Path, errors: list[str]) -> None:
    rel = str(path.relative_to(ROOT))
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except Exception as e:
        errors.append(f'{rel}: invalid JSON — {e}')
        return

    if not isinstance(data, dict) or 'sections' not in data:
        errors.append(f'{rel}: missing top-level "sections"')
        return

    if not isinstance(data.get('title'), str) or not data['title'].strip():
        errors.append(f'{rel}: missing/empty top-level "title"')

    for i, s in enumerate(data.get('sections', [])):
        t = s.get('type')
        sid = f'{rel} sections[{i}]'
        if t not in CANON_SECTION_TYPES:
            errors.append(f'{sid}: unknown type={t!r}')
            continue

        if t == 'vocab-preload':
            if 'groups' not in s:
                errors.append(f'{sid}: vocab-preload missing groups')
            for gi, g in enumerate(s.get('groups') or []):
                if not isinstance(g.get('words'), list):
                    errors.append(f'{sid}.groups[{gi}]: missing words')
                    continue
                for wi, w in enumerate(g['words']):
                    if not isinstance(w, dict) or not w.get('word') or not w.get('def'):
                        errors.append(f'{sid}.groups[{gi}].words[{wi}]: missing word/def')

        elif t == 'vocab-table':
            if 'columns' not in s:
                errors.append(f'{sid}: vocab-table missing columns')
            if 'rows' not in s:
                errors.append(f'{sid}: vocab-table missing rows')
            elif not all(isinstance(r, list) for r in s.get('rows') or []):
                errors.append(f'{sid}: vocab-table rows must be arrays of cells')
            if 'blocks' in s:
                errors.append(f'{sid}: vocab-table should not have blocks')

        elif t == 'grammar':
            if 'blocks' not in s:
                errors.append(f'{sid}: grammar missing blocks')
            _check_blocks(s.get('blocks') or [], sid, errors)

        elif t == 'examples':
            if 'groups' not in s:
                errors.append(f'{sid}: examples missing groups')
            if 'blocks' in s:
                errors.append(f'{sid}: examples should not have blocks (use grammar section instead)')
            for gi, g in enumerate(s.get('groups') or []):
                if 'items' not in g:
                    errors.append(f'{sid}.groups[{gi}]: missing items')
                if 'questions' in g:
                    errors.append(f'{sid}.groups[{gi}]: should use items not questions')
                for ii, it in enumerate(g.get('items') or []):
                    if not isinstance(it, dict) or not it.get('text'):
                        errors.append(f'{sid}.groups[{gi}].items[{ii}]: missing text')

        elif t == 'exercises':
            if 'groups' not in s:
                errors.append(f'{sid}: exercises missing groups')
            if 'style' in s:
                errors.append(f'{sid}: exercises flat style not allowed — wrap in groups')
            if 'questions' in s or 'items' in s:
                errors.append(f'{sid}: exercises flat questions/items not allowed — wrap in groups')
            for gi, g in enumerate(s.get('groups') or []):
                _check_exercise_group(g, f'{sid}.groups[{gi}]', errors)
            _check_blocks(s.get('blocks') or [], sid, errors)

        elif t == 'summary':
            if 'blocks' in s:
                errors.append(f'{sid}: summary should not have blocks — use html or points')
            if 'html' not in s and 'points' not in s:
                errors.append(f'{sid}: summary missing html or points')

        elif t == 'sentence-analysis':
            if 'items' not in s:
                errors.append(f'{sid}: sentence-analysis missing items')
            if 'blocks' in s:
                errors.append(f'{sid}: sentence-analysis should not have blocks')
            for ii, it in enumerate(s.get('items') or []):
                if not isinstance(it, dict) or not it.get('sentence'):
                    errors.append(f'{sid}.items[{ii}]: missing sentence')


def _check_exercise_group(g: dict, gid: str, errors: list[str]) -> None:
    style = g.get('style')
    if style not in EXERCISE_STYLES:
        errors.append(f'{gid}: invalid style={style!r} (allowed: {sorted(EXERCISE_STYLES)})')
    if 'items' in g:
        errors.append(f'{gid}: should use questions not items')
    if 'heading' in g:
        errors.append(f'{gid}: should use title not heading')
    if 'intro' in g:
        errors.append(f'{gid}: should use instruction not intro')
    if 'questions' not in g:
        errors.append(f'{gid}: missing questions')
        return

    for qi, q in enumerate(g.get('questions') or []):
        qid = f'{gid}.questions[{qi}]'
        if not isinstance(q, dict):
            errors.append(f'{qid}: must be an object')
            continue

        if style == 'quiz':
            if not q.get('prompt'):
                errors.append(f'{qid}: quiz missing prompt')
            opts = q.get('options')
            ans = q.get('answer')
            if not isinstance(opts, list) or not opts:
                errors.append(f'{qid}: quiz missing/empty options')
                continue
            if not all(isinstance(o, str) for o in opts):
                errors.append(f'{qid}: quiz options must be strings, not objects '
                              f'(renderer stripHtml() expects a string)')
                continue
            if ans is None:
                errors.append(f'{qid}: quiz missing answer')
                continue
            stripped = [strip_html(o) for o in opts]
            if strip_html(str(ans)) not in stripped:
                errors.append(f'{qid}: quiz answer {strip_html(str(ans))!r} does not match '
                              f'any option {stripped} (after stripHtml) — would never grade correct')

        elif style == 'fill-blank':
            prompt = q.get('prompt')
            if not prompt:
                errors.append(f'{qid}: fill-blank missing prompt')
            else:
                n = prompt.count('____')
                if n != 1:
                    errors.append(f'{qid}: fill-blank prompt has {n} "____" placeholders (need exactly 1)')
            if not q.get('answer'):
                errors.append(f'{qid}: fill-blank missing answer')

        elif style == 'translation':
            if not q.get('source'):
                errors.append(f'{qid}: translation missing source')


def _check_blocks(blocks: list[dict], sid: str, errors: list[str]) -> None:
    for bi, b in enumerate(blocks):
        bt = b.get('type')
        bid = f'{sid}.blocks[{bi}]'
        if bt not in ALLOWED_BLOCK_TYPES:
            errors.append(f'{bid}: invalid block type={bt!r}')
            continue
        if bt in CONTENT_BLOCK_TYPES:
            if not b.get('html') and not b.get('text'):
                errors.append(f'{bid}: {bt} block missing html/text')
        elif bt in ('ul', 'ol'):
            if not isinstance(b.get('items'), list):
                errors.append(f'{bid}: {bt} block missing items[]')
        elif bt == 'table':
            if not isinstance(b.get('rows'), list):
                errors.append(f'{bid}: table block missing rows[]')
        elif bt == 'details':
            if not b.get('html'):
                errors.append(f'{bid}: details block missing html')


def main() -> int:
    errors: list[str] = []
    count = 0
    for d in COURSE_DIRS:
        for f in sorted(d.glob('*.json')):
            count += 1
            validate_file(f, errors)
    if errors:
        print(f'{len(errors)} error(s) across {count} files:')
        for e in errors:
            print(f'  {e}')
        return 1
    print(f'OK — all {count} course JSON files conform to canonical schema.')
    return 0


if __name__ == '__main__':
    sys.exit(main())

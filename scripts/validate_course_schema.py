#!/usr/bin/env python3
"""
严格校验 frontend/public/{legal,uk}/*.json 是否符合规范 schema。

规范 schema 的权威定义：frontend/src/features/courses/types/lesson.ts
正文指南：docs/course-legal-english.md / docs/course-ukrainian.md

用法：python3 scripts/validate_course_schema.py
退出码：0 = 全部通过，1 = 有违规项
"""
from __future__ import annotations

import json
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
EXERCISE_STYLES = {'quiz', 'fill-blank', 'translation'}


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

    for i, s in enumerate(data.get('sections', [])):
        t = s.get('type')
        sid = f'{rel} sections[{i}]'
        if t not in CANON_SECTION_TYPES:
            errors.append(f'{sid}: unknown type={t!r}')
            continue

        if t == 'vocab-preload':
            if 'groups' not in s:
                errors.append(f'{sid}: vocab-preload missing groups')

        elif t == 'vocab-table':
            if 'columns' not in s:
                errors.append(f'{sid}: vocab-table missing columns')
            if 'rows' not in s:
                errors.append(f'{sid}: vocab-table missing rows')
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

        elif t == 'exercises':
            if 'groups' not in s:
                errors.append(f'{sid}: exercises missing groups')
            if 'style' in s:
                errors.append(f'{sid}: exercises flat style not allowed — wrap in groups')
            if 'questions' in s or 'items' in s:
                errors.append(f'{sid}: exercises flat questions/items not allowed — wrap in groups')
            for gi, g in enumerate(s.get('groups') or []):
                style = g.get('style')
                if style not in EXERCISE_STYLES:
                    errors.append(f'{sid}.groups[{gi}]: invalid style={style!r} (allowed: {EXERCISE_STYLES})')
                if 'questions' not in g:
                    errors.append(f'{sid}.groups[{gi}]: missing questions')
                if 'items' in g:
                    errors.append(f'{sid}.groups[{gi}]: should use questions not items')
                if 'heading' in g:
                    errors.append(f'{sid}.groups[{gi}]: should use title not heading')
                if 'intro' in g:
                    errors.append(f'{sid}.groups[{gi}]: should use instruction not intro')
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


def _check_blocks(blocks: list[dict], sid: str, errors: list[str]) -> None:
    for bi, b in enumerate(blocks):
        bt = b.get('type')
        if bt not in ALLOWED_BLOCK_TYPES:
            errors.append(f'{sid}.blocks[{bi}]: invalid block type={bt!r}')


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

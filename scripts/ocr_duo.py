#!/usr/bin/env python3
"""从多邻国截图中提取乌克兰语单词 + 英文释义（macOS Vision OCR）。"""

from __future__ import annotations
import subprocess
import sys
import re
import json
from pathlib import Path

CYRILLIC_RE = re.compile(r'[а-яА-ЯіїєґІЇЄҐ]')
LATIN_RE = re.compile(r'[a-zA-Z]')

# UI 噪声
NOISE = {
    'words', 'start +10 xp', 'start', '+10 xp',
}


def ocr_image(img_path: str) -> list[str]:
    result = subprocess.run(
        ['swift', 'scripts/ocr_vision.swift', img_path],
        capture_output=True, text=True
    )
    return [l.strip() for l in result.stdout.strip().split('\n') if l.strip()]


def extract_words(img_path: str) -> list[dict]:
    lines = ocr_image(img_path)
    pairs = []
    current_word = None

    for line in lines:
        # 跳过 UI 噪声
        if line.lower() in NOISE:
            continue
        # 跳过纯数字/时间/短噪声
        if re.match(r'^[\d:.\s%A-Z]{1,10}$', line):
            continue

        cyrillic = len(CYRILLIC_RE.findall(line))
        latin = len(LATIN_RE.findall(line))

        if cyrillic > latin and cyrillic >= 1:
            # 乌克兰语单词
            current_word = line
        elif latin > cyrillic and current_word:
            # 英文释义
            pairs.append({'word': current_word, 'definition': line})
            current_word = None

    return pairs


def main():
    if len(sys.argv) < 2:
        print("用法: python ocr_duo.py <图片路径或目录>", file=sys.stderr)
        sys.exit(1)

    target = Path(sys.argv[1])

    if target.is_file():
        files = [target]
    elif target.is_dir():
        files = sorted(target.glob('IMG_52*.PNG'))
    else:
        print(f"找不到: {target}", file=sys.stderr)
        sys.exit(1)

    all_words = []
    seen = set()

    for f in files:
        pairs = extract_words(str(f))
        for p in pairs:
            key = p['word'].lower()
            if key not in seen:
                seen.add(key)
                all_words.append(p)
        print(f"  {f.name}: 提取 {len(pairs)} 个词条", file=sys.stderr)

    print(json.dumps(all_words, ensure_ascii=False, indent=2))
    print(f"\n总计: {len(all_words)} 个不重复词条", file=sys.stderr)


if __name__ == '__main__':
    main()

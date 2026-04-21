#!/usr/bin/env python3
"""把 legal/*.json 里的"合同全大写"长句转为 Sentence case。

扫描范围：
 - 所有 section 里 blocks/items/groups 中的字符串字段（递归）
 - 但只对"整段近似全大写的英文字符串"动手（>= 3 个单词，字母全大写比例 >= 0.9）

转换规则：
 1. 整体小写
 2. 句首（以及 `. `/`! `/`? ` 后）字母大写
 3. 把一批合同常用"术语/专有概念"恢复首字母大写（Provider, Client, Party, Agreement 等）
 4. 把一批缩略语恢复全大写（USD, VAT, IN NO EVENT SHALL 等句首短语除外 — 它们依赖首字母大写规则）

默认 dry-run：打印将变更的条目；加 --apply 才写文件。
"""
import json
import os
import re
import glob
import sys

COURSE_DIRS = {
    'legal': os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'legal'),
    'uk': os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'uk'),
}


# 合同常用"首字母大写"术语（按 token 匹配，大小写不敏感）
TITLE_CASE_TERMS = [
    "Agreement", "Party", "Parties", "Section", "Sections", "Article", "Articles",
    "Provider", "Client", "Buyer", "Seller", "Supplier", "Contractor", "Company",
    "Licensee", "Licensor", "Payor", "Recipient", "Payee",
    "Services", "Goods", "Deliverable", "Deliverables", "Fees", "Services'",
    "Effective Date", "Target Date", "Closing Date", "Closing",
    "Business Day", "Business Days",
    "Confidential Information", "Disclosing Party", "Receiving Party",
    "Schedule", "Exhibit",
    "Milestone Event", "Indemnified Parties", "Liability Cap",
    "Affiliate", "Affiliates",
]

# 缩略语（保持全大写）
ALL_CAPS_TERMS = [
    "USD", "VAT", "EUR", "GBP", "RMB", "CNY",
    "NDA", "LLC", "GAAP", "IFRS", "FOB", "CIF",
    "IP", "HR", "IT", "CEO", "CFO", "NYSE",
]


def is_mostly_upper(s: str, threshold: float = 0.9) -> bool:
    """字符串是否"几乎全大写"：字母中大写占比 >= threshold 且至少 3 个单词。"""
    letters = [c for c in s if c.isalpha()]
    if len(letters) < 12:
        return False
    upper = sum(1 for c in letters if c.isupper())
    if upper / len(letters) < threshold:
        return False
    words = [w for w in re.split(r'\s+', s.strip()) if any(c.isalpha() for c in w)]
    return len(words) >= 3


def to_sentence_case(s: str) -> str:
    """核心转换：小写 → 句首大写 → 恢复术语大小写"""
    low = s.lower()
    # 句首及标点后首字母大写
    def cap_first(m):
        return m.group(1) + m.group(2).upper()
    out = re.sub(r'(^|[.!?]\s+|["“]|\()([a-z])', cap_first, low)

    # 术语恢复（按长→短，避免"Party" 覆盖 "Parties"）
    terms = sorted(TITLE_CASE_TERMS, key=len, reverse=True)
    for term in terms:
        pattern = re.compile(r'\b' + re.escape(term.lower()) + r'\b', re.IGNORECASE)
        out = pattern.sub(lambda m: term, out)

    # 缩略语全大写
    for abbr in ALL_CAPS_TERMS:
        pattern = re.compile(r'\b' + re.escape(abbr.lower()) + r'\b', re.IGNORECASE)
        out = pattern.sub(abbr, out)

    return out


# 扫描字符串字段时跳过的 HTML 片段：只替换 <span class="en-text">...</span> 内部的大写
EN_TEXT_RE = re.compile(r'(<span class="en-text">)(.*?)(</span>)', re.DOTALL)


def normalize_string(s: str) -> tuple[str, bool]:
    """对字符串做全大写检测与转换。返回 (新字符串, 是否改动)。
    - 若字符串是裸文本（不含 en-text span），整体判断
    - 若字符串含 en-text span，只针对 span 内部文本判断
    """
    if not isinstance(s, str):
        return s, False

    changed = False

    # 有 en-text span：按 span 拆
    if '<span class="en-text">' in s:
        def replace_en_text(m):
            nonlocal changed
            head, content, tail = m.group(1), m.group(2), m.group(3)
            if is_mostly_upper(content):
                new_content = to_sentence_case(content)
                if new_content != content:
                    changed = True
                    return head + new_content + tail
            return m.group(0)
        new_s = EN_TEXT_RE.sub(replace_en_text, s)
        return new_s, changed

    # 裸文本（如 sentence-analysis.sentence 字段）
    if is_mostly_upper(s):
        new_s = to_sentence_case(s)
        if new_s != s:
            return new_s, True

    return s, False


def walk(obj, path='', changes=None):
    """递归遍历 JSON，在需要时规范化字符串并记录改动"""
    if changes is None:
        changes = []

    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str):
                new_v, changed = normalize_string(v)
                if changed:
                    obj[k] = new_v
                    changes.append((path + '.' + k, v[:80], new_v[:80]))
            else:
                walk(v, path + '.' + k, changes)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            if isinstance(v, str):
                new_v, changed = normalize_string(v)
                if changed:
                    obj[i] = new_v
                    changes.append((f'{path}[{i}]', v[:80], new_v[:80]))
            else:
                walk(v, f'{path}[{i}]', changes)

    return changes


def process(path, apply=False):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    changes = walk(data)
    if not changes:
        return 0

    filename = os.path.basename(path)
    print(f'\n=== {filename} ({len(changes)} changes) ===')
    for p, old, new in changes:
        print(f'  {p}')
        print(f'    - {old}')
        print(f'    + {new}')

    if apply:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')
    return len(changes)


def main():
    apply = '--apply' in sys.argv
    # 目录选择：--course=legal|uk|all（默认 legal，向后兼容）
    course = 'legal'
    for arg in sys.argv[1:]:
        if arg.startswith('--course='):
            course = arg.split('=', 1)[1]
    if course == 'all':
        dirs = list(COURSE_DIRS.values())
    elif course in COURSE_DIRS:
        dirs = [COURSE_DIRS[course]]
    else:
        print(f'Unknown --course={course}; expected one of: legal, uk, all', file=sys.stderr)
        sys.exit(2)

    total = 0
    files_changed = 0
    for d in dirs:
        for path in sorted(glob.glob(os.path.join(d, '*.json'))):
            n = process(path, apply=apply)
            if n:
                total += n
                files_changed += 1
    mode = 'APPLIED' if apply else 'DRY-RUN'
    print(f'\n[{mode}] {total} changes across {files_changed} files.')


if __name__ == '__main__':
    main()

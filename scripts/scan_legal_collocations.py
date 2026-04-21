#!/usr/bin/env python3
"""扫描 legal/*.json 中"固定搭配" section 里的例句，输出待翻译列表。"""
import json
import os
import glob

LEGAL_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'legal')
OUT_FILE = os.path.join(os.path.dirname(__file__), 'legal_collocations_to_translate.json')


def scan_file(path):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)

    results = []
    for si, section in enumerate(data.get('sections', [])):
        if section.get('type') != 'grammar':
            continue
        heading = section.get('heading', '')
        if '固定搭配' not in heading:
            continue
        for bi, block in enumerate(section.get('blocks', [])):
            if block.get('type') != 'table':
                continue
            headers = block.get('headers', [])
            # 例句列索引：优先找 headers 里"例句"所在位置，找不到则默认最后一列
            if '例句' in headers:
                col_idx = headers.index('例句')
            else:
                col_idx = len(headers) - 1
            for ri, row in enumerate(block.get('rows', [])):
                if col_idx >= len(row):
                    continue
                cell = row[col_idx]
                if isinstance(cell, str):
                    results.append({
                        'section_idx': si,
                        'block_idx': bi,
                        'row_idx': ri,
                        'col_idx': col_idx,
                        'en': cell,
                        'zh': '',  # 待填
                    })
    return results


def main():
    all_results = {}
    for path in sorted(glob.glob(os.path.join(LEGAL_DIR, '*.json'))):
        filename = os.path.basename(path)
        items = scan_file(path)
        if items:
            all_results[filename] = items
    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    total = sum(len(v) for v in all_results.values())
    print(f'Scanned {len(all_results)} files, {total} examples to translate.')
    print(f'Output: {OUT_FILE}')


if __name__ == '__main__':
    main()

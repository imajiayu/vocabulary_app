# -*- coding: utf-8 -*-
"""
从 IELTS-4000.txt 提取纯单词列表
输出: backend/data/ielts_words_clean.txt (每行一个单词，无空行)
"""
import re
from pathlib import Path

def extract_words():
    input_path = Path(__file__).parent.parent / "data" / "IELTS-4000.txt"
    output_path = Path(__file__).parent.parent / "data" / "ielts_words_clean.txt"

    words = []

    with open(input_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue

            # 跳过标题行
            if line in ("IELTS", "4000 Academic Word List"):
                continue

            # 跳过字母分节 (单个大写字母)
            if re.match(r"^[A-Z]$", line):
                continue

            # 跳过非单词行 (如 "Sưu tầm..." 之类的注释)
            if ":" not in line:
                continue

            # 提取单词 (冒号前的部分)
            word_part = line.split(":")[0].strip()

            # 验证是有效单词: 纯小写字母，可能带连字符
            if re.match(r"^[a-z]+(-[a-z]+)*$", word_part):
                words.append(word_part)

    # 去重并保持顺序
    seen = set()
    unique_words = []
    for w in words:
        if w not in seen:
            seen.add(w)
            unique_words.append(w)

    # 写入输出文件
    with open(output_path, "w", encoding="utf-8") as f:
        for word in unique_words:
            f.write(word + "\n")

    print(f"提取完成: {len(unique_words)} 个单词")
    print(f"输出文件: {output_path}")
    return unique_words

if __name__ == "__main__":
    extract_words()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
临时脚本：打乱 gre_missing_words.txt 中的单词顺序
"""
import random

# 文件路径
input_file = "web_app/data/gre_missing_words.txt"
output_file = "web_app/data/gre_missing_words_shuffled.txt"

# 读取所有单词
with open(input_file, "r", encoding="utf-8") as f:
    words = [line.strip() for line in f if line.strip()]

print(f"读取了 {len(words)} 个单词")

# 打乱顺序
random.shuffle(words)

# 写回文件（可以选择覆盖原文件或写入新文件）
with open(output_file, "w", encoding="utf-8") as f:
    for word in words:
        f.write(word + "\n")

print(f"已将打乱后的单词写入: {output_file}")
print(f"前10个单词: {words[:10]}")

# 如果要覆盖原文件，取消下面的注释
# with open(input_file, "w", encoding="utf-8") as f:
#     for word in words:
#         f.write(word + "\n")
# print(f"已覆盖原文件: {input_file}")

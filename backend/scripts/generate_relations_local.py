#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
本地关系生成脚本 - CSV 工作流

使用方法:
1. 从 Supabase 下载 CSV:
   - words 表 → words.csv (需要列: id, word, definition)
   - word_relations 表 → relations.csv (需要列: word_id, related_word_id, relation_type)
   - relation_generation_log 表 → generation_log.csv (需要列: word_id, relation_type)

2. 运行脚本:
   python generate_relations_local.py --type synonym --words words.csv
   python generate_relations_local.py --type all --words words.csv

3. 将输出的 CSV 导入回 Supabase:
   - new_relations_*.csv → 导入到 word_relations 表
   - new_logs_*.csv → 导入到 relation_generation_log 表

支持的关系类型: synonym, antonym, root, confused, topic, all
"""

import argparse
import csv
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Set, Tuple

# 导入重构后的生成器
from relations.synonym_generator import SynonymGenerator
from relations.antonym_generator import AntonymGenerator
from relations.root_generator import RootGenerator
from relations.confused_generator import ConfusedGenerator
from relations.topic_generator import TopicGenerator
from relations.base import print_section, print_stat


def load_words_csv(filepath: str) -> List[Dict]:
    """加载单词 CSV"""
    words = []
    print(f"\n📖 加载单词文件: {filepath}")

    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            words.append({
                'id': int(row['id']),
                'word': row['word'],
                'definition': row.get('definition', '')
            })

    print(f"   ✓ 加载了 {len(words)} 个单词")
    return words


def load_generation_log_csv(filepath: str, relation_type: str = None) -> Set[int]:
    """
    加载生成日志 CSV，返回已处理的 word_id 集合

    参数:
    - filepath: 日志文件路径
    - relation_type: 如果指定，只返回该类型已处理的 word_id
    """
    processed_ids = set()

    if not Path(filepath).exists():
        print(f"📋 生成日志文件不存在: {filepath}（将处理所有单词）")
        return processed_ids

    print(f"📋 加载生成日志: {filepath}")

    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            word_id = int(row['word_id'])
            log_type = row['relation_type']
            if relation_type is None or log_type == relation_type:
                processed_ids.add(word_id)

    print(f"   ✓ 已处理单词: {len(processed_ids)} 个")
    return processed_ids


def load_existing_relations_csv(filepath: str) -> Set[Tuple[int, int, str]]:
    """加载现有关系 CSV，返回 (word_id, related_word_id, relation_type) 集合"""
    relations = set()

    if not Path(filepath).exists():
        print(f"🔗 关系文件不存在: {filepath}（将创建所有新关系）")
        return relations

    print(f"🔗 加载现有关系: {filepath}")

    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            word_id = int(row['word_id'])
            related_word_id = int(row['related_word_id'])
            relation_type = row['relation_type']
            relations.add((word_id, related_word_id, relation_type))

    print(f"   ✓ 现有关系: {len(relations)} 条")
    return relations


def save_relations_csv(relations: List[Dict], filepath: str):
    """保存新关系到 CSV"""
    if not relations:
        print(f"💾 没有新关系需要保存")
        return

    print(f"💾 保存新关系: {filepath}")

    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['word_id', 'related_word_id', 'relation_type', 'confidence'])
        writer.writeheader()
        writer.writerows(relations)

    print(f"   ✓ 保存了 {len(relations)} 条新关系")


def save_generation_log_csv(logs: List[Dict], filepath: str):
    """保存生成日志到 CSV"""
    if not logs:
        return

    print(f"📝 保存生成日志: {filepath}")

    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['word_id', 'relation_type', 'processed_at', 'found_count'])
        writer.writeheader()
        writer.writerows(logs)

    print(f"   ✓ 保存了 {len(logs)} 条日志")


# ============== 生成器映射 ==============

GENERATOR_CLASSES = {
    'synonym': SynonymGenerator,
    'antonym': AntonymGenerator,
    'root': RootGenerator,
    'confused': ConfusedGenerator,
    'topic': TopicGenerator,
}


def run_generator(
    relation_type: str,
    words: List[Dict],
    word_index: Dict[str, int],
    existing_relations: Set[Tuple[int, int, str]],
    log_filepath: str
) -> Tuple[List[Dict], List[Dict]]:
    """运行指定类型的生成器"""

    # 加载该类型的已处理单词
    processed_word_ids = load_generation_log_csv(log_filepath, relation_type)

    # 创建生成器实例
    generator_class = GENERATOR_CLASSES.get(relation_type)
    if not generator_class:
        print(f"❌ 未知的关系类型: {relation_type}")
        return [], []

    generator = generator_class()

    # 运行生成
    result = generator.generate(
        words=words,
        word_index=word_index,
        existing_relations=existing_relations,
        processed_word_ids=processed_word_ids
    )

    return result.relations, result.logs


def main():
    parser = argparse.ArgumentParser(
        description="本地关系生成脚本 - CSV 工作流",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s --type synonym --words words.csv
  %(prog)s --type root --words words.csv --log log.csv --relations relations.csv
  %(prog)s --type all --words words.csv --output-dir ./output
        """
    )
    parser.add_argument(
        '--type', '-t',
        required=True,
        choices=list(GENERATOR_CLASSES.keys()) + ['all'],
        help='关系类型 (synonym/antonym/root/confused/topic/all)'
    )
    parser.add_argument(
        '--words', '-w',
        required=True,
        help='单词 CSV 文件路径 (需要列: id, word, definition)'
    )
    parser.add_argument(
        '--log', '-l',
        default='generation_log.csv',
        help='生成日志 CSV 文件路径 (默认: generation_log.csv)'
    )
    parser.add_argument(
        '--relations', '-r',
        default='relations.csv',
        help='现有关系 CSV 文件路径 (默认: relations.csv)'
    )
    parser.add_argument(
        '--output-dir', '-o',
        default='.',
        help='输出目录 (默认: 当前目录)'
    )

    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("  🚀 本地关系生成脚本")
    print("=" * 60)

    # 加载数据
    words = load_words_csv(args.words)
    existing_relations = load_existing_relations_csv(args.relations)

    # 构建单词索引
    word_index = {w['word'].lower(): w['id'] for w in words}

    # 确定要运行的生成器
    if args.type == 'all':
        types_to_run = list(GENERATOR_CLASSES.keys())
    else:
        types_to_run = [args.type]

    # 输出目录
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    all_new_relations = []
    all_new_logs = []

    for relation_type in types_to_run:
        new_relations, new_logs = run_generator(
            relation_type=relation_type,
            words=words,
            word_index=word_index,
            existing_relations=existing_relations,
            log_filepath=args.log
        )
        all_new_relations.extend(new_relations)
        all_new_logs.extend(new_logs)

    # 保存结果
    print("\n" + "─" * 60)
    print("  📦 保存结果")
    print("─" * 60)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    relations_file = output_dir / f"new_relations_{timestamp}.csv"
    logs_file = output_dir / f"new_logs_{timestamp}.csv"

    save_relations_csv(all_new_relations, str(relations_file))
    save_generation_log_csv(all_new_logs, str(logs_file))

    print("\n" + "=" * 60)
    print("  ✅ 生成完成!")
    print_stat("新关系", f"{len(all_new_relations)} 条")
    print_stat("处理日志", f"{len(all_new_logs)} 条")
    if all_new_relations:
        print_stat("关系文件", str(relations_file))
    if all_new_logs:
        print_stat("日志文件", str(logs_file))
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()

import os
from typing import List
import logging
import nltk
from web_app.models.word import RelationType
from web_app.scripts.word_relations.antonym import generate_antonym_relations
from web_app.scripts.word_relations.confused import generate_confused_relations
from web_app.scripts.word_relations.root import generate_root_relations
from web_app.scripts.word_relations.synonym import generate_synonym_relations
from web_app.scripts.word_relations.topic import generate_topic_relations
from web_app.scripts.word_relations.utils import (
    clear_relations,
    export_relations_to_file,
)

logging.basicConfig(level=logging.INFO)

NLTK_DATA_PACKAGES = [
    "wordnet",
    "omw-1.4",
    "averaged_perceptron_tagger",
]


def ensure_nltk_data():
    """检查并下载缺失的 NLTK 数据包"""

    # 这一步是关键：在查找之前，将自定义路径添加到 NLTK 的搜索路径中
    custom_nltk_data_path = "/Users/majiayu/vocabulary_app/.venv/nltk_data"
    if custom_nltk_data_path not in nltk.data.path:
        nltk.data.path.append(custom_nltk_data_path)

    # 可选：如果您不需要代理，可以移除或注释掉以下两行
    os.environ["http_proxy"] = "http://127.0.0.1:7897"
    os.environ["https_proxy"] = "http://127.0.0.1:7897"

    for pkg in NLTK_DATA_PACKAGES:
        try:
            nltk.data.find(pkg)
            logging.info(f"NLTK 数据包 '{pkg}' 已存在。")
        except LookupError:
            logging.info(f"NLTK 数据包 '{pkg}' 缺失，正在下载...")
            nltk.download(pkg, download_dir=custom_nltk_data_path)


def generate_relations(types_to_generate: List[RelationType] = None):
    clear_relations(types_to_generate)
    """按照优先级生成关系"""
    if types_to_generate is None or RelationType.synonym in types_to_generate:
        generate_synonym_relations()

    if types_to_generate is None or RelationType.antonym in types_to_generate:
        generate_antonym_relations()

    if types_to_generate is None or RelationType.root in types_to_generate:
        generate_root_relations()

    if types_to_generate is None or RelationType.confused in types_to_generate:
        generate_confused_relations()

    if types_to_generate is None or RelationType.topic in types_to_generate:
        generate_topic_relations()


if __name__ == "__main__":
    ensure_nltk_data()
    generate_relations(
        [
            RelationType.root,
        ]
    )
    export_relations_to_file(relation_type=RelationType.root)

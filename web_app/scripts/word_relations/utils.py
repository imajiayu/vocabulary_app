from collections import defaultdict, Counter
from typing import List, Optional
import logging
from sqlalchemy import insert
from web_app.extensions import get_session
from web_app.models.word import RelationType, Word, WordRelation

logging.basicConfig(level=logging.INFO)


def clear_relations(relation_types: Optional[List[RelationType]] = None):
    """清空关系表，可传入多个关系类型列表"""
    with get_session() as session:
        query = session.query(WordRelation)
        if relation_types:
            query = query.filter(WordRelation.relation_type.in_(relation_types))
        deleted_count = query.delete(synchronize_session=False)
        session.commit()

        if relation_types:
            types_str = ", ".join([t.value for t in relation_types])
        else:
            types_str = "all"

        logging.info(f"已删除 {deleted_count} 条关系 ({types_str})")


def export_relations_to_file(filename="tmp.txt", relation_type: RelationType = None):
    """
    导出单词关系到文件，可指定关系类型
    :param filename: 输出文件名
    :param relation_type: RelationType 枚举值，若为 None 则导出所有类型
    """
    with get_session() as session:
        words = session.query(Word).all()

        with open(filename, "w", encoding="utf-8") as f:
            for word in words:
                related_list = word.get_all_related_words(session)

                # 按关系类型过滤
                if relation_type:
                    related_list = [
                        rel
                        for rel in related_list
                        if rel["relation_type"] == relation_type.value
                    ]

                for rel in related_list:
                    line = (
                        f"{word.word} -> {rel['word']} | "
                        f"关系: {rel['relation_type']} | "
                        f"confidence: {rel['confidence']:.2f}\n"
                    )
                    f.write(line)

    if relation_type:
        print(f"{relation_type.value} 关系已导出到 {filename}")
    else:
        print(f"所有单词关系已导出到 {filename}")


def batch_insert_relations(session, relations: list, batch_size: int = 1000):
    """批量插入关系，重复自动忽略"""
    total = len(relations)
    logging.info(f"开始批量插入 {total} 条关系...")

    for i in range(0, total, batch_size):
        batch = relations[i : i + batch_size]
        # 构造 INSERT OR IGNORE
        stmt = insert(WordRelation.__table__).prefix_with("OR IGNORE")
        session.execute(stmt, [rel.__dict__ for rel in batch])
        session.commit()
        logging.info(f"已插入 {min(i+batch_size, total)}/{total} 条关系")

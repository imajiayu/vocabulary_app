# -*- coding: utf-8 -*-
"""
批量操作

注意：所有函数需要 user_id 参数进行用户数据隔离
"""
from backend.extensions import transaction
from backend.models.word import Word, WordRelation


def db_batch_delete_words(word_ids: list[int], user_id: int) -> int:
    """
    批量删除单词及其相关数据（事务保护）

    Args:
        word_ids: 要删除的单词ID列表
        user_id: 用户ID

    Returns:
        int: 成功删除的单词数量
    """
    from backend.models.word import RelationGenerationLog

    with transaction() as db:
        # 1. 删除words_relations中相关的记录（按用户过滤）
        db.query(WordRelation).filter(
            WordRelation.user_id == user_id,
            (WordRelation.word_id.in_(word_ids))
            | (WordRelation.related_word_id.in_(word_ids))
        ).delete(synchronize_session=False)

        # 2. 删除relation_generation_log中的记录（按用户过滤）
        db.query(RelationGenerationLog).filter(
            RelationGenerationLog.user_id == user_id,
            RelationGenerationLog.word_id.in_(word_ids)
        ).delete(synchronize_session=False)

        # 3. 删除单词本身（按用户过滤）
        deleted_count = (
            db.query(Word)
            .filter(Word.user_id == user_id, Word.id.in_(word_ids))
            .delete(synchronize_session=False)
        )

        return deleted_count


def db_batch_update_words(
    word_ids: list[int], update_data: dict, user_id: int
) -> tuple[int, list[dict]]:
    """
    批量更新单词字段（事务保护）

    Args:
        word_ids: 要更新的单词ID列表
        update_data: 要更新的字段字典
        user_id: 用户ID

    Returns:
        tuple: (成功更新的单词数量, 更新后的单词列表)
    """
    with transaction() as db:
        # 批量更新（按用户过滤）
        updated_count = (
            db.query(Word)
            .filter(Word.user_id == user_id, Word.id.in_(word_ids))
            .update(update_data, synchronize_session=False)
        )

        # 获取更新后的单词列表（按用户过滤）
        updated_words = db.query(Word).filter(
            Word.user_id == user_id, Word.id.in_(word_ids)
        ).all()
        words_list = [word.to_dict() for word in updated_words]

        return updated_count, words_list

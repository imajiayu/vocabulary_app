import os
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError
from backend.config import STATIC_PATH
from backend.models.speaking import (
    SpeakingTopic,
    SpeakingQuestion,
    SpeakingRecord,
)
from typing import List, Dict, Any
from backend.extensions import get_session


def db_get_all_topics() -> List[Dict[str, Any]]:
    """
    获取所有topic（包括questions）
    返回结构：id, part, title, questions:[{id, question_text}]
    """
    try:
        with get_session() as session:
            topics = (
                session.query(SpeakingTopic)
                .options(joinedload(SpeakingTopic.questions))
                .order_by(SpeakingTopic.part, SpeakingTopic.id)
                .all()
            )

            results = []
            for topic in topics:
                results.append(
                    {
                        "id": topic.id,
                        "part": topic.part,
                        "title": topic.title,
                        "questions": [
                            {
                                "id": q.id,
                                "question_text": q.question_text,
                                "topic_id": topic.id,
                                "topic_title": topic.title,
                            }
                            for q in topic.questions
                        ],
                    }
                )
            return results
    except SQLAlchemyError as e:
        raise e


def db_get_records_by_question_id(question_id: int) -> List[Dict[str, Any]]:
    """
    根据问题ID获取所有练习记录
    """
    try:
        with get_session() as session:
            records = (
                session.query(SpeakingRecord)
                .filter(SpeakingRecord.question_id == question_id)
                .order_by(SpeakingRecord.id.asc())
                .all()
            )
            return [record.to_dict() for record in records]
    except SQLAlchemyError as e:
        raise e


# ========== 插入函数 ==========


def db_insert_topic(part: int, title: str) -> Dict[str, Any]:
    """
    插入新主题
    """
    try:
        with get_session() as session:
            topic = SpeakingTopic(part=part, title=title)
            session.add(topic)
            session.commit()
            session.refresh(topic)
            return topic.to_dict()
    except SQLAlchemyError as e:
        raise e


def db_insert_question(topic_id: int, question_text: str) -> Dict[str, Any]:
    """
    插入新问题
    """
    try:
        with get_session() as session:
            topic = (
                session.query(SpeakingTopic)
                .filter(SpeakingTopic.id == topic_id)
                .first()
            )
            if not topic:
                raise ValueError(f"Topic with id {topic_id} not found")

            question = SpeakingQuestion(topic_id=topic_id, question_text=question_text)
            session.add(question)
            session.commit()
            session.refresh(question)
            # 确保topic关系被加载
            question.topic = topic
            return question.to_dict()
    except SQLAlchemyError as e:
        raise e


def db_insert_record(
    question_id: int,
    user_answer: str = None,
    audio_file: str = None,
    ai_feedback: str = None,
    score: int = None,
) -> Dict[str, Any]:
    """
    插入练习记录
    """
    try:
        with get_session() as session:
            question = (
                session.query(SpeakingQuestion)
                .filter(SpeakingQuestion.id == question_id)
                .first()
            )
            if not question:
                raise ValueError(f"Question with id {question_id} not found")

            record = SpeakingRecord(
                question_id=question_id,
                user_answer=user_answer,
                audio_file=audio_file,
                ai_feedback=ai_feedback,
                score=score,
            )
            session.add(record)
            session.commit()
            session.refresh(record)
            return record.to_dict()
    except SQLAlchemyError as e:
        raise e


# ========== 删除函数 ==========


def _delete_audio_file(audio_file_path: str) -> None:
    """
    删除音频文件的辅助函数
    """
    if not audio_file_path:
        return

    # 去掉开头的 /static，如果已经有
    relative_path = audio_file_path
    if relative_path.startswith("/static/"):
        relative_path = relative_path[len("/static/") :]
    audio_path = os.path.join(STATIC_PATH, relative_path)

    if os.path.exists(audio_path):
        try:
            os.remove(audio_path)
        except OSError as e:
            print(f"Failed to delete audio file {audio_path}: {e}")


def db_delete_topic(topic_id: int) -> bool:
    """
    删除主题，同时删除所有相关的问题和记录
    """
    try:
        with get_session() as session:
            topic = (
                session.query(SpeakingTopic)
                .options(joinedload(SpeakingTopic.questions))
                .filter(SpeakingTopic.id == topic_id)
                .first()
            )
            if not topic:
                return False

            # 删除所有相关问题的所有记录的音频文件
            for question in topic.questions:
                records = (
                    session.query(SpeakingRecord)
                    .filter(SpeakingRecord.question_id == question.id)
                    .all()
                )
                for record in records:
                    _delete_audio_file(record.audio_file)

            session.delete(topic)
            session.commit()
            return True
    except SQLAlchemyError as e:
        raise e


def db_delete_question(question_id: int) -> bool:
    """
    删除问题，同时删除所有相关的记录
    """
    try:
        with get_session() as session:
            question = (
                session.query(SpeakingQuestion)
                .filter(SpeakingQuestion.id == question_id)
                .first()
            )
            if not question:
                return False

            # 删除所有相关记录的音频文件
            records = (
                session.query(SpeakingRecord)
                .filter(SpeakingRecord.question_id == question_id)
                .all()
            )
            for record in records:
                _delete_audio_file(record.audio_file)

            session.delete(question)
            session.commit()
            return True
    except SQLAlchemyError as e:
        raise e


# ========== 更新函数 ==========


def db_update_topic_title(topic_id: int, title: str) -> Dict[str, Any]:
    """
    更新主题标题
    """
    try:
        with get_session() as session:
            topic = (
                session.query(SpeakingTopic)
                .filter(SpeakingTopic.id == topic_id)
                .first()
            )
            if not topic:
                raise ValueError(f"Topic with id {topic_id} not found")

            topic.title = title
            session.commit()
            session.refresh(topic)
            return topic.to_dict()
    except SQLAlchemyError as e:
        raise e


def db_update_question_text(question_id: int, question_text: str) -> Dict[str, Any]:
    """
    更新问题文本
    """
    try:
        with get_session() as session:
            question = (
                session.query(SpeakingQuestion)
                .options(joinedload(SpeakingQuestion.topic))
                .filter(SpeakingQuestion.id == question_id)
                .first()
            )
            if not question:
                raise ValueError(f"Question with id {question_id} not found")

            question.question_text = question_text
            session.commit()
            session.refresh(question)
            return question.to_dict()
    except SQLAlchemyError as e:
        raise e


def db_delete_record(record_id: int) -> bool:
    """
    删除练习记录
    """
    try:
        with get_session() as session:
            record = (
                session.query(SpeakingRecord)
                .filter(SpeakingRecord.id == record_id)
                .first()
            )
            if not record:
                return False

            # 删除对应的音频文件
            _delete_audio_file(record.audio_file)

            session.delete(record)
            session.commit()
            return True
    except SQLAlchemyError as e:
        raise e


# ========== 批量操作函数 ==========


def db_clear_all_speaking_data() -> bool:
    """
    清空数据库中的所有口语题目数据（包括记录、问题和主题）
    """
    try:
        with get_session() as session:
            # 删除所有记录的音频文件
            records = session.query(SpeakingRecord).all()
            for record in records:
                _delete_audio_file(record.audio_file)

            # 删除所有记录
            session.query(SpeakingRecord).delete()
            # 删除所有问题
            session.query(SpeakingQuestion).delete()
            # 删除所有主题
            session.query(SpeakingTopic).delete()

            session.commit()
            return True
    except SQLAlchemyError as e:
        raise e


def db_import_topics(topics_data: List[tuple], part: int) -> Dict[str, int]:
    """
    批量导入主题和问题

    Args:
        topics_data: [(topic_title, [question1, question2, ...]), ...]
        part: 1 或 2

    Returns:
        {"topics_count": int, "questions_count": int}
    """
    try:
        with get_session() as session:
            topics_count = 0
            questions_count = 0

            for title, questions in topics_data:
                # 检查主题是否已存在
                existing = (
                    session.query(SpeakingTopic)
                    .filter_by(title=title, part=part)
                    .first()
                )
                if existing:
                    continue

                # 创建新主题
                topic = SpeakingTopic(part=part, title=title)
                session.add(topic)
                session.flush()  # 获取 topic.id
                topics_count += 1

                # 添加问题
                for q_text in questions:
                    question = SpeakingQuestion(topic_id=topic.id, question_text=q_text)
                    session.add(question)
                    questions_count += 1

            session.commit()
            return {"topics_count": topics_count, "questions_count": questions_count}
    except SQLAlchemyError as e:
        raise e

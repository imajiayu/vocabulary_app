# -*- coding: utf-8 -*-
# 模型定义
import datetime
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship, declarative_base


Base = declarative_base()


class SpeakingTopic(Base):
    __tablename__ = "speaking_topics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    part = Column(Integer, nullable=False)
    title = Column(String(200), nullable=False)

    questions = relationship(
        "SpeakingQuestion", back_populates="topic", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "part": self.part,
            "title": self.title,
            "questions": [q.to_dict() for q in self.questions],
        }


class SpeakingQuestion(Base):
    __tablename__ = "speaking_questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    topic_id = Column(Integer, ForeignKey("speaking_topics.id"), nullable=False)
    question_text = Column(Text, nullable=False)

    topic = relationship("SpeakingTopic", back_populates="questions")
    records = relationship(
        "SpeakingRecord", back_populates="question", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "topic_id": self.topic_id,
            "question_text": self.question_text,
            "topic_title": self.topic.title if self.topic else None,
            "records": [r.to_dict() for r in self.records],
        }


class SpeakingRecord(Base):
    __tablename__ = "speaking_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    question_id = Column(Integer, ForeignKey("speaking_questions.id"), nullable=False)
    user_answer = Column(Text)
    audio_file = Column(String(255))
    ai_feedback = Column(Text)
    score = Column(Integer)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now())

    # 关系
    question = relationship("SpeakingQuestion", back_populates="records")

    def to_dict(self):
        return {
            "id": self.id,
            "user_answer": self.user_answer,
            "audio_file": self.audio_file,
            "ai_feedback": self.ai_feedback,
            "score": self.score,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

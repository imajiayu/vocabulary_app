# -*- coding: utf-8 -*-
# 模型定义
from datetime import date
import enum
from sqlalchemy import (
    Column,
    ForeignKey,
    Integer,
    String,
    Float,
    Date,
    DateTime,
    UniqueConstraint,
    Enum,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, declarative_base


Base = declarative_base()


class Word(Base):
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(PG_UUID(as_uuid=False), nullable=False)
    word = Column(String, nullable=False)
    definition = Column(String)
    date_added = Column(Date, default=date.today)
    remember_count = Column(Integer, default=0)
    forget_count = Column(Integer, default=0)
    last_remembered = Column(Date)
    last_forgot = Column(Date)
    stop_review = Column(Integer, default=0)
    stop_spell = Column(Integer, default=0)
    next_review = Column(Date)
    interval = Column(Integer, default=1)
    repetition = Column(Integer, default=0)
    ease_factor = Column(Float, default=2.5)
    last_score = Column(Integer, default=0)
    avg_elapsed_time = Column(Integer, default=0)
    lapse = Column(Integer, default=0)
    spell_strength = Column(Float)
    spell_next_review = Column(Date)
    source = Column(String(20), nullable=False)  # 改为字符串类型，最大长度20

    related_words = relationship(
        "WordRelation",
        back_populates="word",
        foreign_keys=lambda: [WordRelation.word_id],
        cascade="all, delete-orphan",
    )


class RelationType(enum.Enum):
    synonym = "synonym"
    antonym = "antonym"
    root = "root"
    confused = "confused"
    topic = "topic"


# 单词关系表映射
class WordRelation(Base):
    __tablename__ = "words_relations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(PG_UUID(as_uuid=False), nullable=False)
    word_id = Column(Integer, ForeignKey("words.id"), nullable=False)
    related_word_id = Column(Integer, ForeignKey("words.id"), nullable=False)
    relation_type = Column(Enum(RelationType, name="relation_type_enum", create_constraint=True), nullable=False)
    confidence = Column(Float, default=1.0)

    # 关系映射
    word = relationship("Word", foreign_keys=[word_id], back_populates="related_words")
    related_word = relationship("Word", foreign_keys=[related_word_id])

    __table_args__ = (
        UniqueConstraint(
            "word_id",
            "related_word_id",
            "relation_type",
            name="uq_word_relation_type",
        ),
    )


class RelationGenerationLog(Base):
    """关系生成日志表 - 记录每个单词在各关系类型下的处理状态"""
    __tablename__ = "relation_generation_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(PG_UUID(as_uuid=False), nullable=False)
    word_id = Column(Integer, ForeignKey("words.id"), nullable=False)
    relation_type = Column(Enum(RelationType, name="relation_type_enum", create_constraint=True), nullable=False)
    processed_at = Column(DateTime, nullable=False)  # 处理时间
    found_count = Column(Integer, default=0)  # 找到的关系数

    __table_args__ = (
        UniqueConstraint(
            "word_id",
            "relation_type",
            name="uq_word_relation_log",
        ),
    )

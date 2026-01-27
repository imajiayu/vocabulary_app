# -*- coding: utf-8 -*-
# 模型定义
from datetime import date
import enum
import json
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
from sqlalchemy.orm import relationship, declarative_base


Base = declarative_base()


class Word(Base):
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, default=1)
    word = Column(String, nullable=False)
    definition = Column(String)
    date_added = Column(Date, default=date.today)
    remember_count = Column(Integer, default=0)
    forget_count = Column(Integer, default=0)
    last_remembered = Column(Date)
    last_forgot = Column(Date)
    stop_review = Column(Integer, default=0)
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

    def to_dict(self):
        JSONdefinition = json.loads(self.definition) if self.definition else {}
        return {
            "id": self.id,
            "word": self.word,
            "definition": JSONdefinition,
            "stop_review": self.stop_review,
            "ease_factor": round(self.ease_factor, 2)
            if self.ease_factor is not None
            else None,
            "date_added": self.date_added.isoformat(),
            "repetition": self.repetition,
            "interval": self.interval,
            "next_review": self.next_review.isoformat() if self.next_review else None,
            "lapse": self.lapse,
            "spell_strength": round(self.spell_strength, 2)
            if self.spell_strength is not None
            else None,
            "spell_next_review": self.spell_next_review.isoformat()
            if self.spell_next_review
            else None,
            "source": self.source,  # 直接返回字符串值
            # 统计字段（用于分离式 API 计算，避免额外数据库查询）
            "remember_count": self.remember_count or 0,
            "forget_count": self.forget_count or 0,
            "avg_elapsed_time": self.avg_elapsed_time or 0,
        }

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
    user_id = Column(Integer, nullable=False, default=1)
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
    user_id = Column(Integer, nullable=False, default=1)
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

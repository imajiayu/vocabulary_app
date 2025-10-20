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
    Boolean,
    Text,
    CheckConstraint,
    UniqueConstraint,
    Enum,
)
from sqlalchemy.orm import relationship, declarative_base, Session


Base = declarative_base()


class SourceType(enum.Enum):
    IELTS = "IELTS"
    GRE = "GRE"


class Word(Base):
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, autoincrement=True)
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
    source = Column(Enum(SourceType), nullable=False)

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
            "source": self.source.value,
        }

    related_words = relationship(
        "WordRelation",
        back_populates="word",
        foreign_keys=lambda: [WordRelation.word_id],
        cascade="all, delete-orphan",
    )

    def get_all_related_words(self, session: Session):
        """
        返回当前单词的所有关联词（简化版 - 双向存储实现）

        由于关系已双向存储，只需查询 word_id == self.id 的关系即可
        不再需要额外查询反向关系

        :param session: SQLAlchemy session
        :return: List[Dict]，格式：
        {"id": int, "word": str, "relation_type": str, "confidence": float}
        """
        results = []

        # 只查询正向关联（双向存储下已包含所有关系）
        for rel in self.related_words:
            results.append({
                "id": rel.related_word.id,
                "word": rel.related_word.word,
                "relation_type": rel.relation_type.value,
                "confidence": rel.confidence,
            })

        return results


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
    word_id = Column(Integer, ForeignKey("words.id"), nullable=False)
    related_word_id = Column(Integer, ForeignKey("words.id"), nullable=False)
    relation_type = Column(Enum(RelationType), nullable=False)
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
    word_id = Column(Integer, ForeignKey("words.id"), nullable=False)
    relation_type = Column(Enum(RelationType), nullable=False)
    processed_at = Column(DateTime, nullable=False)  # 处理时间
    found_count = Column(Integer, default=0)  # 找到的关系数

    __table_args__ = (
        UniqueConstraint(
            "word_id",
            "relation_type",
            name="uq_word_relation_log",
        ),
    )


class Progress(Base):
    __tablename__ = "current_progress"

    id = Column(Integer, primary_key=True, default=1)
    mode = Column(String(20), nullable=False)
    source = Column(String(10), nullable=False)
    shuffle = Column(Boolean, default=False)
    word_ids_snapshot = Column(Text, nullable=False)  # JSON数组存储
    current_index = Column(Integer, default=0)
    initial_lapse_count = Column(Integer, default=0)  # lapse模式的初始总lapse数
    initial_lapse_word_count = Column(Integer, default=0)  # lapse模式的初始单词数量

    __table_args__ = (CheckConstraint("id = 1", name="single_row_constraint"),)

    def to_dict(self):
        return {
            "id": self.id,
            "mode": self.mode,
            "source": self.source,
            "shuffle": self.shuffle,
            "word_ids_snapshot": json.loads(self.word_ids_snapshot)
            if self.word_ids_snapshot
            else [],
            "current_index": self.current_index,
            "initial_lapse_count": self.initial_lapse_count,
            "initial_lapse_word_count": self.initial_lapse_word_count,
        }

    @staticmethod
    def from_dict(data):
        """从字典创建Progress对象"""
        return Progress(
            id=1,  # 固定为1
            mode=data.get("mode"),
            source=data.get("source"),
            shuffle=data.get("shuffle", False),
            word_ids_snapshot=json.dumps(data.get("word_ids_snapshot", [])),
            current_index=data.get("current_index", 0),
            initial_lapse_count=data.get("initial_lapse_count", 0),
            initial_lapse_word_count=data.get("initial_lapse_word_count", 0),
        )

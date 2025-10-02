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
            "ease_factor": round(self.ease_factor, 2) if self.ease_factor is not None else None,
            "date_added": self.date_added.isoformat(),
            "repetition": self.repetition,
            "interval": self.interval,
            "next_review": self.next_review.isoformat() if self.next_review else None,
            "lapse": self.lapse,
            "spell_strength": round(self.spell_strength, 2) if self.spell_strength is not None else None,
            "spell_next_review": self.spell_next_review.isoformat() if self.spell_next_review else None,
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
        返回当前单词的所有关联词（正向 + 反向），去重
        :param session: SQLAlchemy session
        :param include_definition: 是否返回 definition
        :return: List[Dict]，格式：
        {"id": int, "word": str, "relation_type": str, "confidence": float, "definition": str}
        """
        results_dict = {}

        # 正向关联
        for rel in self.related_words:
            word_id = rel.related_word.id
            word_text = rel.related_word.word
            if word_id not in results_dict:
                results_dict[word_id] = {
                    "id": word_id,
                    "word": word_text,
                    "relation_type": rel.relation_type.value,
                    "confidence": rel.confidence,
                }

        # 反向关联
        reverse_rels = (
            session.query(WordRelation).filter_by(related_word_id=self.id).all()
        )
        for rel in reverse_rels:
            word_id = rel.word.id
            word_text = rel.word.word
            if word_id not in results_dict:
                results_dict[word_id] = {
                    "id": word_id,
                    "word": word_text,
                    "relation_type": rel.relation_type.value,
                    "confidence": rel.confidence,
                }

        return list(results_dict.values())


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


class Progress(Base):
    __tablename__ = "current_progress"

    id = Column(Integer, primary_key=True, default=1)
    mode = Column(String(20), nullable=False)
    source = Column(String(10), nullable=False)
    shuffle = Column(Boolean, default=False)
    word_ids_snapshot = Column(Text, nullable=False)  # JSON数组存储
    current_index = Column(Integer, default=0)

    __table_args__ = (
        CheckConstraint('id = 1', name='single_row_constraint'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "mode": self.mode,
            "source": self.source,
            "shuffle": self.shuffle,
            "word_ids_snapshot": json.loads(self.word_ids_snapshot) if self.word_ids_snapshot else [],
            "current_index": self.current_index,
        }

    @staticmethod
    def from_dict(data):
        """从字典创建Progress对象"""
        return Progress(
            id=1,  # 固定为1
            mode=data.get('mode'),
            source=data.get('source'),
            shuffle=data.get('shuffle', False),
            word_ids_snapshot=json.dumps(data.get('word_ids_snapshot', [])),
            current_index=data.get('current_index', 0)
        )

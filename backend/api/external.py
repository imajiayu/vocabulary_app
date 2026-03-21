# -*- coding: utf-8 -*-
"""
外部工具 API — 供 iOS 快捷指令等外部工具调用

无需认证，参数最少化。通过 (word, user_id, source) 唯一约束操作单词。
"""
import json
import unicodedata
from datetime import date, timezone, datetime

from flask import Blueprint, request
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from backend.extensions import get_session
from backend.utils.response import api_success, api_error

external_bp = Blueprint("external", __name__, url_prefix="/api/external")


def _normalize_word(raw: str) -> str:
    """NFC + trim + lowercase，与前端保持一致"""
    return unicodedata.normalize("NFC", raw).strip().lower()


def _get_utc_today() -> date:
    """UTC 日期，与前端 getUtcToday() 一致"""
    return datetime.now(timezone.utc).date()


def _parse_params():
    """解析并校验三个必填参数，返回 (user_id, word, source, data, None) 或 (..., error_response)"""
    data = request.get_json(silent=True) or {}
    user_id = (data.get("user_id") or "").strip()
    word_raw = (data.get("word") or "").strip()
    source = (data.get("source") or "").strip()

    if not user_id or not word_raw or not source:
        return None, None, None, None, api_error("user_id, word, source are all required")

    return user_id, _normalize_word(word_raw), source, data, None


@external_bp.route("/words", methods=["POST"])
def add_word():
    """新增单词"""
    result = _parse_params()
    if result[4] is not None:
        return result[4]
    user_id, word, source, data, _ = result

    definition_text = (data.get("definition") or "").strip()
    definition_value = json.dumps({"definitions": [definition_text]}) if definition_text else "{}"

    today = _get_utc_today()

    with get_session() as session:
        try:
            session.execute(
                text("""
                    INSERT INTO words (user_id, word, source, definition, date_added, next_review, stop_review)
                    VALUES (:user_id, :word, :source, :definition, :date_added, :next_review, :stop_review)
                """),
                {
                    "user_id": user_id,
                    "word": word,
                    "source": source,
                    "definition": definition_value,
                    "date_added": today,
                    "next_review": today,
                    "stop_review": 0,
                },
            )
            session.commit()
        except IntegrityError:
            session.rollback()
            return api_error(f"Word '{word}' already exists in source '{source}'", 409)

    return api_success({"word": word, "source": source}), 201


@external_bp.route("/words", methods=["DELETE"])
def delete_word():
    """删除单词"""
    result = _parse_params()
    if result[4] is not None:
        return result[4]
    user_id, word, source, _, _ = result

    with get_session() as session:
        row = session.execute(
            text("DELETE FROM words WHERE user_id = :user_id AND word = :word AND source = :source RETURNING id"),
            {"user_id": user_id, "word": word, "source": source},
        )
        if row.rowcount == 0:
            return api_error(f"Word '{word}' not found in source '{source}'", 404)
        session.commit()

    return api_success({"word": word, "source": source})


@external_bp.route("/words", methods=["GET"])
def list_words():
    """查询用户的单词列表"""
    user_id = (request.args.get("user_id") or "").strip()
    if not user_id:
        return api_error("user_id is required")

    source = (request.args.get("source") or "").strip()

    with get_session() as session:
        if source:
            rows = session.execute(
                text("SELECT word FROM words WHERE user_id = :user_id AND source = :source ORDER BY word"),
                {"user_id": user_id, "source": source},
            )
            words = [r[0] for r in rows]
        else:
            rows = session.execute(
                text("SELECT word, source FROM words WHERE user_id = :user_id ORDER BY source, word"),
                {"user_id": user_id},
            )
            words = [{"word": r[0], "source": r[1]} for r in rows]

    return api_success({"words": words, "count": len(words)})

# -*- coding: utf-8 -*-
"""
单词关系API路由
"""
from flask import Blueprint, jsonify, request
from flask_cors import CORS
from backend.database.relation_dao import (
    db_get_relations_graph,
    db_add_relation,
    db_delete_relation,
    db_get_relation_stats
)

relations_bp = Blueprint("relations", __name__, url_prefix="/api/relations")

CORS(relations_bp, origins="*")


def create_response(success=True, data=None, message=""):
    """创建统一的API响应格式"""
    return jsonify({"success": success, "data": data, "message": message})


@relations_bp.route("/graph", methods=["GET"])
def get_relations_graph():
    """
    获取单词关系图数据

    查询参数:
    - relation_types: synonym,antonym,root,confused,topic (可选，逗号分隔，默认全部)
    - word_id: 中心单词ID (可选，返回以该词为中心的子图)
    - max_depth: 关系深度 (可选，默认2，范围1-3)

    返回格式:
    {
      "nodes": [{"id": 1, "word": "abandon"}],
      "edges": [{"source": 1, "target": 2, "relation_type": "synonym", "confidence": 0.95}]
    }
    """
    try:
        # 获取查询参数
        relation_types_str = request.args.get("relation_types", "")
        word_id = request.args.get("word_id", type=int)
        max_depth = request.args.get("max_depth", default=2, type=int)

        # 验证参数
        if max_depth < 1 or max_depth > 3:
            return create_response(False, None, "max_depth must be between 1 and 3"), 400

        # 解析关系类型
        relation_types = None
        if relation_types_str:
            valid_types = ["synonym", "antonym", "root", "confused", "topic"]
            relation_types = [t.strip() for t in relation_types_str.split(",")]
            # 验证关系类型
            for rt in relation_types:
                if rt not in valid_types:
                    return create_response(
                        False,
                        None,
                        f"Invalid relation_type: {rt}. Must be one of: {', '.join(valid_types)}"
                    ), 400

        # 调用数据库函数获取图数据
        graph_data = db_get_relations_graph(
            relation_types=relation_types,
            word_id=word_id,
            max_depth=max_depth
        )

        return create_response(
            True,
            graph_data,
            "Relations graph retrieved successfully"
        )

    except Exception as e:
        return (
            create_response(False, None, f"Failed to get relations graph: {str(e)}"),
            500,
        )


@relations_bp.route("", methods=["POST"])
def add_relation():
    """
    添加单条关系

    请求体:
    {
      "word_id": 1,
      "related_word_id": 2,
      "relation_type": "synonym",
      "confidence": 0.95
    }
    """
    try:
        data = request.get_json()

        if not data:
            return create_response(False, None, "Missing request body"), 400

        word_id = data.get("word_id")
        related_word_id = data.get("related_word_id")
        relation_type = data.get("relation_type")
        confidence = data.get("confidence", 1.0)

        if not all([word_id, related_word_id, relation_type]):
            return create_response(
                False,
                None,
                "Missing required fields: word_id, related_word_id, relation_type"
            ), 400

        valid_types = ["synonym", "antonym", "root", "confused", "topic"]
        if relation_type not in valid_types:
            return create_response(
                False,
                None,
                f"Invalid relation_type. Must be one of: {', '.join(valid_types)}"
            ), 400

        result = db_add_relation(word_id, related_word_id, relation_type, confidence)

        if result["success"]:
            return create_response(True, result["data"], "Relation added successfully")
        else:
            return create_response(False, None, result["message"]), 400

    except Exception as e:
        return (
            create_response(False, None, f"Failed to add relation: {str(e)}"),
            500,
        )


@relations_bp.route("", methods=["DELETE"])
def delete_relation():
    """
    删除单条关系

    请求体:
    {
      "word_id": 1,
      "related_word_id": 2,
      "relation_type": "synonym"
    }
    """
    try:
        data = request.get_json()

        if not data:
            return create_response(False, None, "Missing request body"), 400

        word_id = data.get("word_id")
        related_word_id = data.get("related_word_id")
        relation_type = data.get("relation_type")

        if not all([word_id, related_word_id, relation_type]):
            return create_response(
                False,
                None,
                "Missing required fields: word_id, related_word_id, relation_type"
            ), 400

        result = db_delete_relation(word_id, related_word_id, relation_type)

        if result["success"]:
            return create_response(True, None, result["message"])
        else:
            return create_response(False, None, result["message"]), 404

    except Exception as e:
        return (
            create_response(False, None, f"Failed to delete relation: {str(e)}"),
            500,
        )


@relations_bp.route("/stats", methods=["GET"])
def get_relation_stats():
    """获取关系统计信息"""
    try:
        stats = db_get_relation_stats()
        return create_response(True, stats, "Stats retrieved successfully")

    except Exception as e:
        return (
            create_response(False, None, f"Failed to get stats: {str(e)}"),
            500,
        )

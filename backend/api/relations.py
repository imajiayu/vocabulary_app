# -*- coding: utf-8 -*-
"""
单词关系API路由

注意：add_relation、delete_relation、stats 已迁移到前端 Supabase 直接操作
- RelationsApi.addDirect() / RelationsApi.deleteDirect() / RelationsApi.getStatsDirect()
"""
from flask import Blueprint, jsonify, request, g
from backend.database.relation_dao import db_get_relations_graph

relations_bp = Blueprint("relations", __name__, url_prefix="/api/relations")


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

        # 调用数据库函数获取图数据（按用户过滤）
        graph_data = db_get_relations_graph(
            relation_types=relation_types,
            word_id=word_id,
            max_depth=max_depth,
            user_id=g.user_id
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

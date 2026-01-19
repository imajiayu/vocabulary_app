from flask import Blueprint, jsonify, request
from flask_cors import CORS
from backend.utils.ai_helper import call_ai

# 创建蓝图
vocabulary_assistance_bp = Blueprint("vocabulary_assistance", __name__, url_prefix="/api/vocabulary-assistance")
CORS(vocabulary_assistance_bp, origins="*")


def create_response(success=True, data=None, message=""):
    """创建统一的API响应格式"""
    return jsonify({"success": success, "data": data, "message": message})

# AI词汇助手的系统提示词
VOCABULARY_ASSISTANT_PROMPT = """你是一个专业的IELTS词汇学习助手。你的任务是帮助用户更好地理解和记忆正在学习的词汇。

【你的角色】
- 词汇专家：深入理解词汇的多层含义、用法和搭配
- 学习顾问：提供有效的记忆技巧和学习建议
- 陪练伙伴：用友好、鼓励的语气与用户交流

【核心能力】
1. 词汇解析：提供详细的词义、词源、同义词、反义词
2. 用法指导：给出地道的例句和常用搭配
3. 记忆技巧：提供联想记忆、词根词缀等记忆方法
4. 辨析对比：解释相似词汇之间的细微差别
5. 场景应用：说明词汇在IELTS听说读写中的具体运用

【交互原则】
- 回答简洁精准，避免冗长
- 使用中文交流，但英文示例要地道准确
- 根据用户的问题灵活调整回答内容
- 主动联系当前正在学习的词汇
- 鼓励用户积极思考和应用

【当前词汇信息】
词汇：{word}
释义：{definition}

请基于这个词汇，回答用户的问题。如果用户的问题与此词汇相关，优先围绕它展开；如果问题是关于其他词汇或学习方法，也要尽力解答。"""


@vocabulary_assistance_bp.route("/message", methods=["POST"])
def chat_message():
    """处理AI聊天消息"""
    try:
        data = request.get_json()
        if not data:
            return create_response(False, None, "No JSON data provided"), 400

        # 必需参数
        if "message" not in data:
            return create_response(False, None, "Missing required field: message"), 400

        user_message = data["message"]

        # 可选参数：当前学习的词汇信息
        word = data.get("word", "")
        definition = data.get("definition", "")

        # 构建系统提示词
        system_prompt = VOCABULARY_ASSISTANT_PROMPT.format(
            word=word or "暂无",
            definition=definition or "暂无"
        )

        # 调用AI助手
        ai_response = call_ai(
            system_prompt=system_prompt,
            user_message=user_message
        )

        return create_response(
            True,
            {"response": ai_response},
            "AI response generated successfully",
        )

    except Exception as e:
        return create_response(False, None, f"AI chat failed: {str(e)}"), 500




# ========== 错误处理 ==========

@vocabulary_assistance_bp.errorhandler(404)
def not_found(error):
    return create_response(False, None, "Resource not found"), 404


@vocabulary_assistance_bp.errorhandler(400)
def bad_request(error):
    return create_response(False, None, "Bad request"), 400


@vocabulary_assistance_bp.errorhandler(500)
def internal_error(error):
    return create_response(False, None, "Internal server error"), 500

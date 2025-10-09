from flask import Blueprint, jsonify, request
from flask_cors import CORS
from flask.views import MethodView
from openai import OpenAI
from web_app.config import STATIC_PATH
from web_app.database.speaking_dao import (
    db_delete_record,
    db_get_all_topics,
    db_get_records_by_question_id,
    db_insert_record,
    db_insert_topic,
    db_insert_question,
    db_delete_topic,
    db_delete_question,
    db_update_question_text,
    db_update_topic_title,
    db_clear_all_speaking_data,
    db_import_topics,
)
from web_app.utils.speech_processing import create_speech_transcriber
from web_app.utils.audio_processing import convert_audio_file_to_wav
from werkzeug.utils import secure_filename
import time
import os
import shutil
from pathlib import Path

# 创建蓝图
speaking_api_bp = Blueprint("speaking_api", __name__, url_prefix="/api/speaking")
CORS(speaking_api_bp, origins="*")


def create_response(success=True, data=None, message=""):
    """创建统一的API响应格式"""
    return jsonify({"success": success, "data": data, "message": message})


API_KEY = "sk-74873efb25324ec8aa9d6e05168c8e5e"
client = OpenAI(api_key=API_KEY, base_url="https://api.deepseek.com")

# 创建转录器实例
speech_transcriber = create_speech_transcriber()

prompt = "你是我的雅思口语陪练。\
【任务目标】\
帮助我提高词汇准确性、表达地道性、句型多样性和语言流利度。\
一定要口语化，绝不使用书面或正式的表达。\
不要偏离我原回答的意思。\
【评分要求】\
必须严格按照雅思口语官方评分标准：\
1. 流利度与连贯性 (Fluency & Coherence)\
2. 词汇资源 (Lexical Resource)\
3. 语法多样性与准确性 (Grammatical Range & Accuracy)\
4. 发音 (Pronunciation)\
根据以上四项综合给分，范围1-9，允许0.5分。\
不要随意打分，必须体现我回答在上述维度上的真实水平。\
【练习流程】\
我给你提出问题和问题的回答（可能夹杂中文）。\
输出一个数字代表你给我的回答的分数（1-9，以0.5为间隔）。\
随后输出一个换行符，并输出改写后的高分参考版本，要求：\
- 用更准确、地道的词汇替换我的表达；\
- 改写为自然口语化的表达；\
- 使用更多类型的句型（复合句、倒装句、强调句等）；\
- 纠正语法、搭配或表达错误；\
- 将中文部分用地道英文替换；\
- 保持原回答意思完全不变。\
【输出格式】\
第一行：分数（纯数字）\
第二行开始：仅输出改写后的高分参考版本，一个字都不要多说。"


@speaking_api_bp.route("/speech-to-text", methods=["POST"])
def speech_to_text():
    """语音转文本 API - 使用新的转录模块"""
    try:
        file = request.files.get("audio")
        if not file:
            return create_response(False, None, "No audio file uploaded"), 400

        # 使用新的转录器进行处理
        result = speech_transcriber.transcribe_audio_file(file, max_size_mb=50)

        if result["success"]:
            return create_response(
                True,
                {"text": result["text"]},
                "Speech to text conversion successful",
            )
        else:
            return (
                create_response(
                    False,
                    None,
                    result["error"],
                ),
                500,
            )

    except Exception as e:
        return create_response(False, None, f"Speech to text failed: {str(e)}"), 500


@speaking_api_bp.route("/ai-feedback", methods=["POST"])
def get_feedback():
    try:
        data = request.get_json()
        if not data or "question_text" not in data or "user_answer" not in data:
            return (
                create_response(
                    False, None, "Missing required fields: question_text, user_answer"
                ),
                400,
            )

        question_text = data["question_text"]
        answer = data["user_answer"]
        topic_title = data.get("topic_title", "")  # 获取topic标题，可选参数
        # 构建完整的prompt，如果有topic标题则包含在内
        full_prompt = prompt
        if topic_title:
            full_prompt = f"话题: {topic_title}\n{prompt}"
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": full_prompt},
                {"role": "user", "content": question_text + "\n" + answer},
            ],
            stream=False,
        )
        text = response.choices[0].message.content
        lines = text.splitlines()
        score = float(lines[0])
        feedback = "".join(lines[1:]) if len(lines) > 1 else ""
        return create_response(
            True,
            {"feedback": feedback, "score": score},
            "AI feedback generated successfully",
        )
    except Exception as e:
        return (
            create_response(False, None, f"AI feedback generation failed: {str(e)}"),
            500,
        )


# ========== RESTful API 类 ==========
class QuestionRecordsAPI(MethodView):
    """问题练习记录API"""

    def get(self, question_id):
        """GET /api/speaking/records/<int:question_id> - 获取指定问题的所有练习记录"""
        try:
            records = db_get_records_by_question_id(question_id)
            return create_response(
                True,
                {"records": records, "total": len(records)},
                "Records retrieved successfully",
            )
        except Exception as e:
            return create_response(False, None, f"Failed to get records: {str(e)}"), 500

    def post(self):
        """POST /api/speaking/records - 插入新记录"""
        temp_wav_path = None
        try:
            # 普通表单字段
            question_id = request.form.get("question_id")
            user_answer = request.form.get("user_answer")
            ai_feedback = request.form.get("ai_feedback")
            score = request.form.get("score")

            # 文件字段
            file = request.files.get("audio_file")
            if not file:
                return create_response(False, None, "No audio file provided"), 400

            # 确保文件名安全
            original_filename = secure_filename(file.filename)
            if not original_filename:
                return create_response(False, None, "Invalid filename"), 400

            # 生成时间戳文件名，确保保存为WAV格式
            timestamp = int(time.time())
            base_name = Path(original_filename).stem
            wav_filename = f"{base_name}_{timestamp}.wav"

            # 确保音频目录存在
            audio_dir = os.path.join(STATIC_PATH, "audios")
            os.makedirs(audio_dir, exist_ok=True)

            # 最终的WAV文件路径
            final_wav_path = os.path.join(audio_dir, wav_filename)

            # 检查原始文件格式并进行转换
            original_extension = Path(original_filename).suffix.lower()

            if original_extension == ".wav":
                # 如果已经是WAV格式，直接保存
                file.save(final_wav_path)
                print(f"直接保存WAV文件: {final_wav_path}")
            else:
                # 需要转换格式
                print(f"转换音频格式: {original_extension} -> .wav")

                # 转换为WAV格式
                temp_wav_path = convert_audio_file_to_wav(file, original_filename)

                # 将转换后的文件移动到最终位置
                shutil.move(temp_wav_path, final_wav_path)
                print(f"音频格式转换完成: {final_wav_path}")

            # 生成相对路径用于数据库存储
            relative_path = f"/static/audios/{wav_filename}"

            # 写入数据库
            record = db_insert_record(
                question_id=question_id,
                user_answer=user_answer,
                ai_feedback=ai_feedback,
                score=score,
                audio_file=relative_path,
            )

            return create_response(True, record, "Record created successfully"), 201

        except ValueError as e:
            return create_response(False, None, str(e)), 400
        except Exception as e:
            # 清理临时文件
            if temp_wav_path and os.path.exists(temp_wav_path):
                try:
                    temp_dir = os.path.dirname(temp_wav_path)
                    shutil.rmtree(temp_dir)
                except:
                    pass

            return (
                create_response(False, None, f"Failed to create record: {str(e)}"),
                500,
            )

    def delete(self, record_id):
        """DELETE /api/speaking/records/<id> - 删除练习记录"""
        try:
            success = db_delete_record(record_id)
            if success:
                return create_response(
                    True, None, f"Record {record_id} deleted successfully"
                )
            else:
                return (
                    create_response(False, None, f"Record {record_id} not found"),
                    404,
                )
        except Exception as e:
            return (
                create_response(False, None, f"Failed to delete record: {str(e)}"),
                500,
            )


class TopicsAPI(MethodView):
    """主题API"""

    def get(self):
        """GET /api/speaking/topics - 获取所有主题"""
        try:
            topics = db_get_all_topics()
            return create_response(True, topics, "Topics retrieved successfully")
        except Exception as e:
            return create_response(False, None, f"Failed to get topics: {str(e)}"), 500

    def post(self):
        """POST /api/speaking/topics - 插入新主题"""
        try:
            data = request.get_json()
            if not data:
                return create_response(False, None, "No JSON data provided"), 400

            # 验证必需字段
            if "part" not in data or "title" not in data:
                return (
                    create_response(
                        False, None, "Missing required fields: part, title"
                    ),
                    400,
                )

            # 插入主题
            topic = db_insert_topic(
                part=data["part"],
                title=data["title"],
            )

            return create_response(True, topic, "Topic created successfully"), 201

        except ValueError as e:
            return create_response(False, None, str(e)), 400
        except Exception as e:
            return (
                create_response(False, None, f"Failed to create topic: {str(e)}"),
                500,
            )

    def delete(self, topic_id):
        """DELETE /api/speaking/topics/<id> - 删除主题及相关问题和记录"""
        try:
            success = db_delete_topic(topic_id)
            if success:
                return create_response(
                    True,
                    None,
                    f"Topic {topic_id} and all related data deleted successfully",
                )
            else:
                return create_response(False, None, f"Topic {topic_id} not found"), 404
        except Exception as e:
            return (
                create_response(False, None, f"Failed to delete topic: {str(e)}"),
                500,
            )

    def patch(self, topic_id):
        """PATCH /api/speaking/topics/<id> - 更新主题标题"""
        try:
            data = request.get_json()
            if not data:
                return (
                    create_response(False, None, "No JSON data provided"),
                    400,
                )

            # 验证必需字段
            if "title" not in data:
                return (
                    jsonify(
                        {
                            "success": False,
                            "error": "Missing required field: title",
                        }
                    ),
                    400,
                )

            # 更新主题
            topic = db_update_topic_title(topic_id=topic_id, title=data["title"])

            return create_response(True, topic, "Operation successful"), 200

        except ValueError as e:
            return create_response(False, None, str(e)), 404
        except Exception as e:
            return create_response(False, None, str(e)), 500


class QuestionsManageAPI(MethodView):
    """问题管理API"""

    def post(self):
        """POST /api/speaking/questions - 插入新问题"""
        try:
            data = request.get_json()
            if not data:
                return (
                    create_response(False, None, "No JSON data provided"),
                    400,
                )

            # 验证必需字段
            if "topic_id" not in data or "question_text" not in data:
                return (
                    jsonify(
                        {
                            "success": False,
                            "error": "Missing required fields: topic_id, question_text",
                        }
                    ),
                    400,
                )

            # 插入问题
            question = db_insert_question(
                topic_id=data["topic_id"], question_text=data["question_text"]
            )

            return create_response(True, question, "Operation successful"), 201

        except ValueError as e:
            return create_response(False, None, str(e)), 400
        except Exception as e:
            return create_response(False, None, str(e)), 500

    def delete(self, question_id):
        """DELETE /api/speaking/questions/<id> - 删除问题及相关记录"""
        try:
            success = db_delete_question(question_id)
            if success:
                return (
                    jsonify(
                        {
                            "success": True,
                            "message": f"Question {question_id} and all related records deleted successfully",
                        }
                    ),
                    200,
                )
            else:
                return (
                    jsonify(
                        {"success": False, "error": f"Question {question_id} not found"}
                    ),
                    404,
                )
        except Exception as e:
            return create_response(False, None, str(e)), 500

    def patch(self, question_id):
        """PATCH /api/speaking/questions/<id> - 更新问题文本"""
        try:
            data = request.get_json()
            if not data:
                return (
                    create_response(False, None, "No JSON data provided"),
                    400,
                )

            # 验证必需字段
            if "question_text" not in data:
                return (
                    jsonify(
                        {
                            "success": False,
                            "error": "Missing required field: question_text",
                        }
                    ),
                    400,
                )

            # 更新问题
            question = db_update_question_text(
                question_id=question_id, question_text=data["question_text"]
            )

            return create_response(True, question, "Operation successful"), 200

        except ValueError as e:
            return create_response(False, None, str(e)), 404
        except Exception as e:
            return create_response(False, None, str(e)), 500


# ========== 批量操作API ==========


@speaking_api_bp.route("/clear-all", methods=["POST"])
def clear_all_questions():
    """POST /api/speaking/clear-all - 清除所有题目、主题和记录"""
    try:
        success = db_clear_all_speaking_data()
        if success:
            return create_response(True, None, "All speaking data cleared successfully")
        else:
            return create_response(False, None, "Failed to clear data"), 500
    except Exception as e:
        return create_response(False, None, f"Failed to clear data: {str(e)}"), 500


@speaking_api_bp.route("/import", methods=["POST"])
def import_questions():
    """POST /api/speaking/import - 从服务器文件导入题目

    Request Body:
        {
            "part": 1 or 2
        }

    Returns:
        {
            "success": true,
            "data": {
                "topics_count": int,
                "questions_count": int
            }
        }
    """
    try:
        from web_app.config import BASE_DIR

        data = request.get_json()
        if not data or "part" not in data:
            return create_response(False, None, "Missing required field: part"), 400

        part = data["part"]
        if part not in [1, 2]:
            return create_response(False, None, "Part must be 1 or 2"), 400

        # 确定文件路径
        if part == 1:
            filepath = os.path.join(
                BASE_DIR, "web_app/data/questions/speaking_questions_part1.txt"
            )
        else:
            filepath = os.path.join(
                BASE_DIR, "web_app/data/questions/speaking_questions_part2&3.txt"
            )

        # 检查文件是否存在
        if not os.path.exists(filepath):
            return (
                create_response(False, None, f"Question file not found: {filepath}"),
                404,
            )

        # 解析题目文件
        topics_data = _parse_questions_file(filepath, part)

        # 导入到数据库
        result = db_import_topics(topics_data, part)

        return create_response(
            True,
            result,
            f"Successfully imported Part {part} questions",
        )

    except Exception as e:
        return (
            create_response(False, None, f"Failed to import questions: {str(e)}"),
            500,
        )


@speaking_api_bp.route("/import-data", methods=["POST"])
def import_questions_from_data():
    """POST /api/speaking/import-data - 从用户上传的数据导入题目

    Request Body:
        {
            "topics_data": [
                {
                    "title": "主题名称",
                    "questions": ["问题1", "问题2"]
                }
            ],
            "part": 1 or 2
        }

    Returns:
        {
            "success": true,
            "data": {
                "topics_count": int,
                "questions_count": int
            }
        }
    """
    try:
        data = request.get_json()
        if not data or "topics_data" not in data or "part" not in data:
            return (
                create_response(
                    False, None, "Missing required fields: topics_data, part"
                ),
                400,
            )

        topics_data_json = data["topics_data"]
        part = data["part"]

        if part not in [1, 2]:
            return create_response(False, None, "Part must be 1 or 2"), 400

        # 转换为元组格式 [(title, [q1, q2, ...]), ...]
        topics_data = [
            (topic["title"], topic["questions"]) for topic in topics_data_json
        ]

        # 导入到数据库
        result = db_import_topics(topics_data, part)

        return create_response(
            True,
            result,
            f"Successfully imported {result['topics_count']} topics and {result['questions_count']} questions",
        )

    except Exception as e:
        return (
            create_response(False, None, f"Failed to import questions: {str(e)}"),
            500,
        )


def _parse_questions_file(filepath: str, part: int) -> list:
    """解析题目文件

    Args:
        filepath: 文件路径
        part: 1 或 2

    Returns:
        [(topic_title, [question1, question2, ...]), ...]
    """
    topics = []

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read().strip()

    blocks = content.split("\n\n")  # 用空行分隔不同主题

    for block in blocks:
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines:
            continue

        if part == 1:
            # Part 1 格式：主题名称 + 问题列表
            # 跳过包含"Part 1"和"##"的标题行
            if "Part 1" in lines[0] or lines[0].startswith("##"):
                continue

            topic = lines[0]
            questions = lines[1:]

            if questions:  # 只有当有问题时才添加主题
                topics.append((topic, questions))

        else:
            # Part 2&3 格式：Describe开头的描述 + 提示点
            if lines[0].startswith("Describe"):
                topic = lines[0]
                # 将所有后续行合并为一个问题
                question_content = "\n".join(lines[1:])
                topics.append((topic, [topic + "\n" + question_content]))

    return topics


# ========== 注册路由 ==========

# 问题练习记录路由
speaking_api_bp.add_url_rule(
    "/records/<int:question_id>",
    view_func=QuestionRecordsAPI.as_view("QuestionRecordsAPI"),
    methods=["GET"],
)

# 新增记录路由
speaking_api_bp.add_url_rule(
    "/records",
    view_func=QuestionRecordsAPI.as_view("records_add_api"),
    methods=["POST"],
)

# 记录删除路由
speaking_api_bp.add_url_rule(
    "/records/<int:record_id>",
    view_func=QuestionRecordsAPI.as_view("records_delete_api"),
    methods=["DELETE"],
)

# 主题管理路由
speaking_api_bp.add_url_rule(
    "/topics", view_func=TopicsAPI.as_view("topics_create_api"), methods=["GET", "POST"]
)

speaking_api_bp.add_url_rule(
    "/topics/<int:topic_id>",
    view_func=TopicsAPI.as_view("topics_manage_api"),
    methods=["DELETE", "PATCH"],
)

# 问题管理路由
speaking_api_bp.add_url_rule(
    "/questions",
    view_func=QuestionsManageAPI.as_view("questions_create_api"),
    methods=["POST"],
)

speaking_api_bp.add_url_rule(
    "/questions/<int:question_id>",
    view_func=QuestionsManageAPI.as_view("questions_manage_api"),
    methods=["DELETE", "PATCH"],
)

# ========== 错误处理 ==========


@speaking_api_bp.errorhandler(404)
def not_found(error):
    return create_response(False, None, "Resource not found"), 404


@speaking_api_bp.errorhandler(400)
def bad_request(error):
    return create_response(False, None, "Bad request"), 400


@speaking_api_bp.errorhandler(500)
def internal_error(error):
    return create_response(False, None, "Internal server error"), 500

from web_app.config import BASE_DIR
from web_app.models.speaking import (
    SpeakingTopic,
    SpeakingQuestion,
    SpeakingRecord,
)
from web_app.extensions import get_session


PART1_FILE_PATH = BASE_DIR + "/web_app/data/questions/speaking_questions_part1.txt"
PART2_FILE_PATH = BASE_DIR + "/web_app/data/questions/speaking_questions_part2&3.txt"


def load_topics_from_file(filepath: str):
    topics = []
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read().strip()

    blocks = content.split("\n\n")  # 用空行分隔不同主题

    for block in blocks:
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines:
            continue
        topic = lines[0]
        questions = lines[1:]
        topics.append((topic, questions))
    return topics


def clear_all_speaking_data():
    """清空数据库中的所有口语题目数据"""
    try:
        with get_session() as session:
            # 删除所有记录
            session.query(SpeakingRecord).delete()
            # 删除所有问题
            session.query(SpeakingQuestion).delete()
            # 删除所有主题
            session.query(SpeakingTopic).delete()

            session.commit()
        print("✅ 已清空所有口语题目数据")

    except Exception as e:
        print(f"❌ 清空数据时出错: {e}")


def clear_part2_data():
    """只清空数据库中Part 2的口语题目数据"""
    try:
        with get_session() as session:
            # 获取所有Part 2的主题ID
            part2_topics = session.query(SpeakingTopic).filter_by(part=2).all()
            part2_topic_ids = [topic.id for topic in part2_topics]

            if part2_topic_ids:
                # 删除Part 2相关的记录
                session.query(SpeakingRecord).filter(
                    SpeakingRecord.question_id.in_(
                        session.query(SpeakingQuestion.id).filter(
                            SpeakingQuestion.topic_id.in_(part2_topic_ids)
                        )
                    )
                ).delete(synchronize_session=False)

                # 删除Part 2的问题
                session.query(SpeakingQuestion).filter(
                    SpeakingQuestion.topic_id.in_(part2_topic_ids)
                ).delete(synchronize_session=False)

                # 删除Part 2的主题
                session.query(SpeakingTopic).filter_by(part=2).delete()

            session.commit()
        print("✅ 已清空Part 2口语题目数据")

    except Exception as e:
        print(f"❌ 清空Part 2数据时出错: {e}")


def load_part1_topics_from_file(filepath: str):
    """从Part 1文件加载主题，格式为主题名+问题列表"""
    topics = []
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read().strip()

    blocks = content.split("\n\n")  # 用空行分隔不同主题

    for block in blocks:
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines:
            continue

        # 跳过包含"Part 1"和"##"的标题行
        if "Part 1" in lines[0] or lines[0].startswith("##"):
            continue

        topic = lines[0]
        questions = lines[1:]

        if questions:  # 只有当有问题时才添加主题
            topics.append((topic, questions))

    return topics


def load_part2_topics_from_file(filepath: str):
    """从Part 2&3文件加载主题，格式为Describe开头的描述+提示点"""
    topics = []
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read().strip()

    blocks = content.split("\n\n")  # 用空行分隔不同主题

    for block in blocks:
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines:
            continue

        # Part 2&3的格式：第一行是描述，后面是You should say等提示
        if lines[0].startswith("Describe"):
            topic = lines[0]
            # 将所有后续行合并为一个问题
            question_content = "\n".join(lines[1:])
            topics.append(
                (topic, [topic + "\n" + question_content])
            )  # 作为单个问题放入列表

    return topics


def save_topics_to_db(filepath: str, part: int = 2):
    """保存主题到数据库"""
    if part == 1:
        topics = load_part1_topics_from_file(filepath)
    else:
        topics = load_part2_topics_from_file(filepath)

    try:
        with get_session() as session:
            for title, questions in topics:
                # 避免重复
                existing = (
                    session.query(SpeakingTopic)
                    .filter_by(title=title, part=part)
                    .first()
                )
                if existing:
                    print(f"⚠️ 跳过已存在主题: {title}")
                    continue

                topic = SpeakingTopic(part=part, title=title)
                session.add(topic)
                session.flush()  # 获取 topic.id

                for q in questions:
                    session.add(SpeakingQuestion(topic_id=topic.id, question_text=q))

            session.commit()
        print(f"✅ Part {part} 导入完成")

    except Exception as e:
        print(f"❌ Part {part} 导入出错:", e)


def insert_all_questions():
    """清空数据库并插入所有Part 1和Part 2&3的题目"""
    print("开始清空并重新导入所有口语题目...")

    # 清空所有数据
    clear_all_speaking_data()

    # 导入Part 1题目
    print("\n导入Part 1题目...")
    save_topics_to_db(PART1_FILE_PATH, part=1)

    # 导入Part 2&3题目
    print("\n导入Part 2&3题目...")
    save_topics_to_db(PART2_FILE_PATH, part=2)

    print("\n🎉 所有题目导入完成！")


def insert_part2_questions_only():
    """只清空并重新导入Part 2的题目"""
    print("开始清空并重新导入Part 2口语题目...")

    # 清空Part 2数据
    clear_part2_data()

    # 导入Part 2&3题目
    print("\n导入Part 2&3题目...")
    save_topics_to_db(PART2_FILE_PATH, part=2)

    print("\n🎉 Part 2题目导入完成！")


if __name__ == "__main__":
    # 只执行Part 2的清空和导入流程
    insert_part2_questions_only()

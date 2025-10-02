from concurrent.futures import ThreadPoolExecutor
import datetime
from sqlalchemy import update
from web_app.extensions import get_session
from web_app.models.word_models import Word
from web_app.utils.db_tools import update_word_definition


def clear_definitions():
    """函数1: 将表中所有单词的释义字段设置为 NULL"""
    with get_session() as db:
        db.execute(update(Word).values(definition=None))
    print("所有释义字段已清空。")


def reset_stop_review():
    """
    将数据库中所有单词的 stop_review 字段设置为 0
    """
    with get_session() as db:
        db.execute(update(Word).values(stop_review=0))
    print("✅ 已将 stop_review 全部重置为 0")


def reset_all_words_srs():
    """
    将数据库中所有单词的 SRS 数据重置为默认值
    next_review 设置为明天
    """
    today = datetime.date.today()
    next_review = today + datetime.timedelta(days=1)

    with get_session() as db:
        db.execute(
            update(Word).values(
                date_added=today.isoformat(),
                remember_count=0,
                forget_count=0,
                last_remembered=None,
                last_forgot=None,
                stop_review=0,
                next_review=next_review.isoformat(),
                interval=1,
                repetition=0,
                ease_factor=2.5,
                last_score=0,
                avg_elapsed_time=0,
                lapse=0,
                spell_strength=None,
            )
        )
        db.commit()


def fill_definitions(max_workers=5):
    """函数2: 多线程填充释义"""
    with get_session() as db:
        words = db.query(Word.id, Word.word).filter(Word.definition == None).all()

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(update_word_definition, wid, w) for wid, w in words]
        for f in futures:
            f.result()  # 等待所有任务完成

    print("所有释义字段已填充完成。")

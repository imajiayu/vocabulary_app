# -*- coding: utf-8 -*-
from concurrent.futures import ThreadPoolExecutor
import sqlite3, datetime, time
from flask import g, has_app_context
from web_app.const import DB_PATH
from web_app.utils.definition_tools import fetch_definition_from_web


def get_db():
    """
    获取 SQLite 连接：
    - 在 Flask 请求上下文中，使用 g 保存连接（自动复用、自动关闭）。
    - 在非请求上下文（脚本/CLI）中，返回独立连接，需要手动关闭。
    """
    if has_app_context():
        if "db" not in g:
            g.db = sqlite3.connect(DB_PATH)
            g.db.row_factory = sqlite3.Row
        return g.db
    else:
        # 非 Flask 上下文，直接创建连接
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

def close_db(error=None):
    """关闭数据库连接"""
    db = g.pop("db", None)
    if db is not None:
        db.close()

def fetch_word_by_id(word_id):
    conn = get_db()
    cursor = conn.cursor()

    row = cursor.execute("SELECT id, word, definition FROM IELTS WHERE id = ?", (word_id,)).fetchone()
    # conn.close()  # 不再需要关闭

    if row:
        return {
            'id': row[0],
            'word': row[1],
            'definition': row[2]
        }
    return None


def insert_new_word(word):
    conn = get_db()
    cursor = conn.cursor()

    # 检查单词是否已存在
    cursor.execute("SELECT 1 FROM IELTS WHERE word = ?", (word,))
    if cursor.fetchone():
        print(f"单词 '{word}' 已存在，跳过插入。")
        return False

    cursor.execute(
        """
        INSERT INTO IELTS (word)
        VALUES (?)
        """,
        (word,)
    )

    conn.commit()
    return True
    
def clear_definitions():
    """函数1: 将表中所有单词的释义字段设置为 NULL"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE IELTS SET definition = NULL")
    conn.commit()
    print("所有释义字段已清空。")

def update_word_definition(word_id, word):
    """查询单词释义并更新数据库，失败则重试"""
    conn = get_db()
    cursor = conn.cursor()
    while True:
        definition = fetch_definition_from_web(word)
        if not definition.startswith("查询失败"):
            cursor.execute(
                "UPDATE IELTS SET definition = ? WHERE id = ?",
                (definition, word_id)
            )
            conn.commit()
            break
        else:
            print(f"{word} 查询失败，0.2秒后重试...")
            time.sleep(0.2)

def fill_definitions(max_workers=5):
    """函数2: 多线程填充释义"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, word FROM IELTS WHERE definition IS NULL")
    words = cursor.fetchall()

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(update_word_definition, wid, w) for wid, w in words]
        for f in futures:
            f.result()  # 等待所有任务完成

    print("所有释义字段已填充完成。")

def reset_stop_review():
    """
    将数据库中所有单词的 stop_review 字段设置为 0
    """
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("UPDATE IELTS SET stop_review = 0")

    conn.commit()
    print("✅ 已将 stop_review 全部重置为 0")

def reset_all_words_srs():
    """
    将数据库中所有单词的 SRS 数据重置为默认值
    next_review 设置为明天
    """
    today = datetime.date.today()
    next_review = today + datetime.timedelta(days=1)

    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        """
        UPDATE IELTS
        SET date_added = ?,
            remember_count = 0,
            forget_count = 0,
            last_remembered = NULL,
            last_forgot = NULL,
            stop_review = 0,
            next_review = ?,
            interval = 1,
            repetition = 0,
            ease_factor = 2.5,
            last_score = 0,
            avg_elapsed_time = 0,
            lapse = 0
        """,
        (today.isoformat(), next_review.isoformat())
    )
    
    conn.commit()
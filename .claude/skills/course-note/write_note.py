#!/usr/bin/env python3
"""
课程便笺写入/查看工具。

便笺存进收件人 course_progress.progress._notes（与 _exercises 并列），
不新建表。本机直连 DATABASE_URL（绕过 RLS）写 body；收件人在前端只读 body、可写 reply。

用法（在仓库根目录 /Users/majiayu/vocabulary_app 运行）：

  # 写一条针对某课时的便笺（只在该课时页显示）
  python3 .claude/skills/course-note/write_note.py \
      --lesson w2d5 --body "你这章学得很棒，继续加油！" --author MJY

  # 写一条全课程通用便笺（法律英语所有课时页都显示）
  python3 .claude/skills/course-note/write_note.py \
      --body "我在每一页陪着你～" --author MJY

  # 查看现有便笺 + 她的回复
  python3 .claude/skills/course-note/write_note.py --list

  # 跳过确认直接写
  python3 .claude/skills/course-note/write_note.py --lesson w2d5 --body "..." --yes
"""

import argparse
import json
import sys
from datetime import datetime, timezone

import psycopg2
from psycopg2.extras import Json
from dotenv import dotenv_values

# 默认收件人（女朋友账号）与课程
DEFAULT_USER = "f18e410b-400d-4492-bc3e-eb0e034eb366"
DEFAULT_COURSE = "legal-english"
# 全课程通用便笺的键（与前端 ALL_LESSONS_KEY 保持一致）
ALL_KEY = "__all"


def get_conn():
    cfg = dotenv_values("backend/.env")
    url = cfg.get("DATABASE_URL")
    if not url:
        sys.exit("✗ backend/.env 中找不到 DATABASE_URL，请在仓库根目录运行")
    return psycopg2.connect(url)


def cmd_list(cur, user, course):
    cur.execute(
        "SELECT progress->'_notes' FROM course_progress WHERE user_id=%s AND course=%s",
        (user, course),
    )
    row = cur.fetchone()
    notes = (row[0] if row else None) or {}
    if not notes:
        print("（该用户该课程暂无便笺）")
        return
    for key, n in notes.items():
        label = "全课程通用" if key == ALL_KEY else f"课时 {key}"
        print("=" * 44)
        print(f"位置 : {label}")
        print(f"内容 : {n.get('body', '')}")
        if n.get("author"):
            print(f"署名 : {n['author']}")
        print(f"回复 : {n.get('reply') or '（她还没回复）'}")
        if n.get("repliedAt"):
            print(f"回复时间: {n['repliedAt']}")


def cmd_write(conn, cur, user, course, key, body, author, assume_yes):
    cur.execute(
        "SELECT progress FROM course_progress WHERE user_id=%s AND course=%s",
        (user, course),
    )
    row = cur.fetchone()
    exists = row is not None
    progress = (row[0] if row else None) or {}
    notes = progress.get("_notes") or {}
    old = notes.get(key) or {}

    now_iso = datetime.now(timezone.utc).isoformat()
    new_note = {"body": body}
    if author:
        new_note["author"] = author
    elif old.get("author"):
        new_note["author"] = old["author"]
    # createdAt 复用旧值；首次写入用当前 UTC 时间
    new_note["createdAt"] = old.get("createdAt") or now_iso
    new_note["updatedAt"] = now_iso
    # 保留她已有的回复
    if old.get("reply") is not None:
        new_note["reply"] = old["reply"]
    if old.get("repliedAt"):
        new_note["repliedAt"] = old["repliedAt"]

    notes[key] = new_note
    progress["_notes"] = notes

    # ── dry-run 预览 ──
    label = "全课程通用（所有课时页显示）" if key == ALL_KEY else f"课时 {key}"
    print("── 即将写入 ──")
    print(f"收件人 : {user}")
    print(f"课程   : {course}")
    print(f"位置   : {label}")
    print(f"便笺   : {json.dumps(new_note, ensure_ascii=False, indent=2)}")
    print(f"操作   : {'UPDATE 现有行' if exists else 'INSERT 新行'}（仅改 _notes，保留 _exercises 与勾选）")

    if not assume_yes:
        ans = input("确认写入？(yes/no): ").strip().lower()
        if ans not in ("y", "yes"):
            print("已取消，未提交")
            return

    if exists:
        cur.execute(
            "UPDATE course_progress SET progress=%s, updated_at=now() "
            "WHERE user_id=%s AND course=%s",
            (Json(progress), user, course),
        )
    else:
        cur.execute(
            "INSERT INTO course_progress (user_id, course, progress) VALUES (%s,%s,%s)",
            (user, course, Json(progress)),
        )
    conn.commit()
    print("✅ 已写入数据库")


def main():
    p = argparse.ArgumentParser(description="课程便笺写入/查看")
    p.add_argument("--user", default=DEFAULT_USER, help="收件人 user_id（默认女朋友账号）")
    p.add_argument("--course", default=DEFAULT_COURSE, help="课程 id（默认 legal-english）")
    p.add_argument("--lesson", default=None, help="课时 id（如 w2d5）；省略=全课程通用便笺")
    p.add_argument("--body", default=None, help="便笺正文")
    p.add_argument("--author", default=None, help="署名")
    p.add_argument("--list", action="store_true", help="列出现有便笺 + 回复")
    p.add_argument("--yes", action="store_true", help="跳过确认直接写入")
    args = p.parse_args()

    conn = get_conn()
    cur = conn.cursor()
    try:
        if args.list:
            cmd_list(cur, args.user, args.course)
            return
        if not args.body:
            sys.exit("✗ 需要 --body 指定便笺内容（或用 --list 查看）")
        key = args.lesson if args.lesson else ALL_KEY
        cmd_write(conn, cur, args.user, args.course, key, args.body, args.author, args.yes)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()

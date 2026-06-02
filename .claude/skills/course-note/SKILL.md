---
name: course-note
description: 给课程学习者在课时页留一条 sticky 便笺（鼓励的话），并查看对方的回复。触发词：写便笺、给课程留言、course note、给女朋友写便笺、查看她的回复
---

# 课程便笺（Course Note）

在指定课程的课时页右侧浮现一张 sticky 便笺，写给正在学习的人（默认：女朋友账号 `f18e410b-400d-4492-bc3e-eb0e034eb366`，法律英语课程）。对方在前端只读便笺正文，可以回复，回复写回数据库后你能用本工具查看。

便笺**不新建表**，直接存进她的 `course_progress.progress._notes`（与练习记录 `_exercises` 并列），由本机直连 `DATABASE_URL`（绕过 RLS）写入。前端组件 `CourseNoteSticky.vue` 运行时读取，所以**写完即时生效，无需重新部署前端**。

## 使用

所有命令在仓库根目录 `/Users/majiayu/vocabulary_app` 运行（脚本依赖 `backend/.env` 的 `DATABASE_URL`）。优先用项目 venv：

```bash
source .venv/bin/activate
```

### 写一条针对某课时的便笺（只在该课时页显示）

```bash
python3 .claude/skills/course-note/write_note.py \
    --lesson w2d5 \
    --body "你这章学得很认真，我都看在眼里，继续加油！" \
    --author MJY
```

### 写一条全课程通用便笺（法律英语所有课时页都显示）

```bash
python3 .claude/skills/course-note/write_note.py \
    --body "无论翻到哪一页，我都在这儿陪着你～" \
    --author MJY
```

### 查看现有便笺 + 她的回复

```bash
python3 .claude/skills/course-note/write_note.py --list
```

## 参数

| 参数 | 说明 |
|------|------|
| `--lesson` | 课时 id（如 `w2d5`）；**省略 = 全课程通用便笺**，所有课时页都显示 |
| `--body` | 便笺正文（写入时必填） |
| `--author` | 署名（可选，显示为「来自 XX」） |
| `--list` | 列出现有便笺 + 回复，不写入 |
| `--course` | 课程 id，默认 `legal-english` |
| `--user` | 收件人 user_id，默认女朋友账号 |
| `--yes` | 跳过确认直接写入 |

## 行为说明

- 同一位置（课时 id 或全课程通用）只保留**一条**便笺，再次写入会**覆盖正文**，但**保留她已有的回复**。
- 写入前默认打印预览并要求确认（dry-run 纪律）；`--yes` 可跳过。
- 只改 `_notes` 子键，不会动她的练习记录（`_exercises`）和课时勾选。
- 对方刷新课时页即可看到/更新；便笺默认展开浮在屏幕右侧居中，可点击收起。

## 注意

- 写入是直连生产数据库的真实操作，确认收件人 / 课程 / 课时无误再提交。
- 想换收件人或课程，用 `--user` / `--course` 覆盖。

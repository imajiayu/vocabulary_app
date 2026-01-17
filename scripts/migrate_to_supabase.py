#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SQLite 到 Supabase (PostgreSQL) 数据迁移脚本

使用方法:
1. 设置环境变量 DATABASE_URL 为 Supabase 连接字符串
2. 运行: python scripts/migrate_to_supabase.py
"""

import os
import sys

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from web_app.config import DB_PATH


def get_supabase_url():
    """获取 Supabase 连接字符串"""
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("错误: 请设置环境变量 DATABASE_URL")
        sys.exit(1)
    return url


def create_tables_in_supabase(pg_engine):
    """在 Supabase 中创建表结构"""
    print("正在创建表结构...")
    from web_app.models.word import Base as WordBase
    from web_app.models.speaking import Base as SpeakingBase
    WordBase.metadata.create_all(pg_engine)
    SpeakingBase.metadata.create_all(pg_engine)
    print("表结构创建完成!")


def migrate_table_batch(sqlite_session, pg_session, table_name, batch_size=100):
    """批量迁移单个表的数据"""
    print(f"\n正在迁移 {table_name} 表...")

    try:
        # 获取数据
        result = sqlite_session.execute(text(f"SELECT * FROM {table_name}"))
        rows = result.fetchall()
        columns = list(result.keys())

        if not rows:
            print(f"  {table_name} 表为空")
            return 0

        # 批量插入
        total = len(rows)
        inserted = 0

        for i in range(0, total, batch_size):
            batch = rows[i:i + batch_size]

            # 构建批量插入的VALUES
            values_list = []
            params = {}

            for j, row in enumerate(batch):
                row_dict = dict(zip(columns, row))
                placeholders = []
                for k, col in enumerate(columns):
                    param_name = f"p{i}_{j}_{k}"
                    placeholders.append(f":{param_name}")
                    params[param_name] = row_dict[col]
                values_list.append(f"({', '.join(placeholders)})")

            cols = ", ".join([f'"{c}"' for c in columns])
            sql = f'INSERT INTO {table_name} ({cols}) VALUES {", ".join(values_list)} ON CONFLICT DO NOTHING'

            try:
                pg_session.execute(text(sql), params)
                pg_session.commit()
                inserted += len(batch)
                print(f"  进度: {inserted}/{total}", end='\r')
            except Exception as e:
                pg_session.rollback()
                print(f"\n  批次插入失败，尝试逐条插入: {e}")
                # 回退到逐条插入
                for row in batch:
                    row_dict = dict(zip(columns, row))
                    single_cols = ", ".join([f'"{c}"' for c in columns])
                    single_placeholders = ", ".join([f":{c}" for c in columns])
                    single_sql = f'INSERT INTO {table_name} ({single_cols}) VALUES ({single_placeholders}) ON CONFLICT DO NOTHING'
                    try:
                        pg_session.execute(text(single_sql), row_dict)
                        pg_session.commit()
                        inserted += 1
                    except Exception as e2:
                        pg_session.rollback()
                        print(f"\n  跳过一条记录: {e2}")

        print(f"  迁移了 {inserted}/{total} 条记录")

        # 重置序列
        if inserted > 0 and 'id' in columns:
            try:
                max_id = max(dict(zip(columns, row))['id'] for row in rows)
                pg_session.execute(text(f"SELECT setval('{table_name}_id_seq', {max_id}, true)"))
                pg_session.commit()
            except Exception:
                pass  # 序列可能不存在

        return inserted

    except Exception as e:
        print(f"  {table_name} 表迁移失败: {e}")
        return 0


def migrate_data(sqlite_engine, pg_engine):
    """迁移数据从 SQLite 到 PostgreSQL"""
    SqliteSession = sessionmaker(bind=sqlite_engine)
    PgSession = sessionmaker(bind=pg_engine)

    sqlite_session = SqliteSession()
    pg_session = PgSession()

    try:
        # 按依赖顺序迁移表（不迁移 words_relations 和 relation_generation_log）
        tables = [
            'words',
            'current_progress',
            'speaking_topics',
            'speaking_questions',
            'speaking_records'
        ]

        for table in tables:
            migrate_table_batch(sqlite_session, pg_session, table, batch_size=50)

        print("\n数据迁移完成!")

    except Exception as e:
        pg_session.rollback()
        print(f"\n迁移失败: {e}")
        raise
    finally:
        sqlite_session.close()
        pg_session.close()


def verify_migration(pg_engine):
    """验证迁移结果"""
    print("\n验证迁移结果...")
    PgSession = sessionmaker(bind=pg_engine)
    session = PgSession()

    try:
        tables = ['words', 'words_relations', 'relation_generation_log',
                  'current_progress', 'speaking_topics', 'speaking_questions', 'speaking_records']

        for table in tables:
            try:
                result = session.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
                print(f"  {table}: {count} 条记录")
            except Exception:
                print(f"  {table}: 表不存在")
    finally:
        session.close()


def main():
    print("=" * 50)
    print("SQLite → Supabase 数据迁移工具")
    print("=" * 50)

    if not os.path.exists(DB_PATH):
        print(f"\n错误: SQLite 数据库不存在: {DB_PATH}")
        sys.exit(1)

    print(f"\n源数据库: {DB_PATH}")

    supabase_url = get_supabase_url()
    print(f"目标数据库: Supabase PostgreSQL")

    sqlite_engine = create_engine(f"sqlite:///{DB_PATH}")
    pg_engine = create_engine(supabase_url, pool_pre_ping=True)

    print("\n测试 Supabase 连接...")
    try:
        with pg_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("连接成功!")
    except Exception as e:
        print(f"连接失败: {e}")
        sys.exit(1)

    create_tables_in_supabase(pg_engine)
    migrate_data(sqlite_engine, pg_engine)
    verify_migration(pg_engine)

    print("\n" + "=" * 50)
    print("迁移完成!")
    print("=" * 50)


if __name__ == "__main__":
    main()

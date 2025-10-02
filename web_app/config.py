# -*- coding: utf-8 -*-
import os

# 项目根目录（和 web_app 同级）
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 数据库路径
DB_PATH = os.path.join(BASE_DIR, "vocabulary.db")

STATIC_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

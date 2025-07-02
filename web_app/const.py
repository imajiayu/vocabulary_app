# config.py
import os

# 项目根目录（和 web_app 同级）
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 数据库路径
DB_PATH = os.path.join(BASE_DIR, 'vocabulary.db')

MODE_NEW = "mode_new"
MODE_REVIEW = "mode_review"
MODE_LAPSE = "mode_lapse"
MODE_SPELLING = "mode_spelling"
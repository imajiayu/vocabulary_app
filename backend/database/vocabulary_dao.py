# -*- coding: utf-8 -*-
"""
Vocabulary DAO - 向后兼容模块
所有函数已迁移到 vocabulary/ 子模块中

新代码推荐直接导入子模块:
    from backend.database.vocabulary import db_insert_word
    from backend.database.vocabulary.word_crud import db_insert_word
"""

# 重导出所有函数以保持向后兼容
from backend.database.vocabulary import *

# 关系生成器重构指南

## 重构目的

将所有 `services/relations/` 下的 generator 文件中的数据库操作移至 DAO 层，避免在 Service 层直接使用 `get_session()`。

## 已完成的重构

### 1. DAO层新增函数 (`relation_dao.py`)

```python
def db_get_all_words():
    """获取所有单词列表（用于关系生成）"""
    with get_session() as db:
        words = db.query(Word).all()
        # 返回字典格式，避免session关闭后访问问题
        return [
            {
                'id': w.id,
                'word': w.word,
                'definition': w.definition
            }
            for w in words
        ]

def db_batch_insert_relations(relations_data: List[Dict], batch_size: int = 1000):
    """批量插入关系，自动创建双向关系"""
    # 实现详见 relation_dao.py:330
```

### 2. 工具函数重构 (`utils.py`)

**修改前:**
```python
def batch_insert_relations(session, relations: list, batch_size: int = 1000):
    # 直接使用session操作数据库
    session.execute(stmt, bidirectional_batch)
    session.commit()
```

**修改后:**
```python
def batch_insert_relations(relations: list, batch_size: int = 1000):
    """通过DAO层批量插入关系"""
    from web_app.database.relation_dao import db_batch_insert_relations

    relations_data = [
        {
            'word_id': rel.word_id,
            'related_word_id': rel.related_word_id,
            'relation_type': rel.relation_type,
            'confidence': rel.confidence
        }
        for rel in relations
    ]

    db_batch_insert_relations(relations_data, batch_size)
```

### 3. 示例：重构 `synonym_generator.py`

#### 步骤1: 修改导入

**修改前:**
```python
from web_app.extensions import get_session
from web_app.models.word import Word, WordRelation, RelationType
from web_app.services.relations.utils import batch_insert_relations
```

**修改后:**
```python
from web_app.models.word import WordRelation, RelationType
from web_app.services.relations.utils import batch_insert_relations
from web_app.database.relation_dao import db_get_all_words
```

#### 步骤2: 修改 `generate_relations()` 方法

**修改前:**
```python
def generate_relations(self, emitter=None) -> int:
    with get_session() as session:
        words = session.query(Word).all()
        word_map = {w.word.lower(): w for w in words}

        # ... 处理逻辑 ...

        # 使用 word.id 和 word.word
        for i, word in enumerate(words):
            synonyms = self.get_wordnet_synonyms(word.word)

            for syn_word, confidence in synonyms.items():
                if syn_word in word_map:
                    pair_key = tuple(sorted([word.id, word_map[syn_word].id]))
                    # ...

        # 批量插入时传入session
        batch_insert_relations(session, relations_to_add)
```

**修改后:**
```python
def generate_relations(self, emitter=None) -> int:
    words_data = db_get_all_words()  # 返回字典列表
    word_map = {w['word'].lower(): w for w in words_data}

    # ... 处理逻辑 ...

    # 使用 word['id'] 和 word['word']
    for i, word in enumerate(words_data):
        synonyms = self.get_wordnet_synonyms(word['word'])

        for syn_word, confidence in synonyms.items():
            if syn_word in word_map:
                pair_key = tuple(sorted([word['id'], word_map[syn_word]['id']]))
                # ...

    # 批量插入时不传session
    batch_insert_relations(relations_to_add)
```

#### 步骤3: 修改其他方法的参数类型

**修改前:**
```python
def get_semantic_similarity_synonyms(
    self, words: List[Word], emitter=None
) -> Dict[Tuple[int, int], float]:
    for word in words:
        synsets = self._get_synsets(word.word)
        if synsets:
            word_synsets[word.id] = synsets[:3]
```

**修改后:**
```python
def get_semantic_similarity_synonyms(
    self, words: List[Dict], emitter=None
) -> Dict[Tuple[int, int], float]:
    for word in words:
        synsets = self._get_synsets(word['word'])
        if synsets:
            word_synsets[word['id']] = synsets[:3]
```

## 待重构的文件

使用相同模式重构以下文件：

1. ✅ `synonym_generator.py` - 已完成
2. ⏳ `antonym_generator.py`
3. ⏳ `root_generator.py`
4. ⏳ `confused_generator.py`
5. ⏳ `topic_generator.py`

## 重构检查清单

对每个generator文件：

- [ ] 移除 `from web_app.extensions import get_session`
- [ ] 添加 `from web_app.database.relation_dao import db_get_all_words`
- [ ] 将 `session.query(Word).all()` 替换为 `db_get_all_words()`
- [ ] 将所有 `word.id` 改为 `word['id']`
- [ ] 将所有 `word.word` 改为 `word['word']`
- [ ] 将所有 `word.definition` 改为 `word['definition']`
- [ ] 移除 `batch_insert_relations()` 的 `session` 参数
- [ ] 更新方法签名中的类型提示 `List[Word]` → `List[Dict]`
- [ ] 测试生成功能是否正常

## 架构优势

**重构前:**
```
Generator (Service层)
  └─> 直接使用 get_session()
      └─> 直接操作数据库
```

**重构后:**
```
Generator (Service层)
  └─> 调用 DAO 函数
      └─> DAO层 (唯一使用get_session的地方)
          └─> 操作数据库
```

### 优点

1. **职责分离**: Service层专注业务逻辑，DAO层专注数据访问
2. **易于测试**: 可以mock DAO函数进行单元测试
3. **代码复用**: 多个generator可以共享DAO函数
4. **易于维护**: 数据库操作集中在一处，修改更容易
5. **避免session泄漏**: DAO层统一管理session生命周期

## 示例：完整重构流程

```bash
# 1. 打开generator文件
vim web_app/services/relations/antonym_generator.py

# 2. 修改导入部分
:%s/from web_app.extensions import get_session//g
# 添加: from web_app.database.relation_dao import db_get_all_words

# 3. 查找并替换所有 get_session 使用
/with get_session()
# 替换为: words_data = db_get_all_words()

# 4. 批量替换 Word 对象访问为字典访问
:%s/word\.id/word['id']/g
:%s/word\.word/word['word']/g
:%s/word\.definition/word['definition']/g

# 5. 移除 batch_insert_relations 的 session 参数
:%s/batch_insert_relations(session,/batch_insert_relations(/g

# 6. 更新类型提示
:%s/List\[Word\]/List[Dict]/g

# 7. 测试
```

## 注意事项

1. **返回值变化**: `db_get_all_words()` 返回字典列表，不是ORM对象
2. **session管理**: 不再需要手动管理session
3. **类型提示**: 记得更新参数类型 `List[Word]` → `List[Dict]`
4. **访问方式**: ORM对象的 `.` 访问改为字典的 `['key']` 访问

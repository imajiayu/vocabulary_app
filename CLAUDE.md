# CLAUDE.md

IELTS词汇学习应用 - Flask后端 + Vue3前端，实现间隔重复记忆系统和Whisper.cpp语音练习。

## 快速启动

```bash
./start.sh start    # 启动前后端
./start.sh stop     # 停止服务
```

单独运行：
```bash
# 后端 (端口5001)
source .venv/bin/activate && python -m web_app.app

# 前端 (HTTPS)
cd vue_project && npm run dev
```

## 项目结构

### 后端 `web_app/`

```
app.py                 # Flask入口，注册5个蓝图
config.py              # 用户配置（学习限制、Lapse设置等）
extensions.py          # SQLAlchemy + SocketIO初始化

api/
├── vocabulary.py      # 单词CRUD、复习结果提交
├── speaking.py        # 语音转文字、话题/问题管理
├── settings.py        # 用户设置读写
├── relations.py       # 词汇关系（同义词/反义词等）
└── vocabulary_assistance.py  # AI辅助

core/
├── review_repetition.py   # SM-2间隔重复算法 + 负荷均衡
└── spell_repetition.py    # 拼写强度算法

database/
├── vocabulary_dao.py  # 单词数据操作
├── speaking_dao.py    # 口语数据操作
├── progress_dao.py    # 学习进度
└── relation_dao.py    # 词汇关系

services/
├── word_update_service.py      # 复习/Lapse/拼写更新
├── websocket_service.py        # WebSocket事件推送
├── relation_generation_manager.py  # 词汇关系生成
└── relations/                  # 各类关系生成器

models/
├── word.py           # Word模型（SRS字段、拼写字段）
└── speaking.py       # Topic/Question/Record模型

utils/
├── whisper_integration.py  # Whisper进程管理
└── speech_processing.py    # 语音转录
```

### 前端 `vue_project/src/`

```
app/
├── main.ts           # Vue应用入口
└── router/index.ts   # 路由配置

pages/
├── HomePage.vue              # 主页导航
├── ReviewPage.vue            # 复习页（复习/Lapse/拼写三种模式）
├── VocabularyManagementPage.vue  # 单词管理
├── SpeakingPage.vue          # 口语练习
├── StatisticsPage.vue        # 统计图表
└── SettingsPage.vue          # 用户设置

features/
├── vocabulary/       # WordCard/WordReview/WordSpelling等组件
├── speaking/         # 录音/转录/AI反馈组件
└── statistics/       # ECharts图表组件

shared/
├── api/              # HTTP客户端（words/speaking/settings等）
├── services/websocket.ts   # WebSocket客户端
├── types/index.ts    # TypeScript类型定义
├── composables/      # 快捷键/定时器/音频等
└── components/       # 通用UI组件
```

## 核心算法

**SM-2复习算法** (`core/review_repetition.py`)
- `calculate_score()` - 基于反应时间评分(1-5)
- `sm2_update_ease_factor()` - EF值更新(1.3-3.0)
- `calculate_srs_parameters_with_load_balancing()` - 间隔计算 + 负荷均衡

**拼写算法** (`core/spell_repetition.py`)
- 分析输入行为（按键事件、退格次数、准确率）
- 考虑单词难度和长度计算拼写强度

## 数据流

```
复习流程:
前端请求 → db_fetch_review_word_ids() → 用户复习 → POST /review-result
→ calculate_srs_parameters_with_load_balancing() → 更新DB → WebSocket推送

语音练习:
录音 → WAV上传 → speech_processing.py → Whisper转录 → OpenAI评分 → 返回反馈
```

## 数据库

- **位置**: `vocabulary.db` (SQLite，不在git中)
- **Word模型**: word, definition(JSON), ease_factor, interval, repetition, lapse, spell_strength, next_review
- **Speaking模型**: SpeakingTopic, SpeakingQuestion, SpeakingRecord

## 技术栈

| 后端 | 前端 |
|------|------|
| Flask 3.1 | Vue 3 + TypeScript |
| SQLAlchemy | Vite + Tailwind |
| Flask-SocketIO | Socket.io |
| Whisper.cpp | ECharts |

## 不在Git中的文件

- `vocabulary.db` - 数据库
- `.venv/` - Python虚拟环境
- `node_modules/` - NPM依赖
- `whisper.cpp/models/*.bin` - AI模型（用download脚本下载）
- `whisper.cpp/build/` - 编译产物
- `*.pem` - SSL证书

## 故障排除

```bash
# 重建Python环境
rm -rf .venv && python3 -m venv .venv && source .venv/bin/activate && pip install -r web_app/requirements.txt

# 重建前端
cd vue_project && rm -rf node_modules && npm install

# 重建Whisper
cd whisper.cpp && rm -rf build && mkdir build && cd build && cmake .. && make
```

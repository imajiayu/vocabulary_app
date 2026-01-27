# 口语模块架构文档

## 当前架构

### 数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                         前端直连架构                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌─────────────────┐    ┌──────────────────┐   │
│  │ 录音     │───>│ Supabase Storage│───>│ 音频文件存储      │   │
│  │ (浏览器) │    │ (speaking-audios)│    │                  │   │
│  └──────────┘    └─────────────────┘    └──────────────────┘   │
│                                                                 │
│  ┌──────────┐    ┌─────────────────┐    ┌──────────────────┐   │
│  │ 转录     │───>│ 手动输入        │───>│ 用户文本          │   │
│  │ (待接入) │    │ (临时方案)      │    │                  │   │
│  └──────────┘    └─────────────────┘    └──────────────────┘   │
│                                                                 │
│  ┌──────────┐    ┌─────────────────┐    ┌──────────────────┐   │
│  │ AI 评分  │───>│ DeepSeek API    │───>│ 分数 + 改写反馈   │   │
│  │          │    │ (前端直调)      │    │                  │   │
│  └──────────┘    └─────────────────┘    └──────────────────┘   │
│                                                                 │
│  ┌──────────┐    ┌─────────────────┐    ┌──────────────────┐   │
│  │ 数据存储 │───>│ Supabase DB     │───>│ topics/questions │   │
│  │          │    │ (PostgreSQL)    │    │ /records         │   │
│  └──────────┘    └─────────────────┘    └──────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 核心文件

| 文件 | 职责 |
|------|------|
| `shared/api/speaking.ts` | Supabase 直连 API（CRUD + 音频上传） |
| `shared/services/supabase-storage.ts` | 音频文件上传/删除 |
| `shared/services/speaking-ai.ts` | AI 评分反馈（DeepSeek） |
| `shared/services/transcription.ts` | 转录服务抽象层（待实现） |
| `features/speaking/components/VoicePractice.vue` | 练习状态机 |

### 状态机

```
IDLE ──START──> RECORDING ──STOP──> TRANSCRIBING
                    │                    │
                    │              ┌─────┴─────┐
                    │              ▼           ▼
                CANCEL        SUCCESS      FAILED
                    │              │           │
                    ▼              ▼           ▼
                  IDLE        ANALYZING   MANUAL_INPUT
                                  │           │
                                  │     ┌─────┴─────┐
                                  │     ▼           ▼
                                  │   SUBMIT     CANCEL
                                  │     │           │
                                  ▼     ▼           ▼
                              COMPLETED          IDLE
                                  │
                            ┌─────┴─────┐
                            ▼           ▼
                          SUBMIT     RESTART
                            │           │
                            ▼           ▼
                          IDLE      RECORDING
```

---

## 在线转录 API 接入计划

### 方案对比

| 方案 | 单次成本 | 月成本(90次) | 延迟 | 推荐度 |
|------|---------|-------------|------|--------|
| A. Realtime 全流程 | $0.54 | $48.6 | 实时 | ⭐ |
| B. Realtime Mini | $0.18 | $16.2 | 实时 | ⭐⭐ |
| **C. 转录 + DeepSeek** | $0.02 | $1.5 | ~3秒 | ⭐⭐⭐⭐⭐ |
| D. 手动输入（当前） | $0.001 | $0.09 | 手动 | ⭐⭐⭐ |

### 推荐方案：gpt-4o-mini-transcribe + DeepSeek

**成本：** $0.003/分钟转录 + ~$0.001 AI 反馈 ≈ **$0.02/次**

**架构：**
```
录音 ──> OpenAI Transcribe API ──> DeepSeek 评分 ──> 显示结果
         (gpt-4o-mini-transcribe)   (deepseek-chat)
              $0.003/分钟              ~$0.001
```

### 接入步骤

#### 1. 添加环境变量

```bash
# .env.local
VITE_OPENAI_API_KEY=sk-...
```

#### 2. 实现转录服务

修改 `frontend/src/shared/services/transcription.ts`：

```typescript
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || ''

// 更新配置
const currentConfig: TranscriptionConfig = {
  provider: OPENAI_API_KEY ? 'openai-transcribe' : 'none'
}

async function transcribeWithOpenAI(audioFile: File): Promise<TranscriptionResult> {
  if (!OPENAI_API_KEY) {
    return { text: '', success: false, error: 'OpenAI API Key 未配置' }
  }

  const formData = new FormData()
  formData.append('file', audioFile)
  formData.append('model', 'gpt-4o-mini-transcribe')
  formData.append('language', 'en')

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: formData
    })

    if (!response.ok) {
      const error = await response.text()
      return { text: '', success: false, error }
    }

    const data = await response.json()
    return { text: data.text, success: true }
  } catch (e) {
    return { text: '', success: false, error: String(e) }
  }
}
```

#### 3. 更新 switch 分支

```typescript
export async function transcribeAudio(audioFile: File): Promise<TranscriptionResult> {
  switch (currentConfig.provider) {
    case 'openai-transcribe':
      return transcribeWithOpenAI(audioFile)
    case 'openai-whisper':
      return transcribeWithWhisper(audioFile)
    case 'gpt-realtime':
      return transcribeWithGptRealtime(audioFile)
    case 'none':
    default:
      return {
        text: '',
        success: false,
        error: '转录服务未配置，请手动输入文本'
      }
  }
}
```

---

## Realtime API 接入（可选）

如果需要实时转录体验，可以接入 GPT-4o Realtime API。

### 优势

- 边说边显示转录文字
- 停止后立即得到反馈
- 支持打断和修正

### 架构变化

```
当前：
  录音 ──> 停止 ──> 批量转录 ──> AI评分 ──> 显示

Realtime：
  开始说话 ──┬──> WebSocket 流式音频
             │         │
             │         ▼
             │    实时显示转录
             │
  停止说话 ──┴──> 触发 AI 评分 ──> 立即显示
```

### 实现要点

1. **WebSocket 连接管理**
   - 连接池或按需连接
   - 心跳保活
   - 断线重连

2. **音频流处理**
   - MediaRecorder 实时分片
   - base64 编码发送
   - 采样率 24kHz（API 要求）

3. **成本控制**
   - 使用 `gpt-4o-mini-realtime`（$0.10/分钟 vs $0.30/分钟）
   - 仅在用户说话时发送音频
   - 静音检测避免空闲计费

### 成本预估

| 使用频率 | Mini 月成本 | 标准 月成本 |
|---------|------------|------------|
| 每天 1 次 | $3 | $9 |
| 每天 3 次 | $9 | $27 |
| 每天 5 次 | $15 | $45 |

---

## 数据库结构

```sql
-- 话题表
CREATE TABLE speaking_topics (
  id SERIAL PRIMARY KEY,
  part INTEGER NOT NULL,      -- 1 或 2
  title VARCHAR(200) NOT NULL
);

-- 问题表
CREATE TABLE speaking_questions (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER REFERENCES speaking_topics(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL
);

-- 练习记录表
CREATE TABLE speaking_records (
  id SERIAL PRIMARY KEY,
  question_id INTEGER REFERENCES speaking_questions(id) ON DELETE CASCADE,
  user_answer TEXT,
  audio_file VARCHAR(255),    -- Supabase Storage URL
  ai_feedback TEXT,
  score INTEGER,              -- 1-90 (分数 * 10)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 参考资料

- [OpenAI Transcription API](https://platform.openai.com/docs/guides/speech-to-text)
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [DeepSeek API](https://platform.deepseek.com/docs)

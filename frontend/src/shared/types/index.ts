// types/index.ts - 统一的类型声明文件

export interface Word {
  id: number;
  word: string;
  // definition字段现在是一个JSON字符串，所以我们用string类型表示
  definition: DefinitionObject;
  ease_factor: number;
  stop_review: number; // 0 或 1，数据库 Integer 字段
  date_added: string;
  repetition: number;
  interval: number;
  next_review: string;
  lapse: number;
  spell_strength: number | null;
  spell_next_review: string | null;
  source: string;
  related_words?: RelatedWord[];
  // 统计字段（用于分离式 API 计算，跳过数据库查询）
  remember_count: number;
  forget_count: number;
  avg_elapsed_time: number;
}

export interface RelatedWord {
  id: number;
  word: string;
  relation_type: string;
  confidence: number;
}

/**
 * 从Word.definition解析后的结构接口
 */
export interface DefinitionObject {
  phonetic?: {
    us?: string;
    uk?: string;
  };
  definitions?: string[];
  examples?: {
    en: string;
    zh: string;
  }[];
}

export interface SpellingKeyEvent {
  timestamp: number
  key: string
  code: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  inputValue: string
}

export interface BackspaceSequence {
  startPos: number
  deletedChars: number
  timestamp: number
}

export interface SpellingData {
  keyEvents: SpellingKeyEvent[]
  interactions: {
    audioRequestCount: number
  }
  inputAnalysis: {
    totalTypingTime: number
    longestPause: number
    averageKeyInterval: number
    backspaceSequences: BackspaceSequence[]
  }
}

// ========== 复习/拼写结果 Breakdown 类型 ==========

export interface ReviewBreakdown {
  elapsed_time: number
  remembered: boolean
  score: number
  repetition: number
  interval: number
}

export interface SpellingBreakdown {
  remembered: boolean
  typed_count: number
  backspace_count: number
  word_length: number
  avg_key_interval: number
  longest_pause: number
  total_typing_time: number
  audio_requests: number
  accuracy_score: number
  fluency_score: number
  independence_score: number
  weighted_accuracy: number
  weighted_fluency: number
  weighted_independence: number
  total_score: number
  strength_gain: number
}

// ========== 持久化数据类型 ==========

export interface ReviewPersistData {
  word_id: number
  last_remembered: string | null
  last_forgot: string | null
  remember_inc: number
  forget_inc: number
  repetition: number
  interval: number
  ease_factor: number
  score: number
  next_review: string
  lapse: number
  avg_elapsed_time: number
  should_stop_review: boolean
}

export interface SpellingPersistData {
  word_id: number
  new_strength: number
  next_review: string
}

export interface Question {
  id: number
  question_text: string
  topic_id?: number
  topic_title?: string
  part?: number
}

export interface TopicGroup {
  id: number
  title: string
  part: number
  questions: Question[]
}

export interface PartGroup {
  number: number
  topics: TopicGroup[]
}

export interface SpeakingRecord {
  id: number,
  question_id: number,
  user_answer: string,
  audio_file: File | string,
  ai_feedback: string,
  score: number,
  created_at: string
}

// ========== 用户设置相关类型 ==========

export interface LearningSettings {
  dailyReviewLimit: number;
  dailySpellLimit: number;
  maxPrepDays: number;
  lapseQueueSize: number;
  defaultShuffle: boolean;
  lowEfExtraCount: number;
}

export interface ManagementSettings {
  wordsLoadBatchSize: number;
  definitionFetchThreads: number;
}

export interface AudioSettings {
  accent: 'us' | 'uk';
  autoPlayOnWordChange: boolean;  // 新单词出现时自动播放
  autoPlayAfterAnswer: boolean;    // 选择答案后自动播放
}

// 快捷键配置
export interface HotkeySettings {
  // 复习页面 - 初始状态
  reviewInitial: {
    remembered: string;      // 记住
    notRemembered: string;   // 没记住
    stopReview: string;      // 不再复习
  };
  // 复习页面 - 显示释义后
  reviewAfter: {
    wrong: string;           // 记错了
    next: string;            // 下一个
  };
  // 拼写页面
  spelling: {
    playAudio: string;       // 播放发音
    forgot: string;          // 忘记了
    next: string;            // 下一个
  };
}

export interface SourcesSettings {
  customSources: string[];  // 自定义的 source 列表
}

export interface UserSettings {
  learning: LearningSettings;
  management: ManagementSettings;
  audio: AudioSettings;
  hotkeys: HotkeySettings;
  sources: SourcesSettings;
}

// ========== 学习进度相关类型 ==========

export interface Progress {
  id: number;
  user_id: string;
  mode: string;
  source: string;
  shuffle: boolean;
  word_ids_snapshot: number[];
  current_index: number;
  initial_lapse_count: number;
  initial_lapse_word_count: number;
}

export interface SaveProgressPayload {
  mode: string;
  source: string;
  shuffle: boolean;
  word_ids: number[];
  initial_lapse_count?: number;
  initial_lapse_word_count?: number;
}

export interface RestoreData {
  progress: {
    mode: string;
    source: string;
    shuffle: boolean;
    current_index: number;
    word_ids: number[];
    initial_lapse_count: number;
    initial_lapse_word_count: number;
  };
  total: number;
}
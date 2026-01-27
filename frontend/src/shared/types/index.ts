// types/index.ts - 统一的类型声明文件

export interface Word {
  id: number;
  word: string;
  // definition字段现在是一个JSON字符串，所以我们用string类型表示
  definition: DefinitionObject;
  ease_factor: number;
  stop_review: number; // 0 或 1，来自后端数据库的Integer字段
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

export interface SpellingMetrics {
  typed_count: number         // 用户总输入字符数
  backspace_count: number     // 用户退格次数
}

export interface WordResult {
  type: 'review' | 'spelling'
  remembered: boolean
  elapsed_time: number
  spelling_data?: SpellingMetrics
}

export interface WordsApiResponse {
  words: Word[]
  total: number
  has_more: boolean
  counts?: SourceCounts  // 首次加载时返回的来源计数
}

export interface Question {
  id: number
  question_text: string
  topic_id?: number
  topic_title?: string
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

export interface SourceStats {
  total: number;
  remembered: number;
  unremembered: number;
}

export interface SourceCounts {
  source_counts: {
    all: SourceStats;
    [key: string]: SourceStats;  // 动态键，支持任意 source 名称
  };
}

// ========== 用户设置相关类型 ==========

export interface LearningSettings {
  dailyReviewLimit: number;
  dailySpellLimit: number;
  maxPrepDays: number;
  lapseQueueSize: number;
  lapseMaxValue: number;
  lapseInitialValue: number;
  lapseFastExitEnabled: boolean;
  lapseConsecutiveThreshold: number;
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

export interface SettingsApiResponse {
  learning: LearningSettings;
  management: ManagementSettings;
  audio: AudioSettings;
  hotkeys: HotkeySettings;
  sources: SourcesSettings;
}

// ========== 学习进度相关类型 ==========

export interface Progress {
  id: number;
  user_id: number;
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
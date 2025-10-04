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
  lapse :number;
  spell_strength: number | null;
  spell_next_review: string | null;
  source : string
  related_words?: RelatedWord[];
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
    IELTS: SourceStats;
    GRE: SourceStats;
  };
}

// ========== 用户设置相关类型 ==========

export interface LearningSettings {
  dailyReviewLimit: number;
  dailySpellLimit: number;
  maxPrepDays: number;
}

export interface AudioSettings {
  accent: 'us' | 'uk';
}

export interface UserSettings {
  learning: LearningSettings;
  audio: AudioSettings;
}

export interface SettingsApiResponse {
  learning: LearningSettings;
  audio: AudioSettings;
}
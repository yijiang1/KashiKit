export type LanguageId = "ja" | "zh";

export type LevelSystem = {
  /** Display name, e.g. "JLPT" or "HSK" */
  name: string;
  /** Numeric levels stored in the DB, in easiest → hardest display order for filter UI */
  easiestFirst: number[];
  /** Format a level for display, e.g. 5 → "N5" (JLPT) or 1 → "HSK1" */
  badge: (level: number) => string;
};

export type LanguageAiConfig = {
  /** Full rules block given to the line-analysis model (vocab/grammar extraction) */
  analysisRules: string;
  /** Difficulty-rating rubric for assessDifficulty() */
  difficultyPrompt: string;
  /** e.g. "Japanese language quiz master" — sets the persona in the quiz prompt */
  quizPersona: string;
  /** e.g. "How do you read [kanji word]?" — phrasing for the reading-recall question type */
  quizReadingQuestion: string;
  /** Persona + tone/pitch-accent guidance for the pronunciation-coach prompt (judges tone/accent correctness from a recorded clip, not singing melody) */
  pronunciationRules: string;
};

export type LanguageConfig = {
  id: LanguageId;
  label: string;
  flag: string;
  /** <html lang="…"> value */
  htmlLang: string;
  /** BCP-47 tag for SpeechSynthesisUtterance.lang */
  ttsLang: string;
  /** "Furigana" / "Pinyin" — what the reading field is called in the UI */
  readingLabel: string;
  /** Short name for the reference page, e.g. "Kana" / "Pinyin" (nav link text; page title appends " Chart") */
  referenceLabel: string;
  /**
   * True if `text` is recognizable as belonging to this language's script.
   * Used as a fallback check when a YouTube caption track isn't explicitly
   * tagged with the right language code.
   */
  matchesScript: (text: string) => boolean;
  levelSystem: LevelSystem;
  ai: LanguageAiConfig;
};

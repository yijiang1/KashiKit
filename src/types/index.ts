export type Song = {
  id: string;
  title: string;
  artist: string;
  youtube_id: string;
  total_days: number;
  created_at: string;
  difficulty: number | null;
  difficulty_reason: string | null;
};

export type Lesson = {
  id: string;
  song_id: string;
  day_number: number;
};

export type Vocabulary = {
  id: string;
  lyric_line_id: string;
  word: string;
  furigana: string;
  english_meaning: string;
  grammar_notes: string;
  part_of_speech: string; // noun, verb, adjective, adverb, expression, other
  example_sentence: string;
  example_sentence_english: string;
};

export type LyricLine = {
  id: string;
  lesson_id: string;
  start_time: number;
  end_time: number;
  japanese_text: string;
  english_text: string;
  trim: number;
  vocabulary: Vocabulary[];
};

export type AILineResult = {
  english: string;
  vocabulary: Array<{
    word: string;
    furigana: string;
    english_meaning: string;
    grammar_notes: string;
    part_of_speech: string;
    example_sentence: string;
    example_sentence_english: string;
  }>;
};

export type ImportPayload = {
  youtubeUrl: string;
  lrcContent: string;
  title: string;
  artist: string;
  dayCount: number;
  translations?: string[]; // parallel to LRC lines, from YouTube EN captions
};

// Lyrics Editor types
export type EditorLine = LyricLine & {
  _status?: "modified" | "added";
};

export type EditorLesson = Lesson & {
  lines: EditorLine[];
};

export type EditorSongData = {
  song: Song;
  lessons: EditorLesson[];
};

export type EditorSavePayload = {
  updates: Array<{
    id: string;
    lesson_id?: string;
    japanese_text?: string;
    english_text?: string;
    start_time?: number;
    end_time?: number;
  }>;
  deletes: string[];
  additions: Array<{
    id: string;
    lesson_id: string;
    start_time: number;
    end_time: number;
    japanese_text: string;
    english_text: string;
  }>;
};

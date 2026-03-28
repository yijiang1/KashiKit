export type Song = {
  id: string;
  title: string;
  youtube_id: string;
  total_days: number;
  created_at: string;
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
  dayCount: number;
  translations?: string[]; // parallel to LRC lines, from YouTube EN captions
};

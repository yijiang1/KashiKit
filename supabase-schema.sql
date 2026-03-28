-- LyricLearn database schema
-- Run this in your Supabase SQL editor

-- Songs
create table songs (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  youtube_id  text not null unique,
  total_days  integer not null check (total_days >= 1),
  created_at  timestamptz not null default now()
);

-- Lessons (one per day per song)
create table lessons (
  id          uuid primary key default gen_random_uuid(),
  song_id     uuid not null references songs(id) on delete cascade,
  day_number  integer not null check (day_number >= 1),
  unique(song_id, day_number)
);

-- Lyric lines (one per LRC timestamp)
create table lyric_lines (
  id             uuid primary key default gen_random_uuid(),
  lesson_id      uuid not null references lessons(id) on delete cascade,
  start_time     numeric not null,   -- seconds as float, e.g. 63.45
  end_time       numeric not null,
  japanese_text  text not null,
  english_text   text not null default ''
);

-- Vocabulary per lyric line
create table vocabulary (
  id              uuid primary key default gen_random_uuid(),
  lyric_line_id   uuid not null references lyric_lines(id) on delete cascade,
  word            text not null,
  furigana        text not null,
  english_meaning text not null,
  grammar_notes   text not null default ''
);

-- Lesson completions (tracks when user completes a lesson)
create table lesson_completions (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references lessons(id) on delete cascade,
  completed_at timestamptz not null default now()
);

-- API usage tracking (Gemini calls)
create table api_usage (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  model             text not null default 'gemini-2.0-flash',
  prompt_tokens     integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens      integer not null default 0,
  purpose           text not null default ''
);

-- Indexes for common query patterns
create index on lessons(song_id, day_number);
create index on lyric_lines(lesson_id);
create index on vocabulary(lyric_line_id);
create index on api_usage(created_at);

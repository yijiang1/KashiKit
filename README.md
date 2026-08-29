# KashiKit

> The AI-powered toolkit for turning song lyrics into language mastery.

![KashiKit Logo](public/logo.png)

**Live site: [kashikit.com](https://www.kashikit.com/)**

KashiKit turns any Japanese or Mandarin Chinese song into a structured, multi-day language course. Paste a YouTube URL and an LRC lyrics file — the app does the rest. A language toggle in the header switches the whole site (dashboard, dictionary, reference chart, grammar guide) between Japanese and Chinese content.

## Features

- **Two languages, one app** — Japanese and Chinese songs live side by side; a header toggle filters everything to the selected language
- **Auto-generated courses** — splits a song into daily lessons based on how many lines you want to study per day
- **AI difficulty ratings** — each song is rated 1–5 stars by the AI with a short explanation of why
- **Vocabulary cards** — click any word in a lyric to see its meaning, reading (furigana or pinyin), part of speech, grammar notes, and an AI-generated example sentence
- **Reading overlay** — furigana or pinyin displayed above the lyric text using `<ruby>` tags
- **Synchronized video** — embedded YouTube player loops the current lyric line automatically
- **Sentence bank** — real example clips from other songs in your library where the same word appears
- **Text-to-speech** — pronounce any word with one click using the browser's built-in Japanese or Mandarin voice
- **Vocabulary quiz** — pre-generated fill-in-the-blank quiz at the end of each lesson
- **Dictionary** — searchable cache of every word you've studied across all songs, with filters by JLPT level (N1–N5) or HSK level (1–6) and part of speech
- **Reference chart** — a Kana Chart (hiragana/katakana) for Japanese, or a Pinyin Chart (initials/finals + tones) for Chinese
- **User accounts** — a free account (username + password) is needed to study courses and to build your own; the song catalog and dictionary stay browsable without one
- **Progress tracking** — lesson progress saved locally in the browser, separate from your account
- **Auto lyrics fetch** — automatically pulls LRC lyrics from [lrclib.net](https://lrclib.net) when available
- **API usage tracker** — monitor your daily Gemini API call count against the free tier limit (1,500/day)

## Tech Stack

- **Framework**: Next.js (App Router)
- **Database**: [Turso](https://turso.tech) (cloud libsql/SQLite) in production; local SQLite file in development
- **AI**: Google Gemini 2.0 Flash for vocabulary extraction, translation, and difficulty assessment
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com) API key (free)

### Setup

```bash
git clone https://github.com/yijiang1/KashiKit.git
cd KashiKit
npm install
cp .env.local.example .env.local
# Add your GOOGLE_AI_API_KEY to .env.local
# Add an AUTH_SECRET too (any 16+ char random string): openssl rand -base64 32
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

By default the app uses a local SQLite file (`lyriclearn.db`) in the project root. To use Turso in production, set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in your environment.

### JLPT / HSK level data (optional)

To enable level filters in the dictionary, run the relevant seed script(s) once after setup:

```bash
npx tsx scripts/seed-jlpt.ts  # Japanese — JLPT N1-N5
npx tsx scripts/seed-hsk.ts   # Chinese — HSK 1-6
```

These fetch public vocabulary lists and store them in the local database. Only needs to be run once each.

JLPT data sourced from:
- [Bluskyo/JLPT_Vocabulary](https://github.com/Bluskyo/JLPT_Vocabulary) — N1–N5 word list
- [surajsau/JLPT-Resources](https://github.com/surajsau/JLPT-Resources) — N4/N5 with readings

HSK data sourced from:
- [drkameleon/complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) — classic HSK 1–6 word lists with pinyin

### Importing a song

1. Find a Japanese or Chinese song on YouTube
2. Pick the language in the import form
3. Get the LRC lyrics file (e.g. from [lrclib.net](https://lrclib.net) — KashiKit can fetch these automatically, or pull captions directly from the YouTube video)
4. Click **+ Import song**, paste the YouTube URL and the artist/title, set how many lines per day, and hit Import
5. The app processes each line with AI (~1 API call per line) and generates your course

### Export to Anki

Turn an already-imported song into an Anki deck with one card per newly-seen word, each with its own audio clip cut from the song. This is a local CLI script, not a site feature — it reuses the reading/meaning/level/translations already stored from import, so it makes no AI calls.

Prerequisites: [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) and `ffmpeg` (`brew install yt-dlp ffmpeg` on macOS).

```bash
npx tsx scripts/export-anki.ts <youtube_id_or_title> [--day=N] [--out=dir] [--padding=200]
```

This writes a `<song>-anki-deck.zip` containing `notes.csv` and one `clip_XXXX.mp3` per card. To import into Anki: unzip it, **File → Import** the CSV (mapping the `Audio` column to the Audio field), then copy the `clip_*.mp3` files into your profile's `collection.media` folder.

Note: this downloads audio from YouTube for personal study use — be mindful of YouTube's Terms of Service, and don't expose this as a public-facing feature.

## Accounts & roles

`AUTH_SECRET` must be set for login to work (any random string of 16+ characters). Passwords
are hashed with scrypt; the session is a signed, HTTP-only cookie (`kk_session`, 30 days).

- **Visitor (logged out)** — browse the song catalog and read the dictionary.
- **User (logged in)** — study any course (lyrics, quizzes, grammar guide, pronunciation
  practice), plus **+ Import song**, the **Lyrics Editor**, and quiz / difficulty / trim /
  rename / delete — the editing tools each scoped to *songs they imported*.
- **Admin** — a user with `is_admin = 1`. Can edit/delete any song and reach the global tools
  (dictionary editing, sentence-bank rebuild, API-usage tracker, site-wide backfills). **The
  first account to register becomes an admin.** Set `SIGNUPS_DISABLED=true` to close signups.
- **`ADMIN_MODE=true`** — a local-dev bypass that treats every request as an admin, with or
  without an account. Do not set it in a real deployment.

Songs imported before this feature existed have no owner and are editable only by an admin
(or with `ADMIN_MODE=true`).

## Usage Notes

- Studying a course requires a free account; the song catalog and dictionary stay open to everyone
- Lesson progress is stored in `localStorage`, never on the server, and is not tied to your account
- The dictionary is public; the grammar guide is shared across all signed-in users; the sentence bank is admin-only
- The free Gemini tier allows 1,500 requests/day, which is enough to import several songs per day

## License

MIT

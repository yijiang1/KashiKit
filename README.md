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
- **Progress tracking** — lesson progress saved locally in the browser (no account needed)
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

## Admin Mode

Set `ADMIN_MODE=true` in your environment to unlock admin-only features:

- **Lyrics Editor** (`/admin/lyrics-editor`) — visually adjust the start/end timestamp of each lyric line against the YouTube player
- **Sentence bank** management — rebuild the cross-song example sentence index
- **Song management** — import songs, regenerate quizzes, and set difficulty ratings

Admin auth is env-var based — no login screen.

## Usage Notes

- Progress is stored in `localStorage` — no account or server-side session required for visitors
- All user data is local; the only external call is sending lyrics to the Gemini API for analysis
- The free Gemini tier allows 1,500 requests/day, which is enough to import several songs per day

## License

MIT

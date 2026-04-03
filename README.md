# KashiKit

> The AI-powered toolkit for turning Japanese lyrics into language mastery.

![KashiKit Logo](public/logo.png)

**Live site: [kashikit.com](https://www.kashikit.com/)**

KashiKit turns any Japanese song into a structured, multi-day language course. Paste a YouTube URL and an LRC lyrics file — the app does the rest.

## Features

- **Auto-generated courses** — splits a song into daily lessons based on how many lines you want to study per day
- **AI difficulty ratings** — each song is rated 1–5 stars by the AI with a short explanation of why
- **Vocabulary cards** — click any word in a lyric to see its meaning, furigana, part of speech, grammar notes, and an AI-generated example sentence
- **Furigana overlay** — readings displayed above kanji using `<ruby>` tags
- **Synchronized video** — embedded YouTube player loops the current lyric line automatically
- **Sentence bank** — real example clips from other songs in your library where the same word appears
- **Text-to-speech** — pronounce any word with one click using the browser's built-in Japanese voice
- **Vocabulary quiz** — pre-generated fill-in-the-blank quiz at the end of each lesson
- **Dictionary** — searchable cache of every word you've studied across all songs
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

### Importing a song

1. Find a Japanese song on YouTube
2. Get the LRC lyrics file (e.g. from [lrclib.net](https://lrclib.net) — KashiKit can fetch these automatically)
3. Click **+ Import song**, paste the YouTube URL and the artist/title, set how many lines per day, and hit Import
4. The app processes each line with AI (~1 API call per line) and generates your course

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

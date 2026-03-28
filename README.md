# KashiKit

> The AI-powered toolkit for turning Japanese lyrics into language mastery.

![KashiKit Logo](public/logo.png)

KashiKit turns any Japanese song into a structured, multi-day language course. Paste a YouTube URL and an LRC lyrics file — the app does the rest.

## Features

- **Auto-generated courses** — splits a song into daily lessons based on how many lines you want to study per day
- **Vocabulary cards** — click any word in a lyric to see its meaning, furigana, part of speech, grammar notes, and an AI-generated example sentence
- **Furigana overlay** — readings displayed above kanji using `<ruby>` tags
- **Synchronized video** — embedded YouTube player loops the current lyric line automatically
- **Sentence bank** — real example clips from other songs in your library where the same word appears
- **Text-to-speech** — pronounce any word with one click using the browser's built-in Japanese voice
- **Vocabulary quiz** — fill-in-the-blank quiz at the end of each lesson
- **Dictionary** — searchable cache of every word you've studied across all songs
- **API usage tracker** — monitor your daily Gemini API call count against the free tier limit (1,500/day)

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite via `better-sqlite3` — runs entirely locally, no server needed
- **AI**: Google Gemini 2.0 Flash for vocabulary extraction and translation
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

### Importing a song

1. Find a Japanese song on YouTube
2. Get the LRC lyrics file (e.g. from [lrclib.net](https://lrclib.net) — KashiKit can fetch these automatically)
3. Click **+ Import song**, paste the YouTube URL, set how many lines per day, and hit Import
4. The app processes each line with AI (~1 API call per line) and generates your course

## Usage Notes

- The SQLite database (`lyriclearn.db`) is created automatically on first run and lives in the project root
- All data is local — nothing is sent anywhere except lyrics to the Gemini API for analysis
- The free Gemini tier allows 1,500 requests/day, which is enough to import several songs per day

## License

MIT

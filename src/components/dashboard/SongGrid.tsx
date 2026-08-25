"use client";

import { useState, useEffect, useMemo } from "react";
import type { Song } from "@/types";
import SongCard from "./SongCard";
import { getCompletedLessonIds } from "@/lib/progress";
import { useLanguage } from "@/lib/language-context";

type SortMode = "newest" | "oldest" | "easiest" | "hardest";

interface Props {
  songs: Song[];
  lessonsBySong: Record<string, string[]>;
  isAdmin: boolean;
  dbAvailable?: boolean;
}

export default function SongGrid({ songs: allSongs, lessonsBySong, isAdmin, dbAvailable = true }: Props) {
  const { language } = useLanguage();
  const songs = useMemo(() => allSongs.filter((s) => s.language === language), [allSongs, language]);
  const [completedDaysBySong, setCompletedDaysBySong] = useState<Record<string, number>>({});
  const [sortBy, setSortBy] = useState<SortMode>("newest");
  const [artistFilter, setArtistFilter] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ generated: number; skipped: number } | null>(null);

  async function handleBackfillQuizzes() {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const res = await fetch("/api/admin/backfill-quizzes", { method: "POST" });
      const data = await res.json();
      setBackfillResult(data);
    } finally {
      setBackfilling(false);
    }
  }

  useEffect(() => {
    const completedIds = getCompletedLessonIds();
    const result: Record<string, number> = {};
    for (const [songId, lessonIds] of Object.entries(lessonsBySong)) {
      result[songId] = lessonIds.filter((id) => completedIds.has(id)).length;
    }
    setCompletedDaysBySong(result);
  }, [lessonsBySong]);

  const artists = useMemo(
    () => Array.from(new Set(songs.map((s) => s.artist))).sort(),
    [songs]
  );

  const sortedSongs = useMemo(() => {
    const base = artistFilter ? songs.filter((s) => s.artist === artistFilter) : songs;
    if (sortBy === "oldest") return [...base].reverse();
    if (sortBy === "easiest" || sortBy === "hardest") {
      return [...base].sort((a, b) => {
        // Unrated songs always go to the end
        if (a.difficulty === null && b.difficulty === null) return 0;
        if (a.difficulty === null) return 1;
        if (b.difficulty === null) return -1;
        return sortBy === "easiest" ? a.difficulty - b.difficulty : b.difficulty - a.difficulty;
      });
    }
    return base; // newest
  }, [songs, sortBy, artistFilter]);

  if (!dbAvailable) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-4xl mb-4">⚠️</p>
        <p className="text-lg font-medium">Database not available</p>
        <p className="text-sm mt-1">Check your internet connection or database credentials</p>
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-5xl mb-4">🎵</p>
        <p className="text-lg font-medium">No songs yet</p>
        <p className="text-sm mt-1">Import your first song to start learning</p>
      </div>
    );
  }

  function cycleDate() {
    if (sortBy === "newest") setSortBy("oldest");
    else setSortBy("newest");
  }

  function cycleDifficulty() {
    if (sortBy === "easiest") setSortBy("hardest");
    else if (sortBy === "hardest") setSortBy("newest");
    else setSortBy("easiest");
  }

  const dateLabel = sortBy === "oldest" ? "Date ↑" : "Date ↓";
  const dateActive = sortBy === "newest" || sortBy === "oldest";
  const difficultyLabel = sortBy === "easiest" ? "Difficulty ↑" : sortBy === "hardest" ? "Difficulty ↓" : "Difficulty";
  const difficultyActive = sortBy === "easiest" || sortBy === "hardest";

  const playlistUrl = `https://www.youtube.com/watch_videos?video_ids=${songs.map((s) => s.youtube_id).join(",")}`;

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackfillQuizzes}
            disabled={backfilling}
            className="text-xs px-3 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-60 transition-colors"
          >
            {backfilling ? "Generating quizzes…" : "⚡ Backfill missing quizzes"}
          </button>
          {backfillResult && (
            <span className="text-xs text-gray-500">
              {backfillResult.generated} generated, {backfillResult.skipped} skipped
            </span>
          )}
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 text-sm flex-wrap">
        <span className="text-gray-400 mr-1">Sort:</span>
        <button
          onClick={cycleDate}
          className={`px-2 py-0.5 rounded transition-colors ${
            dateActive
              ? "text-indigo-600 font-medium bg-indigo-50"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          {dateLabel}
        </button>
        <button
          onClick={cycleDifficulty}
          className={`px-2 py-0.5 rounded transition-colors ${
            difficultyActive
              ? "text-indigo-600 font-medium bg-indigo-50"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          {difficultyLabel}
        </button>
        </div>
        <a
          href={playlistUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
          Watch all on YouTube
        </a>
      </div>
      <div className="flex items-center gap-1 text-sm flex-wrap">
        <span className="text-gray-400 mr-1">Artist:</span>
        <button
          onClick={() => setArtistFilter(null)}
          className={`px-2 py-0.5 rounded transition-colors ${
            artistFilter === null
              ? "text-indigo-600 font-medium bg-indigo-50"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          All
        </button>
        {artists.map((artist) => (
          <button
            key={artist}
            onClick={() => setArtistFilter(artistFilter === artist ? null : artist)}
            className={`px-2 py-0.5 rounded transition-colors ${
              artistFilter === artist
                ? "text-indigo-600 font-medium bg-indigo-50"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {artist}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sortedSongs.map((song) => (
          <SongCard
            key={song.id}
            song={song}
            completedDays={completedDaysBySong[song.id] ?? 0}
            lessonIds={lessonsBySong[song.id] ?? []}
            onReset={() => setCompletedDaysBySong((prev) => ({ ...prev, [song.id]: 0 }))}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </div>
  );
}

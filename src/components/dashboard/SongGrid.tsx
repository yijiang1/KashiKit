"use client";

import { useState, useEffect, useMemo } from "react";
import type { Song } from "@/types";
import SongCard from "./SongCard";
import { getCompletedLessonIds } from "@/lib/progress";

type SortMode = "recent" | "easiest" | "hardest";

interface Props {
  songs: Song[];
  lessonsBySong: Record<string, string[]>;
  isAdmin: boolean;
}

export default function SongGrid({ songs, lessonsBySong, isAdmin }: Props) {
  const [completedDaysBySong, setCompletedDaysBySong] = useState<Record<string, number>>({});
  const [sortBy, setSortBy] = useState<SortMode>("recent");

  useEffect(() => {
    const completedIds = getCompletedLessonIds();
    const result: Record<string, number> = {};
    for (const [songId, lessonIds] of Object.entries(lessonsBySong)) {
      result[songId] = lessonIds.filter((id) => completedIds.has(id)).length;
    }
    setCompletedDaysBySong(result);
  }, [lessonsBySong]);

  const sortedSongs = useMemo(() => {
    if (sortBy === "recent") return songs;
    return [...songs].sort((a, b) => {
      // Unrated songs always go to the end
      if (a.difficulty === null && b.difficulty === null) return 0;
      if (a.difficulty === null) return 1;
      if (b.difficulty === null) return -1;
      return sortBy === "easiest" ? a.difficulty - b.difficulty : b.difficulty - a.difficulty;
    });
  }, [songs, sortBy]);

  if (songs.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-5xl mb-4">🎵</p>
        <p className="text-lg font-medium">No songs yet</p>
        <p className="text-sm mt-1">Import your first song to start learning</p>
      </div>
    );
  }

  const sortOptions: { key: SortMode; label: string }[] = [
    { key: "recent", label: "Recent" },
    { key: "easiest", label: "Easiest first" },
    { key: "hardest", label: "Hardest first" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 text-sm">
        <span className="text-gray-400 mr-1">Sort:</span>
        {sortOptions.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-2 py-0.5 rounded transition-colors ${
              sortBy === key
                ? "text-indigo-600 font-medium bg-indigo-50"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sortedSongs.map((song) => (
          <SongCard
            key={song.id}
            song={song}
            completedDays={completedDaysBySong[song.id] ?? 0}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </div>
  );
}

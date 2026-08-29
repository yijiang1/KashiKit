"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Song } from "@/types";
import StarRating from "@/components/shared/StarRating";
import { resetSong } from "@/lib/progress";

interface Props {
  song: Song;
  completedDays: number;
  lessonIds: string[];
  onReset: () => void;
  /** Viewer owns this song (or is a site admin) — show edit/delete controls. */
  canManage: boolean;
}

export default function SongCard({ song, completedDays, lessonIds, onReset, canManage }: Props) {
  const router = useRouter();
  const thumbnailUrl = `https://img.youtube.com/vi/${song.youtube_id}/mqdefault.jpg`;
  const nextDay = Math.min(completedDays + 1, song.total_days);
  const [difficulty, setDifficulty] = useState(song.difficulty);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm(`Delete "${song.title}"?`)) return;
    await fetch(`/api/songs/${song.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleDifficultyChange(value: number | null) {
    const prev = difficulty;
    setDifficulty(value);
    const res = await fetch(`/api/difficulty/${song.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ difficulty: value }),
    });
    if (!res.ok) setDifficulty(prev);
  }

  return (
    <div className="group relative rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all">
      <Link href={`/study/${song.id}/${nextDay}`} className="block">
        <div className="relative aspect-video">
          <Image src={thumbnailUrl} alt={song.title} fill sizes="(max-width: 768px) 50vw, 25vw" loading="eager" className="object-cover" />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-white/90 rounded-full p-3">
              <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 truncate">{song.title}</h3>
          <p className="text-xs text-gray-400 italic truncate">{song.title_en || "\u00A0"}</p>
          <p className="text-xs font-medium text-gray-500 truncate mt-0.5">{song.artist}</p>
          {song.owner_username && (
            <p className="text-[11px] text-gray-400 truncate">added by {song.owner_username}</p>
          )}
          <div className="mt-1" onClick={canManage ? (e) => { e.preventDefault(); e.stopPropagation(); } : undefined}>
            <StarRating
              value={difficulty}
              onChange={canManage ? handleDifficultyChange : undefined}
              size="sm"
            />
          </div>
          <p className="text-sm text-indigo-600 mt-1">
            {completedDays === song.total_days
              ? "✓ Complete"
              : `Day ${completedDays + 1} of ${song.total_days}`}
          </p>
          <div className="flex gap-1 mt-2">
            {Array.from({ length: song.total_days }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i < completedDays ? "bg-indigo-500" : "bg-indigo-100"}`}
              />
            ))}
          </div>
          {completedDays > 0 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                resetSong(lessonIds);
                onReset();
              }}
              className="mt-2 text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Reset progress
            </button>
          )}
        </div>
      </Link>

      <a
        href={`https://www.youtube.com/watch?v=${song.youtube_id}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
        title="Watch on YouTube"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      </a>

      {canManage && (
        <button
          onClick={handleDelete}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500"
          title="Delete song"
        >
          ×
        </button>
      )}
    </div>
  );
}

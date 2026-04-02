"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Song } from "@/types";
import StarRating from "@/components/shared/StarRating";

interface Props {
  song: Song;
  completedDays: number;
  isAdmin: boolean;
}

export default function SongCard({ song, completedDays, isAdmin }: Props) {
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
          <div className="mt-1" onClick={isAdmin ? (e) => { e.preventDefault(); e.stopPropagation(); } : undefined}>
            <StarRating
              value={difficulty}
              onChange={isAdmin ? handleDifficultyChange : undefined}
              size="sm"
            />
            {isAdmin && song.difficulty_reason && (
              <p className="text-xs text-gray-400 mt-0.5 italic line-clamp-2">{song.difficulty_reason}</p>
            )}
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
        </div>
      </Link>

      {isAdmin && (
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

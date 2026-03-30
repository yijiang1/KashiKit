"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LyricLine, Song } from "@/types";
import dynamic from "next/dynamic";
import LyricDisplay from "./LyricDisplay";
import Quiz from "./Quiz";

const YouTubePlayer = dynamic(() => import("./YouTubePlayer"), { ssr: false });

interface Props {
  song: Song;
  lines: LyricLine[];
  day: number;
  lessonId: string;
  alreadyCompleted: boolean;
}

export default function StudyLayout({ song, lines, day, lessonId, alreadyCompleted }: Props) {
  const router = useRouter();
  const [lineIndex, setLineIndex] = useState(0);
  const [isLooping, setIsLooping] = useState(true);
  const [offset, setOffset] = useState(0);
  const [trim, setTrim] = useState(lines[0]?.trim ?? 0);
  const [completed, setCompleted] = useState(alreadyCompleted);
  const [completing, setCompleting] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [freePlay, setFreePlay] = useState(false);

  const currentLine = lines[lineIndex];
  if (!currentLine) {
    return <p className="text-center text-gray-500 mt-20">No lyric lines for this lesson.</p>;
  }

  const canPrevLine = lineIndex > 0;
  const canNextLine = lineIndex < lines.length - 1;
  const canPrevDay = day > 1;
  const canNextDay = day < song.total_days;
  const lineDuration = currentLine.end_time - currentLine.start_time;
  const startTime = Math.max(0, currentLine.start_time + offset);
  const endTime = Math.max(startTime + 0.5, currentLine.end_time + offset - trim);

  const handleLineEnd = useCallback(() => {
    setLineIndex((i) => {
      const next = Math.min(lines.length - 1, i + 1);
      setTrim(lines[next]?.trim ?? 0);
      return next;
    });
  }, [lines]);

  async function handleComplete() {
    setCompleting(true);
    await fetch(`/api/complete-lesson/${lessonId}`, { method: "POST" });
    setCompleted(true);
    setCompleting(false);
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← Dashboard
        </Link>
        <div className="text-center">
          <h1 className="font-semibold text-gray-900 truncate max-w-[200px]">{song.title}</h1>
          <p className="text-sm text-indigo-600">Day {day} of {song.total_days}</p>
        </div>
        <div className="flex gap-2">
          {canPrevDay && (
            <Link href={`/study/${song.id}/${day - 1}`} className="text-sm text-gray-500 hover:text-gray-700">
              ‹ Day {day - 1}
            </Link>
          )}
          {canNextDay && (
            <Link href={`/study/${song.id}/${day + 1}`} className="text-sm text-indigo-600 hover:text-indigo-800">
              Day {day + 1} ›
            </Link>
          )}
        </div>
      </div>

      {/* YouTube Player */}
      <YouTubePlayer
        videoId={song.youtube_id}
        startTime={freePlay ? 0 : startTime}
        endTime={freePlay ? lines[0].start_time + offset : endTime}
        isLooping={freePlay ? false : isLooping}
        autoplay={day >= 2}
        onLineEnd={freePlay ? () => { setFreePlay(false); setLineIndex(0); setTrim(lines[0]?.trim ?? 0); } : handleLineEnd}
      />

      {/* Controls row */}
      <div className="flex items-center gap-3">
        {freePlay ? (
          <button
            onClick={() => setFreePlay(false)}
            className="px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap bg-amber-500 text-white hover:bg-amber-600"
          >
            ↩ Back to study
          </button>
        ) : (
          <>
            <button
              onClick={() => setIsLooping((v) => !v)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                isLooping ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {isLooping ? "🔁 Looping" : "▶ Loop off"}
            </button>
            {day >= 2 && (
              <button
                onClick={() => setFreePlay(true)}
                className="px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                ▶ Play full
              </button>
            )}
          </>
        )}

        <div className="flex-1 flex items-center gap-2">
          <button type="button" onClick={() => setOffset((v) => Math.round((v - 0.5) * 10) / 10)}
            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold flex items-center justify-center">−</button>
          <div className="flex-1 text-center">
            <span className="text-xs text-gray-400">Sync offset</span>
            <p className={`text-sm font-mono font-medium ${offset === 0 ? "text-gray-400" : "text-indigo-600"}`}>
              {offset >= 0 ? "+" : ""}{offset.toFixed(1)}s
            </p>
          </div>
          <button type="button" onClick={() => setOffset((v) => Math.round((v + 0.5) * 10) / 10)}
            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold flex items-center justify-center">+</button>
          {offset !== 0 && (
            <button type="button" onClick={() => setOffset(0)} className="text-xs text-gray-400 hover:text-gray-600">reset</button>
          )}
        </div>
      </div>

      {/* Loop trim — shorten the loop to cut instrumental tails */}
      {lineDuration > 3 && (
        <div className="flex items-center gap-3 px-1">
          <span className="text-xs text-gray-400 whitespace-nowrap">Trim end</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, lineDuration - 1)}
            step={0.5}
            value={trim}
            onChange={(e) => setTrim(Number(e.target.value))}
            className="flex-1 accent-indigo-600"
          />
          <span className={`text-sm font-mono w-12 text-right ${trim === 0 ? "text-gray-300" : "text-indigo-600"}`}>
            {trim > 0 ? `−${trim.toFixed(1)}s` : "0s"}
          </span>
          {trim !== currentLine.trim && (
            <button
              type="button"
              onClick={async () => {
                await fetch(`/api/trim/${currentLine.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ trim }),
                });
                currentLine.trim = trim;
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              save
            </button>
          )}
          {trim > 0 && trim === currentLine.trim && (
            <button
              type="button"
              onClick={async () => {
                setTrim(0);
                await fetch(`/api/trim/${currentLine.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ trim: 0 }),
                });
                currentLine.trim = 0;
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              reset
            </button>
          )}
        </div>
      )}

      {showQuiz ? (
        /* Quiz section */
        <Quiz lessonId={lessonId} onClose={() => setShowQuiz(false)} />
      ) : (
        <>
          {/* Lyric Display */}
          <LyricDisplay line={currentLine} />

          {/* Line Navigation */}
          <div className="flex items-center justify-between px-2">
            <button onClick={() => { const prev = Math.max(0, lineIndex - 1); setTrim(lines[prev]?.trim ?? 0); setLineIndex(prev); }} disabled={!canPrevLine}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              ← Prev line
            </button>
            <span className="text-sm text-gray-400">Line {lineIndex + 1} / {lines.length}</span>
            <button onClick={() => { const next = Math.min(lines.length - 1, lineIndex + 1); setTrim(lines[next]?.trim ?? 0); setLineIndex(next); }} disabled={!canNextLine}
              className="px-4 py-2 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              Next line →
            </button>
          </div>
        </>
      )}

      {/* Complete Day / Quiz buttons */}
      <div className="border-t pt-4 space-y-3">
        {completed ? (
          <>
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-50 text-green-700 font-medium">
              <span>✓</span> Day {day} completed
            </div>
            {!showQuiz && (
              <button
                onClick={() => setShowQuiz(true)}
                className="w-full py-2.5 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors"
              >
                Take Quiz
              </button>
            )}
          </>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => setShowQuiz(true)}
              className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors"
            >
              Take Quiz
            </button>
            <button
              onClick={handleComplete}
              disabled={completing}
              className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {completing ? "Saving…" : `Complete Day ${day}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

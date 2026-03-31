"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { loadYouTubeAPI } from "@/lib/youtube/loader";

type SentenceExample = {
  japanese_text: string;
  english_text: string;
  youtube_id: string;
  start_time: number;
  end_time: number;
  song_title: string;
  sync_offset: number;
};

export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function speakJapanese(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = "ja-JP";
  utt.rate = 0.9;
  window.speechSynthesis.speak(utt);
}

export function Highlight({ text, word }: { text: string; word: string }) {
  if (!word || !text.includes(word)) return <>{text}</>;
  const parts = text.split(word);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <mark className="bg-yellow-200 text-gray-900 rounded px-0.5 not-italic">{word}</mark>
          )}
        </span>
      ))}
    </>
  );
}

function ClipPlayer({ videoId, startTime, endTime }: { videoId: string; startTime: number; endTime: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idRef = useRef(`clip-${videoId}-${startTime}`);
  const readyRef = useRef(false);

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const current = player.getCurrentTime();
      if (current >= endTime) {
        player.seekTo(startTime, true);
      }
    }, 100);
  }, [startTime, endTime]);

  useEffect(() => {
    let destroyed = false;
    loadYouTubeAPI().then(() => {
      if (destroyed || !containerRef.current) return;
      const player = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { autoplay: 1, controls: 1, modestbranding: 1, rel: 0, start: Math.floor(startTime) },
        events: {
          onReady: (e: { target: YTPlayer }) => { readyRef.current = true; e.target.seekTo(startTime, true); startPolling(); },
          onStateChange: (e: { data: number; target: YTPlayer }) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              window.dispatchEvent(new CustomEvent("yt-play", { detail: idRef.current }));
              startPolling();
            }
          },
        },
      });
      playerRef.current = player;
    });

    function onOtherPlay(e: Event) {
      if ((e as CustomEvent).detail !== idRef.current && readyRef.current) {
        playerRef.current?.pauseVideo();
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }
    window.addEventListener("yt-play", onOtherPlay);

    return () => {
      destroyed = true;
      window.removeEventListener("yt-play", onOtherPlay);
      if (intervalRef.current) clearInterval(intervalRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, startTime, endTime]);

  return <div ref={containerRef} className="w-full" style={{ height: 150 }} />;
}

export default function SentenceExamples({ word, excludeSentence }: { word: string; excludeSentence?: string }) {
  const [examples, setExamples] = useState<SentenceExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setPlayingId(null);
    const params = new URLSearchParams({ word });
    if (excludeSentence) params.set("exclude", excludeSentence);
    fetch(`/api/sentences?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setExamples(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [word, excludeSentence]);

  if (loading) return <p className="text-xs text-gray-400">Loading examples...</p>;
  if (examples.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">From your songs</p>
      {examples.map((ex, i) => {
        const clipKey = `${ex.youtube_id}-${ex.start_time}`;
        const isPlaying = playingId === clipKey;
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-start gap-2">
              <button
                onClick={() => setPlayingId(isPlaying ? null : clipKey)}
                className="shrink-0 w-7 h-7 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors mt-0.5"
                title="Play clip"
              >
                {isPlaying ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                ) : (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800"><Highlight text={ex.japanese_text} word={word} /></p>
                <p className="text-xs text-gray-500 italic">{ex.english_text}</p>
                <p className="text-xs text-gray-400">
                  {ex.song_title} · {formatTime(Number(ex.start_time))}
                </p>
              </div>
            </div>
            {isPlaying && (
              <div className="rounded-lg overflow-hidden ml-9">
                <ClipPlayer videoId={ex.youtube_id} startTime={Number(ex.start_time) + (ex.sync_offset || 0)} endTime={Number(ex.end_time) + (ex.sync_offset || 0)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

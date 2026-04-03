"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { loadYouTubeAPI } from "@/lib/youtube/loader";

interface Props {
  videoId: string;
  startTime: number;
  endTime: number;
  isLooping: boolean;
  onSetStart?: (time: number) => void;
  onSetEnd?: (time: number) => void;
}

type YTPlayer = {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  destroy(): void;
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

export default function EditorYouTubePlayer({
  videoId,
  startTime,
  endTime,
  isLooping,
  onSetStart,
  onSetEnd,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoopingRef = useRef(isLooping);
  const startTimeRef = useRef(startTime);
  const endTimeRef = useRef(endTime);
  const readyRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
  useEffect(() => { startTimeRef.current = startTime; }, [startTime]);
  useEffect(() => { endTimeRef.current = endTime; }, [endTime]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const t = player.getCurrentTime();
      setCurrentTime(t);
      if (t >= endTimeRef.current) {
        if (isLoopingRef.current) {
          player.seekTo(startTimeRef.current, true);
        }
      }
    }, 50);
  }, []);

  // Initialize player once
  useEffect(() => {
    let destroyed = false;

    loadYouTubeAPI().then(() => {
      if (destroyed || !containerRef.current) return;

      const player = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => {
            readyRef.current = true;
            startPolling();
          },
          onStateChange: (event: { data: number }) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              window.dispatchEvent(new CustomEvent("yt-play", { detail: "editor-player" }));
              startPolling();
            }
          },
        },
      });
      playerRef.current = player as unknown as YTPlayer;
    });

    function onOtherPlay(e: Event) {
      if ((e as CustomEvent).detail !== "editor-player" && readyRef.current) {
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
  }, [videoId]);

  // When active line changes, seek to start_time (but don't auto-play)
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;
    player.seekTo(startTime, true);
  }, [startTime, endTime]);

  function handleSetRate(rate: number) {
    playerRef.current?.setPlaybackRate(rate);
    setPlaybackRate(rate);
  }

  function handleSetStart() {
    if (onSetStart) onSetStart(Math.round(currentTime * 100) / 100);
  }

  function handleSetEnd() {
    if (onSetEnd) onSetEnd(Math.round(currentTime * 100) / 100);
  }

  return (
    <div className="space-y-2">
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
        <div ref={containerRef} className="w-full h-full" />
      </div>

      {/* Time readout + controls */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="font-mono text-sm bg-gray-900 text-green-400 px-3 py-1 rounded">
          {formatTime(currentTime)}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleSetStart}
            className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium"
            title="Set start time to current player position"
          >
            Set Start
          </button>
          <button
            type="button"
            onClick={handleSetEnd}
            className="px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded font-medium"
            title="Set end time to current player position"
          >
            Set End
          </button>
        </div>

        <div className="flex items-center gap-1">
          {[0.5, 0.75, 1].map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => handleSetRate(rate)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                playbackRate === rate
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600"
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

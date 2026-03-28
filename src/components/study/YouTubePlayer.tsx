"use client";

import { useEffect, useRef, useCallback } from "react";
import { loadYouTubeAPI } from "@/lib/youtube/loader";

interface Props {
  videoId: string;
  startTime: number;
  endTime: number;
  isLooping: boolean;
  autoplay?: boolean;
}

export default function YouTubePlayer({ videoId, startTime, endTime, isLooping, autoplay }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoopingRef = useRef(isLooping);
  const startTimeRef = useRef(startTime);
  const endTimeRef = useRef(endTime);
  const readyRef = useRef(false);
  const autoplayRef = useRef(autoplay);

  // Keep refs in sync so interval callback always has latest values
  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
  useEffect(() => { startTimeRef.current = startTime; }, [startTime]);
  useEffect(() => { endTimeRef.current = endTime; }, [endTime]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const current = player.getCurrentTime();
      if (isLoopingRef.current && current >= endTimeRef.current) {
        player.seekTo(startTimeRef.current, true);
      }
    }, 100);
  }, []);

  // Initialize player once
  useEffect(() => {
    let destroyed = false;

    loadYouTubeAPI().then(() => {
      if (destroyed || !containerRef.current) return;

      const player = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            readyRef.current = true;
            if (autoplayRef.current) {
              player.seekTo(startTimeRef.current, true);
              player.playVideo();
            }
            startPolling();
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              window.dispatchEvent(new CustomEvent("yt-play", { detail: "main-player" }));
              startPolling();
            }
          },
        },
      });

      playerRef.current = player;
    });

    function onOtherPlay(e: Event) {
      if ((e as CustomEvent).detail !== "main-player" && readyRef.current) {
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
  }, [videoId]); // Recreate player only if video changes

  // When active line changes, seek to new start_time
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.seekTo(startTime, true);
    player.playVideo();
  }, [startTime, endTime]);

  return (
    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

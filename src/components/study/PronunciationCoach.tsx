"use client";

import { useEffect, useRef, useState } from "react";
import type { LyricLine, PitchAttempt } from "@/types";
import type { LanguageId } from "@/lib/languages";
import { detectPitchContour, type PitchPoint } from "@/lib/audio/pitch";
import { encodeWav } from "@/lib/audio/wav-encoder";
import PitchContourChart from "./PitchContourChart";

interface Props {
  line: LyricLine;
  language: LanguageId;
}

type MicState = "idle" | "recording" | "submitting" | "denied" | "unsupported" | "error";

function scoreColor(score: number | null) {
  if (score === null) return "bg-gray-100 text-gray-500";
  if (score >= 80) return "bg-green-100 text-green-700";
  if (score >= 50) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function PronunciationCoach({ line, language }: Props) {
  const [micState, setMicState] = useState<MicState>("idle");
  const [attempts, setAttempts] = useState<PitchAttempt[]>([]);
  const [contour, setContour] = useState<PitchPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function releaseRecording() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    chunksRef.current = [];
  }

  // Reset per-line state and abort any in-flight recording when the learner
  // navigates to a different line, then load that line's attempt history.
  useEffect(() => {
    releaseRecording();
    setMicState("idle");
    setContour(null);
    setError(null);
    setAttempts([]);

    let cancelled = false;
    fetch(`/api/pronunciation/${line.id}`)
      .then((r) => (r.ok ? r.json() : { attempts: [] }))
      .then((data) => {
        if (!cancelled) setAttempts(data.attempts ?? []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      releaseRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line.id]);

  async function startRecording() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicState("unsupported");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicState("denied");
      return;
    }

    // Pause the YouTube player so the recording is a cappella, not mixed with
    // song audio bleeding in through the speakers — same event bus the quiz
    // and clip-preview players already use to coordinate single playback.
    window.dispatchEvent(new CustomEvent("yt-play", { detail: "pronunciation-recorder" }));

    streamRef.current = stream;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      void handleRecordingStopped();
    };

    recorder.start();
    setMicState("recording");

    const lineDurationMs = (line.end_time - line.start_time) * 1000;
    const maxRecordMs = Math.min(15000, Math.max(2500, lineDurationMs + 1000));
    timeoutRef.current = setTimeout(() => stopRecording(), maxRecordMs);
  }

  function stopRecording() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function handleRecordingStopped() {
    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (chunks.length === 0) {
      setMicState("idle");
      return;
    }

    setMicState("submitting");
    let audioCtx: AudioContext | null = null;
    try {
      const blob = new Blob(chunks, { type: recorderRef.current?.mimeType || "audio/webm" });
      const arrayBuffer = await blob.arrayBuffer();
      const AudioContextCtor =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioContextCtor();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);

      setContour(detectPitchContour(channelData, audioBuffer.sampleRate));

      const wavBlob = encodeWav(channelData, audioBuffer.sampleRate);
      const audioBase64 = await blobToBase64(wavBlob);

      const res = await fetch(`/api/pronunciation/${line.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64 }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(body.error || "Analysis failed");
      }

      const attempt: PitchAttempt = await res.json();
      setAttempts((prev) => [attempt, ...prev]);
      setMicState("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMicState("error");
    } finally {
      await audioCtx?.close();
    }
  }

  function toggleRecording() {
    if (micState === "recording") {
      stopRecording();
    } else if (micState === "idle" || micState === "error") {
      startRecording();
    }
  }

  const latest = attempts[0];
  const isRecording = micState === "recording";
  const isSubmitting = micState === "submitting";

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3 max-w-md mx-auto text-left">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">🎤 Practice pronunciation</h3>
        <button
          type="button"
          onClick={toggleRecording}
          disabled={isSubmitting || micState === "unsupported"}
          title={isRecording ? "Stop recording" : "Record this line"}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${
            isRecording ? "bg-red-500 text-white animate-pulse" : "bg-gray-100 hover:bg-gray-200 text-gray-500"
          }`}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z" />
          </svg>
        </button>
      </div>

      {micState === "unsupported" && (
        <p className="text-xs text-gray-400">Voice recording isn&apos;t supported in this browser.</p>
      )}
      {micState === "denied" && (
        <p className="text-xs text-red-500">
          Microphone access was denied — enable it in your browser&apos;s site settings to practice pronunciation.
        </p>
      )}
      {isRecording && <p className="text-xs text-red-500">Recording… say or sing the line, then tap again to stop.</p>}
      {isSubmitting && <p className="text-xs text-gray-400">Analyzing your pronunciation…</p>}
      {micState === "error" && error && <p className="text-xs text-red-500">{error} — try again.</p>}

      {contour && <PitchContourChart data={contour} />}

      {latest && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${scoreColor(latest.score)}`}>
              {latest.score !== null ? `${latest.score}/100` : "—"}
            </span>
            <p className="text-sm text-gray-700">{latest.feedback.summary}</p>
          </div>
          {latest.feedback.tips.length > 0 && (
            <ul className="text-xs text-gray-600 list-disc list-inside space-y-0.5">
              {latest.feedback.tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          )}
          {latest.feedback.wordNotes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {latest.feedback.wordNotes.map((wn, i) => (
                <span key={i} className="text-xs bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 text-gray-600">
                  <span className="font-medium text-gray-800">{wn.word}</span>: {wn.note}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {attempts.length > 1 && (
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-xs text-gray-400">History:</span>
          {[...attempts]
            .reverse()
            .slice(-8)
            .map((a) => (
              <span
                key={a.id}
                title={new Date(a.created_at).toLocaleString()}
                className={`text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-medium ${scoreColor(a.score)}`}
              >
                {a.score ?? "–"}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

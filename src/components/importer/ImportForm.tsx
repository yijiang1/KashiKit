"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DaySlider from "./DaySlider";
import { LANGUAGE_LIST, DEFAULT_LANGUAGE, type LanguageId } from "@/lib/languages";

const TITLE_PLACEHOLDER: Record<LanguageId, string> = {
  ja: "e.g. 夜に駆ける",
  zh: "e.g. 晴天",
};
const ARTIST_PLACEHOLDER: Record<LanguageId, string> = {
  ja: "e.g. YOASOBI",
  zh: "e.g. 周杰伦",
};

export default function ImportForm() {
  const router = useRouter();
  const [language, setLanguage] = useState<LanguageId>(DEFAULT_LANGUAGE);
  const [title, setTitle] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [artist, setArtist] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [lrcContent, setLrcContent] = useState("");
  const [dayCount, setDayCount] = useState(5);
  const [maxDays, setMaxDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const [fetchingLrc, setFetchingLrc] = useState(false);
  const [translations, setTranslations] = useState<string[]>([]);
  const [fetchingTranscript, setFetchingTranscript] = useState(false);
  const [lrcStatus, setLrcStatus] = useState<"idle" | "found" | "notfound" | "transcript" | "transcript-en">("idle");
  const [matchedTrack, setMatchedTrack] = useState<{ trackName: string; artistName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedLines, setFailedLines] = useState<string[] | null>(null);

  async function fetchLyrics() {
    if (!title.trim()) return;
    setFetchingLrc(true);
    setLrcStatus("idle");
    try {
      const params = new URLSearchParams({ title, artist });
      const res = await fetch(`/api/fetch-lyrics?${params}`);
      const data = await res.json();

      if (res.ok) {
        setLrcContent(data.lrc);
        setMatchedTrack({ trackName: data.trackName, artistName: data.artistName });
        setLrcStatus("found");
      } else {
        setMatchedTrack(null);
        setLrcStatus("notfound");
      }
    } catch {
      setLrcStatus("notfound");
    } finally {
      setFetchingLrc(false);
    }
  }

  async function fetchFromVideo() {
    if (!youtubeUrl.trim()) return;
    setFetchingTranscript(true);
    setLrcStatus("idle");
    try {
      const res = await fetch(`/api/fetch-transcript?url=${encodeURIComponent(youtubeUrl)}&lang=${language}`);
      const data = await res.json();
      if (res.ok) {
        setLrcContent(data.lrc);
        setTranslations(data.translations ?? []);
        setLrcStatus(data.hasEnglish ? "transcript-en" : "transcript");
        // Auto-adjust day count to never exceed line count
        if (data.lineCount) {
          setMaxDays(Math.min(data.lineCount, 14));
          setDayCount((prev) => Math.min(prev, data.lineCount, 14));
        }
      } else {
        setLrcStatus("notfound");
      }
    } catch {
      setLrcStatus("notfound");
    } finally {
      setFetchingTranscript(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFailedLines(null);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl, lrcContent, title, title_en: titleEn || undefined, artist, dayCount, translations, language }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed");
        return;
      }

      if (Array.isArray(data.failedLines) && data.failedLines.length > 0) {
        // Song was created, but some lines couldn't be analyzed —
        // let the user see which before leaving the page.
        setFailedLines(data.failedLines);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
      {/* Language */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Language</label>
        <div className="flex gap-2">
          {LANGUAGE_LIST.map((lang) => (
            <button
              key={lang.id}
              type="button"
              onClick={() => setLanguage(lang.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                language === lang.id
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span>{lang.flag}</span>
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title + Artist */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Song title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder={TITLE_PLACEHOLDER[language]}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder-gray-400"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Artist</label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            required
            placeholder={ARTIST_PLACEHOLDER[language]}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder-gray-400"
          />
        </div>
      </div>

      {/* English title (optional) */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">
          English title <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={titleEn}
          onChange={(e) => setTitleEn(e.target.value)}
          placeholder="e.g. Racing into the Night"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder-gray-400"
        />
      </div>

      {/* YouTube URL */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">YouTube URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            required
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder-gray-400"
          />
          <button
            type="button"
            onClick={fetchFromVideo}
            disabled={fetchingTranscript || !youtubeUrl.trim()}
            className="px-3 py-2.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium whitespace-nowrap flex items-center gap-1.5"
          >
            {fetchingTranscript ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Fetching…
              </>
            ) : (
              "Get captions"
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400">Paste the URL first, then click "Get captions" to auto-fill lyrics from the video</p>
      </div>

      {/* LRC Content */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">LRC lyrics</label>
            {lrcStatus === "found" && matchedTrack && (
              <span className="ml-2 text-xs text-green-600 font-medium">
                ✓ Matched: {matchedTrack.trackName}{matchedTrack.artistName ? ` — ${matchedTrack.artistName}` : ""}
              </span>
            )}
            {lrcStatus === "transcript" && (
              <span className="ml-2 text-xs text-green-600 font-medium">✓ Captions fetched from video</span>
            )}
            {lrcStatus === "transcript-en" && (
              <span className="ml-2 text-xs text-green-600 font-medium">✓ JP + EN captions fetched — official translations included</span>
            )}
            {lrcStatus === "notfound" && (
              <span className="ml-2 text-xs text-red-500">Not found — paste manually below</span>
            )}
          </div>
          <button
            type="button"
            onClick={fetchLyrics}
            disabled={fetchingLrc || !title.trim()}
            className="text-sm px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1.5"
          >
            {fetchingLrc ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Searching…
              </>
            ) : (
              "Auto-fetch lyrics"
            )}
          </button>
        </div>
        <textarea
          value={lrcContent}
          onChange={(e) => setLrcContent(e.target.value)}
          required
          rows={10}
          placeholder="Click 'Auto-fetch lyrics' above, or paste LRC content manually&#10;e.g. [00:12.34]最初の行"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm text-gray-900 placeholder-gray-400 resize-y"
        />
      </div>

      {/* Day Slider */}
      <DaySlider value={dayCount} onChange={setDayCount} max={maxDays} lineCount={
        lrcContent
          ? lrcContent.split("\n").filter(l => /^\[\d+:\d{2}\.\d{2,3}\]/.test(l.trim()) && /[\u3000-\u9FFF\uF900-\uFAFF]/.test(l)).length
          : undefined
      } />

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Partial success: some lines failed analysis */}
      {failedLines && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm space-y-2">
          <p className="font-medium">
            Course created, but {failedLines.length} line{failedLines.length > 1 ? "s" : ""} couldn&apos;t be analyzed
            (saved without translation or vocabulary):
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            {failedLines.slice(0, 5).map((line, i) => (
              <li key={i} className="truncate">{line}</li>
            ))}
            {failedLines.length > 5 && <li>…and {failedLines.length - 5} more</li>}
          </ul>
          <button
            type="button"
            onClick={() => { router.push("/"); router.refresh(); }}
            className="mt-1 px-3 py-1.5 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors"
          >
            Continue to dashboard
          </button>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-6 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Analyzing lyrics with AI… (usually 1–2 minutes)
          </>
        ) : (
          "Create course"
        )}
      </button>
    </form>
  );
}

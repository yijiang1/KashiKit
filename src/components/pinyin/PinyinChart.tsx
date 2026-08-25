"use client";

import { useState, useCallback } from "react";
import { speak, ClipPlayer } from "@/components/shared/SentenceExamples";
import { addTone, PINYIN_COLS, LABIALS_ALVEOLARS, VELARS_PALATALS, SIBILANTS, type PinyinCell } from "@/lib/pinyin";

type WordExample = {
  word: string;
  furigana: string;
  english_meaning: string;
  part_of_speech: string;
  song_title: string;
};

type SentenceExample = {
  japanese_text: string;
  english_text: string;
  song_title: string;
  youtube_id: string;
  start_time: number;
  end_time: number;
};

const POS_COLORS: Record<string, string> = {
  noun: "bg-blue-100 text-blue-700",
  verb: "bg-red-100 text-red-700",
  adjective: "bg-yellow-100 text-yellow-700",
  adverb: "bg-green-100 text-green-700",
  expression: "bg-purple-100 text-purple-700",
  other: "bg-gray-100 text-gray-600",
};

const TONES = [1, 2, 3, 4, 5] as const;
const TONE_LABELS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "neutral" };

function SyllableCell({
  cell,
  isSelected,
  hasExamples,
  onClick,
}: {
  cell: PinyinCell;
  isSelected: boolean;
  hasExamples: boolean;
  onClick: () => void;
}) {
  if (!cell) return <div className="aspect-square" />;
  return (
    <button
      onClick={onClick}
      className={`relative w-full aspect-square flex items-center justify-center rounded-lg border transition-all
        ${isSelected
          ? "bg-indigo-600 border-indigo-600 text-white shadow-md scale-105"
          : "bg-white border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-900"
        }`}
    >
      <span className="text-sm font-medium select-none">{cell.base}</span>
      {hasExamples && !isSelected && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-400 rounded-full" />
      )}
    </button>
  );
}

function SpeakBtn({ text, small }: { text: string; small?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); speak(text, "zh-CN"); }}
      className={`shrink-0 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors ${small ? "p-1.5" : "p-2"}`}
      title="Pronounce"
    >
      <svg className={small ? "w-4 h-4" : "w-5 h-5"} fill="currentColor" viewBox="0 0 24 24">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
      </svg>
    </button>
  );
}

export default function PinyinChart({ coverage }: { coverage: Record<string, number> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [tone, setTone] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [examples, setExamples] = useState<{ words: WordExample[]; sentences: SentenceExample[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"vocab" | "lyrics">("vocab");
  const [playingClip, setPlayingClip] = useState<string | null>(null);

  const handleSelect = useCallback(async (base: string) => {
    if (selected === base) {
      setSelected(null);
      setExamples(null);
      return;
    }
    setSelected(base);
    setTone(1);
    setExamples(null);
    setLoading(true);
    setPlayingClip(null);
    try {
      const res = await fetch(`/api/pinyin?syllable=${encodeURIComponent(base)}`);
      const data = await res.json();
      setExamples(data);
      if (data.words.length === 0 && data.sentences.length > 0) setTab("lyrics");
      else setTab("vocab");
    } catch {
      setExamples({ words: [], sentences: [] });
    }
    setLoading(false);
  }, [selected]);

  function renderGroup(title: string, rows: Array<[string, PinyinCell[]]>) {
    return (
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</h2>
        <div className="grid gap-1.5 mb-1" style={{ gridTemplateColumns: `36px repeat(${PINYIN_COLS.length}, 1fr)` }}>
          <div />
          {PINYIN_COLS.map((c) => (
            <div key={c} className="text-center text-xs text-gray-400 font-medium py-0.5">{c}</div>
          ))}
        </div>
        <div className="space-y-1.5">
          {rows.map(([initial, cells]) => (
            <div key={initial || "zero"} className="grid gap-1.5" style={{ gridTemplateColumns: `36px repeat(${PINYIN_COLS.length}, 1fr)` }}>
              <div className="flex items-center justify-center text-xs text-gray-400 font-mono">{initial}</div>
              {cells.map((cell, i) => (
                <SyllableCell
                  key={i}
                  cell={cell}
                  isSelected={!!cell && selected === cell.base}
                  hasExamples={!!cell && !!coverage[cell.base] && coverage[cell.base] > 0}
                  onClick={() => cell && handleSelect(cell.base)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const vocabCount = examples?.words.length ?? 0;
  const lyricsCount = examples?.sentences.length ?? 0;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Left: grid panel */}
      <div className="w-full lg:w-[420px] shrink-0 space-y-5">
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-2 h-2 bg-emerald-400 rounded-full inline-block shrink-0" />
          has examples in your songs
        </span>
        {renderGroup("Labials & Alveolars", LABIALS_ALVEOLARS)}
        {renderGroup("Velars & Palatals", VELARS_PALATALS)}
        {renderGroup("Sibilants", SIBILANTS)}
        <p className="text-xs text-gray-400">
          Shows common syllables with simple finals (a/o/e/i/u/ü) — not every possible combination.
        </p>
      </div>

      {/* Right: details panel */}
      <div className="w-full lg:flex-1 lg:sticky lg:top-20">
        {!selected ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 flex flex-col items-center justify-center gap-3 text-center min-h-[300px]">
            <div className="text-7xl text-gray-100 select-none leading-none font-medium">拼</div>
            <p className="text-gray-400 text-sm max-w-xs">
              Click any syllable to hear its tones and see vocabulary and lyric examples from your songs
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Syllable header with tone picker */}
            <div className="bg-indigo-600 px-6 py-5 space-y-4">
              <div className="flex items-center gap-5">
                <span className="text-5xl text-white leading-none select-none font-medium">
                  {addTone(selected, tone)}
                </span>
                <div className="ml-auto">
                  <SpeakBtn text={addTone(selected, tone)} />
                </div>
              </div>
              <div className="flex gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      tone === t ? "bg-white text-indigo-700" : "bg-white/10 text-indigo-100 hover:bg-white/20"
                    }`}
                  >
                    {addTone(selected, t)} <span className="opacity-70">({TONE_LABELS[t]})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-100 flex">
              {(["vocab", "lyrics"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-5 py-3 text-sm font-medium transition-colors relative flex items-center gap-1.5
                    ${tab === t ? "text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {t === "vocab" ? "Vocabulary" : "Lyrics"}
                  {examples && (
                    <span className="text-xs text-gray-400">
                      ({t === "vocab" ? vocabCount : lyricsCount})
                    </span>
                  )}
                  {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t" />}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="max-h-[62vh] overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-11 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : tab === "vocab" ? (
                vocabCount > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {examples!.words.map((w, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group transition-colors">
                        <div className="shrink-0 w-28">
                          <div className="text-base font-medium text-gray-900 leading-tight">{w.word}</div>
                          <div className="text-xs text-indigo-500 mt-0.5">{w.furigana}</div>
                        </div>
                        <div className="flex-1 text-sm text-gray-600 min-w-0">{w.english_meaning}</div>
                        <div className="flex items-center gap-2 shrink-0">
                          {w.part_of_speech && (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${POS_COLORS[w.part_of_speech] ?? POS_COLORS.other}`}>
                              {w.part_of_speech}
                            </span>
                          )}
                          <button
                            onClick={() => speak(w.word, "zh-CN")}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition-all"
                            title="Pronounce"
                          >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                    <p className="text-gray-400 text-sm">
                      No vocabulary starting with <span className="text-gray-600 font-medium">{selected}</span> in your songs
                    </p>
                    <p className="text-xs text-gray-300 mt-1">Import more songs to grow your examples</p>
                  </div>
                )
              ) : lyricsCount > 0 ? (
                <div className="p-4 space-y-3">
                  {examples!.sentences.map((s, i) => {
                    const clipKey = `${s.youtube_id}-${s.start_time}`;
                    const isPlaying = playingClip === clipKey;
                    return (
                      <div key={i} className="rounded-lg bg-gray-50 overflow-hidden">
                        <div className="px-4 py-3 space-y-1.5">
                          <div className="flex items-start gap-2">
                            <button
                              onClick={() => setPlayingClip(isPlaying ? null : clipKey)}
                              className="shrink-0 w-7 h-7 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors mt-0.5"
                              title={isPlaying ? "Stop" : "Play clip"}
                            >
                              {isPlaying ? (
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                              ) : (
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 leading-relaxed">{s.japanese_text}</p>
                              {s.english_text && (
                                <p className="text-xs text-gray-500 italic leading-relaxed mt-0.5">{s.english_text}</p>
                              )}
                              <p className="text-[11px] text-gray-400 mt-0.5">— {s.song_title}</p>
                            </div>
                            <button
                              onClick={() => speak(s.japanese_text, "zh-CN")}
                              className="shrink-0 p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition-colors"
                              title="Pronounce"
                            >
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        {isPlaying && (
                          <div className="rounded-lg overflow-hidden mx-4 mb-3 ml-[52px] max-w-xs">
                            <ClipPlayer videoId={s.youtube_id} startTime={Number(s.start_time)} endTime={Number(s.end_time)} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                  <p className="text-gray-400 text-sm">
                    No lyrics containing <span className="text-gray-600 font-medium">{selected}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

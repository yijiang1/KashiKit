"use client";

import { useState, useMemo, useEffect } from "react";
import { ClipPlayer, speak } from "@/components/shared/SentenceExamples";
import { useLanguage } from "@/lib/language-context";
import { getLanguageConfig } from "@/lib/languages";

// Kana + Han characters — covers both Japanese structure labels (which mix kana
// and kanji, e.g. 〜てしまう) and Chinese ones (pure Han, e.g. 把-construction).
const CJK_RE = /[ぁ-ん゛゜ァ-ヶー一-龯々]+/;

// Extract the CJK core from a structure label, e.g.:
//   〜てしまう  → てしまう
//   〜ば/〜たら → ば
//   Noun + の + Noun → の
//   把-construction → 把
function extractPattern(structure: string): string {
  const first = structure.split("/")[0];
  const stripped = first.replace(/^[〜～~]/, "").replace(/[〜～~]$/, "").trim();
  // If it's already pure CJK, use as-is
  if (CJK_RE.test(stripped) && !/[A-Za-z+]/.test(stripped)) return stripped;
  // For descriptive patterns like "Noun + の + Noun", pull the first CJK token
  const m = stripped.match(CJK_RE);
  return m ? m[0] : stripped;
}

// Find the longest prefix of `pattern` in `text`.
// For short patterns (≤2 chars) search from the end — sentence-final grammar tends to sit there.
function findMatch(text: string, pattern: string): { before: string; match: string; after: string } | null {
  for (let len = pattern.length; len >= 1; len--) {
    const sub = pattern.slice(0, len);
    const idx = sub.length <= 2 ? text.lastIndexOf(sub) : text.indexOf(sub);
    if (idx !== -1) {
      return { before: text.slice(0, idx), match: text.slice(idx, idx + len), after: text.slice(idx + len) };
    }
  }
  return null;
}

function GrammarHighlight({ text, structure }: { text: string; structure: string }) {
  const pattern = extractPattern(structure);
  const m = pattern ? findMatch(text, pattern) : null;
  if (!m) return <>{text}</>;
  return (
    <>
      {m.before}
      <mark className="bg-yellow-200 text-gray-900 rounded px-0.5 not-italic">{m.match}</mark>
      {m.after}
    </>
  );
}

export type GrammarExample = {
  explanation: string;
  example_sentence_jp: string;
  example_sentence_en: string;
  lyric_line_id: string;
  japanese_text: string;
  english_text: string;
  song_title: string;
  youtube_id: string;
  start_time: number;
  end_time: number;
};

export type GrammarStructure = {
  structure: string;
  language: string;
  count: number;
  examples: GrammarExample[];
};

export default function GrammarExplorer({ structures: allStructures }: { structures: GrammarStructure[] }) {
  const { language } = useLanguage();
  const langConfig = getLanguageConfig(language);
  const structures = useMemo(() => allStructures.filter((s) => s.language === language), [allStructures, language]);
  const [selected, setSelected] = useState<string | null>(null);
  const [playingClip, setPlayingClip] = useState<string | null>(null);

  const active = structures.find((s) => s.structure === selected) ?? structures[0] ?? null;

  useEffect(() => {
    setSelected(null);
    setPlayingClip(null);
  }, [language]);

  if (structures.length === 0) {
    return (
      <div className="text-center py-24 text-gray-400">
        <p className="text-lg font-medium">No grammar points yet</p>
        <p className="text-sm mt-1">Import songs and grammar patterns will appear here automatically.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-6" style={{ minHeight: "70vh" }}>
      {/* Left: structure list */}
      <div className="w-60 shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
        <div className="px-4 py-2.5 border-b border-gray-100 text-xs font-medium text-gray-400 uppercase tracking-wider">
          {structures.length} patterns
        </div>
        <div className="overflow-y-auto flex-1">
          {structures.map((s) => (
            <button
              key={s.structure}
              onClick={() => {
                setSelected(s.structure);
                setPlayingClip(null);
              }}
              className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 transition-colors border-b border-gray-50 ${
                selected === s.structure
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="font-mono text-sm truncate">{s.structure}</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${
                  selected === s.structure
                    ? "bg-indigo-100 text-indigo-600"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {s.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Right: detail panel */}
      {active && (
        <div className="flex-1 min-w-0 space-y-4">
          {/* Header card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-gray-900 font-mono">{active.structure}</h2>
                {active.examples[0]?.explanation && (
                  <p className="text-gray-600 mt-1 leading-relaxed">{active.examples[0].explanation}</p>
                )}
              </div>
              <span className="shrink-0 bg-indigo-100 text-indigo-700 text-sm px-3 py-1 rounded-full">
                {active.count} {active.count === 1 ? "occurrence" : "occurrences"}
              </span>
            </div>

            {/* Generic example sentence */}
            {active.examples[0]?.example_sentence_jp && (
              <div className="mt-4 bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Example</p>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg text-gray-900">
                    <GrammarHighlight text={active.examples[0].example_sentence_jp} structure={active.structure} />
                  </p>
                    <p className="text-sm text-gray-500 italic mt-0.5">
                      {active.examples[0].example_sentence_en}
                    </p>
                  </div>
                  <button
                    onClick={() => speak(active.examples[0].example_sentence_jp, langConfig.ttsLang)}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition-colors"
                    title="Listen"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Song line examples */}
          <h3 className="text-sm font-medium text-gray-500 px-1">
            Found in songs
            {active.examples.length < active.count && ` — showing ${active.examples.length} of ${active.count}`}
          </h3>
          <div className="space-y-3">
            {active.examples.map((ex, i) => {
              const clipKey = `${ex.youtube_id}-${ex.start_time}`;
              const isPlaying = playingClip === clipKey;
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      {/* Play toggle */}
                      <button
                        onClick={() => setPlayingClip(isPlaying ? null : clipKey)}
                        className="shrink-0 w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors mt-0.5"
                        title={isPlaying ? "Stop" : "Play clip"}
                      >
                        {isPlaying ? (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>

                      {/* Text content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-base text-gray-900 leading-relaxed">
                          <GrammarHighlight text={ex.japanese_text} structure={active.structure} />
                        </p>
                        {ex.english_text && (
                          <p className="text-sm text-gray-500 italic mt-0.5">{ex.english_text}</p>
                        )}
                        {ex.explanation && ex.explanation !== active.examples[0].explanation && (
                          <p className="text-xs text-indigo-600 mt-2 bg-indigo-50 rounded px-2 py-1 inline-block">
                            {ex.explanation}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1.5">— {ex.song_title}</p>
                      </div>

                      {/* TTS */}
                      <button
                        onClick={() => speak(ex.japanese_text, langConfig.ttsLang)}
                        className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                        title="Pronounce"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expandable clip */}
                  {isPlaying && (
                    <div className="mx-5 mb-4 ml-16 max-w-xs rounded-lg overflow-hidden">
                      <ClipPlayer
                        videoId={ex.youtube_id}
                        startTime={Number(ex.start_time)}
                        endTime={Number(ex.end_time)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

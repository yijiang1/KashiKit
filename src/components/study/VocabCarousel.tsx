"use client";

import { useState, useEffect } from "react";
import type { Vocabulary } from "@/types";

const POS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  noun:       { bg: "bg-blue-100",   text: "text-blue-700",   label: "Noun" },
  verb:       { bg: "bg-red-100",    text: "text-red-700",    label: "Verb" },
  adjective:  { bg: "bg-yellow-100", text: "text-yellow-700", label: "Adjective" },
  adverb:     { bg: "bg-green-100",  text: "text-green-700",  label: "Adverb" },
  expression: { bg: "bg-purple-100", text: "text-purple-700", label: "Expression" },
  other:      { bg: "bg-gray-100",   text: "text-gray-600",   label: "Other" },
};

export function posColor(pos: string) {
  return POS_COLORS[pos?.toLowerCase()] ?? POS_COLORS.other;
}

interface Props {
  vocabulary: Vocabulary[];
}

export default function VocabCarousel({ vocabulary }: Props) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // Reset when vocabulary changes (new line selected)
  useEffect(() => {
    setIndex(0);
    setFlipped(false);
  }, [vocabulary]);

  // Clamp index to valid range (useEffect reset is async, so index can be stale)
  const safeIndex = Math.min(index, Math.max(0, vocabulary.length - 1));

  if (vocabulary.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        No vocabulary for this line
      </div>
    );
  }

  const current = vocabulary[safeIndex];

  const color = posColor(current.part_of_speech ?? "other");

  return (
    <div className="space-y-3">
      {/* Card */}
      <div
        onClick={() => setFlipped((v) => !v)}
        className="cursor-pointer select-none rounded-2xl shadow-md bg-white border border-gray-100 p-6 min-h-[120px] flex flex-col items-center justify-center text-center transition-all hover:shadow-lg"
      >
        {/* Part of speech badge */}
        {current.part_of_speech && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mb-3 ${color.bg} ${color.text}`}>
            {color.label}
          </span>
        )}
        {!flipped ? (
          <>
            <p className="text-2xl font-bold text-gray-900">{current.word}</p>
            <p className={`text-sm mt-1 ${color.text}`}>{current.furigana}</p>
            <p className="text-xs text-gray-400 mt-3">Tap to reveal meaning</p>
          </>
        ) : (
          <>
            <p className="text-xl font-semibold text-gray-800">{current.english_meaning}</p>
            {current.grammar_notes && (
              <p className="text-sm text-gray-500 mt-2 italic">{current.grammar_notes}</p>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-2">
        <button
          onClick={() => { setIndex((i) => Math.max(0, i - 1)); setFlipped(false); }}
          disabled={safeIndex === 0}
          className="px-4 py-1.5 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Prev
        </button>

        <span className="text-sm text-gray-400">
          {safeIndex + 1} / {vocabulary.length}
        </span>

        <button
          onClick={() => { setIndex((i) => Math.min(vocabulary.length - 1, i + 1)); setFlipped(false); }}
          disabled={safeIndex === vocabulary.length - 1}
          className="px-4 py-1.5 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

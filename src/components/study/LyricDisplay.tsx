"use client";

import { useState, useEffect } from "react";
import type { LyricLine, Vocabulary } from "@/types";
import { posColor } from "./VocabCarousel";
import SentenceExamples, { Highlight, speakJapanese } from "@/components/shared/SentenceExamples";

interface Props {
  line: LyricLine;
}

// POS → underline colour class
const POS_UNDERLINE: Record<string, string> = {
  noun:       "decoration-blue-400",
  verb:       "decoration-red-400",
  adjective:  "decoration-yellow-400",
  adverb:     "decoration-green-400",
  expression: "decoration-purple-400",
  other:      "decoration-gray-400",
};

type Segment = { type: "plain"; text: string } | { type: "vocab"; text: string; vocab: Vocabulary };

function buildSegments(japaneseText: string, vocabulary: Vocabulary[]): Segment[] {
  const sorted = [...vocabulary].sort((a, b) => b.word.length - a.word.length);
  const claimed = new Array(japaneseText.length).fill(false);
  const matches: { start: number; end: number; vocab: Vocabulary }[] = [];

  for (const vocab of sorted) {
    if (!vocab.word) continue;
    let searchFrom = 0;
    while (true) {
      const idx = japaneseText.indexOf(vocab.word, searchFrom);
      if (idx === -1) break;
      const end = idx + vocab.word.length;
      if (!claimed.slice(idx, end).some(Boolean)) {
        matches.push({ start: idx, end, vocab });
        for (let i = idx; i < end; i++) claimed[i] = true;
      }
      searchFrom = idx + 1;
    }
  }

  matches.sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start > cursor) {
      segments.push({ type: "plain", text: japaneseText.slice(cursor, m.start) });
    }
    segments.push({ type: "vocab", text: m.vocab.word, vocab: m.vocab });
    cursor = m.end;
  }
  if (cursor < japaneseText.length) {
    segments.push({ type: "plain", text: japaneseText.slice(cursor) });
  }

  return segments;
}

export default function LyricDisplay({ line }: Props) {
  const [selected, setSelected] = useState<Vocabulary | null>(null);
  const [showTranslation, setShowTranslation] = useState(true);
  const segments = buildSegments(line.japanese_text, line.vocabulary);

  // Reset selection when line changes
  useEffect(() => {
    setSelected(null);
  }, [line.id]);

  return (
    <div className="text-center space-y-4 px-4">
      {/* Japanese line with clickable vocab words */}
      <p className="text-3xl leading-loose font-medium text-gray-900">
        {segments.map((seg, i) => {
          if (seg.type === "plain") {
            return <span key={i}>{seg.text}</span>;
          }
          const pos = seg.vocab.part_of_speech?.toLowerCase() || "other";
          const underline = POS_UNDERLINE[pos] ?? POS_UNDERLINE.other;
          const { text: textColor } = posColor(pos);
          const isSelected = selected?.id === seg.vocab.id;
          return (
            <ruby
              key={i}
              className={`underline decoration-2 ${underline} cursor-pointer transition-all ${
                isSelected ? "bg-indigo-100 rounded px-0.5" : "hover:bg-gray-100 rounded"
              }`}
              onClick={() => setSelected(isSelected ? null : seg.vocab)}
            >
              {seg.text}
              <rt className={textColor}>{seg.vocab.furigana || ""}</rt>
            </ruby>
          );
        })}
      </p>

      {/* POS legend */}
      {line.vocabulary.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {["noun", "verb", "adjective", "adverb", "expression"].filter(pos =>
            line.vocabulary.some(v => v.part_of_speech?.toLowerCase() === pos)
          ).map(pos => {
            const c = posColor(pos);
            return (
              <span key={pos} className={`text-xs px-2 py-0.5 rounded-full ${c.bg} ${c.text} font-medium`}>
                {c.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Selected word detail */}
      {selected && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-left max-w-md mx-auto space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-900">{selected.word}</span>
              <span className="text-sm text-indigo-500">{selected.furigana}</span>
              <button
                onClick={() => speakJapanese(selected.word)}
                title="Pronounce"
                className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                </svg>
              </button>
            </div>
            {selected.part_of_speech && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${posColor(selected.part_of_speech).bg} ${posColor(selected.part_of_speech).text}`}>
                {posColor(selected.part_of_speech).label}
              </span>
            )}
          </div>
          <p className="text-gray-700">{selected.english_meaning}</p>
          {selected.grammar_notes && (
            <p className="text-sm text-gray-500 italic">{selected.grammar_notes}</p>
          )}
          {selected.example_sentence && (
            <div className="border-t border-gray-100 pt-2 mt-2">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Example</p>
                <button
                  onClick={() => speakJapanese(selected.example_sentence!)}
                  title="Pronounce"
                  className="w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-800"><Highlight text={selected.example_sentence} word={selected.word} /></p>
              {selected.example_sentence_english && (
                <p className="text-xs text-gray-500 italic">{selected.example_sentence_english}</p>
              )}
            </div>
          )}

          {/* Real examples from sentence bank */}
          <SentenceExamples word={selected.word} excludeSentence={line.japanese_text} />
        </div>
      )}

      {/* Translation */}
      <button
        onClick={() => setShowTranslation((v) => !v)}
        className="text-sm text-indigo-600 hover:text-indigo-800 underline underline-offset-2 transition-colors"
      >
        {showTranslation ? "Hide translation" : "Show translation"}
      </button>

      {showTranslation && (
        <p className="text-lg text-gray-600 italic">{line.english_text || "—"}</p>
      )}
    </div>
  );
}

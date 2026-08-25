"use client";

import { useState, useCallback } from "react";
import { speak, Highlight, ClipPlayer } from "@/components/shared/SentenceExamples";

function speakJapanese(text: string) {
  speak(text, "ja-JP");
}

// ── Kana data ─────────────────────────────────────────────────────────────────

type K = { h: string; k: string; r: string };

// 5-column basic table (columns: a i u e o)
const BASIC: Array<Array<K | null>> = [
  [{ h:"あ",k:"ア",r:"a" },{ h:"い",k:"イ",r:"i" },{ h:"う",k:"ウ",r:"u" },{ h:"え",k:"エ",r:"e" },{ h:"お",k:"オ",r:"o" }],
  [{ h:"か",k:"カ",r:"ka"},{ h:"き",k:"キ",r:"ki"},{ h:"く",k:"ク",r:"ku"},{ h:"け",k:"ケ",r:"ke"},{ h:"こ",k:"コ",r:"ko"}],
  [{ h:"さ",k:"サ",r:"sa"},{ h:"し",k:"シ",r:"shi"},{ h:"す",k:"ス",r:"su"},{ h:"せ",k:"セ",r:"se"},{ h:"そ",k:"ソ",r:"so"}],
  [{ h:"た",k:"タ",r:"ta"},{ h:"ち",k:"チ",r:"chi"},{ h:"つ",k:"ツ",r:"tsu"},{ h:"て",k:"テ",r:"te"},{ h:"と",k:"ト",r:"to"}],
  [{ h:"な",k:"ナ",r:"na"},{ h:"に",k:"ニ",r:"ni"},{ h:"ぬ",k:"ヌ",r:"nu"},{ h:"ね",k:"ネ",r:"ne"},{ h:"の",k:"ノ",r:"no"}],
  [{ h:"は",k:"ハ",r:"ha"},{ h:"ひ",k:"ヒ",r:"hi"},{ h:"ふ",k:"フ",r:"fu"},{ h:"へ",k:"ヘ",r:"he"},{ h:"ほ",k:"ホ",r:"ho"}],
  [{ h:"ま",k:"マ",r:"ma"},{ h:"み",k:"ミ",r:"mi"},{ h:"む",k:"ム",r:"mu"},{ h:"め",k:"メ",r:"me"},{ h:"も",k:"モ",r:"mo"}],
  [{ h:"や",k:"ヤ",r:"ya"},null,                  { h:"ゆ",k:"ユ",r:"yu"},null,                  { h:"よ",k:"ヨ",r:"yo"}],
  [{ h:"ら",k:"ラ",r:"ra"},{ h:"り",k:"リ",r:"ri"},{ h:"る",k:"ル",r:"ru"},{ h:"れ",k:"レ",r:"re"},{ h:"ろ",k:"ロ",r:"ro"}],
  [{ h:"わ",k:"ワ",r:"wa"},null,null,null,          { h:"を",k:"ヲ",r:"wo"}],
  [{ h:"ん",k:"ン",r:"n" },null,null,null,null],
];

// 5-column voiced & semi-voiced
const VOICED: Array<Array<K | null>> = [
  [{ h:"が",k:"ガ",r:"ga"},{ h:"ぎ",k:"ギ",r:"gi"},{ h:"ぐ",k:"グ",r:"gu"},{ h:"げ",k:"ゲ",r:"ge"},{ h:"ご",k:"ゴ",r:"go"}],
  [{ h:"ざ",k:"ザ",r:"za"},{ h:"じ",k:"ジ",r:"ji"},{ h:"ず",k:"ズ",r:"zu"},{ h:"ぜ",k:"ゼ",r:"ze"},{ h:"ぞ",k:"ゾ",r:"zo"}],
  [{ h:"だ",k:"ダ",r:"da"},{ h:"ぢ",k:"ヂ",r:"ji"},{ h:"づ",k:"ヅ",r:"zu"},{ h:"で",k:"デ",r:"de"},{ h:"ど",k:"ド",r:"do"}],
  [{ h:"ば",k:"バ",r:"ba"},{ h:"び",k:"ビ",r:"bi"},{ h:"ぶ",k:"ブ",r:"bu"},{ h:"べ",k:"ベ",r:"be"},{ h:"ぼ",k:"ボ",r:"bo"}],
  [{ h:"ぱ",k:"パ",r:"pa"},{ h:"ぴ",k:"ピ",r:"pi"},{ h:"ぷ",k:"プ",r:"pu"},{ h:"ぺ",k:"ペ",r:"pe"},{ h:"ぽ",k:"ポ",r:"po"}],
];

// 3-column combinations (columns: ya yu yo)
const YOON: Array<Array<K>> = [
  [{ h:"きゃ",k:"キャ",r:"kya"},{ h:"きゅ",k:"キュ",r:"kyu"},{ h:"きょ",k:"キョ",r:"kyo"}],
  [{ h:"しゃ",k:"シャ",r:"sha"},{ h:"しゅ",k:"シュ",r:"shu"},{ h:"しょ",k:"ショ",r:"sho"}],
  [{ h:"ちゃ",k:"チャ",r:"cha"},{ h:"ちゅ",k:"チュ",r:"chu"},{ h:"ちょ",k:"チョ",r:"cho"}],
  [{ h:"にゃ",k:"ニャ",r:"nya"},{ h:"にゅ",k:"ニュ",r:"nyu"},{ h:"にょ",k:"ニョ",r:"nyo"}],
  [{ h:"ひゃ",k:"ヒャ",r:"hya"},{ h:"ひゅ",k:"ヒュ",r:"hyu"},{ h:"ひょ",k:"ヒョ",r:"hyo"}],
  [{ h:"みゃ",k:"ミャ",r:"mya"},{ h:"みゅ",k:"ミュ",r:"myu"},{ h:"みょ",k:"ミョ",r:"myo"}],
  [{ h:"りゃ",k:"リャ",r:"rya"},{ h:"りゅ",k:"リュ",r:"ryu"},{ h:"りょ",k:"リョ",r:"ryo"}],
  [{ h:"ぎゃ",k:"ギャ",r:"gya"},{ h:"ぎゅ",k:"ギュ",r:"gyu"},{ h:"ぎょ",k:"ギョ",r:"gyo"}],
  [{ h:"じゃ",k:"ジャ",r:"ja" },{ h:"じゅ",k:"ジュ",r:"ju" },{ h:"じょ",k:"ジョ",r:"jo" }],
  [{ h:"びゃ",k:"ビャ",r:"bya"},{ h:"びゅ",k:"ビュ",r:"byu"},{ h:"びょ",k:"ビョ",r:"byo"}],
  [{ h:"ぴゃ",k:"ピャ",r:"pya"},{ h:"ぴゅ",k:"ピュ",r:"pyu"},{ h:"ぴょ",k:"ピョ",r:"pyo"}],
];

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Constants ─────────────────────────────────────────────────────────────────

const POS_COLORS: Record<string, string> = {
  noun: "bg-blue-100 text-blue-700",
  verb: "bg-red-100 text-red-700",
  adjective: "bg-yellow-100 text-yellow-700",
  adverb: "bg-green-100 text-green-700",
  expression: "bg-purple-100 text-purple-700",
  other: "bg-gray-100 text-gray-600",
};

const COL_HEADERS_5 = ["a", "i", "u", "e", "o"];
const COL_HEADERS_3 = ["ya", "yu", "yo"];

// ── Sub-components ────────────────────────────────────────────────────────────

function KanaCell({
  entry,
  mode,
  isSelected,
  hasExamples,
  onClick,
}: {
  entry: K;
  mode: "hiragana" | "katakana";
  isSelected: boolean;
  hasExamples: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative w-full aspect-square flex flex-col items-center justify-center gap-0.5 rounded-lg border transition-all
        ${isSelected
          ? "bg-indigo-600 border-indigo-600 text-white shadow-md scale-105"
          : "bg-white border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-900"
        }`}
    >
      <span className="text-xl leading-none font-medium select-none">
        {mode === "hiragana" ? entry.h : entry.k}
      </span>
      <span className={`text-[10px] font-medium ${isSelected ? "text-indigo-200" : "text-gray-400"}`}>
        {entry.r}
      </span>
      {hasExamples && !isSelected && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-400 rounded-full" />
      )}
    </button>
  );
}

function SpeakBtn({ text, small }: { text: string; small?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); speakJapanese(text); }}
      className={`shrink-0 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors ${small ? "p-1.5" : "p-2"}`}
      title="Pronounce"
    >
      <svg className={small ? "w-4 h-4" : "w-5 h-5"} fill="currentColor" viewBox="0 0 24 24">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
      </svg>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function KanaChart({ coverage }: { coverage: Record<string, number> }) {
  const [mode, setMode] = useState<"hiragana" | "katakana">("hiragana");
  const [selected, setSelected] = useState<K | null>(null);
  const [examples, setExamples] = useState<{ words: WordExample[]; sentences: SentenceExample[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"vocab" | "lyrics">("vocab");
  const [playingClip, setPlayingClip] = useState<string | null>(null);

  const handleSelect = useCallback(async (entry: K) => {
    if (selected?.h === entry.h) {
      setSelected(null);
      setExamples(null);
      return;
    }
    setSelected(entry);
    setExamples(null);
    setLoading(true);
    setPlayingClip(null);
    try {
      const res = await fetch(`/api/kana?kana=${encodeURIComponent(entry.h)}`);
      const data = await res.json();
      setExamples(data);
      // Auto-switch to the tab that has content
      if (data.words.length === 0 && data.sentences.length > 0) setTab("lyrics");
      else setTab("vocab");
    } catch {
      setExamples({ words: [], sentences: [] });
    }
    setLoading(false);
  }, [selected]);

  function renderGrid(
    rows: Array<Array<K | null>>,
    colHeaders: string[],
    cols: number
  ) {
    return (
      <div>
        <div className={`grid gap-1.5 mb-1`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {colHeaders.map((c) => (
            <div key={c} className="text-center text-xs text-gray-400 font-medium py-0.5">{c}</div>
          ))}
        </div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {rows.flat().map((entry, i) =>
            entry ? (
              <KanaCell
                key={entry.h}
                entry={entry}
                mode={mode}
                isSelected={selected?.h === entry.h}
                hasExamples={!!(coverage[entry.h] && coverage[entry.h] > 0)}
                onClick={() => handleSelect(entry)}
              />
            ) : (
              <div key={`empty-${i}`} className="aspect-square" />
            )
          )}
        </div>
      </div>
    );
  }

  const vocabCount = examples?.words.length ?? 0;
  const lyricsCount = examples?.sentences.length ?? 0;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">

      {/* ── Left: grid panel ── */}
      <div className="w-full lg:w-[360px] shrink-0 space-y-5">

        {/* Mode tabs */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(["hiragana", "katakana"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize
                  ${mode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                {m}
              </button>
            ))}
          </div>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-2 h-2 bg-emerald-400 rounded-full inline-block shrink-0" />
            has examples in your songs
          </span>
        </div>

        {/* Basic section */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Basic · Gojūon</h2>
          {renderGrid(BASIC, COL_HEADERS_5, 5)}
        </div>

        {/* Voiced section */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Voiced · Dakuten &amp; Semi-voiced</h2>
          {renderGrid(VOICED, COL_HEADERS_5, 5)}
        </div>

        {/* Combinations section */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Combinations · Yōon</h2>
          {renderGrid(YOON as Array<Array<K | null>>, COL_HEADERS_3, 3)}
        </div>
      </div>

      {/* ── Right: details panel ── */}
      <div className="w-full lg:flex-1 lg:sticky lg:top-20">
        {!selected ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 flex flex-col items-center justify-center gap-3 text-center min-h-[300px]">
            <div className="text-7xl text-gray-100 select-none leading-none font-medium">あ</div>
            <p className="text-gray-400 text-sm max-w-xs">
              Click any kana to see vocabulary and lyric examples from your songs
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Kana header */}
            <div className="bg-indigo-600 px-6 py-5 flex items-center gap-5">
              <span className="text-7xl text-white leading-none select-none font-medium">
                {mode === "hiragana" ? selected.h : selected.k}
              </span>
              <div className="space-y-1.5">
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl text-white leading-none">{selected.h}</span>
                  <span className="text-indigo-300 text-lg">·</span>
                  <span className="text-2xl text-indigo-200 leading-none">{selected.k}</span>
                </div>
                <div className="text-sm font-mono font-semibold tracking-widest text-indigo-300 uppercase">
                  {selected.r}
                </div>
              </div>
              <div className="ml-auto">
                <SpeakBtn text={selected.h} />
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
                  {tab === t && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t" />
                  )}
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
                      <div
                        key={i}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group transition-colors"
                      >
                        <div className="shrink-0 w-28">
                          <div className="text-base font-medium text-gray-900 leading-tight">{w.word}</div>
                          <div className="text-xs text-indigo-500 mt-0.5">
                            <Highlight text={w.furigana} word={selected.h} />
                          </div>
                        </div>
                        <div className="flex-1 text-sm text-gray-600 min-w-0">{w.english_meaning}</div>
                        <div className="flex items-center gap-2 shrink-0">
                          {w.part_of_speech && (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${POS_COLORS[w.part_of_speech] ?? POS_COLORS.other}`}>
                              {w.part_of_speech}
                            </span>
                          )}
                          <button
                            onClick={() => speakJapanese(w.word)}
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
                      No vocabulary starting with <span className="text-gray-600 font-medium">{selected.h}</span> in your songs
                    </p>
                    <p className="text-xs text-gray-300 mt-1">Import more songs to grow your examples</p>
                  </div>
                )
              ) : (
                lyricsCount > 0 ? (
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
                                <p className="text-sm text-gray-900 leading-relaxed">
                                  <Highlight text={s.japanese_text} word={selected.h} />
                                </p>
                                {s.english_text && (
                                  <p className="text-xs text-gray-500 italic leading-relaxed mt-0.5">{s.english_text}</p>
                                )}
                                <p className="text-[11px] text-gray-400 mt-0.5">— {s.song_title}</p>
                              </div>
                              <button
                                onClick={() => speakJapanese(s.japanese_text)}
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
                              <ClipPlayer
                                videoId={s.youtube_id}
                                startTime={Number(s.start_time)}
                                endTime={Number(s.end_time)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                    <p className="text-gray-400 text-sm">
                      No lyrics containing <span className="text-gray-600 font-medium">{selected.h}</span>
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import KanaChart from "@/components/kana/KanaChart";
import PinyinChart from "@/components/pinyin/PinyinChart";
import { useLanguage } from "@/lib/language-context";

interface Props {
  kanaCoverage: Record<string, number>;
  pinyinCoverage: Record<string, number>;
}

export default function ReferencePage({ kanaCoverage, pinyinCoverage }: Props) {
  const { language } = useLanguage();

  if (language === "zh") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pinyin Chart</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Learn pinyin initials, finals, and tones — click any syllable to see examples from your songs
          </p>
        </div>
        <PinyinChart coverage={pinyinCoverage} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kana Chart</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Learn hiragana and katakana — click any character to see examples from your songs
        </p>
      </div>
      <KanaChart coverage={kanaCoverage} />
    </div>
  );
}

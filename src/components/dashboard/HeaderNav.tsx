"use client";

import { useLanguage } from "@/lib/language-context";
import { LANGUAGE_LIST, getLanguageConfig } from "@/lib/languages";
import NavStats from "./NavStats";

interface Props {
  isAdmin: boolean;
}

export default function HeaderNav({ isAdmin }: Props) {
  const { language, setLanguage } = useLanguage();
  const langConfig = getLanguageConfig(language);

  return (
    <nav className="flex gap-4 text-sm items-center shrink-0 ml-4">
      <NavStats isAdmin={isAdmin} />
      <span className="w-px h-5 bg-gray-200" />
      <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
        {LANGUAGE_LIST.map((lang) => (
          <button
            key={lang.id}
            onClick={() => setLanguage(lang.id)}
            title={lang.label}
            className={`px-2 py-1 rounded-md text-sm transition-all ${
              language === lang.id ? "bg-white shadow-sm" : "opacity-40 hover:opacity-70"
            }`}
          >
            {lang.flag}
          </button>
        ))}
      </div>
      <span className="w-px h-5 bg-gray-200" />
      <a href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
        Lessons
      </a>
      <a href="/dictionary" className="text-gray-600 hover:text-gray-900 transition-colors">
        Dictionary
      </a>
      <a href="/kana" className="text-gray-600 hover:text-gray-900 transition-colors">
        {langConfig.referenceLabel}
      </a>
      <a href="/grammar" className="text-gray-600 hover:text-gray-900 transition-colors">
        Grammar
      </a>
      {isAdmin && (
        <>
          <a href="/sentence-bank" className="text-gray-600 hover:text-gray-900 transition-colors">
            Sentence Bank
          </a>
          <a href="/admin/lyrics-editor" className="text-gray-600 hover:text-gray-900 transition-colors">
            Lyrics Editor
          </a>
          <a
            href="/import"
            className="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Import song
          </a>
        </>
      )}
    </nav>
  );
}

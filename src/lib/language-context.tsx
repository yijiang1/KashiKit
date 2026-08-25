"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_LANGUAGE, isLanguageId, type LanguageId } from "@/lib/languages";

const STORAGE_KEY = "lyriclearn_language";

type LanguageContextValue = {
  language: LanguageId;
  setLanguage: (language: LanguageId) => void;
};

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageId>(DEFAULT_LANGUAGE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isLanguageId(stored)) setLanguageState(stored);
    } catch {
      // localStorage unavailable (private browsing, etc.) — stay on default
    }
  }, []);

  function setLanguage(next: LanguageId) {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}

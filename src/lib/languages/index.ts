import type { LanguageConfig, LanguageId } from "./types";
import { ja } from "./ja";
import { zh } from "./zh";

export type { LanguageConfig, LanguageId, LevelSystem, LanguageAiConfig } from "./types";

export const LANGUAGES: Record<LanguageId, LanguageConfig> = { ja, zh };

export const LANGUAGE_LIST: LanguageConfig[] = [ja, zh];

export const DEFAULT_LANGUAGE: LanguageId = "ja";

export function getLanguageConfig(id: LanguageId): LanguageConfig {
  return LANGUAGES[id] ?? LANGUAGES[DEFAULT_LANGUAGE];
}

export function isLanguageId(value: unknown): value is LanguageId {
  return value === "ja" || value === "zh";
}

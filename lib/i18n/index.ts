import { dictionaries, type Key } from "./dictionaries";

export type Locale = "en" | "ms" | "zh";
export const locales: Locale[] = ["en", "ms", "zh"];
export const localeNames: Record<Locale, string> = {
  en: "English",
  ms: "Bahasa Melayu",
  zh: "中文",
};
export const LOCALE_COOKIE = "mivo_lang";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ms" || value === "zh";
}

export type Translate = (key: Key, vars?: Record<string, string | number>) => string;

/** Looks up a phrase; falls back to English, then to the key itself. */
export function translator(locale: Locale): Translate {
  const dict = dictionaries[locale];
  const fallback = dictionaries.en;
  return (key, vars) => {
    let text: string = (dict as Record<string, string>)[key] ?? (fallback as Record<string, string>)[key] ?? key;
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll("{" + name + "}", String(value));
      }
    }
    return text;
  };
}

export type { Key };

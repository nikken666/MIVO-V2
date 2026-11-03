import type { Locale } from "./index";

const tags: Record<Locale, string> = { en: "en-MY", ms: "ms-MY", zh: "zh-CN" };

/** Intl locale for dates and times in the shopper's language. */
export function intlTag(locale?: Locale | null): string {
  if (locale) return tags[locale] || "en-MY";
  // Client-side helpers outside React: <html lang> is kept in sync by LanguageProvider.
  if (typeof document !== "undefined") {
    const lang = document.documentElement.lang || "en";
    if (lang.startsWith("zh")) return tags.zh;
    if (lang.startsWith("ms")) return tags.ms;
  }
  return tags.en;
}

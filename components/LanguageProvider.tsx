"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LOCALE_COOKIE,
  translator,
  type Locale,
  type Translate,
} from "@/lib/i18n";

type LanguageContextValue = {
  locale: Locale;
  t: Translate;
  setLocale: (locale: Locale) => void;
};

const LanguageContext = createContext<LanguageContextValue>({
  locale: "en",
  t: translator("en"),
  setLocale: () => {},
});

export default function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      document.cookie =
        LOCALE_COOKIE + "=" + next + "; path=/; max-age=31536000; samesite=lax";
      document.documentElement.lang = next === "zh" ? "zh-Hans" : next;
      // Remember it on the account too, so it follows the customer.
      void (async () => {
        try {
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            await supabase.rpc("profile_update", {
              p_full_name: null,
              p_username: null,
              p_avatar_url: null,
              p_phone: null,
              p_language: next,
            });
          }
        } catch {}
      })();
      // Server-rendered text picks up the new cookie.
      router.refresh();
    },
    [router]
  );

  const value = useMemo(
    () => ({ locale, t: translator(locale), setLocale }),
    [locale, setLocale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useT() {
  return useContext(LanguageContext).t;
}

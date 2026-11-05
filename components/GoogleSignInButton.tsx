"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

// Google's own sign-in button (Google Identity Services). The account chooser then
// names this website instead of the Supabase address, and nothing leaves the page.
// Uses the same Client ID that is in Supabase (Google project "MIVO"). It is public
// (every visitor's browser sees it); NEXT_PUBLIC_GOOGLE_CLIENT_ID overrides it.
const MIVO_GOOGLE_CLIENT_ID = "278353123157-8or8ueaj2sd2539060ehtvsjlro9od0v.apps.googleusercontent.com";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || MIVO_GOOGLE_CLIENT_ID;
// Google only accepts the web addresses listed under "Authorized JavaScript origins"
// (no wildcards). Elsewhere, e.g. a Vercel preview link, use the redirect button.
const ORIGINS = (process.env.NEXT_PUBLIC_GOOGLE_ORIGINS || "https://www.mivoparts.my,https://mivoparts.my,https://mivo-v2.vercel.app,http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
function originAllowed() {
  return typeof window !== "undefined" && ORIGINS.includes(window.location.origin);
}

type GoogleId = {
  initialize: (options: Record<string, unknown>) => void;
  renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript() {
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) return resolve();
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("Google sign-in could not load"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function GoogleSignInButton({
  locale,
  onSignedIn,
  onError,
  fallback,
}: {
  locale: string;
  onSignedIn: () => void;
  onError: (error: unknown) => void;
  /** The redirect button, used when the Client ID isn't set or Google can't load. */
  fallback: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(!CLIENT_ID);
  const handlers = useRef({ onSignedIn, onError });
  handlers.current = { onSignedIn, onError };

  useEffect(() => {
    if (!CLIENT_ID) return;
    if (!originAllowed()) {
      setFailed(true);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!box.current?.childElementCount) setFailed(true);
    }, 8000);

    (async () => {
      try {
        await loadScript();
        const id = window.google?.accounts?.id;
        if (cancelled || !id || !box.current) return;
        const raw = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
        id.initialize({
          client_id: CLIENT_ID,
          nonce: await sha256Hex(raw),
          ux_mode: "popup",
          context: "signin",
          itp_support: true,
          use_fedcm_for_button: true,
          callback: async (response: { credential?: string }) => {
            try {
              if (!response.credential) throw new Error("No Google sign-in");
              const { error } = await createClient().auth.signInWithIdToken({
                provider: "google",
                token: response.credential,
                nonce: raw,
              });
              if (error) throw error;
              handlers.current.onSignedIn();
            } catch (caught) {
              handlers.current.onError(caught);
            }
          },
        });
        box.current.innerHTML = "";
        id.renderButton(box.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          logo_alignment: "center",
          width: Math.min(400, Math.max(220, box.current.offsetWidth || 320)),
          locale: locale === "zh" ? "zh_CN" : locale === "ms" ? "ms" : "en",
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [locale]);

  if (failed) return <>{fallback}</>;
  return <div ref={box} className="mivoGoogleBox" />;
}

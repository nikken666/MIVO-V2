"use client";

import { FormEvent, useEffect, useState } from "react";
import { GIFT_PENDING_KEY } from "@/components/WelcomeGift";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";
import { useLanguage } from "@/components/LanguageProvider";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { friendlyError } from "@/lib/i18n/errors";

type Mode = "login" | "register";

// Apple sign-in needs an Apple Developer account. Set NEXT_PUBLIC_APPLE_SIGN_IN=on in Vercel to show it.
const APPLE_SIGN_IN = process.env.NEXT_PUBLIC_APPLE_SIGN_IN === "on";

export default function LoginPage() {
  const router = useRouter();
  const { t, locale } = useLanguage();

  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [promoOptIn, setPromoOptIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [socialBusy, setSocialBusy] = useState<"" | "google" | "apple">("");

  const [giftPending, setGiftPending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "oauth") {
      setError(t("account.login.oauthFailed"));
    }
    // From the new-customer gift popup: open on "Create account".
    if (params.get("mode") === "register") setMode("register");
    try {
      setGiftPending(Boolean(window.localStorage.getItem(GIFT_PENDING_KEY)));
    } catch {}
  }, [t]);

  function nextPath() {
    const next = new URLSearchParams(window.location.search).get("next") || "";
    return next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  }

  // Google / Apple: one button signs in, or creates the account the first time.
  async function socialSignIn(provider: "google" | "apple") {
    setSocialBusy(provider);
    setError("");
    setMessage("");
    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin + "/auth/callback?next=" + encodeURIComponent(nextPath()),
      },
    });
    if (oauthError) {
      setError(friendlyError(oauthError, t, "account.login.oauthFailed"));
      setSocialBusy("");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const supabase = createClient();

      if (mode === "register") {
        // The confirmation link brings them back to where they came from.
        const callback =
          window.location.origin + "/auth/callback?next=" + encodeURIComponent(nextPath());

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: callback,
            data: { full_name: fullName.trim(), marketing_opt_in: promoOptIn },
          },
        });

        if (signUpError) throw signUpError;

        // No email confirmation needed: they're signed in already.
        if (signUpData.session) {
          router.push(nextPath());
          router.refresh();
          return;
        }

        setMessage(t("account.login.created"));
        setMode("login");
        return;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) throw loginError;

      router.push(nextPath());
      router.refresh();
    } catch (caught) {
      setError(
        friendlyError(caught, t, "account.login.failed")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mivoAuthPage">
      <div className="container mivoAuthShell">
        <section className="mivoAuthVisual">
          <div className="mivoAuthVisualTop">
            <Logo variant="light" className="mivoAuthLogo" />
            <span>{t("account.login.access")}</span>
          </div>

          <div className="mivoAuthVisualCopy">
            <span className="mivoAuthEyebrow">{t("account.login.eyebrow")}</span>
            <h1>
              {t("account.login.heroLine1")}
              <br />
              {t("account.login.heroLine2")}
              <br />
              <em>{t("account.login.heroLine3")}</em>
            </h1>
            <p>
              {t("account.login.heroText")}
            </p>
          </div>

          <div className="mivoAuthBenefits">
            <span>✓ {t("account.login.benefit1")}</span>
            <span>✓ {t("account.login.benefit2")}</span>
            <span>✓ {t("account.login.benefit3")}</span>
          </div>
        </section>

        <section className="mivoAuthFormPanel">
          <div className="mivoAuthFormHead">
            <span>{t("account.login.formEyebrow")}</span>
            <h2>{mode === "login" ? t("account.login.welcomeBack") : t("account.login.createTitle")}</h2>
            <p>
              {mode === "login"
                ? t("account.login.signInText")
                : t("account.login.registerText")}
            </p>
            {giftPending ? <p className="mivoAuthGiftNote">🎁 {t("gift.loginHint")}</p> : null}
          </div>

          <div className="mivoAuthTabs">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setError("");
                setMessage("");
              }}
            >
              {t("account.login.signInTab")}
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setError("");
                setMessage("");
              }}
            >
              {t("account.login.registerTab")}
            </button>
          </div>

          <div className="mivoSocialAuth">
            <GoogleSignInButton
              locale={locale}
              onSignedIn={() => {
                router.push(nextPath());
                router.refresh();
              }}
              onError={(caught) => setError(friendlyError(caught, t, "account.login.oauthFailed"))}
              fallback={
              <button
                type="button"
                className="mivoSocialButton google"
                disabled={Boolean(socialBusy) || busy}
                onClick={() => void socialSignIn("google")}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z" />
                  <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z" />
                  <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9z" />
                  <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
                </svg>
                {socialBusy === "google" ? t("account.login.pleaseWait") : t("account.login.google")}
              </button>
              }
            />
            {APPLE_SIGN_IN ? (
            <button
              type="button"
              className="mivoSocialButton apple"
              disabled={Boolean(socialBusy) || busy}
              onClick={() => void socialSignIn("apple")}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9a4.8 4.8 0 0 0-3.8-2c-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9a5 5 0 0 0-4.2 2.6c-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5a11 11 0 0 0 1.4-2.9 4.5 4.5 0 0 1-2.6-4.1zM13.9 4.9A4.4 4.4 0 0 0 15 1.7a4.6 4.6 0 0 0-3 1.5 4.3 4.3 0 0 0-1.1 3.1c1.1.1 2.3-.6 3-1.4z" />
              </svg>
              {socialBusy === "apple" ? t("account.login.pleaseWait") : t("account.login.apple")}
            </button>
            ) : null}
            <small>{t("account.login.socialNote")}</small>
            <div className="mivoAuthDivider"><span>{t("account.login.orEmail")}</span></div>
          </div>

          <form className="mivoAuthForm" onSubmit={submit}>
            {mode === "register" ? (
              <label>
                <span>{t("account.login.fullName")}</span>
                <input
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder={t("account.login.fullNamePlaceholder")}
                  autoComplete="name"
                />
              </label>
            ) : null}

            <label>
              <span>{t("account.login.email")}</span>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@email.com"
                autoComplete="email"
              />
            </label>

            <label>
              <span>{t("account.login.password")}</span>
              <input
                required
                minLength={8}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("account.login.passwordPlaceholder")}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </label>

            {mode === "register" ? (
              <label className="mivoAuthCheck">
                <input type="checkbox" checked={promoOptIn} onChange={(event) => setPromoOptIn(event.target.checked)} />
                <span>{t("account.login.promoOptIn")}</span>
              </label>
            ) : null}

            {message ? <p className="mivoAuthSuccess">{message}</p> : null}
            {error ? <p className="mivoAuthError">{error}</p> : null}

            <button className="mivoAuthSubmit" type="submit" disabled={busy}>
              <span>
                <small>{mode === "login" ? t("account.login.submitSmallLogin") : t("account.login.submitSmallRegister")}</small>
                {busy
                  ? t("account.login.pleaseWait")
                  : mode === "login"
                    ? t("account.login.signIn")
                    : t("account.login.createAccount")}
              </span>
              <b>→</b>
            </button>
          </form>

          <div className="mivoAuthFinePrint">
            <span>{t("account.login.fine1")}</span>
            <span>{t("account.login.fine2")}</span>
          </div>
        </section>
      </div>
    </main>
  );
}

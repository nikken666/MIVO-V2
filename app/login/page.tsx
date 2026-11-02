"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";
import { useT } from "@/components/LanguageProvider";
import { friendlyError } from "@/lib/i18n/errors";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const t = useT();

  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const supabase = createClient();

      if (mode === "register") {
        const callback =
          window.location.origin + "/auth/callback?next=/account";

        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: callback,
            data: { full_name: fullName.trim() },
          },
        });

        if (signUpError) throw signUpError;

        setMessage(t("account.login.created"));
        setMode("login");
        return;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) throw loginError;

      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next || "/account");
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

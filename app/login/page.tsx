"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/sellers/Seller.module.css";

type Mode = "login" | "register";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();

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
      if (mode === "register") {
        const callback = `${window.location.origin}/auth/callback?next=/sellers`;
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: callback,
            data: { full_name: fullName.trim() },
          },
        });

        if (signUpError) throw signUpError;

        setMessage(
          "Registration submitted. Check your email to confirm the account, then log in."
        );
        setMode("login");
        return;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) throw loginError;

      const next = searchParams.get("next");
      router.push(next === "checkout" ? "/cart" : next || "/sellers");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`container pageShell ${styles.narrowPage}`}>
      <section className={styles.panel}>
        <div className={styles.titleRow}>
          <div>
            <span className={styles.eyebrow}>MIVO ACCOUNT</span>
            <h1>{mode === "login" ? "Login" : "Create account"}</h1>
            <p>
              Customers and sellers use the same account. A seller application is
              completed after login.
            </p>
          </div>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={mode === "login" ? styles.activeTab : ""}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === "register" ? styles.activeTab : ""}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        <form className={styles.form} onSubmit={submit}>
          {mode === "register" && (
            <label>
              <span>Full name</span>
              <input
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your full name"
              />
            </label>
          )}

          <label>
            <span>Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@email.com"
            />
          </label>

          <label>
            <span>Password</span>
            <input
              required
              minLength={8}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 8 characters"
            />
          </label>

          {message && <p className={styles.success}>{message}</p>}
          {error && <p className={styles.error}>{error}</p>}

          <button className="redButton" type="submit" disabled={busy}>
            {busy
              ? "Please wait..."
              : mode === "login"
                ? "Login"
                : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}

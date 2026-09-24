"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();

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

        setMessage(
          "Account created. Check your email to confirm it, then sign in to MIVO."
        );
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
        caught instanceof Error ? caught.message : "Authentication failed."
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
            <span>ACCOUNT ACCESS</span>
          </div>

          <div className="mivoAuthVisualCopy">
            <span className="mivoAuthEyebrow">MIVO CUSTOMER ACCOUNT</span>
            <h1>
              Your garage.
              <br />
              Your orders.
              <br />
              <em>One account.</em>
            </h1>
            <p>
              Save your vehicle, track orders and move through checkout faster.
            </p>
          </div>

          <div className="mivoAuthBenefits">
            <span>✓ Saved vehicle fitment</span>
            <span>✓ Faster checkout</span>
            <span>✓ Order tracking</span>
          </div>
        </section>

        <section className="mivoAuthFormPanel">
          <div className="mivoAuthFormHead">
            <span>MIVO ACCOUNT</span>
            <h2>{mode === "login" ? "Welcome back." : "Create your account."}</h2>
            <p>
              {mode === "login"
                ? "Sign in to continue shopping with your saved MIVO account."
                : "Create one account for orders, garage and delivery details."}
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
              SIGN IN
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
              REGISTER
            </button>
          </div>

          <form className="mivoAuthForm" onSubmit={submit}>
            {mode === "register" ? (
              <label>
                <span>FULL NAME</span>
                <input
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                />
              </label>
            ) : null}

            <label>
              <span>EMAIL ADDRESS</span>
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
              <span>PASSWORD</span>
              <input
                required
                minLength={8}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 8 characters"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </label>

            {message ? <p className="mivoAuthSuccess">{message}</p> : null}
            {error ? <p className="mivoAuthError">{error}</p> : null}

            <button className="mivoAuthSubmit" type="submit" disabled={busy}>
              <span>
                <small>{mode === "login" ? "MIVO ACCOUNT" : "NEW CUSTOMER"}</small>
                {busy
                  ? "PLEASE WAIT..."
                  : mode === "login"
                    ? "SIGN IN"
                    : "CREATE ACCOUNT"}
              </span>
              <b>→</b>
            </button>
          </form>

          <div className="mivoAuthFinePrint">
            <span>Secure account access</span>
            <span>Malaysia customer support</span>
          </div>
        </section>
      </div>
    </main>
  );
}

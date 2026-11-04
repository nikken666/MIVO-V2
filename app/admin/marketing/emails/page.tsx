"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../../Admin.module.css";
import css from "./Emails.module.css";
import AdminSidebar from "@/components/admin/AdminSidebar";

type Status = {
  configured: boolean;
  from: string | null;
  instant: boolean;
  smtp?: { host: string; port: number; user: string | null; passLength: number; passLooksLikeAppPassword: boolean; vercelEnv: string | null };
  dailyLimit: number;
  tablesReady: boolean;
  pending: number | null;
  failed: number | null;
  sent24h: number | null;
  subscribers: number | null;
  campaigns: Array<{ id: string; subject: string; recipients: number; sent: number; created_at: string }>;
  recent: Array<{ kind: string; status: string; recipient: string | null; last_error: string | null; created_at: string; sent_at: string | null }>;
};

const kindLabel: Record<string, string> = {
  order_paid: "Receipt",
  order_cancelled: "Cancelled",
  order_refunded: "Refund",
  parcel_shipped: "Shipped",
  parcel_delivered: "Delivered",
  campaign: "Promotion",
};

const empty = { subject: "", headline: "", body: "", image_url: "", button_text: "Shop now", button_url: "" };

export default function AdminEmailsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{ sent: number; remaining: number } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/email", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) setError(json.error || "Could not load.");
    else setStatus(json);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(action: string, extra: Record<string, unknown> = {}) {
    const response = await fetch("/api/admin/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "Something went wrong.");
    return json;
  }

  async function test() {
    setBusy("test");
    setError("");
    setMessage("");
    try {
      const result = await post("test", { campaign: form });
      setMessage("Test sent to " + result.to + ". Check your inbox (and spam).");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy("");
    }
  }

  // Keep sending in batches while this page is open; the daily check finishes the rest.
  async function sendQueue() {
    let sent = 0;
    for (let round = 0; round < 60; round++) {
      const result = await post("process");
      sent += result.sent || 0;
      setProgress({ sent, remaining: result.remaining || 0 });
      if (!result.remaining || (!result.sent && !result.failed)) break;
    }
  }

  async function send() {
    if (!status?.subscribers) {
      setError("No customers have said yes to promotions yet.");
      return;
    }
    if (!window.confirm(`Send "${form.subject}" to ${status.subscribers} customers?`)) return;
    setBusy("send");
    setError("");
    setMessage("");
    try {
      const result = await post("send", { campaign: form });
      setMessage(`Queued for ${result.recipients} customers. Sending now – keep this page open.`);
      await sendQueue();
      setMessage(`Done for now. ${result.recipients} customers queued.`);
      setForm(empty);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy("");
    }
  }

  async function verify() {
    setBusy("verify");
    setError("");
    setMessage("");
    try {
      const result = await post("verify");
      if (result.ok) setMessage("Gmail accepted the login. Emails can be sent.");
      else setError("Gmail refused the login: " + result.error);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy("");
    }
  }

  async function retry() {
    setBusy("process");
    setError("");
    try {
      await sendQueue();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy("");
    }
  }

  const field = (key: keyof typeof empty) => ({
    value: form[key],
    onChange: (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />
        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>Marketing centre · Emails</span>
              <h1>Customer emails</h1>
              <p>Receipts and delivery updates go out by themselves. Write promotions here for customers who said yes.</p>
            </div>
          </header>

          {status && !status.configured ? (
            <div className={css.setup}>
              <strong>Email isn&apos;t switched on yet</strong>
              <p>
                In Vercel → Settings → Environment Variables add <code>SMTP_USER</code> (your Gmail) and{" "}
                <code>SMTP_PASS</code> (a Gmail App Password), then redeploy.
              </p>
            </div>
          ) : null}
          {status && !status.tablesReady ? (
            <div className={css.setup}>
              <strong>Run supabase/customer-emails.sql in Supabase first.</strong>
            </div>
          ) : null}

          {status ? (
            <div className={css.stats}>
              <div><span>Sending from</span><b>{status.from || "—"}</b></div>
              <div><span>Promotion subscribers</span><b>{status.subscribers ?? "—"}</b></div>
              <div><span>Sent last 24h</span><b>{status.sent24h ?? "—"} / {status.dailyLimit}</b></div>
              <div>
                <span>Waiting · failed</span>
                <b>{status.pending ?? "—"} · {status.failed ?? "—"}</b>
                {status.pending || status.failed ? (
                  <button type="button" onClick={() => void retry()} disabled={Boolean(busy)}>
                    {busy === "process" ? "Sending…" : "Send now"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {status?.smtp ? (
            <div className={css.check}>
              <span>Mail login</span>
              <b>{status.smtp.user || "SMTP_USER missing"}</b>
              <span>
                Password: {status.smtp.passLength} characters
                {status.smtp.passLength
                  ? status.smtp.passLooksLikeAppPassword
                    ? " · looks like a Gmail App Password ✓"
                    : " · not a Gmail App Password (should be 16 letters)"
                  : " · SMTP_PASS missing"}
              </span>
              <span>Vercel: {status.smtp.vercelEnv || "local"} · {status.smtp.host}:{status.smtp.port}</span>
              <button type="button" onClick={() => void verify()} disabled={Boolean(busy)}>
                {busy === "verify" ? "Checking…" : "Check Gmail login"}
              </button>
            </div>
          ) : null}

          {message ? <p className={css.ok}>{message}</p> : null}
          {error ? <p className={css.error}>{error}</p> : null}
          {progress && busy ? <p className={css.hint}>Sent {progress.sent} · {progress.remaining} waiting</p> : null}

          <div className={css.layout}>
            <form className={css.form} onSubmit={(event) => event.preventDefault()}>
              <h2>New promotion</h2>
              <label>Subject line<input {...field("subject")} maxLength={150} placeholder="11.11 sale: up to 30% off brake pads" /></label>
              <label>Headline (optional)<input {...field("headline")} maxLength={150} placeholder="Big savings for your car" /></label>
              <label>
                Message
                <textarea {...field("body")} rows={8} maxLength={6000} placeholder={"Write like you talk to a customer.\n\nA blank line starts a new paragraph."} />
              </label>
              <label>Picture link (optional)<input {...field("image_url")} placeholder="https://…/banner.jpg" /></label>
              <div className={css.row}>
                <label>Button text<input {...field("button_text")} maxLength={40} /></label>
                <label>Button link<input {...field("button_url")} placeholder="https://mivo-v2.vercel.app/products" /></label>
              </div>
              <p className={css.hint}>
                Only customers who ticked “Send me promotions” get this. Every email has an unsubscribe link.
                Gmail sends about {status?.dailyLimit ?? 450} a day; the rest continue the next day.
              </p>
              <div className={css.actions}>
                <button type="button" className={styles.adminSecondaryAction} disabled={Boolean(busy)} onClick={() => void test()}>
                  {busy === "test" ? "Sending…" : "Send me a test"}
                </button>
                <button type="button" className={styles.adminAction} disabled={Boolean(busy) || !form.subject || !form.body} onClick={() => void send()}>
                  {busy === "send" ? "Sending…" : `Send to ${status?.subscribers ?? 0} customers`}
                </button>
              </div>
            </form>

            <aside className={css.preview} aria-label="Preview">
              <div className={css.previewMail}>
                <div className={css.previewTop}>MIVO</div>
                <div className={css.previewBody}>
                  <h3>{form.headline || form.subject || "Your headline"}</h3>
                  <p className={css.previewHi}>Hi Ali,</p>
                  {/^https?:\/\//.test(form.image_url) ? <img src={form.image_url} alt="" /> : null}
                  {(form.body || "Your message shows here.").split(/\n{2,}/).map((block, index) => (
                    <p key={index}>{block}</p>
                  ))}
                  {form.button_text && form.button_url ? <span className={css.previewButton}>{form.button_text}</span> : null}
                  <small>Unsubscribe from promotions</small>
                </div>
              </div>
            </aside>
          </div>

          {status?.campaigns.length ? (
            <section className={css.list}>
              <h2>Sent promotions</h2>
              {status.campaigns.map((c) => (
                <div key={c.id}>
                  <strong>{c.subject}</strong>
                  <span>{new Date(c.created_at).toLocaleString("en-MY")}</span>
                  <span>{c.sent} / {c.recipients} sent</span>
                </div>
              ))}
            </section>
          ) : null}

          {status?.recent.length ? (
            <section className={css.list}>
              <h2>Latest emails</h2>
              {status.recent.map((r, index) => (
                <div key={index}>
                  <strong>{kindLabel[r.kind] || r.kind}</strong>
                  <span>{r.recipient || "—"}</span>
                  <span className={css["s_" + r.status]}>{r.status}</span>
                  <span>{new Date(r.sent_at || r.created_at).toLocaleString("en-MY")}</span>
                  {r.last_error ? <small>{r.last_error}</small> : null}
                </div>
              ))}
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import styles from "../Admin.module.css";

type Check = { group: string; name: string; ok: boolean; warn?: boolean; detail: string; fix?: string };
type Result = { environment: string; commit: string | null; branch: string | null; checkedAt: string; checks: Check[] };

/** MIVO admin: which settings this deployment has. */
export default function SystemCheckPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/system-check", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/login?next=/admin/system-check";
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Check failed.");
      setResult(data as Result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Check failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = result ? [...new Set(result.checks.map((c) => c.group))] : [];
  const failing = result?.checks.filter((c) => !c.ok).length || 0;

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />
        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>Setup</span>
              <h1>System check</h1>
              <p>What this deployment has set up. Secret values are never shown, only whether they work.</p>
            </div>
          </header>

          {error ? <p role="alert">{error}</p> : null}

          {result ? (
            <p className={styles.adminNotice}>
              Environment <strong>{result.environment}</strong>
              {result.branch ? " · " + result.branch : ""}
              {result.commit ? " · " + result.commit : ""} ·{" "}
              {failing ? <strong style={{ color: "#b42318" }}>{failing} to fix</strong> : <strong style={{ color: "#067647" }}>All good</strong>}{" "}
              <button type="button" className={styles.adminSecondaryAction} disabled={busy} onClick={() => void load()} style={{ marginLeft: 8 }}>
                {busy ? "Checking…" : "Check again"}
              </button>
            </p>
          ) : busy ? (
            <p>Checking…</p>
          ) : null}

          {groups.map((group) => (
            <section key={group} className={styles.adminPanel} style={{ marginTop: 16 }}>
              <h2>{group}</h2>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {result!.checks
                  .filter((c) => c.group === group)
                  .map((c) => (
                    <li key={c.name} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: "1px solid #eef0f1" }}>
                      <span aria-hidden style={{ fontSize: 18, lineHeight: "20px" }}>{!c.ok ? "❌" : c.warn ? "⚠️" : "✅"}</span>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: 14 }}>{c.name}</strong>
                        <div style={{ fontSize: 13, color: "#555", overflowWrap: "anywhere" }}>{c.detail}</div>
                        {(!c.ok || c.warn) && c.fix ? <div style={{ fontSize: 12, color: "#b42318", marginTop: 2 }}>{c.fix}</div> : null}
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </section>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import styles from "@/app/admin/Admin.module.css";

type Status = {
  configured: boolean;
  ready: boolean;
  connected: boolean;
  connectedAt?: string | null;
  refreshExpiresAt?: string | null;
  balance: number | null;
  walletError: string | null;
  error?: string;
};

/** MIVO admin: EasyParcel connection, wallet balance and the connect button. */
export default function EasyParcelStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("easyparcel");
    if (result) setNotice(result === "connected" ? "EasyParcel connected." : "EasyParcel: " + result);
    void fetch("/api/easyparcel/status")
      .then((r) => r.json())
      .then((data) => setStatus(data as Status))
      .catch(() => setStatus(null));
  }, []);

  return (
    <section className={styles.adminPanel}>
      <h2>EasyParcel (shipping labels)</h2>
      {notice ? <p>{notice}</p> : null}
      {!status ? (
        <p>Checking…</p>
      ) : !status.configured ? (
        <p className={styles.adminNotice}>
          Add EASYPARCEL_CLIENT_ID, EASYPARCEL_CLIENT_SECRET and EASYPARCEL_WEBHOOK_KEY in Vercel → Environment Variables, then redeploy.
        </p>
      ) : !status.ready ? (
        <p className={styles.adminNotice}>Run supabase/easyparcel.sql in Supabase first.</p>
      ) : status.connected ? (
        <p className={styles.adminNotice}>
          Connected{status.connectedAt ? " since " + new Date(status.connectedAt).toLocaleDateString("en-MY") : ""}.
          {status.balance != null ? " Wallet balance: RM " + status.balance.toFixed(2) + "." : ""}
          {status.walletError ? " (" + status.walletError + ")" : ""} Shops can now book couriers and print labels from their orders.{" "}
          <a href="/api/easyparcel/connect">Reconnect</a>
        </p>
      ) : (
        <p className={styles.adminNotice}>
          Not connected. Connect MIVO&apos;s EasyParcel account (choose the Demo account to test, Live to go live).{" "}
          <a className={styles.adminAction} href="/api/easyparcel/connect">
            Connect EasyParcel
          </a>
        </p>
      )}
    </section>
  );
}

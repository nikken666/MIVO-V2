"use client";

import { Fragment, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../../Admin.module.css";
import ui from "../../store-health/StoreHealth.module.css";
import AdminSidebar from "@/components/admin/AdminSidebar";

type Application = {
  id: string;
  seller_id: string;
  seller_type: "individual" | "business";
  legal_name: string;
  ic_number: string | null;
  business_reg_no: string | null;
  tin: string | null;
  sst_no: string | null;
  phone: string;
  email: string | null;
  business_address: string;
  pickup_address: Record<string, string> | null;
  bank_name: string;
  bank_account_name: string;
  bank_account_no: string;
  documents: Record<string, string> | null;
  categories: string | null;
  status: "submitted" | "more_info" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  sellers: { shop_name: string } | null;
};

const statusLabel: Record<Application["status"], string> = {
  submitted: "Waiting for review",
  more_info: "Asked for more info",
  approved: "Approved",
  rejected: "Rejected",
};

const docLabel: Record<string, string> = {
  ic_front: "IC (front)",
  ic_back: "IC (back)",
  ssm: "SSM certificate",
  bank_statement: "Bank statement",
};

const filters = ["submitted", "more_info", "approved", "rejected", "all"] as const;

export default function SellerApplicationsPage() {
  const [rows, setRows] = useState<Application[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]>("submitted");
  const [openId, setOpenId] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        window.location.assign("/login?next=/admin/shops/applications");
        return;
      }
      const { data: isAdmin } = await client.rpc("is_admin");
      if (!isAdmin) {
        window.location.assign("/admin");
        return;
      }
      const { data, error: loadError } = await client
        .from("seller_applications")
        .select("*, sellers(shop_name)")
        .order("updated_at", { ascending: false });
      if (loadError) {
        throw new Error(
          "Seller applications are not available yet. Run supabase/seller-onboarding.sql in Supabase first. (" +
            loadError.message + ")"
        );
      }
      setRows((data as Application[] | null) || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load applications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Private documents: create short-lived links when an application is opened.
  async function open(app: Application) {
    if (openId === app.id) {
      setOpenId(null);
      return;
    }
    setOpenId(app.id);
    setNote(app.admin_note || "");
    setLinks({});
    const entries = Object.entries(app.documents || {}).filter(([, path]) => typeof path === "string" && path);
    const signed: Record<string, string> = {};
    await Promise.all(
      entries.map(async ([slot, path]) => {
        const { data } = await createClient().storage.from("seller-documents").createSignedUrl(path, 600);
        if (data?.signedUrl) signed[slot] = data.signedUrl;
      })
    );
    setLinks(signed);
  }

  async function review(app: Application, decision: "approved" | "rejected" | "more_info") {
    setError("");
    setMessage("");
    if (decision !== "approved" && !note.trim()) {
      setError("Write a note for the seller first — tell them what to fix or why.");
      return;
    }
    setBusy(true);
    const { error: reviewError } = await createClient().rpc("admin_review_application", {
      p_id: app.id,
      p_decision: decision,
      p_note: note,
    });
    setBusy(false);
    if (reviewError) {
      setError(reviewError.message);
      return;
    }
    const shop = app.sellers?.shop_name || "the shop";
    setMessage(
      decision === "approved"
        ? shop + " is approved. The seller can now use Seller Centre."
        : decision === "rejected"
          ? shop + " was rejected. The seller sees your note."
          : "Sent back to the seller to fix: " + note
    );
    setOpenId(null);
    await load();
  }

  const shown = rows.filter((row) => filter === "all" || row.status === filter);
  const count = (status: string) => rows.filter((row) => row.status === status).length;
  const pickup = (value: Record<string, string> | null) =>
    value ? [value.name, value.phone, value.line, value.postcode, value.city, value.state].filter(Boolean).join(", ") : "—";

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>MIVO store control · Marketplace</span>
              <h1>Seller applications</h1>
              <p>Check each new seller&apos;s identity, business registration and bank account before their shop opens.</p>
            </div>
            <a className={styles.adminAction} href="/admin/shops">All shops</a>
          </header>

          <section className={styles.adminPanel}>
            <div className={ui.cards}>
              <div className={ui.card}><small>To review</small><strong>{loading ? "—" : count("submitted")}</strong><span>New or resubmitted</span></div>
              <div className={ui.card}><small>Waiting on seller</small><strong>{loading ? "—" : count("more_info")}</strong><span>Asked for more info</span></div>
              <div className={ui.card}><small>Approved</small><strong>{loading ? "—" : count("approved")}</strong><span>Shops opened</span></div>
              <div className={ui.card}><small>Rejected</small><strong>{loading ? "—" : count("rejected")}</strong><span>Not accepted</span></div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "0 0 14px" }}>
              {filters.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={filter === value ? styles.adminAction : undefined}
                  onClick={() => setFilter(value)}
                >
                  {value === "all" ? "All" : statusLabel[value]}
                </button>
              ))}
            </div>

            {error ? <p role="alert">{error}</p> : null}
            {message ? <p>{message}</p> : null}

            {loading ? (
              <p>Loading applications…</p>
            ) : shown.length === 0 ? (
              <p>No applications here.</p>
            ) : (
              <div className={ui.tableWrap}>
                <table className={ui.table}>
                  <thead>
                    <tr><th>Shop</th><th>Seller</th><th>Type</th><th>Phone</th><th>Sent</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {shown.map((app) => (
                      <Fragment key={app.id}>
                        <tr>
                          <td>{app.sellers?.shop_name || "—"}</td>
                          <td>{app.legal_name}<br /><small>{app.email}</small></td>
                          <td>{app.seller_type === "business" ? "Business" : "Individual"}</td>
                          <td>{app.phone}</td>
                          <td>{new Date(app.updated_at).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })}</td>
                          <td>{statusLabel[app.status]}</td>
                          <td>
                            <button type="button" onClick={() => void open(app)}>{openId === app.id ? "Close" : "Review"}</button>
                          </td>
                        </tr>
                        {openId === app.id ? (
                          <tr>
                            <td colSpan={7}>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, padding: "8px 0" }}>
                                <div>
                                  <strong>Identity</strong>
                                  <p>
                                    Legal name: {app.legal_name}<br />
                                    {app.seller_type === "business"
                                      ? <>SSM no.: {app.business_reg_no || "—"}<br /></>
                                      : <>IC no.: {app.ic_number || "—"}<br /></>}
                                    TIN: {app.tin || "—"}<br />
                                    SST: {app.sst_no || "—"}
                                  </p>
                                  <strong>Sells</strong>
                                  <p>{app.categories || "—"}</p>
                                </div>
                                <div>
                                  <strong>Addresses</strong>
                                  <p>
                                    Business: {app.business_address}<br />
                                    Pickup: {pickup(app.pickup_address)}
                                  </p>
                                  <strong>Bank (payouts)</strong>
                                  <p>
                                    {app.bank_name}<br />
                                    {app.bank_account_name}<br />
                                    {app.bank_account_no}
                                  </p>
                                  {app.bank_account_name.trim().toLowerCase() !== app.legal_name.trim().toLowerCase() ? (
                                    <p role="alert">Bank account name is different from the legal name — check the statement.</p>
                                  ) : null}
                                </div>
                                <div>
                                  <strong>Documents</strong>
                                  <ul>
                                    {Object.keys(app.documents || {}).length === 0 ? <li>None uploaded</li> : null}
                                    {Object.keys(app.documents || {}).map((slot) => (
                                      <li key={slot}>
                                        {links[slot]
                                          ? <a href={links[slot]} target="_blank" rel="noreferrer">{docLabel[slot] || slot} ↗</a>
                                          : <>{docLabel[slot] || slot} (opening…)</>}
                                      </li>
                                    ))}
                                  </ul>
                                  <small>Links work for 10 minutes.</small>
                                </div>
                              </div>
                              <label className={styles.adminField} style={{ display: "block" }}>
                                <span>Note to the seller (needed to reject or ask for more info)</span>
                                <textarea
                                  rows={3}
                                  style={{ width: "100%" }}
                                  value={note}
                                  onChange={(event) => setNote(event.target.value)}
                                  placeholder="e.g. The IC photo is blurry, please upload a clearer one."
                                />
                              </label>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "0 0 14px" }}>
                                <button type="button" className={styles.adminAction} disabled={busy} onClick={() => void review(app, "approved")}>
                                  Approve and open shop
                                </button>
                                <button type="button" disabled={busy} onClick={() => void review(app, "more_info")}>
                                  Ask for more info
                                </button>
                                <button type="button" disabled={busy} onClick={() => void review(app, "rejected")}>
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

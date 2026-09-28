"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../Admin.module.css";

type ClaimStatus =
  | "new"
  | "reviewing"
  | "approved"
  | "rejected"
  | "completed";

type ClaimRow = {
  id: string;
  claim_number: string;
  user_id: string;
  order_number: string;
  product_name: string;
  variant_name: string | null;
  warranty_months: number;
  warranty_start_at: string;
  warranty_expires_at: string;
  issue_type: string;
  description: string;
  image_urls: string[];
  display_image_urls?: string[];
  status: ClaimStatus;
  admin_note: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type ClaimView = ClaimRow & {
  customer?: ProfileRow;
};

type TabKey = "all" | ClaimStatus;

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "all", label: "ALL" },
  { key: "new", label: "NEW" },
  { key: "reviewing", label: "REVIEWING" },
  { key: "approved", label: "APPROVED" },
  { key: "rejected", label: "REJECTED" },
  { key: "completed", label: "COMPLETED" },
];

function label(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<ClaimView[]>([]);
  const [tab, setTab] = useState<TabKey>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState<ClaimStatus>("new");
  const [adminNote, setAdminNote] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadClaims() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login?next=/admin/claims";
      return;
    }

    const { data: isAdmin, error: adminError } = await supabase.rpc(
      "is_admin"
    );

    if (adminError) throw adminError;

    if (!isAdmin) {
      window.location.href = "/";
      return;
    }

    const { data: claimData, error: claimError } = await supabase
      .from("warranty_claims")
      .select(
        "id, claim_number, user_id, order_number, product_name, variant_name, warranty_months, warranty_start_at, warranty_expires_at, issue_type, description, image_urls, status, admin_note, resolution_note, created_at, updated_at"
      )
      .order("created_at", { ascending: false });

    if (claimError) throw claimError;

    const baseClaims = (claimData as ClaimRow[] | null) || [];
    const userIds = Array.from(
      new Set(baseClaims.map((claim) => claim.user_id).filter(Boolean))
    );

    const profileResult = userIds.length
      ? await supabase
          .from("profiles")
          .select("id, full_name, email, phone")
          .in("id", userIds)
      : { data: [], error: null };

    if (profileResult.error) throw profileResult.error;

    const profiles = new Map(
      ((profileResult.data as ProfileRow[] | null) || []).map((profile) => [
        profile.id,
        profile,
      ])
    );

    const privatePaths = Array.from(
      new Set(
        baseClaims
          .flatMap((claim) => claim.image_urls || [])
          .filter((url) => url && !url.startsWith("http"))
      )
    );
    const signedMap = new Map<string, string>();

    if (privatePaths.length > 0) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from("warranty-claim-images")
        .createSignedUrls(privatePaths, 3600);

      if (signedError) throw signedError;

      (signedData || []).forEach((item, index) => {
        if (item.signedUrl) {
          signedMap.set(privatePaths[index], item.signedUrl);
        }
      });
    }

    const next = baseClaims.map((claim) => ({
      ...claim,
      customer: profiles.get(claim.user_id),
      display_image_urls: (claim.image_urls || [])
        .map((url) =>
          url.startsWith("http") ? url : signedMap.get(url) || ""
        )
        .filter(Boolean),
    }));

    setClaims(next);

    const params = new URLSearchParams(window.location.search);
    const requestedClaim = params.get("claim") || "";

    if (requestedClaim && next.some((claim) => claim.id === requestedClaim)) {
      setSelectedId(requestedClaim);
    } else if (!selectedId && next[0]) {
      setSelectedId(next[0].id);
    }
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        await loadClaims();
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error ? caught.message : "Unable to load claims."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return claims.filter((claim) => {
      if (tab !== "all" && claim.status !== tab) return false;

      if (!normalized) return true;

      return (
        claim.claim_number.toLowerCase().includes(normalized) ||
        claim.order_number.toLowerCase().includes(normalized) ||
        claim.product_name.toLowerCase().includes(normalized) ||
        claim.customer?.full_name?.toLowerCase().includes(normalized) ||
        claim.customer?.email?.toLowerCase().includes(normalized)
      );
    });
  }, [claims, query, tab]);

  const counts = useMemo(
    () =>
      claims.reduce<Record<ClaimStatus, number>>(
        (result, claim) => {
          result[claim.status] += 1;
          return result;
        },
        {
          new: 0,
          reviewing: 0,
          approved: 0,
          rejected: 0,
          completed: 0,
        }
      ),
    [claims]
  );

  const selected = useMemo(
    () => claims.find((claim) => claim.id === selectedId) || null,
    [claims, selectedId]
  );

  useEffect(() => {
    if (!selected) return;
    setStatus(selected.status);
    setAdminNote(selected.admin_note || "");
    setResolutionNote(selected.resolution_note || "");
    setMessage("");
    setError("");
  }, [selectedId]);

  async function saveClaim() {
    if (!selected) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.rpc(
        "admin_update_warranty_claim",
        {
          p_claim_id: selected.id,
          p_status: status,
          p_admin_note: adminNote.trim() || null,
          p_resolution_note: resolutionNote.trim() || null,
        }
      );

      if (updateError) throw updateError;

      await loadClaims();
      setMessage("Warranty claim updated.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to update claim."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <aside className={styles.adminSidebar}>
          <a href="/admin" className={styles.adminBrand}>
            <span>MIVO</span>
            <small>STORE CONTROL</small>
          </a>

          <nav className={styles.adminSideNav}>
            <a href="/admin"><span>01</span>Dashboard</a>
            <a href="/admin/orders"><span>02</span>Orders</a>
            <a href="/admin/arrange-shipment"><span>03</span>Arrange Shipment</a>
            <a href="/admin/claims" className={styles.active}><span>04</span>Claims</a>
            <a href="/admin/promotions"><span>05</span>Promotions</a>
            <a href="/admin/discounts"><span>06</span>Discounts</a>
            <a href="/admin/products"><span>07</span>Products</a>
            <a href="/admin/products/new"><span>08</span>Add Product</a>
            <a href="/admin/shipping"><span>09</span>Shipping</a>
          </nav>

          <div className={styles.adminSidebarFoot}>
            <span>STORE MODE</span>
            <strong>MIVO DIRECT</strong>
            <a href="/">OPEN STOREFRONT ↗</a>
          </div>
        </aside>

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>
                AFTER-SALES CONTROL
              </span>
              <h1>Warranty Claims</h1>
              <p>Review customer evidence and manage warranty outcomes.</p>
            </div>

            <div className={styles.adminHeaderActions}>
              <div className={styles.adminAttention}>
                <span>OPEN CLAIMS</span>
                <strong>
                  {loading
                    ? "—"
                    : counts.new + counts.reviewing + counts.approved}
                </strong>
              </div>
            </div>
          </header>

          {error ? <p className={styles.adminError}>{error}</p> : null}
          {message ? <p className={styles.adminNotice}>{message}</p> : null}

          <div className={styles.claimTabs}>
            {tabs.map((item) => (
              <button
                type="button"
                key={item.key}
                className={tab === item.key ? styles.active : ""}
                onClick={() => setTab(item.key)}
              >
                <span>{item.label}</span>
                <strong>
                  {item.key === "all"
                    ? claims.length
                    : counts[item.key as ClaimStatus]}
                </strong>
              </button>
            ))}
          </div>

          <section className={styles.adminPanel}>
            <div className={styles.claimToolbar}>
              <label>
                <span>SEARCH CLAIM</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Claim no., order, product or customer"
                />
              </label>
              <div>
                <span>RESULTS</span>
                <strong>{filtered.length}</strong>
              </div>
            </div>

            {loading ? (
              <p className={styles.adminNotice}>Loading warranty claims...</p>
            ) : filtered.length === 0 ? (
              <div className={styles.adminEmptyState}>
                <strong>No warranty claims found.</strong>
                <span>New customer claims will appear here.</span>
              </div>
            ) : (
              <div className={styles.claimWorkspace}>
                <div className={styles.claimList}>
                  {filtered.map((claim) => (
                    <button
                      type="button"
                      className={
                        styles.claimListItem +
                        (selectedId === claim.id
                          ? " " + styles.selected
                          : "")
                      }
                      onClick={() => setSelectedId(claim.id)}
                      key={claim.id}
                    >
                      <div>
                        <span>{claim.claim_number}</span>
                        <strong>{claim.product_name}</strong>
                        <small>
                          {claim.customer?.full_name ||
                            claim.customer?.email ||
                            "MIVO CUSTOMER"}{" "}
                          · {dateLabel(claim.created_at)}
                        </small>
                      </div>
                      <b
                        className={
                          styles.adminStatus +
                          " " +
                          styles["claim_" + claim.status]
                        }
                      >
                        {label(claim.status)}
                      </b>
                    </button>
                  ))}
                </div>

                {selected ? (
                  <div className={styles.claimDetail}>
                    <div className={styles.claimDetailHead}>
                      <div>
                        <span>CLAIM {selected.claim_number}</span>
                        <h2>{selected.product_name}</h2>
                        <p>
                          Order {selected.order_number}
                          {selected.variant_name
                            ? " · " + selected.variant_name
                            : ""}
                        </p>
                      </div>
                      <b
                        className={
                          styles.adminStatus +
                          " " +
                          styles["claim_" + selected.status]
                        }
                      >
                        {label(selected.status)}
                      </b>
                    </div>

                    <div className={styles.claimMetaGrid}>
                      <div>
                        <span>CUSTOMER</span>
                        <strong>
                          {selected.customer?.full_name || "MIVO CUSTOMER"}
                        </strong>
                        <small>{selected.customer?.email || "—"}</small>
                        <small>{selected.customer?.phone || "—"}</small>
                      </div>
                      <div>
                        <span>ISSUE</span>
                        <strong>{label(selected.issue_type)}</strong>
                        <small>{dateLabel(selected.created_at)}</small>
                      </div>
                      <div>
                        <span>WARRANTY</span>
                        <strong>{selected.warranty_months} MONTHS</strong>
                        <small>
                          Expires {dateLabel(selected.warranty_expires_at)}
                        </small>
                      </div>
                    </div>

                    <div className={styles.claimDescription}>
                      <span>CUSTOMER DESCRIPTION</span>
                      <p>{selected.description}</p>
                    </div>

                    {(selected.display_image_urls || []).length > 0 ? (
                      <div className={styles.claimEvidence}>
                        <span>EVIDENCE</span>
                        <div>
                          {(selected.display_image_urls || []).map((url) => (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              key={url}
                            >
                              <img src={url} alt="Warranty claim evidence" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className={styles.claimAdminForm}>
                      <label>
                        <span>STATUS</span>
                        <select
                          value={status}
                          onChange={(event) =>
                            setStatus(event.target.value as ClaimStatus)
                          }
                        >
                          <option value="new">NEW</option>
                          <option value="reviewing">REVIEWING</option>
                          <option value="approved">APPROVED</option>
                          <option value="rejected">REJECTED</option>
                          <option value="completed">COMPLETED</option>
                        </select>
                      </label>

                      <label>
                        <span>CUSTOMER UPDATE</span>
                        <textarea
                          rows={4}
                          value={adminNote}
                          onChange={(event) =>
                            setAdminNote(event.target.value)
                          }
                          placeholder="Message visible to the customer, e.g. inspection required."
                        />
                      </label>

                      <label>
                        <span>RESOLUTION</span>
                        <textarea
                          rows={4}
                          value={resolutionNote}
                          onChange={(event) =>
                            setResolutionNote(event.target.value)
                          }
                          placeholder="Final outcome, replacement, refund or claim result."
                        />
                      </label>

                      <div className={styles.claimAdminActions}>
                        <a
                          href={
                            "/admin/orders?order=" +
                            encodeURIComponent(selected.order_number)
                          }
                          className={styles.adminSecondaryAction}
                        >
                          VIEW ORDER
                        </a>
                        <button
                          type="button"
                          className={styles.adminAction}
                          disabled={busy}
                          onClick={() => void saveClaim()}
                        >
                          {busy ? "SAVING..." : "SAVE CLAIM"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

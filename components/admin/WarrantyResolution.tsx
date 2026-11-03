"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/admin/Admin.module.css";

type Resolution = {
  id: string;
  status: string;
  resolution_type: "replace" | "repair" | "refund" | null;
  resolution_stage: string | null;
  needs_return: boolean;
  return_courier: string | null;
  return_tracking: string | null;
  replacement_courier: string | null;
  replacement_tracking: string | null;
  refund_amount: number | string | null;
};

type ClaimEvent = { id: string; actor: string; action: string; note: string | null; created_at: string };

const stageLabel: Record<string, string> = {
  awaiting_return: "Waiting for the customer to send the part back",
  returning: "Part on its way back to MIVO",
  to_ship: "Ready to send the replacement / repaired part",
  shipped: "Sent to the customer · waiting for them to confirm",
  refund_pending: "Ready to refund",
  refunded: "Refunded",
  done: "Done · customer received it",
};

const actionLabel: Record<string, string> = {
  resolution_replace: "MIVO will replace the part",
  resolution_repair: "MIVO will repair the part",
  resolution_refund: "MIVO will refund",
  shipped_back: "Customer sent the part back",
  item_received: "MIVO received the part",
  replacement_shipped: "MIVO sent the part",
  received: "Customer received it",
  refunded: "Refunded",
};

const typeLabel = { replace: "Replacement", repair: "Repair", refund: "Refund" } as const;

/** MIVO back office: resolve an approved warranty claim and track each step. */
export default function WarrantyResolution({ claimId, onChanged }: { claimId: string; onChanged: () => void }) {
  const [row, setRow] = useState<Resolution | null>(null);
  const [events, setEvents] = useState<ClaimEvent[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [type, setType] = useState<"replace" | "repair" | "refund">("replace");
  const [needsReturn, setNeedsReturn] = useState(true);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("warranty_claims")
      .select(
        "id, status, resolution_type, resolution_stage, needs_return, return_courier, return_tracking, replacement_courier, replacement_tracking, refund_amount"
      )
      .eq("id", claimId)
      .maybeSingle();
    if (loadError) {
      setUnavailable(true);
      return;
    }
    setRow(data as Resolution | null);
    const { data: ev } = await supabase
      .from("warranty_claim_events")
      .select("id, actor, action, note, created_at")
      .eq("claim_id", claimId)
      .order("created_at");
    setEvents((ev as ClaimEvent[] | null) || []);
  }, [claimId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, done: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: rpcError } = await fn();
      if (rpcError) throw new Error(rpcError.message);
      setMessage(done);
      setCourier("");
      setTracking("");
      await load();
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function refund() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/warranty/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: claimId }),
      });
      const data = (await response.json()) as { error?: string; amount?: number };
      if (!response.ok) throw new Error(data.error || "Refund failed.");
      setMessage("Refunded RM " + Number(data.amount || 0).toFixed(2) + " to the customer's original payment method.");
      await load();
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Refund failed.");
    } finally {
      setBusy(false);
    }
  }

  if (unavailable) {
    return <p className={styles.adminNotice}>Run supabase/warranty-resolution.sql to track replacements and refunds.</p>;
  }
  if (!row || !["approved", "completed"].includes(row.status)) return null;

  const rpc = (name: string, args: Record<string, unknown>) => () => createClient().rpc(name, args);
  const stage = row.resolution_stage;

  return (
    <div className={styles.returnsActions}>
      <h3>After approval</h3>
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      {!stage ? (
        <>
          <label>
            <span>How will MIVO resolve it?</span>
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="replace">Send a replacement part</option>
              <option value="repair">Repair and send it back</option>
              <option value="refund">Refund the customer</option>
            </select>
          </label>
          <label className={styles.returnsCheck}>
            <input type="checkbox" checked={needsReturn} onChange={(e) => setNeedsReturn(e.target.checked)} /> Customer must send the faulty part back first
          </label>
          {type === "refund" ? (
            <label>
              <span>Refund amount (RM, up to what they paid for this item)</span>
              <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
          ) : null}
          <label>
            <span>Note to the customer</span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please send the shock absorber to our Shah Alam warehouse." />
          </label>
          <button
            type="button"
            className={styles.adminAction}
            disabled={busy || (type === "refund" && !(Number(amount) > 0))}
            onClick={() =>
              void run(
                rpc("admin_warranty_set_resolution", {
                  p_claim_id: claimId,
                  p_type: type,
                  p_needs_return: needsReturn,
                  p_refund_amount: type === "refund" ? Number(amount) : null,
                  p_note: note || null,
                }),
                "Saved. The customer can see the next step."
              )
            }
          >
            Confirm resolution
          </button>
        </>
      ) : (
        <p className={styles.adminNotice}>
          <strong>{row.resolution_type ? typeLabel[row.resolution_type] : ""}</strong> · {stageLabel[stage] || stage}
          {row.resolution_type === "refund" && row.refund_amount != null ? " · RM " + Number(row.refund_amount).toFixed(2) : ""}
        </p>
      )}

      {row.return_tracking ? (
        <p>
          Part sent back with {row.return_courier} · {row.return_tracking}
        </p>
      ) : null}

      {stage === "awaiting_return" || stage === "returning" ? (
        <button
          type="button"
          className={styles.adminSecondaryAction}
          disabled={busy}
          onClick={() => void run(rpc("admin_warranty_item_received", { p_claim_id: claimId, p_note: null }), "Marked as received.")}
        >
          Part received at MIVO
        </button>
      ) : null}

      {stage === "to_ship" ? (
        <>
          <label>
            <span>Courier</span>
            <input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="e.g. Pos Laju" />
          </label>
          <label>
            <span>Tracking number</span>
            <input value={tracking} onChange={(e) => setTracking(e.target.value)} />
          </label>
          <button
            type="button"
            className={styles.adminAction}
            disabled={busy || !courier.trim() || !tracking.trim()}
            onClick={() =>
              void run(
                rpc("admin_warranty_ship_replacement", { p_claim_id: claimId, p_courier: courier, p_tracking: tracking }),
                "Sent. The customer can track it."
              )
            }
          >
            Mark sent to customer
          </button>
        </>
      ) : null}

      {row.replacement_tracking ? (
        <p>
          Sent to customer with {row.replacement_courier} · {row.replacement_tracking}
        </p>
      ) : null}

      {stage === "refund_pending" ? (
        <button type="button" className={styles.adminAction} disabled={busy} onClick={() => void refund()}>
          Refund RM {Number(row.refund_amount || 0).toFixed(2)} via Stripe
        </button>
      ) : null}

      {events.length ? (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          {events.map((event) => (
            <li key={event.id}>
              {new Date(event.created_at).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
              {actionLabel[event.action] || event.action}
              {event.note ? " — " + event.note : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

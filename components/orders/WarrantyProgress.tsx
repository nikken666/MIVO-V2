"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/LanguageProvider";
import type { Key } from "@/lib/i18n";
import { friendlyError } from "@/lib/i18n/errors";
import { intlTag } from "@/lib/i18n/format";

type Progress = {
  resolution_type: "replace" | "repair" | "refund" | null;
  resolution_stage: string | null;
  needs_return: boolean;
  return_courier: string | null;
  return_tracking: string | null;
  replacement_courier: string | null;
  replacement_tracking: string | null;
  refund_amount: number | string | null;
};
type ClaimEvent = { id: string; action: string; note: string | null; created_at: string };

/** Customer: what happens next with an approved warranty claim (supabase/warranty-resolution.sql). */
export default function WarrantyProgress({ claimId }: { claimId: string }) {
  const t = useT();
  const [row, setRow] = useState<Progress | null>(null);
  const [events, setEvents] = useState<ClaimEvent[]>([]);
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("warranty_claims")
      .select(
        "resolution_type, resolution_stage, needs_return, return_courier, return_tracking, replacement_courier, replacement_tracking, refund_amount"
      )
      .eq("id", claimId)
      .maybeSingle();
    if (loadError) return; // not set up yet
    setRow(data as Progress | null);
    const { data: ev } = await supabase
      .from("warranty_claim_events")
      .select("id, action, note, created_at")
      .eq("claim_id", claimId)
      .order("created_at");
    setEvents((ev as ClaimEvent[] | null) || []);
  }, [claimId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(name: string, args: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { error: rpcError } = await createClient().rpc(name, args);
      if (rpcError) throw rpcError;
      await load();
    } catch (caught) {
      setError(friendlyError(caught, t, "wc.error"));
    } finally {
      setBusy(false);
    }
  }

  if (!row?.resolution_stage || !row.resolution_type) return null;
  const stage = row.resolution_stage;
  const amount = row.refund_amount != null ? "RM " + Number(row.refund_amount).toFixed(2) : "";

  return (
    <div className="myClaimResolution warrantyProgress">
      <span>{t(("wc.type." + row.resolution_type) as Key, { amount })}</span>
      <p>
        <strong>{t(("wc.stage." + stage) as Key)}</strong>
      </p>

      {stage === "awaiting_return" ? (
        <div className="warrantyProgressForm">
          <p>{t("wc.sendBackHint")}</p>
          <input placeholder={t("wc.courier")} value={courier} onChange={(e) => setCourier(e.target.value)} />
          <input placeholder={t("wc.tracking")} value={tracking} onChange={(e) => setTracking(e.target.value)} />
          <button
            type="button"
            className="orderPrimaryButton"
            disabled={busy || !courier.trim() || !tracking.trim()}
            onClick={() => void act("warranty_customer_ship_back", { p_claim_id: claimId, p_courier: courier, p_tracking: tracking })}
          >
            {t("wc.sentBack")}
          </button>
        </div>
      ) : null}

      {row.return_tracking ? <p>{t("wc.yourParcel", { courier: row.return_courier || "", tracking: row.return_tracking })}</p> : null}
      {row.replacement_tracking ? (
        <p>{t("wc.ourParcel", { courier: row.replacement_courier || "", tracking: row.replacement_tracking })}</p>
      ) : null}

      {stage === "shipped" ? (
        <button
          type="button"
          className="orderPrimaryButton"
          disabled={busy}
          onClick={() => void act("warranty_customer_confirm", { p_claim_id: claimId })}
        >
          {t("wc.gotIt")}
        </button>
      ) : null}

      {error ? <p role="alert">{error}</p> : null}

      {events.length ? (
        <ul className="warrantyProgressEvents">
          {events.map((event) => (
            <li key={event.id}>
              <time>{new Date(event.created_at).toLocaleString(intlTag(), { dateStyle: "medium", timeStyle: "short" })}</time>
              {t(("wc.ev." + event.action) as Key)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import styles from "@/app/admin/Admin.module.css";

type Preview = {
  parcel: { weight: number; length: number; width: number; height: number };
  choice: { courierName: string; serviceName: string; price: number } | null;
};
type Arranged = {
  courier: string;
  service: string;
  price: number;
  awbNumber: string | null;
  labelUrl: string | null;
  pending: boolean;
};

async function post(body: Record<string, unknown>) {
  const response = await fetch("/api/shipping/easyparcel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error || "EasyParcel request failed.");
  return data;
}

/**
 * Seller Centre / MIVO admin: book the parcel with EasyParcel (MIVO's account
 * pays), print the AWB label, and the parcel is marked shipped automatically.
 */
export default function EasyParcelArrange({ sellerOrderId, onDone }: { sellerOrderId: string; onDone: () => void }) {
  const [method, setMethod] = useState<"pickup" | "dropoff">("dropoff");
  const [weight, setWeight] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [done, setDone] = useState<Arranged | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Already booked (e.g. the label was paid but shipping didn't finish): offer to finish.
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    void post({ action: "label", sellerOrderId })
      .then((data) => {
        const shipment = (data as { shipment?: { ep_shipment_number?: string | null; courier_name?: string | null; tracking_number?: string | null; awb_url?: string | null } | null }).shipment;
        if (shipment?.ep_shipment_number) {
          setDone({
            courier: shipment.courier_name || "EasyParcel",
            service: shipment.ep_shipment_number,
            price: 0,
            awbNumber: shipment.tracking_number || null,
            labelUrl: shipment.awb_url || null,
            pending: true,
          });
        }
      })
      .catch(() => undefined)
      .finally(() => setChecked(true));
  }, [sellerOrderId]);

  useEffect(() => {
    if (!checked || done) return;
    let active = true;
    setPreview(null);
    setError("");
    post({ action: "preview", sellerOrderId, method, weight: Number(weight) || undefined })
      .then((data) => {
        if (!active) return;
        setPreview(data as Preview);
        if (!weight) setWeight(String((data as Preview).parcel.weight));
      })
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : String(caught)));
    return () => {
      active = false;
    };
    // weight is applied when "Update price" is pressed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerOrderId, method, checked]);

  async function refreshPrice() {
    setBusy(true);
    setError("");
    try {
      setPreview((await post({ action: "preview", sellerOrderId, method, weight: Number(weight) || undefined })) as Preview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function arrange() {
    setBusy(true);
    setError("");
    try {
      const result = (await post({ action: "arrange", sellerOrderId, method, weight: Number(weight) || undefined })) as Arranged;
      setDone(result);
      if (!result.pending) onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function refreshAwb() {
    setBusy(true);
    setError("");
    try {
      const result = (await post({ action: "refresh", sellerOrderId })) as { pending: boolean; awbNumber?: string; labelUrl?: string };
      if (!result.pending && done) {
        setDone({ ...done, pending: false, awbNumber: result.awbNumber || null, labelUrl: result.labelUrl || null });
        onDone();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className={styles.adminNotice}>
        <strong>Booked with {done.courier}</strong> · {done.service}
        {done.price ? " · RM " + Number(done.price).toFixed(2) : ""}
        <br />
        {done.pending ? (
          <>
            Not marked shipped yet.{" "}
            <button type="button" className={styles.adminSecondaryAction} disabled={busy} onClick={() => void refreshAwb()}>
              {busy ? "Checking…" : "Finish shipping"}
            </button>
          </>
        ) : (
          <>
            Tracking {done.awbNumber}
            {done.labelUrl ? (
              <>
                {" · "}
                <a href={done.labelUrl} target="_blank" rel="noreferrer">
                  Print label (AWB) ↗
                </a>
              </>
            ) : null}
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.adminShipForm}>
      <label>
        <span>EasyParcel</span>
        <select value={method} onChange={(e) => setMethod(e.target.value as "pickup" | "dropoff")}>
          <option value="dropoff">I&apos;ll drop it off at a courier point</option>
          <option value="pickup">Courier picks up from the shop</option>
        </select>
      </label>
      <label>
        <span>Parcel weight (kg)</span>
        <input type="number" min="0.1" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} onBlur={() => void refreshPrice()} />
      </label>
      {preview?.choice ? (
        <small>
          Cheapest: {preview.choice.serviceName} · RM {preview.choice.price.toFixed(2)} (paid from MIVO&apos;s EasyParcel wallet)
        </small>
      ) : !error ? (
        <small>Getting EasyParcel prices…</small>
      ) : null}
      {error ? <small role="alert">{error}</small> : null}
      <button type="button" className={styles.adminAction} disabled={busy || !preview?.choice} onClick={() => void arrange()}>
        {busy ? "Booking…" : "Book & print label"}
      </button>
    </div>
  );
}

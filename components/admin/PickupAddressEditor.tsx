"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/admin/Admin.module.css";

const STATES = [
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Pulau Pinang", "Perak", "Perlis",
  "Sabah", "Sarawak", "Selangor", "Terengganu", "W.P. Kuala Lumpur", "W.P. Labuan", "W.P. Putrajaya",
];

type Address = { name: string; phone: string; line: string; line2: string; postcode: string; city: string; state: string };
const empty: Address = { name: "", phone: "", line: "", line2: "", postcode: "", city: "", state: "" };

/** Where couriers collect this shop's parcels (used for EasyParcel bookings). */
export default function PickupAddressEditor({ sellerId }: { sellerId: string }) {
  const [form, setForm] = useState<Address>(empty);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [superadmin, setSuperadmin] = useState(false);

  useEffect(() => {
    void createClient()
      .rpc("is_superadmin")
      .then(({ data }) => setSuperadmin(Boolean(data)));
  }, []);

  async function applyToAll() {
    setBusy(true);
    setError("");
    setMessage("");
    const { data, error: rpcError } = await createClient().rpc("platform_apply_pickup_to_my_shops", { p_address: form });
    setBusy(false);
    if (rpcError) setError(/platform_apply_pickup_to_my_shops/.test(rpcError.message) ? "Run supabase/RUN-NEW.sql first." : rpcError.message);
    else setMessage("Saved for all " + Number(data || 0) + " of your shops. Shops with the same address ship as one parcel.");
  }

  useEffect(() => {
    void createClient()
      .rpc("shop_pickup_address", { p_seller_id: sellerId })
      .then(({ data }) => setForm({ ...empty, ...((data as Partial<Address> | null) || {}) }));
  }, [sellerId]);

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    const { error: saveError } = await createClient().rpc("shop_save_pickup_address", { p_seller_id: sellerId, p_address: form });
    setBusy(false);
    if (saveError) setError(/shop_save_pickup_address/.test(saveError.message) ? "Run supabase/easyparcel.sql first." : saveError.message);
    else setMessage("Pickup address saved.");
  }

  const field = (key: keyof Address, label: string, extra: Record<string, string> = {}) => (
    <label className={styles.adminField}>
      <span>{label}</span>
      <input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} {...extra} />
    </label>
  );

  return (
    <div className={styles.returnsActions}>
      <h3>Pickup address (for couriers)</h3>
      <p className={styles.adminNotice}>Couriers collect parcels here, and it is printed as the sender on shipping labels.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
        {field("name", "Contact name")}
        {field("phone", "Phone", { inputMode: "tel", placeholder: "012-3456789" })}
        {field("line", "Street address")}
        {field("line2", "Unit / building (optional)")}
        {field("postcode", "Postcode", { inputMode: "numeric", maxLength: "5" })}
        {field("city", "City")}
        <label className={styles.adminField}>
          <span>State</span>
          <select value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}>
            <option value="">Choose state</option>
            {STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p>{message}</p> : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button type="button" className={styles.adminAction} disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save pickup address"}
        </button>
        {superadmin ? (
          <button type="button" className={styles.adminSecondaryAction} disabled={busy} onClick={() => void applyToAll()}>
            Use this address for all my shops
          </button>
        ) : null}
      </div>
    </div>
  );
}

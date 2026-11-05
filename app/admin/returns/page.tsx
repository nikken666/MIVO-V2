"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sellerCustomerInfo } from "@/lib/sellerCustomers";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getStaffAccess } from "@/lib/staff";
import { formatPrice } from "@/data/products";
import styles from "../Admin.module.css";

type Req = {
  id: string;
  request_number: string;
  order_id: string;
  seller_id: string | null;
  customer_id: string;
  items: Array<{ order_item_id: string; quantity: number }>;
  reason: string;
  solution: string;
  description: string | null;
  evidence_paths: string[];
  seller_fault: boolean;
  items_amount: number | string;
  shipping_refund: number | string;
  fee_deduction: number | string;
  requested_amount: number | string;
  seller_amount: number | string | null;
  final_amount: number | string | null;
  status: string;
  needs_return: boolean;
  return_courier: string | null;
  return_tracking: string | null;
  return_awb_url?: string | null;
  return_ep_shipment?: string | null;
  return_label_cost?: number | string | null;
  fault_decided_by?: string | null;
  seller_note: string | null;
  dispute_note: string | null;
  mivo_note: string | null;
  respond_by: string | null;
  inspect_by?: string | null;
  created_at: string;
};
type Ev = { id: string; actor: string; action: string; note: string | null; amount: number | string | null; created_at: string };

const reasonLabel: Record<string, string> = {
  wrong_item: "Wrong item",
  damaged: "Damaged on arrival",
  defective: "Defective",
  not_as_described: "Not as described",
  missing_parts: "Missing parts",
  not_received: "Not received",
  does_not_fit: "Doesn't fit",
  change_of_mind: "Change of mind",
  no_reason: "No reason",
};
const statusLabel: Record<string, string> = {
  requested: "To respond",
  seller_offer: "Offer sent",
  mivo_review: "MIVO review",
  approved_return: "Awaiting return",
  returning: "Item on the way",
  received: "Inspecting (3 days)",
  refunding: "To refund",
  refunded: "Refunded",
  rejected: "Rejected",
  cancelled: "Cancelled",
  closed: "Closed",
};
const tabs: Array<{ key: string; label: string; match: string[] }> = [
  { key: "all", label: "All", match: [] },
  { key: "respond", label: "To respond", match: ["requested"] },
  { key: "review", label: "Disputes · MIVO decides", match: ["mivo_review"] },
  { key: "offer", label: "Offer sent", match: ["seller_offer"] },
  { key: "receive", label: "To receive", match: ["approved_return", "returning", "received"] },
  { key: "refund", label: "To refund", match: ["refunding"] },
  { key: "done", label: "Refunded", match: ["refunded"] },
  { key: "closed", label: "Closed", match: ["rejected", "cancelled", "closed"] },
];

const money = (v: number | string | null | undefined) => formatPrice(Number(v || 0));
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-MY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function AdminReturnsPage() {
  const [rows, setRows] = useState<Req[]>([]);
  const [orders, setOrders] = useState<Map<string, string>>(new Map());
  const [people, setPeople] = useState<Map<string, string>>(new Map());
  const [shops, setShops] = useState<Map<string, string>>(new Map());
  const [tab, setTab] = useState("respond");
  const initialTabSet = useRef(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ items: Map<string, string>; events: Ev[]; photos: string[] } | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [requireReturn, setRequireReturn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  // Sellers act for their shop; MIVO decisions and refunds are admin-only.
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: listError } = await supabase
      .from("return_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (listError) {
      setError(/return_requests/.test(listError.message) ? "Run supabase/returns.sql in Supabase to turn on returns." : listError.message);
      return;
    }
    const list = (data || []) as Req[];
    setRows(list);
    // MIVO opens on disputes first: they wait on nobody else.
    if (!initialTabSet.current) {
      initialTabSet.current = true;
      const fromUrl = new URLSearchParams(window.location.search).get("tab");
      if (fromUrl && tabs.some((x) => x.key === fromUrl)) setTab(fromUrl);
      else if (list.some((r) => r.status === "mivo_review")) setTab("review");
    }
    const orderIds = Array.from(new Set(list.map((r) => r.order_id)));
    const customerIds = Array.from(new Set(list.map((r) => r.customer_id)));
    const sellerIds = Array.from(new Set(list.map((r) => r.seller_id).filter((v): v is string => Boolean(v))));
    const [o, p, s] = await Promise.all([
      orderIds.length ? supabase.from("orders").select("id, order_number").in("id", orderIds) : Promise.resolve({ data: [] }),
      customerIds.length ? supabase.from("profiles").select("id, full_name, email").in("id", customerIds) : Promise.resolve({ data: [] }),
      sellerIds.length ? supabase.from("sellers").select("id, shop_name").in("id", sellerIds) : Promise.resolve({ data: [] }),
    ]);
    const orderMap = new Map(((o.data || []) as Array<{ id: string; order_number: string }>).map((x) => [x.id, x.order_number]));
    const peopleMap = new Map(
      ((p.data || []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((x) => [
        x.id,
        x.full_name || x.email || "Customer",
      ])
    );
    // Sellers can't read profiles/orders directly: fill the gaps for their own customers.
    const missingPeople = customerIds.filter((id) => !peopleMap.has(id));
    const missingOrders = orderIds.filter((id) => !orderMap.has(id));
    if (missingPeople.length || missingOrders.length) {
      const extra = await sellerCustomerInfo(supabase, missingPeople, missingOrders);
      extra.people.forEach((x) => peopleMap.set(x.id, x.full_name || "Customer"));
      extra.orders.forEach((x) => orderMap.set(x.id, x.order_number));
    }
    setOrders(orderMap);
    setPeople(peopleMap);
    setShops(new Map(((s.data || []) as Array<{ id: string; shop_name: string }>).map((x) => [x.id, x.shop_name])));
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
        return;
      }
      const access = await getStaffAccess(supabase);
      if (!access.allowed) {
        window.location.href = "/sell";
        return;
      }
      setIsAdmin(access.isAdmin);
      await load();
    })();
  }, [load]);

  const current = rows.find((r) => r.id === selected) || null;

  useEffect(() => {
    if (!current) {
      setDetail(null);
      return;
    }
    setAmount(String(Number(current.seller_amount ?? current.final_amount ?? current.requested_amount).toFixed(2)));
    setNote("");
    setRequireReturn(current.needs_return && !current.return_tracking);
    (async () => {
      const supabase = createClient();
      const [itemRes, evRes] = await Promise.all([
        supabase
          .from("order_items")
          .select("id, product_name, variant_name, sku")
          .in("id", current.items.map((i) => i.order_item_id)),
        supabase.from("return_request_events").select("*").eq("request_id", current.id).order("created_at", { ascending: false }),
      ]);
      let photos: string[] = [];
      if (current.evidence_paths?.length) {
        const { data: signed } = await supabase.storage.from("return-evidence").createSignedUrls(current.evidence_paths, 3600);
        photos = (signed || []).map((s) => s.signedUrl).filter(Boolean) as string[];
      }
      setDetail({
        items: new Map(
          ((itemRes.data || []) as Array<{ id: string; product_name: string; variant_name: string | null; sku: string }>).map((i) => [
            i.id,
            i.product_name + (i.variant_name ? " · " + i.variant_name : "") + " (" + i.sku + ")",
          ])
        ),
        events: (evRes.data || []) as Ev[],
        photos,
      });
    })();
  }, [current?.id, current?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    tabs.forEach((tb) => (c[tb.key] = tb.match.length ? rows.filter((r) => tb.match.includes(r.status)).length : rows.length));
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const tb = tabs.find((x) => x.key === tab)!;
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!tb.match.length || tb.match.includes(r.status)) &&
        (!q ||
          [r.request_number, orders.get(r.order_id), people.get(r.customer_id)].join(" ").toLowerCase().includes(q))
    );
  }, [rows, tab, query, orders, people]);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, done: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: rpcError } = await fn();
      if (rpcError) throw new Error(rpcError.message);
      setMessage(done);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  const rpc = (name: string, args: Record<string, unknown>) => () => createClient().rpc(name, args);

  // MIVO books the return parcel with EasyParcel (paid from MIVO's wallet).
  async function bookReturn(id: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/returns/book-return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; courier?: string; awbNumber?: string; price?: number; pending?: boolean };
      if (!response.ok) throw new Error(data.error || "Couldn't book the return.");
      setMessage(
        data.pending
          ? "Booked. The courier label is still being prepared — press the button again in a minute."
          : "Return parcel booked: " + (data.courier || "") + " " + (data.awbNumber || "") + (data.price ? " · RM " + Number(data.price).toFixed(2) + " from the EasyParcel wallet" : "") + ". The customer can now drop it off."
      );
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't book the return.");
    } finally {
      setBusy(false);
    }
  }

  // MIVO accepts and decides whose fault it is; for our fault the return parcel is booked straight away.
  async function mivoAccept(current: Req, ourFault: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: rpcError } = await createClient().rpc("return_request_mivo_accept", { p_id: current.id, p_our_fault: ourFault, p_note: note || null });
      if (rpcError) throw new Error(rpcError.message);
      setMessage(ourFault ? "Accepted as our fault." : "Accepted as change of mind.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
      setBusy(false);
      return;
    }
    setBusy(false);
  }
  const amt = Number(amount);

  // Seller confirms the returned item is fine: approve and pay the refund straight away.
  async function receivedOk() {
    if (!current) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: rpcError } = await createClient().rpc("return_request_seller_received", {
        p_id: current.id,
        p_ok: true,
        p_amount: null,
        p_note: note || null,
      });
      if (rpcError) throw new Error(rpcError.message);
      const response = await fetch("/api/admin/returns/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id }),
      });
      const data = (await response.json()) as { error?: string; amount?: number };
      setMessage(
        response.ok
          ? "Refunded " + money(data.amount) + " to the customer."
          : "Approved. The refund will go out automatically (" + (data.error || "payment not sent yet") + ")."
      );
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function refund() {
    if (!current) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/returns/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id }),
      });
      const data = (await response.json()) as { error?: string; amount?: number };
      if (!response.ok) throw new Error(data.error || "Refund failed.");
      setMessage("Refunded " + money(data.amount) + " to the customer's original payment method.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Refund failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />
        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>Orders</span>
              <h1>Returns &amp; refunds</h1>
              <p>Respond within 2 days or requests are approved automatically. Disputes go to MIVO review.</p>
            </div>
          </header>

          <nav className={styles.adminOrderTabs}>
            {tabs.map((tb) => (
              <button type="button" key={tb.key} className={tab === tb.key ? styles.active : ""} onClick={() => setTab(tb.key)}>
                <span>{tb.label}</span>
                <b>{counts[tb.key] || 0}</b>
              </button>
            ))}
          </nav>
          <div className={styles.adminOrderToolbar}>
            <label>
              <span>Search</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Request no., order no. or customer" />
            </label>
          </div>
          {message ? <p className={styles.adminSuccess}>{message}</p> : null}
          {error ? <p className={styles.adminError}>{error}</p> : null}

          <div className={styles.returnsLayout}>
            <ul className={styles.returnsList}>
              {visible.length === 0 ? <li className={styles.returnsEmpty}>Nothing here.</li> : null}
              {visible.map((r) => (
                <li key={r.id}>
                  <button type="button" className={r.id === selected ? styles.active : ""} onClick={() => setSelected(r.id)}>
                    <span>
                      <strong>{reasonLabel[r.reason] || r.reason}</strong>
                      <small>
                        {r.request_number} · {orders.get(r.order_id) || "—"} · {people.get(r.customer_id) || "Customer"}
                      </small>
                      <small>
                        {(r.seller_id && shops.get(r.seller_id)) || "Shop"} · {when(r.created_at)}
                      </small>
                    </span>
                    <span className={styles.returnsRight}>
                      <b>{money(r.final_amount ?? r.requested_amount)}</b>
                      <em className={r.seller_fault ? styles.returnsFault : styles.returnsMind}>
                        {statusLabel[r.status] || r.status}
                      </em>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <section className={styles.returnsDetail}>
              {!current ? (
                <p className={styles.returnsEmpty}>Pick a request on the left.</p>
              ) : (
                <>
                  <div className={styles.returnsHead}>
                    <div>
                      <h2>{reasonLabel[current.reason]}</h2>
                      <p>
                        {current.request_number} · order{" "}
                        <a href={"/admin/orders?order=" + encodeURIComponent(orders.get(current.order_id) || "")}>
                          {orders.get(current.order_id)}
                        </a>{" "}
                        · {people.get(current.customer_id)} · {current.solution === "refund_only" ? "Refund only" : "Return & refund"}
                      </p>
                    </div>
                    <em className={current.seller_fault ? styles.returnsFault : styles.returnsMind}>
                      {current.seller_fault ? "Seller's responsibility" : "Customer's choice"}
                    </em>
                  </div>

                  <div className={styles.returnsBlock}>
                    {current.items.map((i) => (
                      <p key={i.order_item_id}>
                        {detail?.items.get(i.order_item_id) || "…"} × {i.quantity}
                      </p>
                    ))}
                    {current.description ? <p className={styles.returnsQuote}>“{current.description}”</p> : null}
                    {detail?.photos.length ? (
                      <div className={styles.returnsPhotos}>
                        {detail.photos.map((u) => (
                          <a key={u} href={u} target="_blank" rel="noreferrer">
                            <img src={u} alt="" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {current.return_tracking ? (
                      <p>
                        Return parcel: {current.return_courier} · <strong>{current.return_tracking}</strong>
                      </p>
                    ) : null}
                    {current.dispute_note ? <p className={styles.returnsQuote}>Dispute: “{current.dispute_note}”</p> : null}
                    {current.seller_note ? <p className={styles.returnsQuote}>Seller: “{current.seller_note}”</p> : null}
                  </div>

                  <div className={styles.returnsMoney}>
                    <div><span>Item price (after voucher)</span><strong>{money(current.items_amount)}</strong></div>
                    {Number(current.shipping_refund) > 0 ? <div><span>Shipping share</span><strong>+ {money(current.shipping_refund)}</strong></div> : null}
                    {Number(current.fee_deduction) > 0 ? <div><span>Payment fee deducted</span><strong>− {money(current.fee_deduction)}</strong></div> : null}
                    <div><span>Customer asked for</span><strong>{money(current.requested_amount)}</strong></div>
                    {current.seller_amount != null ? <div><span>Seller proposed</span><strong>{money(current.seller_amount)}</strong></div> : null}
                    {current.final_amount != null ? <div className={styles.returnsFinal}><span>Approved refund</span><strong>{money(current.final_amount)}</strong></div> : null}
                  </div>

                  {/* Actions per stage */}
                  {isAdmin && ["requested", "mivo_review", "seller_offer"].includes(current.status) ? (
                    <div className={styles.returnsActions}>
                      <h3>MIVO decision · whose fault is it?</h3>
                      <p className={styles.adminNotice}>
                        The customer chose “{current.reason.replace(/_/g, " ")}”. Check the photos, then decide.
                        Our fault: item + its delivery share refunded. Not our fault: change-of-mind rules — no delivery refund,
                        payment fee deducted.{current.needs_return ? " Either way the customer posts the item back to the shop's return address and enters the tracking number." : ""}
                      </p>
                      <div className={styles.returnsRow}>
                        <button type="button" className={styles.adminAction} disabled={busy} onClick={() => void mivoAccept(current, true)}>
                          Accept · our fault
                        </button>
                        <button type="button" className={styles.adminSecondaryAction} disabled={busy} onClick={() => void mivoAccept(current, false)}>
                          Accept · not our fault
                        </button>
                        {current.status === "requested" ? (
                          <button
                            type="button"
                            className={styles.adminSecondaryAction}
                            disabled={busy || note.trim().length < 5}
                            title="Write the reason in the note box below first (shown to the customer)."
                            onClick={() => void run(rpc("return_request_mivo_decide", { p_id: current.id, p_approve: false, p_amount: null, p_require_return: false, p_note: note }), "Rejected. The customer can see your note.")}
                          >
                            Reject
                          </button>
                        ) : null}
                      </div>
                      {current.status === "requested" ? (
                        <label><span>Note to the customer (needed to reject)</span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
                      ) : null}
                    </div>
                  ) : null}

                  {current.status === "requested" && !isAdmin ? (
                    <div className={styles.returnsActions}>
                      <h3>Seller response</h3>
                      <button type="button" className={styles.adminAction} disabled={busy} onClick={() => void run(rpc("return_request_seller_respond", { p_id: current.id, p_action: "accept", p_amount: null, p_note: note || null }), current.needs_return ? "Accepted. Customer will send the item back." : "Accepted. Ready to refund.")}>
                        Accept {current.needs_return ? "return" : "refund"}
                      </button>
                      <label><span>Partial refund (customer keeps item)</span><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
                      <button type="button" className={styles.adminSecondaryAction} disabled={busy || !(amt > 0 && amt < Number(current.requested_amount))} onClick={() => void run(rpc("return_request_seller_respond", { p_id: current.id, p_action: "offer", p_amount: amt, p_note: note || null }), "Offer sent to the customer.")}>
                        Offer {money(amt)}
                      </button>
                      <label><span>Note / reason to dispute</span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
                      <button type="button" className={styles.adminSecondaryAction} disabled={busy || note.trim().length < 5} onClick={() => void run(rpc("return_request_seller_respond", { p_id: current.id, p_action: "dispute", p_amount: null, p_note: note }), "Disputed. MIVO will review.")}>
                        Dispute
                      </button>
                    </div>
                  ) : null}

                  {current.status === "approved_return" || current.status === "returning" ? (
                    current.return_ep_shipment ? (
                      <p className={styles.adminNotice}>
                        Free return booked with EasyParcel: {current.return_courier || "courier"} {current.return_tracking || "(label being prepared)"}
                        {current.return_label_cost != null ? " · RM " + Number(current.return_label_cost).toFixed(2) : ""}
                        {current.return_awb_url ? (
                          <>
                            {" · "}
                            <a href={current.return_awb_url} target="_blank" rel="noreferrer">Label</a>
                          </>
                        ) : null}
                        {!current.return_tracking && isAdmin ? (
                          <>
                            {" · "}
                            <button type="button" className={styles.adminSecondaryAction} disabled={busy} onClick={() => void bookReturn(current.id)}>Get label</button>
                          </>
                        ) : null}
                      </p>
                    ) : null
                  ) : null}

                  {current.status === "approved_return" || current.status === "returning" || current.status === "received" ? (
                    <div className={styles.returnsActions}>
                      <h3>Returned item</h3>
                      {current.status === "received" && current.inspect_by ? (
                        <p className={styles.adminNotice}>
                          Parcel arrived. You have until {when(current.inspect_by)} to check it. If you don&apos;t
                          report a problem by then, {money(current.requested_amount)} is refunded to the customer automatically.
                        </p>
                      ) : (
                        <>
                          <p className={styles.adminNotice}>
                            When the parcel arrives, mark it below. You then have 3 days to unpack and check it before the
                            refund goes out automatically. If you don&apos;t mark it, it counts as arrived 7 days after the customer sent it.
                          </p>
                          <button type="button" className={styles.adminSecondaryAction} disabled={busy} onClick={() => void run(rpc("return_request_seller_arrived", { p_id: current.id }), "Parcel arrived. You have 3 days to check it.")}>
                            Parcel arrived · start 3-day check
                          </button>
                        </>
                      )}
                      <button type="button" className={styles.adminAction} disabled={busy} onClick={() => void receivedOk()}>
                        Item is fine · refund {money(current.requested_amount)} now
                      </button>
                      <label><span>Problem with the returned item? Amount you think is fair</span><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
                      <label><span>What is wrong (MIVO will verify)</span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
                      <button type="button" className={styles.adminSecondaryAction} disabled={busy || !(amt >= 0 && amt < Number(current.requested_amount)) || note.trim().length < 5} onClick={() => void run(rpc("return_request_seller_received", { p_id: current.id, p_ok: false, p_amount: amt, p_note: note }), "Sent to MIVO review with the adjusted amount.")}>
                        Report problem · propose {money(amt)}
                      </button>
                    </div>
                  ) : null}

                  {isAdmin && (current.status === "mivo_review" || current.status === "seller_offer") ? (
                    <div className={styles.returnsActions}>
                      <h3>MIVO decision</h3>
                      <label><span>Refund amount</span><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
                      <label className={styles.returnsCheck}>
                        <input type="checkbox" checked={requireReturn} onChange={(e) => setRequireReturn(e.target.checked)} /> Customer must send the item back first
                      </label>
                      <label><span>Decision note (shown to customer)</span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
                      <div className={styles.returnsRow}>
                        <button type="button" className={styles.adminAction} disabled={busy || !(amt > 0)} onClick={() => void run(rpc("return_request_mivo_decide", { p_id: current.id, p_approve: true, p_amount: amt, p_require_return: requireReturn, p_note: note || null }), "Approved.")}>
                          Approve {money(amt)}
                        </button>
                        <button type="button" className={styles.adminSecondaryAction} disabled={busy || note.trim().length < 5} onClick={() => void run(rpc("return_request_mivo_decide", { p_id: current.id, p_approve: false, p_amount: null, p_require_return: false, p_note: note }), "Rejected.")}>
                          Reject
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {current.status === "refunding" && !isAdmin ? (
                    <p className={styles.adminNotice}>Approved. The refund goes out to the customer automatically.</p>
                  ) : null}
                  {current.status === "refunding" && isAdmin ? (
                    <div className={styles.returnsActions}>
                      <h3>Refund</h3>
                      <button type="button" className={styles.adminAction} disabled={busy} onClick={() => void refund()}>
                        {busy ? "Refunding…" : "Refund " + money(current.final_amount ?? current.requested_amount) + " via Stripe"}
                      </button>
                    </div>
                  ) : null}

                  <div className={styles.returnsBlock}>
                    <h3>History</h3>
                    {(detail?.events || []).map((e) => (
                      <p key={e.id} className={styles.returnsEvent}>
                        <strong>{e.actor}</strong> {e.action.replaceAll("_", " ")}
                        {e.amount != null ? " · " + money(e.amount) : ""}
                        {e.note ? " — “" + e.note + "”" : ""}
                        <small>{when(e.created_at)}</small>
                      </p>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

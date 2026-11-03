"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import styles from "@/app/admin/Admin.module.css";
import m from "./Marketing.module.css";
import { useMyShops } from "../SellerGate";
import { toLocalInput, when } from "@/app/admin/platform/usePlatformGate";

type Tab = "discounts" | "vouchers" | "campaigns";

type DiscountItem = {
  variant_id: string;
  product_id: string;
  product_name: string;
  variant_title: string | null;
  sku: string | null;
  image_url: string | null;
  price: number | string;
  stock: number;
  discount_enabled: boolean;
  discount_percent: number | string | null;
  discount_starts_at: string | null;
  discount_ends_at: string | null;
};

type ShopVoucher = {
  id: string;
  seller_id: string;
  shop_name: string;
  code: string;
  name: string;
  discount_type: "fixed" | "percent";
  discount_value: number | string;
  minimum_spend: number | string;
  max_discount: number | string | null;
  starts_at: string;
  ends_at: string;
  usage_limit: number | null;
  per_user_limit: number | null;
  is_active: boolean;
  shop_wide: boolean;
  product_ids: string[];
  claimed: number;
  used: number;
};

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  voucher_code: string;
  starts_at: string;
  ends_at: string;
  funding: "platform" | "shared";
  platform_share_pct: number | string;
  invited: boolean;
  participation: "invited" | "accepted" | "rejected" | "included" | "not_invited";
};

const rm = (n: number | string | null | undefined) => "RM " + Number(n || 0).toFixed(2);

function discountLive(item: DiscountItem) {
  if (!item.discount_enabled || !Number(item.discount_percent)) return "off";
  const now = Date.now();
  const start = item.discount_starts_at ? new Date(item.discount_starts_at).getTime() : 0;
  const end = item.discount_ends_at ? new Date(item.discount_ends_at).getTime() : Infinity;
  if (end < now) return "ended";
  if (start > now) return "upcoming";
  return "live";
}

function voucherState(v: ShopVoucher) {
  const now = Date.now();
  if (!v.is_active || new Date(v.ends_at).getTime() <= now) return "Ended";
  if (new Date(v.starts_at).getTime() > now) return "Upcoming";
  return "Live";
}

/** Seller Centre → Marketing centre: discounts, shop vouchers and MIVO campaigns. */
export default function SellerMarketingPage() {
  const { shops, error: gateError } = useMyShops();
  const [tab, setTab] = useState<Tab>("discounts");
  const [shopId, setShopId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const approvedShops = useMemo(() => (shops || []).filter((s) => s.status === "approved"), [shops]);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (fromUrl && ["discounts", "vouchers", "campaigns"].includes(fromUrl)) setTab(fromUrl);
  }, []);
  useEffect(() => {
    if (!shopId && approvedShops.length) setShopId(approvedShops[0].id);
  }, [approvedShops, shopId]);

  // ------------------------------------------------------------- discounts
  const [items, setItems] = useState<DiscountItem[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [percent, setPercent] = useState("10");
  const [dStart, setDStart] = useState(toLocalInput(new Date()));
  const [dEnd, setDEnd] = useState(toLocalInput(new Date(Date.now() + 7 * 86400000)));
  const [search, setSearch] = useState("");

  // -------------------------------------------------------------- vouchers
  const [vouchers, setVouchers] = useState<ShopVoucher[]>([]);
  const blankVoucher = () => ({
    id: "",
    code: "",
    name: "",
    discount_type: "fixed" as "fixed" | "percent",
    discount_value: "5",
    minimum_spend: "50",
    max_discount: "",
    starts_at: toLocalInput(new Date()),
    ends_at: toLocalInput(new Date(Date.now() + 30 * 86400000)),
    usage_limit: "100",
    per_user_limit: "1",
    shop_wide: true,
    product_ids: [] as string[],
  });
  const [form, setForm] = useState(blankVoucher);
  const [showForm, setShowForm] = useState(false);

  // ------------------------------------------------------------- campaigns
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const notReady = (msg: string) =>
    /seller_(discount_items|vouchers|campaigns|save_voucher|set_discount)|function .* does not exist|schema cache/i.test(msg)
      ? "Run supabase/seller-marketing.sql in Supabase to turn on the Marketing centre."
      : msg;

  const load = useCallback(async () => {
    if (!shopId) return;
    setError("");
    const supabase = createClient();
    const [d, v, c] = await Promise.all([
      supabase.rpc("seller_discount_items", { p_seller_id: shopId }),
      supabase.rpc("seller_vouchers"),
      supabase.rpc("seller_campaigns", { p_seller_id: shopId }),
    ]);
    const firstError = d.error || v.error || c.error;
    if (firstError) setError(notReady(firstError.message));
    setItems((d.data as DiscountItem[] | null) || []);
    setVouchers(((v.data as ShopVoucher[] | null) || []).filter((x) => x.seller_id === shopId));
    setCampaigns((c.data as Campaign[] | null) || []);
  }, [shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, done: string) {
    setBusy(true);
    setError("");
    setMessage("");
    const { error: rpcError } = await fn();
    setBusy(false);
    if (rpcError) {
      setError(notReady(rpcError.message));
      return false;
    }
    setMessage(done);
    await load();
    return true;
  }

  const filtered = items.filter(
    (i) => !search.trim() || (i.product_name + " " + (i.variant_title || "") + " " + (i.sku || "")).toLowerCase().includes(search.toLowerCase())
  );
  const products = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((i) => map.set(i.product_id, i.product_name));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [items]);

  function togglePick(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const shopName = approvedShops.find((s) => s.id === shopId)?.shop_name || "";

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />
        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>Seller Centre</span>
              <h1>Marketing centre</h1>
              <p>Put products on sale, create shop vouchers and join MIVO campaigns to get more orders.</p>
            </div>
            {approvedShops.length > 1 ? (
              <label className={styles.adminField}>
                <span>Shop</span>
                <select value={shopId} onChange={(e) => setShopId(e.target.value)}>
                  {approvedShops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shop_name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </header>

          {shops && !approvedShops.length ? (
            <p className={styles.adminNotice}>Your shop needs to be approved by MIVO before you can run promotions.</p>
          ) : null}

          <nav className={m.tabs} role="tablist">
            {(
              [
                ["discounts", "Discounts", "🏷️"],
                ["vouchers", "Shop vouchers", "🎟️"],
                ["campaigns", "MIVO campaigns", "📣"],
              ] as Array<[Tab, string, string]>
            ).map(([key, label, icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={tab === key ? m.tabActive : ""}
                onClick={() => {
                  setTab(key);
                  setMessage("");
                }}
              >
                <span aria-hidden>{icon}</span> {label}
                {key === "campaigns" && campaigns.some((c) => c.participation === "invited") ? <b className={m.dot} /> : null}
              </button>
            ))}
          </nav>

          {gateError || error ? <p className={styles.adminError}>{gateError || error}</p> : null}
          {message ? <p className={m.ok}>{message}</p> : null}

          {tab === "discounts" ? (
            <section className={styles.adminPanel}>
              <h2>Product discounts</h2>
              <p className={m.hint}>Tick the products, choose % off and the dates. Buyers see the sale price and a discount badge.</p>
              <div className={m.toolbar}>
                <label className={styles.adminField}>
                  <span>% off</span>
                  <input type="number" min="1" max="90" value={percent} onChange={(e) => setPercent(e.target.value)} />
                </label>
                <label className={styles.adminField}>
                  <span>Starts</span>
                  <input type="datetime-local" value={dStart} onChange={(e) => setDStart(e.target.value)} />
                </label>
                <label className={styles.adminField}>
                  <span>Ends</span>
                  <input type="datetime-local" value={dEnd} onChange={(e) => setDEnd(e.target.value)} />
                </label>
                <button
                  type="button"
                  className={styles.adminAction}
                  disabled={busy || !picked.size}
                  onClick={() =>
                    void run(
                      () =>
                        createClient().rpc("seller_set_discount", {
                          p_seller_id: shopId,
                          p_variant_ids: Array.from(picked),
                          p_percent: Number(percent),
                          p_starts_at: new Date(dStart).toISOString(),
                          p_ends_at: new Date(dEnd).toISOString(),
                        }),
                      "Discount saved for " + picked.size + " item(s)."
                    ).then((ok) => ok && setPicked(new Set()))
                  }
                >
                  Apply to {picked.size || ""} selected
                </button>
                <button
                  type="button"
                  className={styles.adminSecondaryAction}
                  disabled={busy || !picked.size}
                  onClick={() =>
                    void run(
                      () => createClient().rpc("seller_clear_discount", { p_seller_id: shopId, p_variant_ids: Array.from(picked) }),
                      "Discount removed."
                    ).then((ok) => ok && setPicked(new Set()))
                  }
                >
                  Remove discount
                </button>
              </div>
              <input className={m.search} placeholder="Search your products or SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
              {filtered.length === 0 ? (
                <p className={m.hint}>No products yet. Add products first, then put them on sale here.</p>
              ) : (
                <div className={styles.adminTableWrap}>
                  <table className={m.table}>
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            aria-label="Select all"
                            checked={filtered.length > 0 && filtered.every((i) => picked.has(i.variant_id))}
                            onChange={(e) =>
                              setPicked(e.target.checked ? new Set(filtered.map((i) => i.variant_id)) : new Set())
                            }
                          />
                        </th>
                        <th>Product</th>
                        <th>Price</th>
                        <th>Sale price</th>
                        <th>Stock</th>
                        <th>Promotion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((i) => {
                        const state = discountLive(i);
                        const pct = Number(i.discount_percent || 0);
                        return (
                          <tr key={i.variant_id} className={picked.has(i.variant_id) ? m.picked : ""}>
                            <td>
                              <input type="checkbox" checked={picked.has(i.variant_id)} onChange={() => togglePick(i.variant_id)} aria-label={"Select " + i.product_name} />
                            </td>
                            <td>
                              <div className={m.product}>
                                {i.image_url ? <img src={i.image_url} alt="" /> : <span />}
                                <span>
                                  <strong>{i.product_name}</strong>
                                  <small>{[i.variant_title, i.sku].filter(Boolean).join(" · ")}</small>
                                </span>
                              </div>
                            </td>
                            <td>{rm(i.price)}</td>
                            <td>{state === "off" ? "—" : <strong className={m.sale}>{rm(Number(i.price) * (1 - pct / 100))}</strong>}</td>
                            <td>{i.stock}</td>
                            <td>
                              {state === "off" ? (
                                <span className={m.pill}>No discount</span>
                              ) : (
                                <span className={m.pill + " " + (state === "live" ? m.live : state === "upcoming" ? m.soon : "")}>
                                  -{pct}% · {state === "live" ? "Live" : state === "upcoming" ? "Upcoming" : "Ended"}
                                  <small>
                                    {when(i.discount_starts_at)} → {when(i.discount_ends_at)}
                                  </small>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {tab === "vouchers" ? (
            <section className={styles.adminPanel}>
              <div className={m.headRow}>
                <div>
                  <h2>Shop vouchers</h2>
                  <p className={m.hint}>
                    Vouchers for {shopName || "your shop"}, paid by your shop. Buyers claim them on your shop and product pages, and they
                    only discount your products.
                  </p>
                </div>
                {!showForm ? (
                  <button
                    type="button"
                    className={styles.adminAction}
                    onClick={() => {
                      setForm(blankVoucher());
                      setShowForm(true);
                    }}
                  >
                    + Create voucher
                  </button>
                ) : null}
              </div>

              {showForm ? (
                <div className={m.formCard}>
                  <div className={m.ticketPreview}>
                    <strong>
                      {form.discount_type === "percent" ? Number(form.discount_value || 0) + "% OFF" : "RM" + Number(form.discount_value || 0) + " OFF"}
                    </strong>
                    <span>Min. spend RM{Number(form.minimum_spend || 0)}</span>
                    <code>{form.code || "CODE"}</code>
                  </div>
                  <div className={m.grid}>
                    <label className={styles.adminField}>
                      <span>Voucher code (4–20 letters/numbers)</span>
                      <input value={form.code} maxLength={20} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} placeholder="AHSENG5" />
                    </label>
                    <label className={styles.adminField}>
                      <span>Name (for you)</span>
                      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Raya sale" />
                    </label>
                    <label className={styles.adminField}>
                      <span>Discount</span>
                      <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as "fixed" | "percent" })}>
                        <option value="fixed">RM off</option>
                        <option value="percent">% off</option>
                      </select>
                    </label>
                    <label className={styles.adminField}>
                      <span>{form.discount_type === "percent" ? "% off" : "RM off"}</span>
                      <input type="number" min="1" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
                    </label>
                    {form.discount_type === "percent" ? (
                      <label className={styles.adminField}>
                        <span>Max discount (RM, optional)</span>
                        <input type="number" min="0" value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} />
                      </label>
                    ) : null}
                    <label className={styles.adminField}>
                      <span>Minimum spend (RM)</span>
                      <input type="number" min="0" value={form.minimum_spend} onChange={(e) => setForm({ ...form, minimum_spend: e.target.value })} />
                    </label>
                    <label className={styles.adminField}>
                      <span>Starts</span>
                      <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                    </label>
                    <label className={styles.adminField}>
                      <span>Ends</span>
                      <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
                    </label>
                    <label className={styles.adminField}>
                      <span>Total vouchers (empty = no limit)</span>
                      <input type="number" min="0" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} />
                    </label>
                    <label className={styles.adminField}>
                      <span>Uses per buyer</span>
                      <input type="number" min="1" value={form.per_user_limit} onChange={(e) => setForm({ ...form, per_user_limit: e.target.value })} />
                    </label>
                  </div>
                  <div className={m.applies}>
                    <label>
                      <input type="radio" checked={form.shop_wide} onChange={() => setForm({ ...form, shop_wide: true })} /> All products in my shop
                    </label>
                    <label>
                      <input type="radio" checked={!form.shop_wide} onChange={() => setForm({ ...form, shop_wide: false })} /> Selected products
                    </label>
                  </div>
                  {!form.shop_wide ? (
                    <div className={m.productPick}>
                      {products.map((p) => (
                        <label key={p.id}>
                          <input
                            type="checkbox"
                            checked={form.product_ids.includes(p.id)}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                product_ids: e.target.checked ? [...form.product_ids, p.id] : form.product_ids.filter((x) => x !== p.id),
                              })
                            }
                          />{" "}
                          {p.name}
                        </label>
                      ))}
                    </div>
                  ) : null}
                  <div className={m.formActions}>
                    <button
                      type="button"
                      className={styles.adminAction}
                      disabled={busy || !form.code}
                      onClick={() =>
                        void run(
                          () =>
                            createClient().rpc("seller_save_voucher", {
                              p: {
                                ...form,
                                id: form.id || null,
                                seller_id: shopId,
                                starts_at: new Date(form.starts_at).toISOString(),
                                ends_at: new Date(form.ends_at).toISOString(),
                                discount_value: Number(form.discount_value),
                                minimum_spend: Number(form.minimum_spend || 0),
                                max_discount: Number(form.max_discount || 0),
                                usage_limit: Number(form.usage_limit || 0),
                                per_user_limit: Number(form.per_user_limit || 1),
                              },
                            }),
                          "Voucher " + form.code + " saved."
                        ).then((ok) => ok && setShowForm(false))
                      }
                    >
                      {form.id ? "Save changes" : "Create voucher"}
                    </button>
                    <button type="button" className={styles.adminSecondaryAction} onClick={() => setShowForm(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {vouchers.length === 0 && !showForm ? <p className={m.hint}>No vouchers yet.</p> : null}
              <div className={m.tickets}>
                {vouchers.map((v) => {
                  const state = voucherState(v);
                  return (
                    <div key={v.id} className={m.ticket + (state === "Ended" ? " " + m.ended : "")}>
                      <div className={m.ticketLeft}>
                        <strong>{v.discount_type === "percent" ? Number(v.discount_value) + "% OFF" : "RM" + Number(v.discount_value) + " OFF"}</strong>
                        <small>Min. spend RM{Number(v.minimum_spend)}</small>
                      </div>
                      <div className={m.ticketBody}>
                        <span className={m.pill + " " + (state === "Live" ? m.live : state === "Upcoming" ? m.soon : "")}>{state}</span>
                        <strong>{v.code}</strong>
                        <small>
                          {when(v.starts_at)} → {when(v.ends_at)}
                        </small>
                        <small>
                          {v.shop_wide ? "All products" : v.product_ids.length + " product(s)"} · Claimed {v.claimed} · Used {v.used}
                          {v.usage_limit ? " / " + v.usage_limit : ""}
                        </small>
                        <div className={m.ticketActions}>
                          {state !== "Ended" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setForm({
                                    id: v.id,
                                    code: v.code,
                                    name: v.name,
                                    discount_type: v.discount_type,
                                    discount_value: String(Number(v.discount_value)),
                                    minimum_spend: String(Number(v.minimum_spend)),
                                    max_discount: v.max_discount ? String(Number(v.max_discount)) : "",
                                    starts_at: toLocalInput(new Date(v.starts_at)),
                                    ends_at: toLocalInput(new Date(v.ends_at)),
                                    usage_limit: v.usage_limit ? String(v.usage_limit) : "",
                                    per_user_limit: String(v.per_user_limit || 1),
                                    shop_wide: v.shop_wide,
                                    product_ids: v.product_ids,
                                  });
                                  setShowForm(true);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void run(() => createClient().rpc("seller_end_voucher", { p_voucher_id: v.id }), "Voucher " + v.code + " ended.")
                                }
                              >
                                End now
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {tab === "campaigns" ? (
            <section className={styles.adminPanel}>
              <h2>MIVO campaigns</h2>
              <p className={m.hint}>
                Campaigns run by MIVO (e.g. 11.11, Raya). Join to have your products featured; for shared campaigns your shop pays its share of
                the discount on your items.
              </p>
              {campaigns.length === 0 ? <p className={m.hint}>No MIVO campaigns right now.</p> : null}
              <div className={m.campaigns}>
                {campaigns.map((c) => {
                  const started = new Date(c.starts_at).getTime() <= Date.now();
                  const ended = new Date(c.ends_at).getTime() <= Date.now();
                  return (
                    <article key={c.id} className={m.campaign}>
                      <header>
                        <strong>{c.name}</strong>
                        <span
                          className={
                            m.pill +
                            " " +
                            (c.participation === "accepted" || c.participation === "included" ? m.live : c.participation === "invited" ? m.soon : "")
                          }
                        >
                          {ended
                            ? "Ended"
                            : c.participation === "accepted"
                              ? "Joined"
                              : c.participation === "included"
                                ? "Included · paid by MIVO"
                                : c.participation === "invited"
                                  ? "Invitation"
                                  : c.participation === "rejected"
                                    ? "Not joined"
                                    : "Not invited"}
                        </span>
                      </header>
                      {c.description ? <p>{c.description}</p> : null}
                      <dl>
                        <div>
                          <dt>When</dt>
                          <dd>
                            {when(c.starts_at)} → {when(c.ends_at)}
                          </dd>
                        </div>
                        <div>
                          <dt>Voucher</dt>
                          <dd>{c.voucher_code}</dd>
                        </div>
                        <div>
                          <dt>Who pays the discount</dt>
                          <dd>
                            {c.funding === "platform"
                              ? "MIVO pays 100%"
                              : "MIVO " + Number(c.platform_share_pct) + "% · your shop " + (100 - Number(c.platform_share_pct)) + "%"}
                          </dd>
                        </div>
                      </dl>
                      {c.invited && !ended && (c.participation === "invited" || (c.participation === "rejected" && !started) || (c.participation === "accepted" && !started)) ? (
                        <div className={m.formActions}>
                          {c.participation !== "accepted" ? (
                            <button
                              type="button"
                              className={styles.adminAction}
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  () => createClient().rpc("seller_respond_campaign", { p_campaign_id: c.id, p_seller_id: shopId, p_accept: true }),
                                  "You joined " + c.name + "."
                                )
                              }
                            >
                              Join campaign
                            </button>
                          ) : null}
                          {c.participation !== "rejected" ? (
                            <button
                              type="button"
                              className={styles.adminSecondaryAction}
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  () => createClient().rpc("seller_respond_campaign", { p_campaign_id: c.id, p_seller_id: shopId, p_accept: false }),
                                  c.participation === "accepted" ? "You left " + c.name + "." : "You declined " + c.name + "."
                                )
                              }
                            >
                              {c.participation === "accepted" ? "Leave" : "Not this time"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../../Admin.module.css";

type ProductRelation =
  | {
      name: string;
      slug: string;
      status: string;
      primary_image_url: string | null;
    }
  | Array<{
      name: string;
      slug: string;
      status: string;
      primary_image_url: string | null;
    }>
  | null;

type DiscountRow = {
  id: string;
  product_id: string;
  title: string | null;
  sku: string;
  price: number | string;
  discount_enabled: boolean;
  discount_percent: number | string | null;
  discount_starts_at: string | null;
  discount_ends_at: string | null;
  products: ProductRelation;
};

function productData(value: ProductRelation) {
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function money(value: number | string | null) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(Number(value || 0));
}

function localInput(value?: string | null, offsetDays = 0) {
  const date = value
    ? new Date(value)
    : new Date(Date.now() + offsetDays * 86400000);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function statusFor(row: DiscountRow) {
  if (!row.discount_enabled || !Number(row.discount_percent || 0)) {
    return "OFF";
  }

  const now = Date.now();
  const start = row.discount_starts_at
    ? new Date(row.discount_starts_at).getTime()
    : 0;
  const end = row.discount_ends_at
    ? new Date(row.discount_ends_at).getTime()
    : Number.POSITIVE_INFINITY;

  if (now < start) return "SCHEDULED";
  if (now > end) return "ENDED";
  return "LIVE";
}

function salePrice(row: DiscountRow) {
  const regular = Number(row.price || 0);
  const percent = Number(row.discount_percent || 0);
  return Math.round(regular * (1 - percent / 100) * 100) / 100;
}

export default function AdminDiscountsPage() {
  const [rows, setRows] = useState<DiscountRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [percent, setPercent] = useState("10");
  const [startsAt, setStartsAt] = useState(localInput());
  const [endsAt, setEndsAt] = useState(localInput(null, 7));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  async function load() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login?next=/admin/marketing/discounts";
      return;
    }

    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");

    if (adminError) throw adminError;

    if (!isAdmin) {
      window.location.href = "/";
      return;
    }

    const { data, error: loadError } = await supabase
      .from("product_variants")
      .select(
        "id, product_id, title, sku, price, discount_enabled, discount_percent, discount_starts_at, discount_ends_at, products!inner(name, slug, status, primary_image_url)"
      )
      .eq("is_active", true)
      .eq("products.status", "active")
      .order("created_at", { ascending: false });

    if (loadError) throw loadError;

    setRows((data as unknown as DiscountRow[] | null) || []);
  }

  useEffect(() => {
    let active = true;

    async function start() {
      try {
        await load();
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load discounts."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void start();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) return rows;

    return rows.filter((row) => {
      const product = productData(row.products);

      return (
        row.sku.toLowerCase().includes(value) ||
        (row.title || "").toLowerCase().includes(value) ||
        (product?.name || "").toLowerCase().includes(value)
      );
    });
  }, [rows, query]);

  const counts = useMemo(
    () =>
      rows.reduce(
        (result, row) => {
          const status = statusFor(row);
          if (status === "LIVE") result.live += 1;
          if (status === "SCHEDULED") result.scheduled += 1;
          if (status === "ENDED") result.ended += 1;
          return result;
        },
        { live: 0, scheduled: 0, ended: 0 }
      ),
    [rows]
  );

  function toggleSelected(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleAllVisible() {
    const ids = filtered.map((row) => row.id);
    const allSelected =
      ids.length > 0 && ids.every((id) => selected.includes(id));

    setSelected((current) => {
      if (allSelected) {
        return current.filter((id) => !ids.includes(id));
      }

      return Array.from(new Set([...current, ...ids]));
    });
  }

  async function applyDiscount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const discountPercent = Number(percent);
    const start = new Date(startsAt);
    const end = new Date(endsAt);

    setError("");
    setMessage("");

    if (!selected.length) {
      setError("Select at least one SKU.");
      return;
    }

    if (
      !Number.isFinite(discountPercent) ||
      discountPercent <= 0 ||
      discountPercent >= 100
    ) {
      setError("Discount must be between 0% and 100%.");
      return;
    }

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      setError("Choose a valid discount start and end time.");
      return;
    }

    setBusy("apply");

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("product_variants")
        .update({
          discount_enabled: true,
          discount_percent: discountPercent,
          discount_starts_at: start.toISOString(),
          discount_ends_at: end.toISOString(),
        })
        .in("id", selected);

      if (updateError) throw updateError;

      await load();
      setMessage(
        discountPercent +
          "% discount scheduled for " +
          selected.length +
          " SKU" +
          (selected.length === 1 ? "" : "s") +
          "."
      );
      setSelected([]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to apply discount."
      );
    } finally {
      setBusy("");
    }
  }

  async function clearDiscount(ids: string[]) {
    if (!ids.length) return;

    setBusy("clear");
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("product_variants")
        .update({
          discount_enabled: false,
          discount_percent: null,
          discount_starts_at: null,
          discount_ends_at: null,
        })
        .in("id", ids);

      if (updateError) throw updateError;

      await load();
      setSelected((current) =>
        current.filter((id) => !ids.includes(id))
      );
      setMessage(
        "Discount removed from " +
          ids.length +
          " SKU" +
          (ids.length === 1 ? "" : "s") +
          "."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to remove discount."
      );
    } finally {
      setBusy("");
    }
  }

  const allVisibleSelected =
    filtered.length > 0 &&
    filtered.every((row) => selected.includes(row.id));

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
            <a href="/admin/claims"><span>04</span>Claims</a>
            <a href="/admin/marketing" className={styles.active}>
              <span>05</span>Marketing Centre
            </a>
            <a href="/admin/products"><span>06</span>Products</a>
            <a href="/admin/products/new"><span>07</span>Add Product</a>
            <a href="/admin/shipping"><span>08</span>Shipping</a>
          </nav>

          <div className={styles.adminSidebarFoot}>
            <span>LIVE DISCOUNTS</span>
            <strong>{loading ? "—" : counts.live}</strong>
            <a href="/">OPEN STOREFRONT</a>
          </div>
        </aside>

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>MARKETING CENTRE · DISCOUNTS</span>
              <h1>Discounts</h1>
              <p>
                Schedule real sale prices without changing the regular product
                price.
              </p>
            </div>

            <div className={styles.adminHeaderActions}>
              <div className={styles.adminAttention}>
                <span>LIVE</span>
                <strong>{loading ? "—" : counts.live}</strong>
              </div>
              <div className={styles.adminAttention}>
                <span>SCHEDULED</span>
                <strong>{loading ? "—" : counts.scheduled}</strong>
              </div>
            </div>
          </header>

          <nav className={styles.marketingSubnav}>
            <a href="/admin/marketing/campaigns">Campaigns</a>
            <a href="/admin/marketing/vouchers">Vouchers</a>
            <a
              className={styles.marketingSubnavActive}
              href="/admin/marketing/discounts"
            >
              Discounts
            </a>
          </nav>

          {error ? <p className={styles.adminError}>{error}</p> : null}
          {message ? <p className={styles.adminSuccess}>{message}</p> : null}

          <section className={styles.adminPanel}>
            <div className={styles.adminPanelHead}>
              <div>
                <span className={styles.adminPanelKicker}>CREATE DISCOUNT</span>
                <h2>Schedule Sale Price</h2>
                <p>
                  Select SKUs below, set a percentage and campaign window.
                  Prices automatically return to regular price after the end
                  time.
                </p>
              </div>
            </div>

            <form
              className={styles.discountBuilder}
              onSubmit={applyDiscount}
            >
              <label className={styles.adminField}>
                <span>DISCOUNT %</span>
                <input
                  type="number"
                  min="0.01"
                  max="99.99"
                  step="0.01"
                  value={percent}
                  onChange={(event) => setPercent(event.target.value)}
                />
              </label>

              <label className={styles.adminField}>
                <span>START</span>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                />
              </label>

              <label className={styles.adminField}>
                <span>END</span>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                />
              </label>

              <div className={styles.discountBuilderActions}>
                <button type="button" className={styles.adminSecondaryAction} onClick={() => setPickerOpen(true)}>SELECT PRODUCTS</button>
                <span>
                  {selected.length} SKU{selected.length === 1 ? "" : "s"} selected
                </span>
                <button
                  type="submit"
                  className={styles.adminAction}
                  disabled={busy === "apply" || selected.length === 0}
                >
                  {busy === "apply" ? "APPLYING..." : "APPLY DISCOUNT"}
                </button>
                {selected.length > 0 ? (
                  <button
                    type="button"
                    className={styles.adminSecondaryAction}
                    disabled={busy === "clear"}
                    onClick={() => void clearDiscount(selected)}
                  >
                    REMOVE DISCOUNT
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className={styles.adminPanel}>
            <div className={styles.discountToolbar}>
              <label>
                <span>SEARCH PRODUCT / SKU</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search product, variation or SKU"
                />
              </label>

              <button
                type="button"
                className={styles.adminSecondaryAction}
                onClick={toggleAllVisible}
              >
                {allVisibleSelected ? "CLEAR VISIBLE" : "SELECT ALL VISIBLE"}
              </button>
            </div>

            {loading ? (
              <p className={styles.adminNotice}>Loading product prices...</p>
            ) : filtered.length === 0 ? (
              <div className={styles.adminEmptyState}>
                <strong>No matching SKUs.</strong>
                <span>Try another product name or SKU.</span>
              </div>
            ) : (
              <div className={styles.adminTableWrap}>
                <table
                  className={
                    styles.adminTable + " " + styles.discountTable
                  }
                >
                  <thead>
                    <tr>
                      <th>SELECT</th>
                      <th>PRODUCT</th>
                      <th>VARIATION / SKU</th>
                      <th>REGULAR PRICE</th>
                      <th>DISCOUNT</th>
                      <th>SALE PRICE</th>
                      <th>WINDOW</th>
                      <th>STATUS</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map((row) => {
                      const product = productData(row.products);
                      const status = statusFor(row);
                      const discount = Number(row.discount_percent || 0);

                      return (
                        <tr key={row.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selected.includes(row.id)}
                              onChange={() => toggleSelected(row.id)}
                              aria-label={"Select " + row.sku}
                            />
                          </td>
                          <td>
                            <div className={styles.discountProductCell}>
                              {product?.primary_image_url ? (
                                <img
                                  src={product.primary_image_url}
                                  alt=""
                                />
                              ) : (
                                <span>M</span>
                              )}
                              <strong>
                                {product?.name || "MIVO Product"}
                              </strong>
                            </div>
                          </td>
                          <td>
                            <strong>{row.title || "Default"}</strong>
                            <small>{row.sku}</small>
                          </td>
                          <td>
                            <strong>{money(row.price)}</strong>
                          </td>
                          <td>
                            <strong>
                              {discount > 0 ? discount + "%" : "—"}
                            </strong>
                          </td>
                          <td>
                            <strong
                              className={
                                discount > 0
                                  ? styles.discountSalePrice
                                  : ""
                              }
                            >
                              {discount > 0
                                ? money(salePrice(row))
                                : "—"}
                            </strong>
                          </td>
                          <td>
                            {row.discount_starts_at &&
                            row.discount_ends_at ? (
                              <>
                                <small>
                                  {new Date(
                                    row.discount_starts_at
                                  ).toLocaleString("en-MY", {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </small>
                                <small>
                                  →{" "}
                                  {new Date(
                                    row.discount_ends_at
                                  ).toLocaleString("en-MY", {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </small>
                              </>
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                          <td>
                            <b
                              className={
                                styles.discountStatus +
                                " " +
                                styles[
                                  "discount" +
                                    status.charAt(0) +
                                    status.slice(1).toLowerCase()
                                ]
                              }
                            >
                              {status}
                            </b>
                          </td>
                          <td>
                            {discount > 0 ? (
                              <button
                                type="button"
                                className={styles.discountRemove}
                                disabled={busy === "clear"}
                                onClick={() =>
                                  void clearDiscount([row.id])
                                }
                              >
                                REMOVE
                              </button>
                            ) : (
                              <span>—</span>
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
        </section>
          {pickerOpen ? (
            <div className={styles.productPickerOverlay} role="dialog" aria-modal="true">
              <div className={styles.productPickerModal}>
                <div className={styles.productPickerHead}><div><span>SELECT PRODUCTS & VARIATIONS</span><h2>Choose discount items</h2></div><button type="button" onClick={() => setPickerOpen(false)}>CLOSE</button></div>
                <div className={styles.productPickerSearch}><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, variation or SKU" /><span>{filtered.length} ITEMS</span></div>
                <div className={styles.discountPickerList}>
                  {filtered.map((row) => { const product=productData(row.products); const checked=selected.includes(row.id); return <button type="button" key={row.id} className={checked ? styles.discountPickerSelected : ""} onClick={() => toggleSelected(row.id)}><i>{checked ? "✓" : ""}</i>{product?.primary_image_url ? <img src={product.primary_image_url} alt="" /> : <span className={styles.discountPickerFallback}>M</span>}<span><strong>{product?.name || "MIVO Product"}</strong><small>{row.title || "Default"} · {row.sku}</small><small>{money(row.price)}</small></span></button>})}
                </div>
                <div className={styles.productPickerFooter}><button type="button" className={styles.pickerSelectAll} onClick={toggleAllVisible}>{allVisibleSelected ? "CLEAR VISIBLE" : "SELECT ALL VISIBLE"}</button><span>{selected.length} SKU{selected.length===1?"":"s"} selected</span><button type="button" disabled={!selected.length} onClick={() => setPickerOpen(false)}>CONFIRM</button></div>
              </div>
            </div>
          ) : null}
      </div>
    </main>
  );
}

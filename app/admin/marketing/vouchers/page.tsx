"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../../Admin.module.css";

type CampaignOption = {
  id: string;
  title: string;
};

type RefOption = {
  id: string;
  name: string;
};

type Voucher = {
  id: string;
  campaign_id: string | null;
  code: string;
  name: string;
  description: string | null;
  discount_type: "fixed" | "percent" | "free_shipping";
  discount_value: number | string;
  minimum_spend: number | string;
  max_discount: number | string | null;
  starts_at: string;
  ends_at: string;
  usage_limit: number | null;
  per_user_limit: number;
  first_order_only: boolean;
  scope_type: "all" | "brand" | "category" | "product";
  scope_id: string | null;
  is_active: boolean;
};

function toLocalInput(value?: string) {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function money(value: number | string | null) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(Number(value || 0));
}

function emptyVoucher() {
  return {
    campaign_id: "",
    code: "",
    name: "",
    description: "",
    discount_type: "fixed" as "fixed" | "percent" | "free_shipping",
    discount_value: "10",
    minimum_spend: "100",
    max_discount: "",
    starts_at: toLocalInput(),
    ends_at: toLocalInput(
      new Date(Date.now() + 14 * 86400000).toISOString()
    ),
    usage_limit: "500",
    per_user_limit: "1",
    first_order_only: false,
    scope_type: "all" as "all" | "brand" | "category" | "product",
    scope_id: "",
  };
}

export default function MarketingVouchersPage() {
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [brands, setBrands] = useState<RefOption[]>([]);
  const [categories, setCategories] = useState<RefOption[]>([]);
  const [products, setProducts] = useState<RefOption[]>([]);
  const [form, setForm] = useState(emptyVoucher());
  const [editingId, setEditingId] = useState("");
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login?next=/admin/marketing/vouchers";
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

    const [
      voucherResult,
      campaignResult,
      brandResult,
      categoryResult,
      productResult,
    ] = await Promise.all([
      supabase
        .from("vouchers")
        .select(
          "id, campaign_id, code, name, description, discount_type, discount_value, minimum_spend, max_discount, starts_at, ends_at, usage_limit, per_user_limit, first_order_only, scope_type, scope_id, is_active"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("promotion_campaigns")
        .select("id, title")
        .order("starts_at", { ascending: false }),
      supabase.from("brands").select("id, name").order("name"),
      supabase.from("categories").select("id, name").order("name"),
      supabase
        .from("products")
        .select("id, name")
        .eq("status", "active")
        .order("name"),
    ]);

    const firstError =
      voucherResult.error ||
      campaignResult.error ||
      brandResult.error ||
      categoryResult.error ||
      productResult.error;

    if (firstError) throw firstError;

    setVouchers((voucherResult.data as Voucher[] | null) || []);
    setCampaigns(
      (campaignResult.data as CampaignOption[] | null) || []
    );
    setBrands((brandResult.data as RefOption[] | null) || []);
    setCategories((categoryResult.data as RefOption[] | null) || []);
    setProducts((productResult.data as RefOption[] | null) || []);
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
            : "Unable to load vouchers."
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

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => product.name.toLowerCase().includes(query));
  }, [products, productSearch]);

  const scopeOptions = useMemo(() => {
    if (form.scope_type === "brand") return brands;
    if (form.scope_type === "category") return categories;
    if (form.scope_type === "product") return products;
    return [];
  }, [form.scope_type, brands, categories, products]);

  async function saveVoucher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("save");
    setError("");
    setMessage("");

    try {
      if (form.scope_type !== "all" && !form.scope_id) {
        throw new Error("Choose where this voucher applies.");
      }

      const start = new Date(form.starts_at);
      const end = new Date(form.ends_at);

      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
      ) {
        throw new Error("Choose a valid voucher start and end time.");
      }

      const supabase = createClient();
      const payload = {
        campaign_id: form.campaign_id || null,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        discount_type: form.discount_type,
        discount_value:
          form.discount_type === "free_shipping"
            ? 0
            : Number(form.discount_value || 0),
        minimum_spend: Number(form.minimum_spend || 0),
        max_discount: form.max_discount
          ? Number(form.max_discount)
          : null,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        usage_limit: form.usage_limit
          ? Number(form.usage_limit)
          : null,
        per_user_limit: Math.max(
          1,
          Number(form.per_user_limit || 1)
        ),
        first_order_only: form.first_order_only,
        scope_type: form.scope_type,
        scope_id:
          form.scope_type === "all" ? null : form.scope_id || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      const result = editingId
        ? await supabase
            .from("vouchers")
            .update(payload)
            .eq("id", editingId)
        : await supabase.from("vouchers").insert(payload);

      if (result.error) throw result.error;

      await load();
      setForm(emptyVoucher());
      setSelectedProductIds([]);
      setEditingId("");
      setMessage(editingId ? "Voucher updated." : "Voucher created.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save voucher."
      );
    } finally {
      setBusy("");
    }
  }

  function editVoucher(voucher: Voucher) {
    setEditingId(voucher.id);
    setForm({
      campaign_id: voucher.campaign_id || "",
      code: voucher.code,
      name: voucher.name,
      description: voucher.description || "",
      discount_type: voucher.discount_type,
      discount_value: String(voucher.discount_value || 0),
      minimum_spend: String(voucher.minimum_spend || 0),
      max_discount:
        voucher.max_discount === null
          ? ""
          : String(voucher.max_discount),
      starts_at: toLocalInput(voucher.starts_at),
      ends_at: toLocalInput(voucher.ends_at),
      usage_limit:
        voucher.usage_limit === null
          ? ""
          : String(voucher.usage_limit),
      per_user_limit: String(voucher.per_user_limit || 1),
      first_order_only: voucher.first_order_only,
      scope_type: voucher.scope_type,
      scope_id: voucher.scope_id || "",
    });
    setSelectedProductIds(
      voucher.scope_type === "product" && voucher.scope_id
        ? [voucher.scope_id]
        : []
    );
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleVoucher(voucher: Voucher) {
    setBusy("toggle-" + voucher.id);
    setError("");

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("vouchers")
        .update({ is_active: !voucher.is_active })
        .eq("id", voucher.id);

      if (updateError) throw updateError;
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update voucher."
      );
    } finally {
      setBusy("");
    }
  }

  async function deleteVoucher(voucher: Voucher) {
    if (
      !window.confirm(
        "Delete voucher " +
          voucher.code +
          "? Unused customer claims will also be removed."
      )
    ) {
      return;
    }

    setBusy("delete-" + voucher.id);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase.rpc(
        "admin_delete_voucher",
        { p_voucher_id: voucher.id }
      );

      if (deleteError) throw deleteError;

      if (editingId === voucher.id) {
        setEditingId("");
        setForm(emptyVoucher());
      }

      await load();
      setMessage("Voucher " + voucher.code + " deleted.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to delete voucher."
      );
    } finally {
      setBusy("");
    }
  }

  const activeCount = vouchers.filter((item) => item.is_active).length;

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
            <span>ACTIVE VOUCHERS</span>
            <strong>{loading ? "—" : activeCount}</strong>
            <a href="/admin/marketing">MARKETING CENTRE</a>
          </div>
        </aside>

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>
                MARKETING CENTRE · VOUCHERS
              </span>
              <h1>Vouchers</h1>
              <p>
                Build discount and shipping vouchers with Shopee-style
                conditions.
              </p>
            </div>
            <div className={styles.adminHeaderActions}>
              <a
                href="/admin/marketing"
                className={styles.adminSecondaryAction}
              >
                ← MARKETING CENTRE
              </a>
            </div>
          </header>

          <nav className={styles.marketingSubnav}>
            <a href="/admin/marketing/campaigns">Campaigns</a>
            <a
              className={styles.marketingSubnavActive}
              href="/admin/marketing/vouchers"
            >
              Vouchers
            </a>
            <a href="/admin/marketing/discounts">Discounts</a>
          </nav>

          {error ? <p className={styles.adminError}>{error}</p> : null}
          {message ? <p className={styles.adminSuccess}>{message}</p> : null}

          <div className={styles.marketingManagerGrid}>
            <section className={styles.adminPanel}>
              <div className={styles.adminPanelHead}>
                <div>
                  <span className={styles.adminPanelKicker}>
                    {editingId ? "EDIT VOUCHER" : "CREATE VOUCHER"}
                  </span>
                  <h2>Voucher Builder</h2>
                  <p>
                    Minimum spend, caps, usage limits and product scope are
                    shown to customers at checkout.
                  </p>
                </div>
              </div>

              <form className={styles.adminForm} onSubmit={saveVoucher}>
                <div className={styles.adminFormGrid}>
                  <label className={styles.adminField}>
                    <span>CODE</span>
                    <input
                      required
                      value={form.code}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          code: event.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="MIVO10"
                    />
                  </label>

                  <label className={styles.adminField}>
                    <span>NAME</span>
                    <input
                      required
                      value={form.name}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="RM10 OFF"
                    />
                  </label>

                  <label className={styles.adminField + " " + styles.full}>
                    <span>DESCRIPTION</span>
                    <input
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Spend RM100 and save RM10."
                    />
                  </label>

                  <label className={styles.adminField}>
                    <span>CAMPAIGN</span>
                    <select
                      value={form.campaign_id}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          campaign_id: event.target.value,
                        }))
                      }
                    >
                      <option value="">Standalone voucher</option>
                      {campaigns.map((campaign) => (
                        <option value={campaign.id} key={campaign.id}>
                          {campaign.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.adminField}>
                    <span>TYPE</span>
                    <select
                      value={form.discount_type}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          discount_type: event.target.value as
                            | "fixed"
                            | "percent"
                            | "free_shipping",
                        }))
                      }
                    >
                      <option value="fixed">Fixed amount</option>
                      <option value="percent">Percentage</option>
                      <option value="free_shipping">Free shipping</option>
                    </select>
                  </label>

                  {form.discount_type !== "free_shipping" ? (
                    <label className={styles.adminField}>
                      <span>
                        {form.discount_type === "percent"
                          ? "DISCOUNT %"
                          : "DISCOUNT RM"}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.discount_value}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            discount_value: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ) : null}

                  <label className={styles.adminField}>
                    <span>MINIMUM SPEND</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.minimum_spend}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          minimum_spend: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className={styles.adminField}>
                    <span>MAX DISCOUNT</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.max_discount}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          max_discount: event.target.value,
                        }))
                      }
                      placeholder="Optional"
                    />
                  </label>

                  <label className={styles.adminField}>
                    <span>SCOPE</span>
                    <select
                      value={form.scope_type}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          scope_type: event.target.value as
                            | "all"
                            | "brand"
                            | "category"
                            | "product",
                          scope_id: "",
                        }));
                        setSelectedProductIds([]);
                      }
                    >
                      <option value="all">All products</option>
                      <option value="brand">Selected brand</option>
                      <option value="category">Selected category</option>
                      <option value="product">Selected product</option>
                    </select>
                  </label>

                  {form.scope_type !== "all" ? (
                    form.scope_type === "product" ? (
                      <div className={styles.adminField + " " + styles.full}>
                        <span>APPLIES TO</span>
                        <button type="button" className={styles.productPickerTrigger} onClick={() => setProductPickerOpen(true)}>
                          <span>{selectedProductIds.length ? selectedProductIds.length + " products selected" : form.scope_id ? "1 product selected" : "Select products"}</span>
                          <b>SELECT</b>
                        </button>
                      </div>
                    ) : (
                      <label className={styles.adminField}>
                        <span>APPLIES TO</span>
                        <select required value={form.scope_id} onChange={(event) => setForm((current) => ({ ...current, scope_id: event.target.value }))}>
                          <option value="">Choose</option>
                          {scopeOptions.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}
                        </select>
                      </label>
                    )
                  ) : null}

                  <label className={styles.adminField}>
                    <span>TOTAL USAGE LIMIT</span>
                    <input
                      type="number"
                      min="1"
                      value={form.usage_limit}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          usage_limit: event.target.value,
                        }))
                      }
                      placeholder="Unlimited if blank"
                    />
                  </label>

                  <label className={styles.adminField}>
                    <span>PER USER LIMIT</span>
                    <input
                      type="number"
                      min="1"
                      value={form.per_user_limit}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          per_user_limit: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className={styles.promotionCheck}>
                    <input
                      type="checkbox"
                      checked={form.first_order_only}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          first_order_only: event.target.checked,
                        }))
                      }
                    />
                    <span>FIRST ORDER ONLY</span>
                  </label>

                  <label className={styles.adminField}>
                    <span>START</span>
                    <input
                      type="datetime-local"
                      required
                      value={form.starts_at}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          starts_at: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className={styles.adminField}>
                    <span>END</span>
                    <input
                      type="datetime-local"
                      required
                      value={form.ends_at}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          ends_at: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <div className={styles.marketingFormActions}>
                  <button
                    type="submit"
                    className={styles.adminAction}
                    disabled={busy === "save"}
                  >
                    {busy === "save"
                      ? "SAVING..."
                      : editingId
                        ? "SAVE VOUCHER"
                        : "+ CREATE VOUCHER"}
                  </button>

                  {editingId ? (
                    <button
                      type="button"
                      className={styles.adminSecondaryAction}
                      onClick={() => {
                        setEditingId("");
                        setForm(emptyVoucher());
                        setSelectedProductIds([]);
                      }}
                    >
                      CANCEL EDIT
                    </button>
                  ) : null}
                </div>
              </form>
            </section>

            <section className={styles.adminPanel}>
              <div className={styles.adminPanelHead}>
                <div>
                  <span className={styles.adminPanelKicker}>VOUCHER LIST</span>
                  <h2>{vouchers.length} Vouchers</h2>
                  <p>Active, paused and historical voucher setup.</p>
                </div>
              </div>

              {loading ? (
                <p className={styles.adminNotice}>Loading vouchers...</p>
              ) : vouchers.length === 0 ? (
                <div className={styles.adminEmptyState}>
                  <strong>No vouchers yet.</strong>
                  <span>Create your first voucher on the left.</span>
                </div>
              ) : (
                <div className={styles.marketingVoucherList}>
                  {vouchers.map((voucher) => (
                    <article key={voucher.id}>
                      <div className={styles.marketingVoucherTicket}>
                        <span>{voucher.code}</span>
                        <strong>{voucher.name}</strong>
                        <small>
                          Min. Spend {money(voucher.minimum_spend)}
                          {voucher.max_discount
                            ? " · Cap " + money(voucher.max_discount)
                            : ""}
                        </small>
                      </div>

                      <div className={styles.marketingVoucherMeta}>
                        <span>{voucher.scope_type.toUpperCase()}</span>
                        <small>
                          {new Date(voucher.ends_at).toLocaleDateString(
                            "en-MY",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </small>
                        {voucher.first_order_only ? (
                          <b>FIRST ORDER</b>
                        ) : null}
                      </div>

                      <div className={styles.promotionRowActions}>
                        <button
                          type="button"
                          className={styles.promotionEdit}
                          onClick={() => editVoucher(voucher)}
                        >
                          EDIT
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleVoucher(voucher)}
                          disabled={busy === "toggle-" + voucher.id}
                          className={
                            voucher.is_active
                              ? styles.promotionOn
                              : styles.promotionOff
                          }
                        >
                          {voucher.is_active ? "ACTIVE" : "OFF"}
                        </button>
                        <button
                          type="button"
                          className={styles.promotionDelete}
                          onClick={() => void deleteVoucher(voucher)}
                          disabled={busy === "delete-" + voucher.id}
                        >
                          {busy === "delete-" + voucher.id
                            ? "DELETING..."
                            : "DELETE"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
          {productPickerOpen ? (
            <div className={styles.productPickerOverlay} role="dialog" aria-modal="true">
              <div className={styles.productPickerModal}>
                <div className={styles.productPickerHead}><div><span>SELECT PRODUCTS</span><h2>Choose eligible products</h2></div><button type="button" onClick={() => setProductPickerOpen(false)}>CLOSE</button></div>
                <div className={styles.productPickerSearch}><input autoFocus placeholder="Search product name" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} /><span>{filteredProducts.length} PRODUCTS</span></div>
                <div className={styles.productPickerList}>
                  {filteredProducts.map((product) => {
                    const selected = form.scope_id === product.id;

                    return (
                      <button
                        type="button"
                        key={product.id}
                        className={
                          selected ? styles.productPickerSelected : ""
                        }
                        onClick={() => {
                          const nextId = selected ? "" : product.id;

                          setSelectedProductIds(
                            nextId ? [nextId] : []
                          );
                          setForm((current) => ({
                            ...current,
                            scope_id: nextId,
                          }));
                        }}
                      >
                        <i>{selected ? "✓" : ""}</i>
                        <span>{product.name}</span>
                      </button>
                    );
                  })}
                </div>
                <div className={styles.productPickerFooter}>
                  <span>
                    {form.scope_id
                      ? "1 product selected"
                      : "No product selected"}
                  </span>
                  <button
                    type="button"
                    disabled={!form.scope_id}
                    onClick={() => setProductPickerOpen(false)}
                  >
                    CONFIRM
                  </button>
                </div>
              </div>
            </div>
          ) : null}
      </div>
    </main>
  );
}

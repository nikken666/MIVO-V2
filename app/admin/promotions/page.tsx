"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../Admin.module.css";

type Campaign = {
  id: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
  cta_label: string;
  landing_path: string;
  theme: string;
  starts_at: string;
  ends_at: string;
  sort_order: number;
  is_active: boolean;
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

type RefOption = {
  id: string;
  name: string;
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

export default function AdminPromotionsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [brands, setBrands] = useState<RefOption[]>([]);
  const [categories, setCategories] = useState<RefOption[]>([]);
  const [products, setProducts] = useState<RefOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [campaignForm, setCampaignForm] = useState({
    title: "",
    subtitle: "",
    badge: "LIMITED TIME",
    cta_label: "SHOP NOW",
    landing_path: "/products",
    theme: "red",
    starts_at: toLocalInput(),
    ends_at: toLocalInput(
      new Date(Date.now() + 14 * 86400000).toISOString()
    ),
  });

  const [voucherForm, setVoucherForm] = useState({
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
  });

  async function load() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login?next=/admin/promotions";
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
      campaignResult,
      voucherResult,
      brandResult,
      categoryResult,
      productResult,
    ] = await Promise.all([
      supabase
        .from("promotion_campaigns")
        .select(
          "id, title, subtitle, badge, cta_label, landing_path, theme, starts_at, ends_at, sort_order, is_active"
        )
        .order("starts_at", { ascending: false }),
      supabase
        .from("vouchers")
        .select(
          "id, campaign_id, code, name, description, discount_type, discount_value, minimum_spend, max_discount, starts_at, ends_at, usage_limit, per_user_limit, first_order_only, scope_type, scope_id, is_active"
        )
        .order("created_at", { ascending: false }),
      supabase.from("brands").select("id, name").order("name"),
      supabase.from("categories").select("id, name").order("name"),
      supabase
        .from("products")
        .select("id, name")
        .eq("status", "active")
        .order("name"),
    ]);

    const firstError =
      campaignResult.error ||
      voucherResult.error ||
      brandResult.error ||
      categoryResult.error ||
      productResult.error;

    if (firstError) throw firstError;

    setCampaigns((campaignResult.data as Campaign[] | null) || []);
    setVouchers((voucherResult.data as Voucher[] | null) || []);
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
            : "Unable to load promotions."
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

  const scopeOptions = useMemo(() => {
    if (voucherForm.scope_type === "brand") return brands;
    if (voucherForm.scope_type === "category") return categories;
    if (voucherForm.scope_type === "product") return products;
    return [];
  }, [voucherForm.scope_type, brands, categories, products]);

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("campaign");
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { error: insertError } = await supabase
        .from("promotion_campaigns")
        .insert({
          title: campaignForm.title.trim(),
          subtitle: campaignForm.subtitle.trim() || null,
          badge: campaignForm.badge.trim() || null,
          cta_label: campaignForm.cta_label.trim() || "SHOP NOW",
          landing_path: campaignForm.landing_path.trim() || "/products",
          theme: campaignForm.theme,
          starts_at: new Date(campaignForm.starts_at).toISOString(),
          ends_at: new Date(campaignForm.ends_at).toISOString(),
          is_active: true,
        });

      if (insertError) throw insertError;

      await load();
      setCampaignForm((current) => ({
        ...current,
        title: "",
        subtitle: "",
      }));
      setMessage("Campaign created.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create campaign."
      );
    } finally {
      setBusy("");
    }
  }

  async function createVoucher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("voucher");
    setError("");
    setMessage("");

    try {
      if (voucherForm.scope_type !== "all" && !voucherForm.scope_id) {
        throw new Error("Choose where this voucher applies.");
      }

      const supabase = createClient();
      const { error: insertError } = await supabase.from("vouchers").insert({
        campaign_id: voucherForm.campaign_id || null,
        code: voucherForm.code.trim().toUpperCase(),
        name: voucherForm.name.trim(),
        description: voucherForm.description.trim() || null,
        discount_type: voucherForm.discount_type,
        discount_value:
          voucherForm.discount_type === "free_shipping"
            ? 0
            : Number(voucherForm.discount_value || 0),
        minimum_spend: Number(voucherForm.minimum_spend || 0),
        max_discount: voucherForm.max_discount
          ? Number(voucherForm.max_discount)
          : null,
        starts_at: new Date(voucherForm.starts_at).toISOString(),
        ends_at: new Date(voucherForm.ends_at).toISOString(),
        usage_limit: voucherForm.usage_limit
          ? Number(voucherForm.usage_limit)
          : null,
        per_user_limit: Math.max(1, Number(voucherForm.per_user_limit || 1)),
        first_order_only: voucherForm.first_order_only,
        scope_type: voucherForm.scope_type,
        scope_id:
          voucherForm.scope_type === "all"
            ? null
            : voucherForm.scope_id || null,
        is_active: true,
      });

      if (insertError) throw insertError;

      await load();
      setVoucherForm((current) => ({
        ...current,
        code: "",
        name: "",
        description: "",
      }));
      setMessage("Voucher created.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create voucher."
      );
    } finally {
      setBusy("");
    }
  }

  async function toggleCampaign(campaign: Campaign) {
    setBusy(campaign.id);
    setError("");

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("promotion_campaigns")
        .update({ is_active: !campaign.is_active })
        .eq("id", campaign.id);

      if (updateError) throw updateError;
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to update campaign."
      );
    } finally {
      setBusy("");
    }
  }

  async function toggleVoucher(voucher: Voucher) {
    setBusy(voucher.id);
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
        caught instanceof Error ? caught.message : "Unable to update voucher."
      );
    } finally {
      setBusy("");
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
            <a href="/admin/claims"><span>04</span>Claims</a>
            <a href="/admin/promotions" className={styles.active}>
              <span>05</span>Promotions
            </a>
            <a href="/admin/products"><span>06</span>Products</a>
            <a href="/admin/products/new"><span>07</span>Add Product</a>
            <a href="/admin/shipping"><span>08</span>Shipping</a>
          </nav>

          <div className={styles.adminSidebarFoot}>
            <span>CAMPAIGNS</span>
            <strong>
              {campaigns.filter((campaign) => campaign.is_active).length} ACTIVE
            </strong>
            <a href="/">OPEN STOREFRONT ↗</a>
          </div>
        </aside>

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>MIVO · GROWTH TOOLS</span>
              <h1>Promotions</h1>
              <p>Campaign banners, vouchers and checkout discounts.</p>
            </div>
          </header>

          {error ? <p className={styles.adminError}>{error}</p> : null}
          {message ? <p className={styles.adminSuccess}>{message}</p> : null}

          {loading ? (
            <p className={styles.adminNotice}>Loading promotions...</p>
          ) : (
            <div className={styles.promotionAdminGrid}>
              <section className={styles.adminPanel}>
                <div className={styles.adminPanelHead}>
                  <div>
                    <span className={styles.adminPanelKicker}>CAMPAIGNS</span>
                    <h2>Homepage Campaign</h2>
                    <p>Create 10.10, 11.11, Payday and seasonal banners.</p>
                  </div>
                </div>

                <form className={styles.adminForm} onSubmit={createCampaign}>
                  <div className={styles.adminFormGrid}>
                    <label className={styles.adminField}>
                      <span>TITLE</span>
                      <input
                        required
                        value={campaignForm.title}
                        onChange={(event) =>
                          setCampaignForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        placeholder="11.11 MEGA DEALS"
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>BADGE</span>
                      <input
                        value={campaignForm.badge}
                        onChange={(event) =>
                          setCampaignForm((current) => ({
                            ...current,
                            badge: event.target.value,
                          }))
                        }
                        placeholder="LIMITED TIME"
                      />
                    </label>

                    <label className={styles.adminField + " " + styles.full}>
                      <span>SUBTITLE</span>
                      <input
                        value={campaignForm.subtitle}
                        onChange={(event) =>
                          setCampaignForm((current) => ({
                            ...current,
                            subtitle: event.target.value,
                          }))
                        }
                        placeholder="Big automotive savings for a limited time."
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>CTA LABEL</span>
                      <input
                        value={campaignForm.cta_label}
                        onChange={(event) =>
                          setCampaignForm((current) => ({
                            ...current,
                            cta_label: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>LANDING PATH</span>
                      <input
                        value={campaignForm.landing_path}
                        onChange={(event) =>
                          setCampaignForm((current) => ({
                            ...current,
                            landing_path: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>START</span>
                      <input
                        type="datetime-local"
                        required
                        value={campaignForm.starts_at}
                        onChange={(event) =>
                          setCampaignForm((current) => ({
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
                        value={campaignForm.ends_at}
                        onChange={(event) =>
                          setCampaignForm((current) => ({
                            ...current,
                            ends_at: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    className={styles.adminAction}
                    disabled={busy === "campaign"}
                  >
                    {busy === "campaign" ? "CREATING..." : "+ CREATE CAMPAIGN"}
                  </button>
                </form>

                <div className={styles.promotionList}>
                  {campaigns.map((campaign) => (
                    <article key={campaign.id}>
                      <div>
                        <span>{campaign.badge || "CAMPAIGN"}</span>
                        <strong>{campaign.title}</strong>
                        <small>
                          {new Date(campaign.starts_at).toLocaleDateString("en-MY")}
                          {" → "}
                          {new Date(campaign.ends_at).toLocaleDateString("en-MY")}
                        </small>
                      </div>
                      <button
                        type="button"
                        onClick={() => void toggleCampaign(campaign)}
                        disabled={busy === campaign.id}
                        className={
                          campaign.is_active
                            ? styles.promotionOn
                            : styles.promotionOff
                        }
                      >
                        {campaign.is_active ? "ACTIVE" : "OFF"}
                      </button>
                    </article>
                  ))}
                </div>
              </section>

              <section className={styles.adminPanel}>
                <div className={styles.adminPanelHead}>
                  <div>
                    <span className={styles.adminPanelKicker}>VOUCHERS</span>
                    <h2>Voucher Builder</h2>
                    <p>Fixed discount, percentage or free shipping.</p>
                  </div>
                </div>

                <form className={styles.adminForm} onSubmit={createVoucher}>
                  <div className={styles.adminFormGrid}>
                    <label className={styles.adminField}>
                      <span>CODE</span>
                      <input
                        required
                        value={voucherForm.code}
                        onChange={(event) =>
                          setVoucherForm((current) => ({
                            ...current,
                            code: event.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="MIVO11"
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>NAME</span>
                      <input
                        required
                        value={voucherForm.name}
                        onChange={(event) =>
                          setVoucherForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        placeholder="RM11 OFF"
                      />
                    </label>

                    <label className={styles.adminField + " " + styles.full}>
                      <span>DESCRIPTION</span>
                      <input
                        value={voucherForm.description}
                        onChange={(event) =>
                          setVoucherForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        placeholder="Spend RM111 and save RM11."
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>CAMPAIGN</span>
                      <select
                        value={voucherForm.campaign_id}
                        onChange={(event) =>
                          setVoucherForm((current) => ({
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
                        value={voucherForm.discount_type}
                        onChange={(event) =>
                          setVoucherForm((current) => ({
                            ...current,
                            discount_type: event.target.value as
                              | "fixed"
                              | "percent"
                              | "free_shipping",
                          }))
                        }
                      >
                        <option value="fixed">Fixed RM discount</option>
                        <option value="percent">Percentage</option>
                        <option value="free_shipping">Free shipping</option>
                      </select>
                    </label>

                    {voucherForm.discount_type !== "free_shipping" ? (
                      <label className={styles.adminField}>
                        <span>
                          {voucherForm.discount_type === "percent"
                            ? "DISCOUNT %"
                            : "DISCOUNT RM"}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={voucherForm.discount_value}
                          onChange={(event) =>
                            setVoucherForm((current) => ({
                              ...current,
                              discount_value: event.target.value,
                            }))
                          }
                        />
                      </label>
                    ) : null}

                    <label className={styles.adminField}>
                      <span>MINIMUM SPEND RM</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={voucherForm.minimum_spend}
                        onChange={(event) =>
                          setVoucherForm((current) => ({
                            ...current,
                            minimum_spend: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>MAX DISCOUNT RM</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={voucherForm.max_discount}
                        onChange={(event) =>
                          setVoucherForm((current) => ({
                            ...current,
                            max_discount: event.target.value,
                          }))
                        }
                        placeholder="Optional"
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>APPLIES TO</span>
                      <select
                        value={voucherForm.scope_type}
                        onChange={(event) =>
                          setVoucherForm((current) => ({
                            ...current,
                            scope_type: event.target.value as
                              | "all"
                              | "brand"
                              | "category"
                              | "product",
                            scope_id: "",
                          }))
                        }
                      >
                        <option value="all">All products</option>
                        <option value="brand">Brand</option>
                        <option value="category">Category</option>
                        <option value="product">Selected product</option>
                      </select>
                    </label>

                    {voucherForm.scope_type !== "all" ? (
                      <label className={styles.adminField}>
                        <span>SELECT {voucherForm.scope_type.toUpperCase()}</span>
                        <select
                          required
                          value={voucherForm.scope_id}
                          onChange={(event) =>
                            setVoucherForm((current) => ({
                              ...current,
                              scope_id: event.target.value,
                            }))
                          }
                        >
                          <option value="">Choose...</option>
                          {scopeOptions.map((option) => (
                            <option value={option.id} key={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}

                    <label className={styles.adminField}>
                      <span>USAGE LIMIT</span>
                      <input
                        type="number"
                        min="1"
                        value={voucherForm.usage_limit}
                        onChange={(event) =>
                          setVoucherForm((current) => ({
                            ...current,
                            usage_limit: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>PER USER</span>
                      <input
                        type="number"
                        min="1"
                        value={voucherForm.per_user_limit}
                        onChange={(event) =>
                          setVoucherForm((current) => ({
                            ...current,
                            per_user_limit: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>START</span>
                      <input
                        type="datetime-local"
                        required
                        value={voucherForm.starts_at}
                        onChange={(event) =>
                          setVoucherForm((current) => ({
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
                        value={voucherForm.ends_at}
                        onChange={(event) =>
                          setVoucherForm((current) => ({
                            ...current,
                            ends_at: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className={styles.promotionCheck}>
                      <input
                        type="checkbox"
                        checked={voucherForm.first_order_only}
                        onChange={(event) =>
                          setVoucherForm((current) => ({
                            ...current,
                            first_order_only: event.target.checked,
                          }))
                        }
                      />
                      <span>FIRST ORDER ONLY</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className={styles.adminAction}
                    disabled={busy === "voucher"}
                  >
                    {busy === "voucher" ? "CREATING..." : "+ CREATE VOUCHER"}
                  </button>
                </form>

                <div className={styles.promotionList}>
                  {vouchers.map((voucher) => (
                    <article key={voucher.id}>
                      <div>
                        <span>{voucher.code}</span>
                        <strong>{voucher.name}</strong>
                        <small>
                          Min {money(voucher.minimum_spend)} ·{" "}
                          {voucher.scope_type.toUpperCase()}
                        </small>
                      </div>
                      <button
                        type="button"
                        onClick={() => void toggleVoucher(voucher)}
                        disabled={busy === voucher.id}
                        className={
                          voucher.is_active
                            ? styles.promotionOn
                            : styles.promotionOff
                        }
                      >
                        {voucher.is_active ? "ACTIVE" : "OFF"}
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

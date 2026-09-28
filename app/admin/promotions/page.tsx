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
  primary_color: string;
  secondary_color: string;
  text_color: string;
  muted_text_color: string;
  countdown_bg_color: string;
  countdown_text_color: string;
  button_bg_color: string;
  button_text_color: string;
  starts_at: string;
  ends_at: string;
  sort_order: number;
  desktop_image_url: string | null;
  mobile_image_url: string | null;
  display_mode: "overlay" | "image_only";
  overlay_opacity: number | string;
  show_countdown: boolean;
  image_position: "center" | "left" | "right" | "top" | "bottom";
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


const campaignPresets = {
  red_sale: {
    label: "MIVO RED",
    description: "Bold campaign red",
    primary_color: "#D8242F",
    secondary_color: "#6F0D14",
    text_color: "#FFFFFF",
    muted_text_color: "#FFE9EA",
    countdown_bg_color: "#2B1014",
    countdown_text_color: "#FFFFFF",
    button_bg_color: "#FFFFFF",
    button_text_color: "#B61923",
  },
  orange_market: {
    label: "ORANGE SALE",
    description: "Marketplace promo",
    primary_color: "#F4511E",
    secondary_color: "#C62828",
    text_color: "#FFFFFF",
    muted_text_color: "#FFF0E8",
    countdown_bg_color: "#7A2414",
    countdown_text_color: "#FFFFFF",
    button_bg_color: "#FFFFFF",
    button_text_color: "#E74616",
  },
  black_premium: {
    label: "BLACK PREMIUM",
    description: "Dark luxury look",
    primary_color: "#17191B",
    secondary_color: "#050607",
    text_color: "#FFFFFF",
    muted_text_color: "#C6C9CB",
    countdown_bg_color: "#050607",
    countdown_text_color: "#FFFFFF",
    button_bg_color: "#D8242F",
    button_text_color: "#FFFFFF",
  },
  blue_tech: {
    label: "BLUE TECH",
    description: "Cool technology",
    primary_color: "#1769AA",
    secondary_color: "#0A2B4C",
    text_color: "#FFFFFF",
    muted_text_color: "#D9EDFF",
    countdown_bg_color: "#09243D",
    countdown_text_color: "#FFFFFF",
    button_bg_color: "#FFFFFF",
    button_text_color: "#0D5E9B",
  },
  gold_premium: {
    label: "GOLD PREMIUM",
    description: "Premium seasonal",
    primary_color: "#B8892E",
    secondary_color: "#3B2A0E",
    text_color: "#FFFFFF",
    muted_text_color: "#F5E8C8",
    countdown_bg_color: "#2C1F0A",
    countdown_text_color: "#FFF7E3",
    button_bg_color: "#FFF4D7",
    button_text_color: "#5F430E",
  },
} as const;

type CampaignPresetKey = keyof typeof campaignPresets;

type CampaignColorField =
  | "primary_color"
  | "secondary_color"
  | "text_color"
  | "muted_text_color"
  | "countdown_bg_color"
  | "countdown_text_color"
  | "button_bg_color"
  | "button_text_color";

type CampaignFormState = {
  title: string;
  subtitle: string;
  badge: string;
  cta_label: string;
  landing_path: string;
  theme: string;
  primary_color: string;
  secondary_color: string;
  text_color: string;
  muted_text_color: string;
  countdown_bg_color: string;
  countdown_text_color: string;
  button_bg_color: string;
  button_text_color: string;
  desktop_image_url: string;
  mobile_image_url: string;
  display_mode: "overlay" | "image_only";
  overlay_opacity: string;
  show_countdown: boolean;
  image_position: "center" | "left" | "right" | "top" | "bottom";
  starts_at: string;
  ends_at: string;
};

const campaignColorFields: Array<[string, CampaignColorField]> = [
  ["PRIMARY", "primary_color"],
  ["SECONDARY", "secondary_color"],
  ["TEXT", "text_color"],
  ["SUBTEXT", "muted_text_color"],
  ["COUNTDOWN BG", "countdown_bg_color"],
  ["COUNTDOWN TEXT", "countdown_text_color"],
  ["BUTTON BG", "button_bg_color"],
  ["BUTTON TEXT", "button_text_color"],
];

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
  const [editingCampaignId, setEditingCampaignId] = useState("");
  const [editingVoucherId, setEditingVoucherId] = useState("");
  const [campaignImageBusy, setCampaignImageBusy] = useState("");

  const [campaignForm, setCampaignForm] = useState<CampaignFormState>({
    title: "",
    subtitle: "",
    badge: "LIMITED TIME",
    cta_label: "SHOP NOW",
    landing_path: "/products",
    theme: "red_sale",
    primary_color: campaignPresets.red_sale.primary_color,
    secondary_color: campaignPresets.red_sale.secondary_color,
    text_color: campaignPresets.red_sale.text_color,
    muted_text_color: campaignPresets.red_sale.muted_text_color,
    countdown_bg_color: campaignPresets.red_sale.countdown_bg_color,
    countdown_text_color: campaignPresets.red_sale.countdown_text_color,
    button_bg_color: campaignPresets.red_sale.button_bg_color,
    button_text_color: campaignPresets.red_sale.button_text_color,
    desktop_image_url: "",
    mobile_image_url: "",
    display_mode: "overlay" as "overlay" | "image_only",
    overlay_opacity: "0.35",
    show_countdown: true,
    image_position: "center" as "center" | "left" | "right" | "top" | "bottom",
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
          "id, title, subtitle, badge, cta_label, landing_path, theme, primary_color, secondary_color, text_color, muted_text_color, countdown_bg_color, countdown_text_color, button_bg_color, button_text_color, desktop_image_url, mobile_image_url, display_mode, overlay_opacity, show_countdown, image_position, starts_at, ends_at, sort_order, is_active"
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

  function updateCampaignColor(
    field: CampaignColorField,
    value: string
  ) {
    setCampaignForm((current) => ({
      ...current,
      theme: "custom",
      [field]: value.toUpperCase(),
    }));
  }

  function applyCampaignPreset(presetKey: CampaignPresetKey) {
    const preset = campaignPresets[presetKey];

    setCampaignForm((current) => ({
      ...current,
      theme: presetKey,
      primary_color: preset.primary_color,
      secondary_color: preset.secondary_color,
      text_color: preset.text_color,
      muted_text_color: preset.muted_text_color,
      countdown_bg_color: preset.countdown_bg_color,
      countdown_text_color: preset.countdown_text_color,
      button_bg_color: preset.button_bg_color,
      button_text_color: preset.button_text_color,
    }));
  }

  const scopeOptions = useMemo(() => {
    if (voucherForm.scope_type === "brand") return brands;
    if (voucherForm.scope_type === "category") return categories;
    if (voucherForm.scope_type === "product") return products;
    return [];
  }, [voucherForm.scope_type, brands, categories, products]);

  async function uploadCampaignImage(
    file: File,
    kind: "desktop" | "mobile"
  ) {
    setCampaignImageBusy(kind);
    setError("");
    setMessage("");

    try {
      const body = new FormData();
      body.append("image", file);
      body.append("kind", kind);

      const response = await fetch("/api/admin/promotions/banner", {
        method: "POST",
        body,
      });

      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !result.url) {
        throw new Error(result.error || "Unable to upload banner image.");
      }

      setCampaignForm((current) => ({
        ...current,
        [kind === "desktop"
          ? "desktop_image_url"
          : "mobile_image_url"]: result.url,
      }));
      setMessage(
        kind === "desktop"
          ? "Desktop banner uploaded."
          : "Mobile banner uploaded."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to upload banner image."
      );
    } finally {
      setCampaignImageBusy("");
    }
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("campaign");
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const payload = {
        title: campaignForm.title.trim(),
        subtitle: campaignForm.subtitle.trim() || null,
        badge: campaignForm.badge.trim() || null,
        cta_label: campaignForm.cta_label.trim() || "SHOP NOW",
        landing_path: campaignForm.landing_path.trim() || "/products",
        theme: campaignForm.theme,
        primary_color: campaignForm.primary_color,
        secondary_color: campaignForm.secondary_color,
        text_color: campaignForm.text_color,
        muted_text_color: campaignForm.muted_text_color,
        countdown_bg_color: campaignForm.countdown_bg_color,
        countdown_text_color: campaignForm.countdown_text_color,
        button_bg_color: campaignForm.button_bg_color,
        button_text_color: campaignForm.button_text_color,
        desktop_image_url: campaignForm.desktop_image_url || null,
        mobile_image_url: campaignForm.mobile_image_url || null,
        display_mode: campaignForm.display_mode,
        overlay_opacity: Number(campaignForm.overlay_opacity || 0.35),
        show_countdown: campaignForm.show_countdown,
        image_position: campaignForm.image_position,
        starts_at: new Date(campaignForm.starts_at).toISOString(),
        ends_at: new Date(campaignForm.ends_at).toISOString(),
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      const result = editingCampaignId
        ? await supabase
            .from("promotion_campaigns")
            .update(payload)
            .eq("id", editingCampaignId)
        : await supabase.from("promotion_campaigns").insert(payload);

      if (result.error) throw result.error;

      await load();
      setEditingCampaignId("");
      setCampaignForm((current) => ({
        ...current,
        title: "",
        subtitle: "",
        badge: "LIMITED TIME",
        cta_label: "SHOP NOW",
        landing_path: "/products",
        theme: "red_sale",
        primary_color: campaignPresets.red_sale.primary_color,
        secondary_color: campaignPresets.red_sale.secondary_color,
        text_color: campaignPresets.red_sale.text_color,
        muted_text_color: campaignPresets.red_sale.muted_text_color,
        countdown_bg_color: campaignPresets.red_sale.countdown_bg_color,
        countdown_text_color: campaignPresets.red_sale.countdown_text_color,
        button_bg_color: campaignPresets.red_sale.button_bg_color,
        button_text_color: campaignPresets.red_sale.button_text_color,
        desktop_image_url: "",
        mobile_image_url: "",
        display_mode: "overlay",
        overlay_opacity: "0.35",
        show_countdown: true,
        image_position: "center",
      }));
      setMessage(
        editingCampaignId ? "Campaign updated." : "Campaign created."
      );
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
      const payload = {
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
        updated_at: new Date().toISOString(),
      };

      const result = editingVoucherId
        ? await supabase
            .from("vouchers")
            .update(payload)
            .eq("id", editingVoucherId)
        : await supabase.from("vouchers").insert(payload);

      if (result.error) throw result.error;

      await load();
      setEditingVoucherId("");
      setVoucherForm((current) => ({
        ...current,
        campaign_id: "",
        code: "",
        name: "",
        description: "",
        scope_type: "all",
        scope_id: "",
      }));
      setMessage(
        editingVoucherId ? "Voucher updated." : "Voucher created."
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create voucher."
      );
    } finally {
      setBusy("");
    }
  }

  function editCampaign(campaign: Campaign) {
    setEditingCampaignId(campaign.id);
    setCampaignForm({
      title: campaign.title,
      subtitle: campaign.subtitle || "",
      badge: campaign.badge || "",
      cta_label: campaign.cta_label,
      landing_path: campaign.landing_path,
      theme: campaign.theme || "red_sale",
      primary_color: campaign.primary_color || campaignPresets.red_sale.primary_color,
      secondary_color: campaign.secondary_color || campaignPresets.red_sale.secondary_color,
      text_color: campaign.text_color || campaignPresets.red_sale.text_color,
      muted_text_color: campaign.muted_text_color || campaignPresets.red_sale.muted_text_color,
      countdown_bg_color:
        campaign.countdown_bg_color || campaignPresets.red_sale.countdown_bg_color,
      countdown_text_color:
        campaign.countdown_text_color || campaignPresets.red_sale.countdown_text_color,
      button_bg_color:
        campaign.button_bg_color || campaignPresets.red_sale.button_bg_color,
      button_text_color:
        campaign.button_text_color || campaignPresets.red_sale.button_text_color,
      desktop_image_url: campaign.desktop_image_url || "",
      mobile_image_url: campaign.mobile_image_url || "",
      display_mode: campaign.display_mode || "overlay",
      overlay_opacity: String(campaign.overlay_opacity ?? 0.35),
      show_countdown: campaign.show_countdown !== false,
      image_position: campaign.image_position || "center",
      starts_at: toLocalInput(campaign.starts_at),
      ends_at: toLocalInput(campaign.ends_at),
    });
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editVoucher(voucher: Voucher) {
    setEditingVoucherId(voucher.id);
    setVoucherForm({
      campaign_id: voucher.campaign_id || "",
      code: voucher.code,
      name: voucher.name,
      description: voucher.description || "",
      discount_type: voucher.discount_type,
      discount_value: String(voucher.discount_value || 0),
      minimum_spend: String(voucher.minimum_spend || 0),
      max_discount:
        voucher.max_discount === null ? "" : String(voucher.max_discount),
      starts_at: toLocalInput(voucher.starts_at),
      ends_at: toLocalInput(voucher.ends_at),
      usage_limit:
        voucher.usage_limit === null ? "" : String(voucher.usage_limit),
      per_user_limit: String(voucher.per_user_limit || 1),
      first_order_only: voucher.first_order_only,
      scope_type: voucher.scope_type,
      scope_id: voucher.scope_id || "",
    });
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
            <a href="/admin/promotions" className={styles.active}><span>05</span>Promotions</a>
            <a href="/admin/discounts"><span>06</span>Discounts</a>
            <a href="/admin/products"><span>07</span>Products</a>
            <a href="/admin/products/new"><span>08</span>Add Product</a>
            <a href="/admin/shipping"><span>09</span>Shipping</a>
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

                    <div className={styles.campaignImageManager}>
                      <div className={styles.campaignImageManagerHead}>
                        <div>
                          <span>BANNER IMAGE</span>
                          <strong>Upload your own campaign artwork</strong>
                        </div>
                        <small>JPG, PNG or WEBP · Max 8MB</small>
                      </div>

                      <div className={styles.campaignImageGrid}>
                        <label className={styles.campaignImageUpload}>
                          <span>DESKTOP BANNER</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void uploadCampaignImage(file, "desktop");
                              event.currentTarget.value = "";
                            }}
                          />
                          {campaignForm.desktop_image_url ? (
                            <img
                              src={campaignForm.desktop_image_url}
                              alt="Desktop campaign preview"
                            />
                          ) : (
                            <div>
                              <b>＋</b>
                              <strong>
                                {campaignImageBusy === "desktop"
                                  ? "UPLOADING..."
                                  : "UPLOAD DESKTOP"}
                              </strong>
                              <small>Recommended wide banner</small>
                            </div>
                          )}
                        </label>

                        <label className={styles.campaignImageUpload}>
                          <span>MOBILE BANNER</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void uploadCampaignImage(file, "mobile");
                              event.currentTarget.value = "";
                            }}
                          />
                          {campaignForm.mobile_image_url ? (
                            <img
                              src={campaignForm.mobile_image_url}
                              alt="Mobile campaign preview"
                            />
                          ) : (
                            <div>
                              <b>＋</b>
                              <strong>
                                {campaignImageBusy === "mobile"
                                  ? "UPLOADING..."
                                  : "UPLOAD MOBILE"}
                              </strong>
                              <small>Optional mobile crop</small>
                            </div>
                          )}
                        </label>
                      </div>

                      {(campaignForm.desktop_image_url ||
                        campaignForm.mobile_image_url) ? (
                        <div className={styles.campaignImageClearRow}>
                          {campaignForm.desktop_image_url ? (
                            <button
                              type="button"
                              onClick={() =>
                                setCampaignForm((current) => ({
                                  ...current,
                                  desktop_image_url: "",
                                }))
                              }
                            >
                              REMOVE DESKTOP
                            </button>
                          ) : null}
                          {campaignForm.mobile_image_url ? (
                            <button
                              type="button"
                              onClick={() =>
                                setCampaignForm((current) => ({
                                  ...current,
                                  mobile_image_url: "",
                                }))
                              }
                            >
                              REMOVE MOBILE
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <label className={styles.adminField}>
                      <span>BANNER MODE</span>
                      <select
                        value={campaignForm.display_mode}
                        onChange={(event) =>
                          setCampaignForm((current) => ({
                            ...current,
                            display_mode: event.target.value as
                              | "overlay"
                              | "image_only",
                          }))
                        }
                      >
                        <option value="overlay">Image + text overlay</option>
                        <option value="image_only">Image only</option>
                      </select>
                    </label>

                    <div className={styles.campaignStyleManager}>
                      <div className={styles.campaignStyleHead}>
                        <div>
                          <span>BANNER STYLE</span>
                          <strong>Preset & custom colours</strong>
                        </div>
                        <small>
                          Pick a preset, then fine-tune any colour.
                        </small>
                      </div>

                      <div className={styles.campaignPresetGrid}>
                        {(
                          Object.entries(campaignPresets) as Array<
                            [CampaignPresetKey, (typeof campaignPresets)[CampaignPresetKey]]
                          >
                        ).map(([key, preset]) => (
                          <button
                            type="button"
                            key={key}
                            className={
                              styles.campaignPresetCard +
                              (campaignForm.theme === key
                                ? " " + styles.activePreset
                                : "")
                            }
                            onClick={() => applyCampaignPreset(key)}
                          >
                            <i
                              style={{
                                background:
                                  "linear-gradient(135deg," +
                                  preset.primary_color +
                                  "," +
                                  preset.secondary_color +
                                  ")",
                              }}
                            />
                            <span>{preset.label}</span>
                            <small>{preset.description}</small>
                          </button>
                        ))}
                      </div>

                      <div className={styles.campaignColourGrid}>
                        {campaignColorFields.map(([label, field]) => (
                          <label
                            className={styles.campaignColourField}
                            key={field}
                          >
                            <span>{label}</span>
                            <div>
                              <input
                                type="color"
                                value={campaignForm[field]}
                                onChange={(event) =>
                                  updateCampaignColor(
                                    field,
                                    event.target.value
                                  )
                                }
                              />
                              <input
                                value={campaignForm[field]}
                                maxLength={7}
                                onChange={(event) =>
                                  updateCampaignColor(
                                    field,
                                    event.target.value
                                  )
                                }
                              />
                            </div>
                          </label>
                        ))}
                      </div>

                      <div
                        className={styles.campaignMiniPreview}
                        style={{
                          background:
                            "linear-gradient(120deg," +
                            campaignForm.primary_color +
                            "," +
                            campaignForm.secondary_color +
                            ")",
                          color: campaignForm.text_color,
                        }}
                      >
                        <div>
                          <span
                            style={{
                              color: campaignForm.muted_text_color,
                            }}
                          >
                            {campaignForm.badge || "LIMITED TIME"}
                          </span>
                          <strong>
                            {campaignForm.title || "10.10 AUTO SALE"}
                          </strong>
                          <small
                            style={{
                              color: campaignForm.muted_text_color,
                            }}
                          >
                            {campaignForm.subtitle ||
                              "Campaign subtitle preview"}
                          </small>
                          <b
                            style={{
                              background: campaignForm.button_bg_color,
                              color: campaignForm.button_text_color,
                            }}
                          >
                            {campaignForm.cta_label || "SHOP NOW"} →
                          </b>
                        </div>
                        <i
                          style={{
                            background: campaignForm.countdown_bg_color,
                            color: campaignForm.countdown_text_color,
                          }}
                        >
                          12 : 11 : 48 : 55
                        </i>
                      </div>
                    </div>

                    <label className={styles.adminField}>
                      <span>IMAGE POSITION</span>
                      <select
                        value={campaignForm.image_position}
                        onChange={(event) =>
                          setCampaignForm((current) => ({
                            ...current,
                            image_position: event.target.value as
                              | "center"
                              | "left"
                              | "right"
                              | "top"
                              | "bottom",
                          }))
                        }
                      >
                        <option value="center">Center</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                      </select>
                    </label>

                    {campaignForm.display_mode === "overlay" ? (
                      <label className={styles.adminField}>
                        <span>
                          DARK OVERLAY ·{" "}
                          {Math.round(
                            Number(campaignForm.overlay_opacity || 0) * 100
                          )}
                          %
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="0.85"
                          step="0.05"
                          value={campaignForm.overlay_opacity}
                          onChange={(event) =>
                            setCampaignForm((current) => ({
                              ...current,
                              overlay_opacity: event.target.value,
                            }))
                          }
                        />
                      </label>
                    ) : null}

                    <label className={styles.promotionCheck}>
                      <input
                        type="checkbox"
                        checked={campaignForm.show_countdown}
                        onChange={(event) =>
                          setCampaignForm((current) => ({
                            ...current,
                            show_countdown: event.target.checked,
                          }))
                        }
                      />
                      <span>SHOW COUNTDOWN</span>
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
                    {busy === "campaign"
                      ? "SAVING..."
                      : editingCampaignId
                        ? "SAVE CAMPAIGN"
                        : "+ CREATE CAMPAIGN"}
                  </button>
                  {editingCampaignId ? (
                    <button
                      type="button"
                      className={styles.adminSecondaryAction}
                      onClick={() => {
                        setEditingCampaignId("");
                        setCampaignForm((current) => ({
                          ...current,
                          title: "",
                          subtitle: "",
                          badge: "LIMITED TIME",
                          cta_label: "SHOP NOW",
                          landing_path: "/products",
                          theme: "red_sale",
                          primary_color: campaignPresets.red_sale.primary_color,
                          secondary_color: campaignPresets.red_sale.secondary_color,
                          text_color: campaignPresets.red_sale.text_color,
                          muted_text_color: campaignPresets.red_sale.muted_text_color,
                          countdown_bg_color:
                            campaignPresets.red_sale.countdown_bg_color,
                          countdown_text_color:
                            campaignPresets.red_sale.countdown_text_color,
                          button_bg_color:
                            campaignPresets.red_sale.button_bg_color,
                          button_text_color:
                            campaignPresets.red_sale.button_text_color,
                          desktop_image_url: "",
                          mobile_image_url: "",
                          display_mode: "overlay",
                          overlay_opacity: "0.35",
                          show_countdown: true,
                          image_position: "center",
                        }));
                      }}
                    >
                      CANCEL EDIT
                    </button>
                  ) : null}
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
                        {campaign.desktop_image_url ? (
                          <small>✓ CUSTOM BANNER IMAGE</small>
                        ) : (
                          <small>DEFAULT DESIGN</small>
                        )}
                      </div>
                      <div className={styles.promotionRowActions}>
                        <button
                          type="button"
                          className={styles.promotionEdit}
                          onClick={() => editCampaign(campaign)}
                        >
                          EDIT
                        </button>
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
                      </div>
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
                    {busy === "voucher"
                      ? "SAVING..."
                      : editingVoucherId
                        ? "SAVE VOUCHER"
                        : "+ CREATE VOUCHER"}
                  </button>
                  {editingVoucherId ? (
                    <button
                      type="button"
                      className={styles.adminSecondaryAction}
                      onClick={() => {
                        setEditingVoucherId("");
                        setVoucherForm((current) => ({
                          ...current,
                          campaign_id: "",
                          code: "",
                          name: "",
                          description: "",
                          scope_type: "all",
                          scope_id: "",
                        }));
                      }}
                    >
                      CANCEL EDIT
                    </button>
                  ) : null}
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
                          disabled={busy === voucher.id}
                          className={
                            voucher.is_active
                              ? styles.promotionOn
                              : styles.promotionOff
                          }
                        >
                          {voucher.is_active ? "ACTIVE" : "OFF"}
                        </button>
                      </div>
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

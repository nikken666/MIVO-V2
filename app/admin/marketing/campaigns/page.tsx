"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../../Admin.module.css";

type TemplateType =
  | "mega_sale"
  | "voucher_blast"
  | "flash_deal_grid"
  | "category_festival";

type BannerStyle = "formal" | "motorsport" | "garage" | "street";

type Campaign = {
  id: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
  cta_label: string;
  landing_path: string;
  theme: string;
  template_type: TemplateType;
  banner_style: BannerStyle;
  event_code: string;
  highlight_text: string | null;
  voucher_text: string | null;
  benefit_items: string[] | null;
  featured_product_ids: string[] | null;
  primary_color: string;
  secondary_color: string;
  text_color: string;
  muted_text_color: string;
  countdown_bg_color: string;
  countdown_text_color: string;
  button_bg_color: string;
  button_text_color: string;
  desktop_image_url: string | null;
  mobile_image_url: string | null;
  display_mode: "overlay" | "image_only";
  overlay_opacity: number | string;
  show_countdown: boolean;
  image_position: "center" | "left" | "right" | "top" | "bottom";
  starts_at: string;
  ends_at: string;
  sort_order: number;
  is_active: boolean;
};

type ProductOption = {
  id: string;
  name: string;
  primary_image_url: string | null;
};

const templates: Array<{
  key: TemplateType;
  name: string;
  kicker: string;
  description: string;
}> = [
  {
    key: "mega_sale",
    name: "Mega Sale Hero",
    kicker: "BIG EVENT",
    description:
      "Large 10.10 / 11.11 style hero with highlight, countdown and benefit strip.",
  },
  {
    key: "voucher_blast",
    name: "Voucher Blast",
    kicker: "VOUCHER EVENT",
    description:
      "Campaign headline plus large claimable voucher tickets and countdown.",
  },
  {
    key: "flash_deal_grid",
    name: "Flash Deal Grid",
    kicker: "PRODUCT EVENT",
    description:
      "Hero headline with selected discounted products displayed inside the campaign.",
  },
  {
    key: "category_festival",
    name: "Auto Parts Festival",
    kicker: "CATEGORY EVENT",
    description:
      "Big event hero with direct category shortcuts for Braking, Suspension and more.",
  },
];

const bannerStyles: Array<{
  key: BannerStyle;
  name: string;
  kicker: string;
  description: string;
}> = [
  {
    key: "formal",
    name: "Formal Premium",
    kicker: "CLEAN",
    description: "Refined official campaign with a premium corporate finish.",
  },
  {
    key: "motorsport",
    name: "Motorsport",
    kicker: "PERFORMANCE",
    description: "Aggressive racing graphics, speed lines and bold sale typography.",
  },
  {
    key: "garage",
    name: "Garage Workshop",
    kicker: "MECHANICAL",
    description: "Workshop-inspired styling with industrial panels and parts cues.",
  },
  {
    key: "street",
    name: "Street Performance",
    kicker: "TUNING",
    description: "Night-street energy with neon accents and a younger car-culture feel.",
  },
];

const campaignPresets = {
  red_sale: {
    label: "MIVO RED",
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

type CampaignForm = {
  title: string;
  subtitle: string;
  badge: string;
  cta_label: string;
  landing_path: string;
  template_type: TemplateType;
  banner_style: BannerStyle;
  event_code: string;
  highlight_text: string;
  voucher_text: string;
  benefits: string[];
  featured_product_ids: string[];
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

const colourFields: Array<[string, CampaignColorField]> = [
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

function blankCampaign(): CampaignForm {
  return {
    title: "AUTO SALE",
    subtitle: "",
    badge: "LIMITED TIME",
    cta_label: "SHOP 10.10 DEALS",
    landing_path: "/products",
    template_type: "mega_sale",
    banner_style: "formal",
    event_code: "10.10",
    highlight_text: "UP TO 50% OFF",
    voucher_text: "EXTRA VOUCHERS AVAILABLE",
    benefits: [
      "FREE SHIPPING DEALS",
      "FLASH DISCOUNTS",
      "LIMITED VOUCHERS",
      "POPULAR AUTO PARTS",
    ],
    featured_product_ids: [],
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
    starts_at: toLocalInput(),
    ends_at: toLocalInput(
      new Date(Date.now() + 14 * 86400000).toISOString()
    ),
  };
}

export default function MarketingCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [form, setForm] = useState<CampaignForm>(blankCampaign());
  const [editingId, setEditingId] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [publishMode, setPublishMode] = useState<"draft" | "publish">("publish");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [imageBusy, setImageBusy] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login?next=/admin/marketing/campaigns";
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

    const [campaignResult, productResult] = await Promise.all([
      supabase
        .from("promotion_campaigns")
        .select(
          "id, title, subtitle, badge, cta_label, landing_path, theme, template_type, banner_style, event_code, highlight_text, voucher_text, benefit_items, featured_product_ids, primary_color, secondary_color, text_color, muted_text_color, countdown_bg_color, countdown_text_color, button_bg_color, button_text_color, desktop_image_url, mobile_image_url, display_mode, overlay_opacity, show_countdown, image_position, starts_at, ends_at, sort_order, is_active"
        )
        .order("starts_at", { ascending: false }),
      supabase
        .from("products")
        .select("id, name, primary_image_url")
        .eq("status", "active")
        .order("name"),
    ]);

    if (campaignResult.error) throw campaignResult.error;
    if (productResult.error) throw productResult.error;

    setCampaigns((campaignResult.data as Campaign[] | null) || []);
    setProducts((productResult.data as ProductOption[] | null) || []);
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
            : "Unable to load campaigns."
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
    const query = productQuery.trim().toLowerCase();
    if (!query) return products.slice(0, 24);
    return products
      .filter((product) => product.name.toLowerCase().includes(query))
      .slice(0, 24);
  }, [products, productQuery]);

  function applyPreset(key: CampaignPresetKey) {
    const preset = campaignPresets[key];
    setForm((current) => ({
      ...current,
      theme: key,
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

  function updateColour(field: CampaignColorField, value: string) {
    setForm((current) => ({
      ...current,
      theme: "custom",
      [field]: value.toUpperCase(),
    }));
  }

  function updateBenefit(index: number, value: string) {
    setForm((current) => {
      const benefits = [...current.benefits];
      benefits[index] = value;
      return { ...current, benefits };
    });
  }

  function toggleFeaturedProduct(id: string) {
    setForm((current) => {
      if (current.featured_product_ids.includes(id)) {
        return {
          ...current,
          featured_product_ids: current.featured_product_ids.filter(
            (item) => item !== id
          ),
        };
      }

      return {
        ...current,
        featured_product_ids: [...current.featured_product_ids, id],
      };
    });
  }

  async function uploadImage(file: File, kind: "desktop" | "mobile") {
    setImageBusy(kind);
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

      setForm((current) => ({
        ...current,
        [kind === "desktop" ? "desktop_image_url" : "mobile_image_url"]:
          result.url,
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
      setImageBusy("");
    }
  }

  async function saveCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("save");
    setError("");
    setMessage("");

    try {
      const start = new Date(form.starts_at);
      const end = new Date(form.ends_at);

      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
      ) {
        throw new Error("Choose a valid campaign start and end time.");
      }

      const supabase = createClient();
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        badge: form.badge.trim() || null,
        cta_label: form.cta_label.trim() || "SHOP NOW",
        landing_path: form.landing_path.trim() || "/products",
        template_type: form.template_type,
        banner_style: form.banner_style,
        event_code: form.event_code.trim() || "10.10",
        highlight_text: form.highlight_text.trim() || null,
        voucher_text: form.voucher_text.trim() || null,
        benefit_items: form.benefits
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 4),
        featured_product_ids: form.featured_product_ids,
        theme: form.theme,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
        text_color: form.text_color,
        muted_text_color: form.muted_text_color,
        countdown_bg_color: form.countdown_bg_color,
        countdown_text_color: form.countdown_text_color,
        button_bg_color: form.button_bg_color,
        button_text_color: form.button_text_color,
        desktop_image_url: form.desktop_image_url || null,
        mobile_image_url: form.mobile_image_url || null,
        display_mode: form.display_mode,
        overlay_opacity: Number(form.overlay_opacity || 0.35),
        show_countdown: form.show_countdown,
        image_position: form.image_position,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        is_active: publishMode === "publish",
        updated_at: new Date().toISOString(),
      };

      const result = editingId
        ? await supabase
            .from("promotion_campaigns")
            .update(payload)
            .eq("id", editingId)
        : await supabase.from("promotion_campaigns").insert(payload);

      if (result.error) throw result.error;

      const wasEditing = Boolean(editingId);
      await load();
      setForm(blankCampaign());
      setEditingId("");
      setBuilderOpen(false);
      setPublishMode("publish");
      setProductQuery("");
      setMessage(
        publishMode === "draft"
          ? wasEditing
            ? "Campaign saved as draft."
            : "Draft campaign created."
          : wasEditing
            ? "Campaign updated."
            : "Campaign published."
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save campaign."
      );
    } finally {
      setBusy("");
    }
  }

  function editCampaign(campaign: Campaign) {
    const benefits = Array.isArray(campaign.benefit_items)
      ? campaign.benefit_items.slice(0, 4)
      : [];

    setEditingId(campaign.id);
    setBuilderOpen(true);
    setPublishMode(campaign.is_active ? "publish" : "draft");
    setForm({
      title:
        campaign.event_code &&
        campaign.title.startsWith(campaign.event_code + " ")
          ? campaign.title.slice(campaign.event_code.length + 1)
          : campaign.title,
      subtitle: campaign.subtitle || "",
      badge: campaign.badge || "",
      cta_label: campaign.cta_label,
      landing_path: campaign.landing_path,
      template_type: campaign.template_type || "mega_sale",
      banner_style: campaign.banner_style || "formal",
      event_code: campaign.event_code || "10.10",
      highlight_text: campaign.highlight_text || "",
      voucher_text: campaign.voucher_text || "",
      benefits: [
        benefits[0] || "",
        benefits[1] || "",
        benefits[2] || "",
        benefits[3] || "",
      ],
      featured_product_ids: campaign.featured_product_ids || [],
      theme: campaign.theme || "red_sale",
      primary_color:
        campaign.primary_color || campaignPresets.red_sale.primary_color,
      secondary_color:
        campaign.secondary_color || campaignPresets.red_sale.secondary_color,
      text_color:
        campaign.text_color || campaignPresets.red_sale.text_color,
      muted_text_color:
        campaign.muted_text_color || campaignPresets.red_sale.muted_text_color,
      countdown_bg_color:
        campaign.countdown_bg_color ||
        campaignPresets.red_sale.countdown_bg_color,
      countdown_text_color:
        campaign.countdown_text_color ||
        campaignPresets.red_sale.countdown_text_color,
      button_bg_color:
        campaign.button_bg_color || campaignPresets.red_sale.button_bg_color,
      button_text_color:
        campaign.button_text_color ||
        campaignPresets.red_sale.button_text_color,
      desktop_image_url: campaign.desktop_image_url || "",
      mobile_image_url: campaign.mobile_image_url || "",
      display_mode: campaign.display_mode || "overlay",
      overlay_opacity: String(campaign.overlay_opacity ?? 0.35),
      show_countdown: campaign.show_countdown !== false,
      image_position: campaign.image_position || "center",
      starts_at: toLocalInput(campaign.starts_at),
      ends_at: toLocalInput(campaign.ends_at),
    });
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleCampaign(campaign: Campaign) {
    setBusy("toggle-" + campaign.id);
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

  async function deleteCampaign(campaign: Campaign) {
    if (
      !window.confirm(
        'Delete campaign "' +
          campaign.title +
          '"? Linked vouchers will stay available as standalone vouchers.'
      )
    ) {
      return;
    }

    setBusy("delete-" + campaign.id);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: deleteError } = await supabase.rpc(
        "admin_delete_campaign",
        { p_campaign_id: campaign.id }
      );

      if (deleteError) throw deleteError;

      if (editingId === campaign.id) {
        setEditingId("");
        setForm(blankCampaign());
      }

      await load();

      const kept = Number(
        (data as { linked_vouchers_kept?: number } | null)
          ?.linked_vouchers_kept || 0
      );
      setMessage(
        "Campaign deleted." +
          (kept
            ? " " +
              kept +
              " linked voucher" +
              (kept === 1 ? " was" : "s were") +
              " kept."
            : "")
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to delete campaign."
      );
    } finally {
      setBusy("");
    }
  }

  async function duplicateCampaign(campaign: Campaign) {
    setBusy("duplicate-" + campaign.id);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const now = new Date();
      const end = new Date(now.getTime() + 14 * 86400000);

      const { error: insertError } = await supabase
        .from("promotion_campaigns")
        .insert({
          title: campaign.title + " Copy",
          subtitle: campaign.subtitle,
          badge: campaign.badge,
          cta_label: campaign.cta_label,
          landing_path: campaign.landing_path,
          theme: campaign.theme,
          template_type: campaign.template_type,
          banner_style: campaign.banner_style,
          event_code: campaign.event_code,
          highlight_text: campaign.highlight_text,
          voucher_text: campaign.voucher_text,
          benefit_items: campaign.benefit_items,
          featured_product_ids: campaign.featured_product_ids,
          primary_color: campaign.primary_color,
          secondary_color: campaign.secondary_color,
          text_color: campaign.text_color,
          muted_text_color: campaign.muted_text_color,
          countdown_bg_color: campaign.countdown_bg_color,
          countdown_text_color: campaign.countdown_text_color,
          button_bg_color: campaign.button_bg_color,
          button_text_color: campaign.button_text_color,
          desktop_image_url: campaign.desktop_image_url,
          mobile_image_url: campaign.mobile_image_url,
          display_mode: campaign.display_mode,
          overlay_opacity: campaign.overlay_opacity,
          show_countdown: campaign.show_countdown,
          image_position: campaign.image_position,
          starts_at: now.toISOString(),
          ends_at: end.toISOString(),
          sort_order: campaign.sort_order,
          is_active: false,
        });

      if (insertError) throw insertError;
      await load();
      setMessage("Campaign duplicated as draft.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to duplicate campaign."
      );
    } finally {
      setBusy("");
    }
  }

  function openNewCampaign() {
    setEditingId("");
    setForm(blankCampaign());
    setPublishMode("publish");
    setProductQuery("");
    setBuilderOpen(true);
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeBuilder() {
    setBuilderOpen(false);
    setEditingId("");
    setForm(blankCampaign());
    setPublishMode("publish");
    setProductQuery("");
  }

  function campaignStatus(campaign: Campaign) {
    const now = Date.now();
    const starts = new Date(campaign.starts_at).getTime();
    const ends = new Date(campaign.ends_at).getTime();

    if (!campaign.is_active) return "DRAFT";
    if (now < starts) return "SCHEDULED";
    if (now > ends) return "ENDED";
    return "ACTIVE";
  }

  const activeCount = campaigns.filter(
    (item) => campaignStatus(item) === "ACTIVE"
  ).length;

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
            <span>ACTIVE CAMPAIGNS</span>
            <strong>{loading ? "—" : activeCount}</strong>
            <a href="/">OPEN STOREFRONT →</a>
          </div>
        </aside>

        <section className={styles.adminContent}>
          <header className={styles.marketingV2Header}>
            <div>
              <span>MARKETING CENTRE</span>
              <h1>Campaigns</h1>
              <p>
                Build, schedule and manage homepage campaigns from one place.
              </p>
            </div>
            <button
              type="button"
              className={styles.marketingCreateButton}
              onClick={openNewCampaign}
            >
              + CREATE CAMPAIGN
            </button>
          </header>

          <nav className={styles.marketingV2Tabs}>
            <a className={styles.active} href="/admin/marketing/campaigns">
              Campaigns
            </a>
            <a href="/admin/marketing/vouchers">Vouchers</a>
            <a href="/admin/marketing/discounts">Discounts</a>
          </nav>

          {error ? <p className={styles.adminError}>{error}</p> : null}
          {message ? <p className={styles.adminSuccess}>{message}</p> : null}

          <section className={styles.marketingCampaignOverview}>
            <div className={styles.marketingSectionHead}>
              <div>
                <span>CAMPAIGN MANAGEMENT</span>
                <h2>{loading ? "Campaigns" : campaigns.length + " Campaign" + (campaigns.length === 1 ? "" : "s")}</h2>
                <p>
                  Homepage campaigns with schedule, artwork and storefront status.
                </p>
              </div>
              <div className={styles.marketingStatusSummary}>
                <b>{activeCount}</b>
                <span>LIVE NOW</span>
              </div>
            </div>

            {loading ? (
              <div className={styles.marketingEmptyState}>Loading campaigns...</div>
            ) : campaigns.length === 0 ? (
              <div className={styles.marketingEmptyState}>
                <strong>No campaign yet.</strong>
                <span>Create your first homepage promotion.</span>
                <button type="button" onClick={openNewCampaign}>
                  CREATE CAMPAIGN
                </button>
              </div>
            ) : (
              <div className={styles.marketingCampaignListV2}>
                {campaigns.map((campaign) => {
                  const status = campaignStatus(campaign);
                  const template =
                    templates.find((item) => item.key === campaign.template_type) ||
                    templates[0];

                  return (
                    <article className={styles.marketingCampaignCardV2} key={campaign.id}>
                      <div
                        className={styles.marketingCampaignThumbV2}
                        style={{
                          background: campaign.desktop_image_url
                            ? undefined
                            : "linear-gradient(135deg," +
                              campaign.primary_color +
                              "," +
                              campaign.secondary_color +
                              ")",
                          backgroundImage: campaign.desktop_image_url
                            ? "linear-gradient(rgba(0,0,0,.18),rgba(0,0,0,.18)),url(" +
                              campaign.desktop_image_url +
                              ")"
                            : undefined,
                          color: campaign.text_color,
                        }}
                      >
                        <span>{campaign.badge || "CAMPAIGN"}</span>
                        <strong>
                          {campaign.event_code ? campaign.event_code + " " : ""}
                          {campaign.title}
                        </strong>
                        <small>{campaign.highlight_text || template.name}</small>
                      </div>

                      <div className={styles.marketingCampaignInfoV2}>
                        <div className={styles.marketingCampaignTitleRow}>
                          <div>
                            <span>{template.kicker}</span>
                            <h3>{campaign.title}</h3>
                          </div>
                          <b
                            className={
                              styles.marketingStatusPill +
                              " " +
                              (status === "ACTIVE"
                                ? styles.marketingStatusActive
                                : status === "SCHEDULED"
                                  ? styles.marketingStatusScheduled
                                  : status === "ENDED"
                                    ? styles.marketingStatusEnded
                                    : styles.marketingStatusDraft)
                            }
                          >
                            {status}
                          </b>
                        </div>

                        <div className={styles.marketingCampaignMetaV2}>
                          <div>
                            <span>LAYOUT</span>
                            <strong>{template.name}</strong>
                          </div>
                          <div>
                            <span>PLACEMENT</span>
                            <strong>Homepage</strong>
                          </div>
                          <div>
                            <span>START</span>
                            <strong>
                              {new Date(campaign.starts_at).toLocaleString("en-MY", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </strong>
                          </div>
                          <div>
                            <span>END</span>
                            <strong>
                              {new Date(campaign.ends_at).toLocaleString("en-MY", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className={styles.marketingCampaignActionsV2}>
                        <button type="button" onClick={() => editCampaign(campaign)}>
                          EDIT
                        </button>
                        <button
                          type="button"
                          disabled={busy === "duplicate-" + campaign.id}
                          onClick={() => void duplicateCampaign(campaign)}
                        >
                          {busy === "duplicate-" + campaign.id ? "..." : "DUPLICATE"}
                        </button>
                        <button
                          type="button"
                          className={campaign.is_active ? styles.dangerSoft : styles.successSoft}
                          disabled={busy === "toggle-" + campaign.id}
                          onClick={() => void toggleCampaign(campaign)}
                        >
                          {campaign.is_active ? "DEACTIVATE" : "ACTIVATE"}
                        </button>
                        <button
                          type="button"
                          className={styles.marketingDeleteButton}
                          disabled={busy === "delete-" + campaign.id}
                          onClick={() => void deleteCampaign(campaign)}
                        >
                          DELETE
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {builderOpen ? (
            <section className={styles.marketingBuilderV2}>
              <div className={styles.marketingBuilderTopbar}>
                <div>
                  <span>{editingId ? "EDIT CAMPAIGN" : "NEW CAMPAIGN"}</span>
                  <h2>{editingId ? "Update campaign" : "Create campaign"}</h2>
                  <p>Complete the four steps, preview it, then publish or save as draft.</p>
                </div>
                <button type="button" onClick={closeBuilder}>×</button>
              </div>

              <form onSubmit={saveCampaign}>
                <div className={styles.marketingBuilderLayout}>
                  <div className={styles.marketingBuilderSteps}>
                    <section className={styles.marketingStepCard}>
                      <div className={styles.marketingStepHead}>
                        <b>01</b>
                        <div>
                          <span>LAYOUT</span>
                          <h3>Choose campaign type</h3>
                        </div>
                      </div>

                      <div className={styles.marketingTemplateGridV2}>
                        {templates.map((template) => (
                          <button
                            type="button"
                            key={template.key}
                            className={
                              styles.marketingTemplateV2 +
                              (form.template_type === template.key
                                ? " " + styles.active
                                : "")
                            }
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                template_type: template.key,
                              }))
                            }
                          >
                            <div className={styles.marketingTemplateMini}>
                              <i />
                              <b />
                              <em />
                            </div>
                            <span>{template.kicker}</span>
                            <strong>{template.name}</strong>
                            <small>{template.description}</small>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className={styles.marketingStepCard}>
                      <div className={styles.marketingStepHead}>
                        <b>02</b>
                        <div>
                          <span>CONTENT</span>
                          <h3>Campaign message</h3>
                        </div>
                      </div>

                      <div className={styles.marketingFormGridV2}>
                        <label>
                          <span>EVENT NUMBER / DATE</span>
                          <input
                            value={form.event_code}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                event_code: event.target.value,
                              }))
                            }
                            placeholder="10.10"
                          />
                        </label>

                        <label>
                          <span>SALE TITLE *</span>
                          <input
                            required
                            value={form.title}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                title: event.target.value,
                              }))
                            }
                            placeholder="AUTO SALE"
                          />
                        </label>

                        <label>
                          <span>EVENT TAG</span>
                          <input
                            value={form.badge}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                badge: event.target.value,
                              }))
                            }
                            placeholder="LIMITED TIME"
                          />
                        </label>

                        <label className={styles.full}>
                          <span>SUBTITLE</span>
                          <input
                            value={form.subtitle}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                subtitle: event.target.value,
                              }))
                            }
                            placeholder="Big automotive savings for a limited time."
                          />
                        </label>

                        <label>
                          <span>HIGHLIGHT</span>
                          <input
                            value={form.highlight_text}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                highlight_text: event.target.value,
                              }))
                            }
                            placeholder="UP TO 50% OFF"
                          />
                        </label>

                        <label>
                          <span>VOUCHER HIGHLIGHT</span>
                          <input
                            value={form.voucher_text}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                voucher_text: event.target.value,
                              }))
                            }
                            placeholder="EXTRA VOUCHERS AVAILABLE"
                          />
                        </label>

                        <label>
                          <span>CTA LABEL</span>
                          <input
                            value={form.cta_label}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                cta_label: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <label>
                          <span>CTA LINK</span>
                          <input
                            value={form.landing_path}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                landing_path: event.target.value,
                              }))
                            }
                            placeholder="/products"
                          />
                        </label>
                      </div>

                      {form.template_type === "mega_sale" ? (
                        <div className={styles.marketingBenefitsV2}>
                          <span>BENEFIT STRIP</span>
                          <div>
                            {form.benefits.map((benefit, index) => (
                              <input
                                key={index}
                                value={benefit}
                                onChange={(event) =>
                                  updateBenefit(index, event.target.value)
                                }
                                placeholder={"Benefit " + (index + 1)}
                              />
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {form.template_type === "flash_deal_grid" ? (
                        <div className={styles.marketingProductsPickerV2}>
                          <div>
                            <span>FEATURED PRODUCTS</span>
                            <small>{form.featured_product_ids.length} selected.</small>
                          </div>
                          <button
                            type="button"
                            className={styles.adminSecondaryAction}
                            onClick={() => setProductPickerOpen(true)}
                          >
                            SELECT CAMPAIGN PRODUCTS
                          </button>
                        </div>
                      ) : null}
                    </section>

                    <section className={styles.marketingStepCard}>
                      <div className={styles.marketingStepHead}>
                        <b>03</b>
                        <div>
                          <span>STYLE & ARTWORK</span>
                          <h3>Brand the campaign</h3>
                        </div>
                      </div>

                      <div className={styles.marketingBannerStyleBlock}>
                        <div className={styles.marketingBannerStyleHead}>
                          <div>
                            <span>BANNER STYLE</span>
                            <strong>Choose how the campaign feels</strong>
                          </div>
                          <small>
                            Typography and graphic treatment change automatically.
                          </small>
                        </div>

                        <div className={styles.marketingBannerStyleGrid}>
                          {bannerStyles.map((style) => (
                            <button
                              type="button"
                              key={style.key}
                              className={
                                styles.marketingBannerStyleCard +
                                " " +
                                styles["bannerStyle_" + style.key] +
                                (form.banner_style === style.key
                                  ? " " + styles.active
                                  : "")
                              }
                              onClick={() =>
                                setForm((current) => ({
                                  ...current,
                                  banner_style: style.key,
                                }))
                              }
                            >
                              <div>
                                <i />
                                <b>{form.event_code || "10.10"}</b>
                                <em>{form.title || "AUTO SALE"}</em>
                              </div>
                              <span>{style.kicker}</span>
                              <strong>{style.name}</strong>
                              <small>{style.description}</small>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className={styles.marketingPresetGridV2}>
                        {(Object.entries(campaignPresets) as Array<
                          [CampaignPresetKey, (typeof campaignPresets)[CampaignPresetKey]]
                        >).map(([key, preset]) => (
                          <button
                            type="button"
                            key={key}
                            className={
                              styles.marketingPresetV2 +
                              (form.theme === key ? " " + styles.active : "")
                            }
                            onClick={() => applyPreset(key)}
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
                            <strong>{preset.label}</strong>
                          </button>
                        ))}
                      </div>

                      <div className={styles.marketingColourGridV2}>
                        {colourFields.map(([label, field]) => (
                          <label key={field}>
                            <span>{label}</span>
                            <div>
                              <input
                                type="color"
                                value={form[field]}
                                onChange={(event) =>
                                  updateColour(field, event.target.value)
                                }
                              />
                              <input
                                value={form[field]}
                                onChange={(event) =>
                                  updateColour(field, event.target.value)
                                }
                              />
                            </div>
                          </label>
                        ))}
                      </div>

                      <div className={styles.marketingArtworkGridV2}>
                        <label>
                          <span>DESKTOP BANNER</span>
                          <div className={styles.marketingUploadBoxV2}>
                            {form.desktop_image_url ? (
                              <img src={form.desktop_image_url} alt="" />
                            ) : (
                              <strong>+ UPLOAD DESKTOP</strong>
                            )}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) void uploadImage(file, "desktop");
                                event.currentTarget.value = "";
                              }}
                            />
                          </div>
                          <small>{imageBusy === "desktop" ? "Uploading..." : "Wide homepage artwork"}</small>
                        </label>

                        <label>
                          <span>MOBILE BANNER</span>
                          <div className={styles.marketingUploadBoxV2}>
                            {form.mobile_image_url ? (
                              <img src={form.mobile_image_url} alt="" />
                            ) : (
                              <strong>+ UPLOAD MOBILE</strong>
                            )}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) void uploadImage(file, "mobile");
                                event.currentTarget.value = "";
                              }}
                            />
                          </div>
                          <small>{imageBusy === "mobile" ? "Uploading..." : "Optional phone crop"}</small>
                        </label>
                      </div>

                      <div className={styles.marketingFormGridV2}>
                        <label>
                          <span>DISPLAY MODE</span>
                          <select
                            value={form.display_mode}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                display_mode: event.target.value as "overlay" | "image_only",
                              }))
                            }
                          >
                            <option value="overlay">Image + text overlay</option>
                            <option value="image_only">Image only</option>
                          </select>
                        </label>

                        <label>
                          <span>IMAGE POSITION</span>
                          <select
                            value={form.image_position}
                            onChange={(event) =>
                              setForm((current) => ({
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

                        <label>
                          <span>OVERLAY {Math.round(Number(form.overlay_opacity || 0) * 100)}%</span>
                          <input
                            type="range"
                            min="0"
                            max="0.85"
                            step="0.05"
                            value={form.overlay_opacity}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                overlay_opacity: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <label className={styles.marketingToggleV2}>
                          <span>COUNTDOWN</span>
                          <input
                            type="checkbox"
                            checked={form.show_countdown}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                show_countdown: event.target.checked,
                              }))
                            }
                          />
                          <strong>{form.show_countdown ? "ON" : "OFF"}</strong>
                        </label>
                      </div>
                    </section>

                    <section className={styles.marketingStepCard}>
                      <div className={styles.marketingStepHead}>
                        <b>04</b>
                        <div>
                          <span>SCHEDULE & PUBLISH</span>
                          <h3>Choose when it runs</h3>
                        </div>
                      </div>

                      <div className={styles.marketingFormGridV2}>
                        <label>
                          <span>START</span>
                          <input
                            type="datetime-local"
                            value={form.starts_at}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                starts_at: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <label>
                          <span>END</span>
                          <input
                            type="datetime-local"
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

                      <div className={styles.marketingPublishChoiceV2}>
                        <button
                          type="submit"
                          className={publishMode === "draft" ? styles.active : ""}
                          disabled={busy === "save"}
                          onClick={() => setPublishMode("draft")}
                        >
                          <span>SAVE AS DRAFT</span>
                          <small>Keep it hidden from customers.</small>
                        </button>
                        <button
                          type="submit"
                          className={publishMode === "publish" ? styles.active : ""}
                          disabled={busy === "save"}
                          onClick={() => setPublishMode("publish")}
                        >
                          <span>{busy === "save" ? "SAVING..." : editingId ? "SAVE & PUBLISH" : "PUBLISH CAMPAIGN"}</span>
                          <small>Runs automatically inside the selected time window.</small>
                        </button>
                      </div>
                    </section>
                  </div>

                  <aside className={styles.marketingPreviewV2}>
                    <div className={styles.marketingPreviewHeadV2}>
                      <span>LIVE PREVIEW</span>
                      <strong>Homepage</strong>
                    </div>

                    <div
                      className={
                        styles.marketingPreviewCanvasV2 +
                        " " +
                        styles["previewStyle_" + form.banner_style]
                      }
                      style={{
                        background: form.desktop_image_url
                          ? undefined
                          : "linear-gradient(135deg," +
                            form.primary_color +
                            "," +
                            form.secondary_color +
                            ")",
                        backgroundImage: form.desktop_image_url
                          ? "linear-gradient(rgba(0,0,0," +
                            form.overlay_opacity +
                            "),rgba(0,0,0," +
                            form.overlay_opacity +
                            ")),url(" +
                            form.desktop_image_url +
                            ")"
                          : undefined,
                        color: form.text_color,
                        backgroundPosition: form.image_position,
                      }}
                    >
                      {form.display_mode === "image_only" && form.desktop_image_url ? null : (
                        <>
                          <span>{form.badge || "LIMITED TIME"}</span>
                          <div className={styles.marketingPreviewEventCode}>
                            {form.event_code || "10.10"}
                          </div>
                          <h3>{form.title || "AUTO SALE"}</h3>
                          <p style={{ color: form.muted_text_color }}>
                            {form.subtitle || "Campaign subtitle appears here."}
                          </p>
                          <strong>{form.highlight_text || "SALE HIGHLIGHT"}</strong>
                          <button
                            type="button"
                            style={{
                              background: form.button_bg_color,
                              color: form.button_text_color,
                            }}
                          >
                            {form.cta_label || "SHOP NOW"}
                          </button>
                        </>
                      )}
                    </div>

                    <div className={styles.marketingPreviewDetailsV2}>
                      <div>
                        <span>STYLE</span>
                        <strong>{form.banner_style.toUpperCase()}</strong>
                      </div>
                      <div>
                        <span>LAYOUT</span>
                        <strong>
                          {templates.find((item) => item.key === form.template_type)?.name}
                        </strong>
                      </div>
                      <div>
                        <span>COUNTDOWN</span>
                        <strong>{form.show_countdown ? "VISIBLE" : "HIDDEN"}</strong>
                      </div>
                    </div>
                  </aside>
                </div>
              </form>
            </section>
          ) : null}

          {productPickerOpen ? (
            <div className={styles.productPickerOverlay} role="dialog" aria-modal="true">
              <div className={styles.productPickerModal}>
                <div className={styles.productPickerHead}>
                  <div><span>CAMPAIGN PRODUCTS</span><h2>Select products</h2></div>
                  <button type="button" onClick={() => setProductPickerOpen(false)}>CLOSE</button>
                </div>
                <div className={styles.productPickerSearch}>
                  <input autoFocus value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Search products" />
                  <span>{form.featured_product_ids.length} SELECTED</span>
                </div>
                <div className={styles.marketingProductGridV2}>
                  {filteredProducts.map((product) => {
                    const selected = form.featured_product_ids.includes(product.id);
                    return (
                      <button type="button" key={product.id} className={selected ? styles.active : ""} onClick={() => toggleFeaturedProduct(product.id)}>
                        {product.primary_image_url ? <img src={product.primary_image_url} alt="" /> : <i>M</i>}
                        <span>{product.name}</span>
                      </button>
                    );
                  })}
                </div>
                <div className={styles.productPickerFooter}>
                  <span>{form.featured_product_ids.length} products selected</span>
                  <button type="button" onClick={() => setProductPickerOpen(false)}>CONFIRM</button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../../Admin.module.css";

type TemplateType =
  | "mega_sale"
  | "voucher_blast"
  | "flash_deal_grid"
  | "category_festival";

type Campaign = {
  id: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
  cta_label: string;
  landing_path: string;
  theme: string;
  template_type: TemplateType;
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
    title: "",
    subtitle: "",
    badge: "LIMITED TIME",
    cta_label: "SHOP 10.10 DEALS",
    landing_path: "/products",
    template_type: "mega_sale",
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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [imageBusy, setImageBusy] = useState("");
  const [productQuery, setProductQuery] = useState("");
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
          "id, title, subtitle, badge, cta_label, landing_path, theme, template_type, highlight_text, voucher_text, benefit_items, featured_product_ids, primary_color, secondary_color, text_color, muted_text_color, countdown_bg_color, countdown_text_color, button_bg_color, button_text_color, desktop_image_url, mobile_image_url, display_mode, overlay_opacity, show_countdown, image_position, starts_at, ends_at, sort_order, is_active"
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

      if (current.featured_product_ids.length >= 4) return current;

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
        highlight_text: form.highlight_text.trim() || null,
        voucher_text: form.voucher_text.trim() || null,
        benefit_items: form.benefits
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 4),
        featured_product_ids: form.featured_product_ids.slice(0, 4),
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
        is_active: true,
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
      setProductQuery("");
      setMessage(wasEditing ? "Campaign updated." : "Campaign created.");
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
    setForm({
      title: campaign.title,
      subtitle: campaign.subtitle || "",
      badge: campaign.badge || "",
      cta_label: campaign.cta_label,
      landing_path: campaign.landing_path,
      template_type: campaign.template_type || "mega_sale",
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

  const activeCount = campaigns.filter((item) => item.is_active).length;

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
            <a href="/admin/marketing">MARKETING CENTRE →</a>
          </div>
        </aside>

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>
                MARKETING CENTRE · CAMPAIGNS
              </span>
              <h1>Campaigns</h1>
              <p>
                Big-event templates for 10.10, 11.11, Payday and seasonal
                campaigns.
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
            <a className={styles.marketingSubnavActive} href="/admin/marketing/campaigns">
              Campaigns
            </a>
            <a href="/admin/marketing/vouchers">Vouchers</a>
            <a href="/admin/marketing/discounts">Discounts</a>
          </nav>

          {error ? <p className={styles.adminError}>{error}</p> : null}
          {message ? <p className={styles.adminSuccess}>{message}</p> : null}

          <div className={styles.marketingManagerGrid}>
            <section className={styles.adminPanel}>
              <div className={styles.adminPanelHead}>
                <div>
                  <span className={styles.adminPanelKicker}>
                    {editingId ? "EDIT CAMPAIGN" : "CREATE BIG EVENT"}
                  </span>
                  <h2>Campaign Builder</h2>
                  <p>
                    Choose the event layout first. Colours and artwork are the
                    finishing layer, not the whole template.
                  </p>
                </div>
              </div>

              <form className={styles.adminForm} onSubmit={saveCampaign}>
                <div className={styles.adminFormGrid}>
                  <div className={styles.campaignTemplateManager}>
                    <div className={styles.campaignTemplateHead}>
                      <div>
                        <span>STEP 1 · EVENT TEMPLATE</span>
                        <strong>Choose the campaign experience</strong>
                      </div>
                      <small>
                        Each template changes the actual homepage layout.
                      </small>
                    </div>

                    <div className={styles.campaignTemplateGrid}>
                      {templates.map((template) => (
                        <button
                          type="button"
                          key={template.key}
                          className={
                            styles.campaignTemplateCard +
                            (form.template_type === template.key
                              ? " " + styles.campaignTemplateActive
                              : "")
                          }
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              template_type: template.key,
                            }))
                          }
                        >
                          <div
                            className={
                              styles.campaignTemplateVisual +
                              " " +
                              styles[
                                "template_" +
                                  template.key.replaceAll("-", "_")
                              ]
                            }
                          >
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
                  </div>

                  <label className={styles.adminField}>
                    <span>MAIN TITLE</span>
                    <input
                      required
                      value={form.title}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="10.10 MEGA SALE"
                    />
                  </label>

                  <label className={styles.adminField}>
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

                  <label className={styles.adminField + " " + styles.full}>
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

                  <label className={styles.adminField}>
                    <span>HIGHLIGHT TEXT</span>
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

                  {(form.template_type === "mega_sale" ||
                    form.template_type === "voucher_blast") ? (
                    <label className={styles.adminField}>
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
                  ) : null}

                  <label className={styles.adminField}>
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

                  <label className={styles.adminField}>
                    <span>LANDING PATH</span>
                    <input
                      value={form.landing_path}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          landing_path: event.target.value,
                        }))
                      }
                    />
                  </label>

                  {(form.template_type === "mega_sale" ||
                    form.template_type === "category_festival") ? (
                    <div className={styles.campaignBenefitsEditor}>
                      <div>
                        <span>BENEFIT STRIP</span>
                        <strong>Four event highlights</strong>
                      </div>
                      <div>
                        {form.benefits.map((benefit, index) => (
                          <label key={index}>
                            <span>0{index + 1}</span>
                            <input
                              value={benefit}
                              onChange={(event) =>
                                updateBenefit(index, event.target.value)
                              }
                              placeholder="FLASH DISCOUNTS"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {form.template_type === "flash_deal_grid" ? (
                    <div className={styles.campaignProductPicker}>
                      <div className={styles.campaignProductPickerHead}>
                        <div>
                          <span>FEATURED PRODUCTS</span>
                          <strong>
                            Select up to 4 discounted products
                          </strong>
                        </div>
                        <small>
                          {form.featured_product_ids.length}/4 selected
                        </small>
                      </div>
                      <input
                        value={productQuery}
                        onChange={(event) =>
                          setProductQuery(event.target.value)
                        }
                        placeholder="Search product name"
                      />
                      <div className={styles.campaignProductPickerGrid}>
                        {filteredProducts.map((product) => {
                          const selected =
                            form.featured_product_ids.includes(product.id);
                          return (
                            <button
                              type="button"
                              key={product.id}
                              className={
                                styles.campaignProductChoice +
                                (selected
                                  ? " " + styles.campaignProductSelected
                                  : "")
                              }
                              onClick={() =>
                                toggleFeaturedProduct(product.id)
                              }
                            >
                              <div>
                                {product.primary_image_url ? (
                                  <img
                                    src={product.primary_image_url}
                                    alt=""
                                  />
                                ) : (
                                  <span>M</span>
                                )}
                              </div>
                              <strong>{product.name}</strong>
                              <small>
                                {selected ? "SELECTED" : "+ ADD"}
                              </small>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className={styles.campaignImageManager}>
                    <div className={styles.campaignImageManagerHead}>
                      <div>
                        <span>CAMPAIGN ARTWORK</span>
                        <strong>Desktop & mobile images</strong>
                      </div>
                      <small>JPG, PNG or WEBP · Max 8MB</small>
                    </div>

                    <div className={styles.campaignImageGrid}>
                      <label className={styles.campaignImageUpload}>
                        <span>DESKTOP</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void uploadImage(file, "desktop");
                            event.currentTarget.value = "";
                          }}
                        />
                        {form.desktop_image_url ? (
                          <img src={form.desktop_image_url} alt="" />
                        ) : (
                          <div>
                            <b>＋</b>
                            <strong>
                              {imageBusy === "desktop"
                                ? "UPLOADING..."
                                : "UPLOAD DESKTOP"}
                            </strong>
                            <small>Wide event artwork</small>
                          </div>
                        )}
                      </label>

                      <label className={styles.campaignImageUpload}>
                        <span>MOBILE</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void uploadImage(file, "mobile");
                            event.currentTarget.value = "";
                          }}
                        />
                        {form.mobile_image_url ? (
                          <img src={form.mobile_image_url} alt="" />
                        ) : (
                          <div>
                            <b>＋</b>
                            <strong>
                              {imageBusy === "mobile"
                                ? "UPLOADING..."
                                : "UPLOAD MOBILE"}
                            </strong>
                            <small>Optional phone artwork</small>
                          </div>
                        )}
                      </label>
                    </div>

                    {(form.desktop_image_url || form.mobile_image_url) ? (
                      <div className={styles.campaignImageClearRow}>
                        {form.desktop_image_url ? (
                          <button
                            type="button"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                desktop_image_url: "",
                              }))
                            }
                          >
                            REMOVE DESKTOP
                          </button>
                        ) : null}
                        {form.mobile_image_url ? (
                          <button
                            type="button"
                            onClick={() =>
                              setForm((current) => ({
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
                    <span>ARTWORK MODE</span>
                    <select
                      value={form.display_mode}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          display_mode: event.target.value as
                            | "overlay"
                            | "image_only",
                        }))
                      }
                    >
                      <option value="overlay">
                        Template + artwork background
                      </option>
                      <option value="image_only">
                        Full artwork only
                      </option>
                    </select>
                  </label>

                  <label className={styles.adminField}>
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

                  <div className={styles.campaignStyleManager}>
                    <div className={styles.campaignStyleHead}>
                      <div>
                        <span>STEP 2 · EVENT LOOK</span>
                        <strong>Colour direction</strong>
                      </div>
                      <small>
                        The template stays the same; this changes its finish.
                      </small>
                    </div>

                    <div className={styles.campaignPresetGrid}>
                      {(
                        Object.entries(campaignPresets) as Array<
                          [
                            CampaignPresetKey,
                            (typeof campaignPresets)[CampaignPresetKey],
                          ]
                        >
                      ).map(([key, preset]) => (
                        <button
                          type="button"
                          key={key}
                          className={
                            styles.campaignPresetCard +
                            (form.theme === key
                              ? " " + styles.activePreset
                              : "")
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
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className={styles.campaignColourGrid}>
                      {colourFields.map(([label, field]) => (
                        <label
                          className={styles.campaignColourField}
                          key={field}
                        >
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
                              maxLength={7}
                              onChange={(event) =>
                                updateColour(field, event.target.value)
                              }
                            />
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {form.display_mode === "overlay" ? (
                    <label className={styles.adminField}>
                      <span>
                        DARK OVERLAY ·{" "}
                        {Math.round(Number(form.overlay_opacity || 0) * 100)}%
                      </span>
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
                  ) : null}

                  <label className={styles.promotionCheck}>
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
                    <span>SHOW COUNTDOWN</span>
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
                        ? "SAVE CAMPAIGN"
                        : "+ CREATE CAMPAIGN"}
                  </button>

                  {editingId ? (
                    <button
                      type="button"
                      className={styles.adminSecondaryAction}
                      onClick={() => {
                        setEditingId("");
                        setForm(blankCampaign());
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
                  <span className={styles.adminPanelKicker}>CAMPAIGN LIST</span>
                  <h2>{campaigns.length} Campaigns</h2>
                  <p>Each campaign now has its own event layout.</p>
                </div>
              </div>

              {loading ? (
                <p className={styles.adminNotice}>Loading campaigns...</p>
              ) : campaigns.length === 0 ? (
                <div className={styles.adminEmptyState}>
                  <strong>No campaigns yet.</strong>
                  <span>Create your first big event on the left.</span>
                </div>
              ) : (
                <div className={styles.marketingList}>
                  {campaigns.map((campaign) => {
                    const template =
                      templates.find(
                        (item) => item.key === campaign.template_type
                      ) || templates[0];

                    return (
                      <article key={campaign.id}>
                        <div className={styles.marketingListVisual}>
                          {campaign.desktop_image_url ? (
                            <img src={campaign.desktop_image_url} alt="" />
                          ) : (
                            <i
                              style={{
                                background:
                                  "linear-gradient(135deg," +
                                  (campaign.primary_color || "#D8242F") +
                                  "," +
                                  (campaign.secondary_color || "#6F0D14") +
                                  ")",
                              }}
                            />
                          )}
                        </div>
                        <div className={styles.marketingListCopy}>
                          <span>{template.name.toUpperCase()}</span>
                          <strong>{campaign.title}</strong>
                          <small>
                            {new Date(campaign.starts_at).toLocaleString(
                              "en-MY",
                              {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                            {" → "}
                            {new Date(campaign.ends_at).toLocaleString(
                              "en-MY",
                              {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </small>
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
                            disabled={busy === "toggle-" + campaign.id}
                            className={
                              campaign.is_active
                                ? styles.promotionOn
                                : styles.promotionOff
                            }
                          >
                            {campaign.is_active ? "ACTIVE" : "OFF"}
                          </button>
                          <button
                            type="button"
                            className={styles.promotionDelete}
                            onClick={() => void deleteCampaign(campaign)}
                            disabled={busy === "delete-" + campaign.id}
                          >
                            {busy === "delete-" + campaign.id
                              ? "DELETING..."
                              : "DELETE"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

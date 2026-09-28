"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../../Admin.module.css";

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

type CampaignForm = {
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
    starts_at: toLocalInput(),
    ends_at: toLocalInput(
      new Date(Date.now() + 14 * 86400000).toISOString()
    ),
  };
}

export default function MarketingCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState<CampaignForm>(blankCampaign());
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [imageBusy, setImageBusy] = useState("");
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

    const { data, error: loadError } = await supabase
      .from("promotion_campaigns")
      .select(
        "id, title, subtitle, badge, cta_label, landing_path, theme, primary_color, secondary_color, text_color, muted_text_color, countdown_bg_color, countdown_text_color, button_bg_color, button_text_color, desktop_image_url, mobile_image_url, display_mode, overlay_opacity, show_countdown, image_position, starts_at, ends_at, sort_order, is_active"
      )
      .order("starts_at", { ascending: false });

    if (loadError) throw loadError;
    setCampaigns((data as Campaign[] | null) || []);
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
      const supabase = createClient();
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        badge: form.badge.trim() || null,
        cta_label: form.cta_label.trim() || "SHOP NOW",
        landing_path: form.landing_path.trim() || "/products",
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
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
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

      await load();
      setForm(blankCampaign());
      setEditingId("");
      setMessage(editingId ? "Campaign updated." : "Campaign created.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save campaign."
      );
    } finally {
      setBusy("");
    }
  }

  function editCampaign(campaign: Campaign) {
    setEditingId(campaign.id);
    setForm({
      title: campaign.title,
      subtitle: campaign.subtitle || "",
      badge: campaign.badge || "",
      cta_label: campaign.cta_label,
      landing_path: campaign.landing_path,
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
                Homepage banners, countdown campaigns and seasonal creative.
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
                    {editingId ? "EDIT CAMPAIGN" : "CREATE CAMPAIGN"}
                  </span>
                  <h2>Homepage Campaign</h2>
                  <p>
                    Build the campaign banner first, then connect vouchers and
                    product discounts from Marketing Centre.
                  </p>
                </div>
              </div>

              <form className={styles.adminForm} onSubmit={saveCampaign}>
                <div className={styles.adminFormGrid}>
                  <label className={styles.adminField}>
                    <span>TITLE</span>
                    <input
                      required
                      value={form.title}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="10.10 AUTO SALE"
                    />
                  </label>

                  <label className={styles.adminField}>
                    <span>BADGE</span>
                    <input
                      value={form.badge}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          badge: event.target.value,
                        }))
                      }
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
                    />
                  </label>

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

                  <div className={styles.campaignImageManager}>
                    <div className={styles.campaignImageManagerHead}>
                      <div>
                        <span>BANNER ARTWORK</span>
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
                            <small>Wide homepage banner</small>
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
                    <span>BANNER MODE</span>
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
                      <option value="overlay">Image + text overlay</option>
                      <option value="image_only">Image only</option>
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
                        <span>BANNER STYLE</span>
                        <strong>Preset & custom colours</strong>
                      </div>
                      <small>Select a preset or customise every colour.</small>
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
                          <small>{preset.description}</small>
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

                    <div
                      className={styles.campaignMiniPreview}
                      style={{
                        background:
                          "linear-gradient(120deg," +
                          form.primary_color +
                          "," +
                          form.secondary_color +
                          ")",
                        color: form.text_color,
                      }}
                    >
                      <div>
                        <span style={{ color: form.muted_text_color }}>
                          {form.badge || "LIMITED TIME"}
                        </span>
                        <strong>{form.title || "10.10 AUTO SALE"}</strong>
                        <small style={{ color: form.muted_text_color }}>
                          {form.subtitle || "Campaign subtitle preview"}
                        </small>
                        <b
                          style={{
                            background: form.button_bg_color,
                            color: form.button_text_color,
                          }}
                        >
                          {form.cta_label || "SHOP NOW"} →
                        </b>
                      </div>
                      <i
                        style={{
                          background: form.countdown_bg_color,
                          color: form.countdown_text_color,
                        }}
                      >
                        12 : 11 : 48 : 55
                      </i>
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
                  <p>Manage visibility, editing and deletion.</p>
                </div>
              </div>

              {loading ? (
                <p className={styles.adminNotice}>Loading campaigns...</p>
              ) : campaigns.length === 0 ? (
                <div className={styles.adminEmptyState}>
                  <strong>No campaigns yet.</strong>
                  <span>Create your first campaign on the left.</span>
                </div>
              ) : (
                <div className={styles.marketingList}>
                  {campaigns.map((campaign) => (
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
                        <span>{campaign.badge || "CAMPAIGN"}</span>
                        <strong>{campaign.title}</strong>
                        <small>
                          {new Date(campaign.starts_at).toLocaleString("en-MY", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" → "}
                          {new Date(campaign.ends_at).toLocaleString("en-MY", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

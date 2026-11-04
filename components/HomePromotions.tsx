"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/data/products";
import { formatPrice } from "@/data/products";
import { useT } from "./LanguageProvider";
import type { Translate } from "@/lib/i18n";
import { friendlyError } from "@/lib/i18n/errors";
import { celebrateClaim } from "@/lib/flyToCart";

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
  template_type: TemplateType;
  banner_style: BannerStyle;
  event_code: string;
  highlight_text: string | null;
  voucher_text: string | null;
  benefit_items: string[] | null;
  featured_product_ids: string[] | null;
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
  ends_at: string;
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
  first_order_only: boolean;
  ends_at: string;
};

const eventCategories = [
  { label: "nav.maintenance", mark: "M", href: "/products?group=maintenance" },
  { label: "nav.braking", mark: "B", href: "/products?group=braking" },
  { label: "nav.suspension", mark: "S", href: "/products?group=suspension" },
  { label: "nav.steering", mark: "R", href: "/products?group=steering" },
  { label: "nav.drivetrain", mark: "D", href: "/products?group=drivetrain" },
  { label: "nav.cooling", mark: "C", href: "/products?group=cooling" },
] as const;

function countdownLabel(endsAt: string, now: number) {
  const diff = Math.max(0, new Date(endsAt).getTime() - now);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

function voucherValue(voucher: Voucher, t: Translate) {
  if (voucher.discount_type === "free_shipping") return t("browse.promo.freeShipping");
  if (voucher.discount_type === "percent") {
    return t("browse.promo.percentOff", { n: Number(voucher.discount_value) });
  }
  return t("browse.promo.rmOff", { n: Number(voucher.discount_value).toFixed(0) });
}

function dealInfo(product: Product) {
  const candidates = (product.variants || [])
    .filter((variant) => variant.isActive)
    .map((variant) => ({
      price: Number(variant.price),
      compareAt: Number(variant.compareAtPrice || 0),
    }))
    .filter((item) => item.compareAt > item.price);

  if (!candidates.length) return null;

  const best = candidates.sort(
    (a, b) =>
      (b.compareAt - b.price) / b.compareAt -
      (a.compareAt - a.price) / a.compareAt
  )[0];

  return {
    price: best.price,
    compareAt: best.compareAt,
    percent: Math.max(
      1,
      Math.round(((best.compareAt - best.price) / best.compareAt) * 100)
    ),
  };
}

function lowestPrice(product: Product) {
  const prices = (product.variants || [])
    .filter((variant) => variant.isActive)
    .map((variant) => Number(variant.price))
    .filter((value) => Number.isFinite(value));

  return prices.length ? Math.min(...prices) : Number(product.price || 0);
}

export default function HomePromotions({
  products,
  only,
}: {
  products: Product[];
  // "vouchers": render just the voucher rail (the homepage has its own
  // banner carousel and flash-sale row).
  only?: "vouchers";
}) {
  const t = useT();
  const onlyVouchers = only === "vouchers";
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [claimedIds, setClaimedIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      const supabase = createClient();

      const [{ data: campaignData }, { data: voucherData }, auth] =
        await Promise.all([
          supabase
            .from("promotion_campaigns")
            .select(
              "id, title, subtitle, badge, cta_label, landing_path, template_type, banner_style, event_code, highlight_text, voucher_text, benefit_items, featured_product_ids, theme, primary_color, secondary_color, text_color, muted_text_color, countdown_bg_color, countdown_text_color, button_bg_color, button_text_color, desktop_image_url, mobile_image_url, display_mode, overlay_opacity, show_countdown, image_position, ends_at"
            )
            .eq("is_active", true)
            .lte("starts_at", new Date().toISOString())
            .gte("ends_at", new Date().toISOString())
            .order("sort_order", { ascending: true })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("vouchers")
            .select(
              "id, campaign_id, code, name, description, discount_type, discount_value, minimum_spend, max_discount, first_order_only, ends_at"
            )
            .eq("is_active", true)
            .lte("starts_at", new Date().toISOString())
            .gte("ends_at", new Date().toISOString())
            .order("created_at", { ascending: true }),
          supabase.auth.getUser(),
        ]);

      if (!active) return;

      setCampaign((campaignData as Campaign | null) || null);
      setVouchers((voucherData as Voucher[] | null) || []);

      const user = auth.data.user;

      if (user) {
        const { data: claimed } = await supabase
          .from("customer_vouchers")
          .select("voucher_id")
          .eq("user_id", user.id);

        if (!active) return;

        setClaimedIds(
          ((claimed as Array<{ voucher_id: string }> | null) || []).map(
            (row) => row.voucher_id
          )
        );
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const deals = useMemo(
    () =>
      products
        .map((product) => ({
          product,
          deal: dealInfo(product),
        }))
        .filter(
          (
            row
          ): row is {
            product: Product;
            deal: { price: number; compareAt: number; percent: number };
          } => Boolean(row.deal)
        )
        .slice(0, 4),
    [products]
  );

  const campaignVouchers = useMemo(() => {
    if (!campaign) return [];
    const linked = vouchers.filter(
      (voucher) => voucher.campaign_id === campaign.id
    );
    return (linked.length ? linked : vouchers).slice(0, 3);
  }, [campaign, vouchers]);

  const campaignProducts = useMemo(() => {
    if (!campaign) return [];
    const ids = campaign.featured_product_ids || [];
    const selected = ids
      .map((id) => products.find((product) => product.id === id))
      .filter((product): product is Product => Boolean(product));

    return selected.length ? selected : deals.map((row) => row.product).slice(0, 4);
  }, [campaign, products, deals]);

  async function claim(voucher: Voucher, button?: HTMLElement) {
    setMessage("");
    setBusyId(voucher.id);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login?next=/";
        return;
      }

      const { error } = await supabase.rpc("claim_voucher", {
        p_voucher_id: voucher.id,
      });

      if (error) throw error;

      setClaimedIds((current) =>
        current.includes(voucher.id) ? current : [...current, voucher.id]
      );
      celebrateClaim(button);
      setMessage(t("browse.promo.added", { code: voucher.code }));
    } catch (caught) {
      setMessage(
        friendlyError(caught, t, "browse.promo.claimError")
      );
    } finally {
      setBusyId("");
    }
  }

  if (!campaign && vouchers.length === 0 && deals.length === 0) {
    return null;
  }
  if (onlyVouchers && vouchers.length === 0) return null;

  const countdown =
    campaign && campaign.show_countdown
      ? countdownLabel(campaign.ends_at, now)
      : null;

  const campaignStyle = campaign
    ? ({
        "--campaign-primary": campaign.primary_color || "#D8242F",
        "--campaign-secondary": campaign.secondary_color || "#6F0D14",
        "--campaign-text": campaign.text_color || "#FFFFFF",
        "--campaign-muted": campaign.muted_text_color || "#FFE9EA",
        "--campaign-countdown-bg":
          campaign.countdown_bg_color || "#2B1014",
        "--campaign-countdown-text":
          campaign.countdown_text_color || "#FFFFFF",
        "--campaign-button-bg": campaign.button_bg_color || "#FFFFFF",
        "--campaign-button-text":
          campaign.button_text_color || "#B61923",
      } as CSSProperties & Record<string, string>)
    : undefined;

  const campaignThemeClass =
    campaign?.theme && /^[a-z0-9_-]+$/i.test(campaign.theme)
      ? " theme-" + campaign.theme
      : "";

  function Countdown({
    compact = false,
  }: {
    compact?: boolean;
  }) {
    if (!countdown) return null;

    return (
      <div
        className={
          "campaignCountdown" + (compact ? " campaignCountdownCompact" : "")
        }
      >
        <span>{t("browse.promo.endsIn")}</span>
        <div>
          <strong>{countdown.days}</strong>
          <small>{t("browse.promo.days")}</small>
        </div>
        <i>:</i>
        <div>
          <strong>{countdown.hours}</strong>
          <small>{t("browse.promo.hrs")}</small>
        </div>
        <i>:</i>
        <div>
          <strong>{countdown.minutes}</strong>
          <small>{t("browse.promo.min")}</small>
        </div>
        <i>:</i>
        <div>
          <strong>{countdown.seconds}</strong>
          <small>{t("browse.promo.sec")}</small>
        </div>
      </div>
    );
  }

  const templateType = campaign?.template_type || "mega_sale";
  const bannerStyle = campaign?.banner_style || "formal";
  const eventCode =
    campaign?.event_code ||
    campaign?.title.match(/\d+\.\d+/)?.[0] ||
    "10.10";
  const saleTitle =
    campaign && campaign.title.startsWith(eventCode + " ")
      ? campaign.title.slice(eventCode.length + 1)
      : campaign?.title || t("browse.promo.autoSale");
  const benefits =
    campaign?.benefit_items?.filter(Boolean).slice(0, 4) || [];

  return (
    <section className="homePromotions">
      <div className="container">
        {campaign && !onlyVouchers ? (
          <div
            className={
              "campaignEvent campaignEvent-" +
              templateType +
              " bannerStyle-" +
              bannerStyle +
              campaignThemeClass +
              (campaign.desktop_image_url ? " hasImage" : "") +
              (campaign.display_mode === "image_only" ? " imageOnly" : "")
            }
            style={campaignStyle}
          >
            {campaign.desktop_image_url ? (
              <picture className="campaignBannerMedia">
                {campaign.mobile_image_url ? (
                  <source
                    media="(max-width: 680px)"
                    srcSet={campaign.mobile_image_url}
                  />
                ) : null}
                <img
                  src={campaign.desktop_image_url}
                  alt={campaign.title}
                  style={{
                    objectPosition: campaign.image_position || "center",
                  }}
                />
              </picture>
            ) : null}

            {campaign.desktop_image_url &&
            campaign.display_mode !== "image_only" ? (
              <div
                className="campaignBannerShade"
                style={{
                  opacity: Number(campaign.overlay_opacity ?? 0.35),
                }}
              />
            ) : null}

            {campaign.display_mode === "image_only" &&
            campaign.desktop_image_url ? (
              <Link
                href={campaign.landing_path || "/products"}
                className="campaignBannerImageLink"
                aria-label={campaign.title}
              />
            ) : templateType === "voucher_blast" ? (
              <div className="campaignVoucherBlast">
                <div className="campaignEventCopy">
                  <span>{campaign.badge || t("browse.promo.limitedTime")}</span>
                  {campaign.highlight_text ? (
                    <b>{campaign.highlight_text}</b>
                  ) : null}
                  <h2>{campaign.title}</h2>
                  <p>{campaign.subtitle}</p>
                  {campaign.voucher_text ? (
                    <em>{campaign.voucher_text}</em>
                  ) : null}
                  <div className="campaignEventActions">
                    <Link href={campaign.landing_path || "/products"}>
                      {campaign.cta_label || t("browse.shopNow")} <b aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 8h9M8 4l4 4-4 4"/></svg></b>
                    </Link>
                    <Countdown compact />
                  </div>
                </div>

                <div className="campaignVoucherStack">
                  <div className="campaignVoucherStackHead">
                    <span>{t("browse.promo.claimSave")}</span>
                    <strong>{t("browse.promo.eventVouchers")}</strong>
                  </div>
                  {campaignVouchers.length > 0 ? (
                    campaignVouchers.map((voucher) => {
                      const claimed = claimedIds.includes(voucher.id);

                      return (
                        <article key={voucher.id}>
                          <div>
                            <span>{voucher.code}</span>
                            <strong>{voucherValue(voucher, t)}</strong>
                            <small>
                              {t("browse.promo.minSpend", {
                                amount: formatPrice(Number(voucher.minimum_spend)),
                              })}
                              {voucher.max_discount
                                ? " · " +
                                  t("browse.promo.cap", {
                                    amount: formatPrice(Number(voucher.max_discount)),
                                  })
                                : ""}
                            </small>
                          </div>
                          <button
                            type="button"
                            disabled={claimed || busyId === voucher.id}
                            onClick={(event) => void claim(voucher, event.currentTarget)}
                          >
                            {claimed
                              ? t("browse.promo.claimed")
                              : busyId === voucher.id
                                ? "..."
                                : t("browse.promo.claim")}
                          </button>
                        </article>
                      );
                    })
                  ) : (
                    <div className="campaignVoucherEmpty">
                      {t("browse.promo.campaignEmpty")}
                    </div>
                  )}
                </div>
              </div>
            ) : templateType === "flash_deal_grid" ? (
              <div className="campaignFlashLayout">
                <div className="campaignEventCopy">
                  <span>{campaign.badge || t("browse.promo.flashEvent")}</span>
                  {campaign.highlight_text ? (
                    <b>{campaign.highlight_text}</b>
                  ) : null}
                  <h2>{campaign.title}</h2>
                  <p>{campaign.subtitle}</p>
                  <div className="campaignEventActions">
                    <Link href={campaign.landing_path || "/products"}>
                      {campaign.cta_label || t("browse.promo.shopDeals")} <b aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 8h9M8 4l4 4-4 4"/></svg></b>
                    </Link>
                    <Countdown compact />
                  </div>
                </div>

                <div className="campaignProductGrid">
                  {campaignProducts.slice(0, 8).map((product) => {
                    const deal = dealInfo(product);
                    const price = deal?.price ?? lowestPrice(product);

                    return (
                      <Link
                        href={"/products/" + product.slug}
                        key={product.id || product.slug}
                        className="campaignProductCard"
                      >
                        <div>
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} />
                          ) : (
                            <span>{product.icon}</span>
                          )}
                          {deal ? <b>-{deal.percent}%</b> : null}
                        </div>
                        <small>{product.brand}</small>
                        <strong>{product.name}</strong>
                        <footer>
                          <b>{formatPrice(price)}</b>
                          {deal ? (
                            <del>{formatPrice(deal.compareAt)}</del>
                          ) : null}
                        </footer>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : templateType === "category_festival" ? (
              <div className="campaignCategoryLayout">
                <div className="campaignEventTop">
                  <div className="campaignEventCopy">
                    <span>{campaign.badge || t("browse.promo.festival")}</span>
                    {campaign.highlight_text ? (
                      <b>{campaign.highlight_text}</b>
                    ) : null}
                    <h2>{campaign.title}</h2>
                    <p>{campaign.subtitle}</p>
                  </div>
                  <Countdown />
                </div>

                <div className="campaignCategoryGrid">
                  {eventCategories.map((category) => (
                    <Link href={category.href} key={category.label}>
                      <b>{category.mark}</b>
                      <span>{t(category.label)}</span>
                      <i aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 8h9M8 4l4 4-4 4"/></svg></i>
                    </Link>
                  ))}
                </div>

                <div className="campaignEventFooter">
                  <div className="campaignBenefitStrip">
                    {(benefits.length
                      ? benefits
                      : [
                          t("browse.promo.trustedBrands"),
                          t("browse.promo.vehicleFitment"),
                          t("browse.promo.fastCheckout"),
                          t("browse.promo.malaysiaDelivery"),
                        ]
                    ).map((item, index) => (
                      <span key={item + index}>
                        <b>0{index + 1}</b>
                        {item}
                      </span>
                    ))}
                  </div>
                  <Link href={campaign.landing_path || "/products"}>
                    {campaign.cta_label || t("browse.promo.shopAllParts")} <span aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 8h9M8 4l4 4-4 4"/></svg></span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="campaignMegaLayout">
                <div className="campaignEventTop">
                  <div className="campaignEventCopy">
                    <span>{campaign.badge || t("browse.promo.bigEvent")}</span>
                    {campaign.highlight_text ? (
                      <b>{campaign.highlight_text}</b>
                    ) : null}
                    <div className="campaignEventCode">{eventCode}</div>
                    <h2>{saleTitle}</h2>
                    <p>{campaign.subtitle}</p>

                    <div className="campaignMegaPromos">
                      {campaign.voucher_text ? (
                        <em>{campaign.voucher_text}</em>
                      ) : null}
                      {campaignVouchers[0] ? (
                        <div>
                          <span>{campaignVouchers[0].code}</span>
                          <strong>{voucherValue(campaignVouchers[0], t)}</strong>
                          <small>
                            {t("browse.promo.minSpend", {
                              amount: formatPrice(
                                Number(campaignVouchers[0].minimum_spend)
                              ),
                            })}
                          </small>
                        </div>
                      ) : null}
                    </div>

                    <div className="campaignEventActions">
                      <Link href={campaign.landing_path || "/products"}>
                        {campaign.cta_label || t("browse.promo.shopEvent")} <b aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 8h9M8 4l4 4-4 4"/></svg></b>
                      </Link>
                    </div>
                  </div>

                  <div className="campaignMegaRight">
                    <div className="campaignBigNumber">
                      <span>{t("browse.promo.mega")}</span>
                      <strong>{eventCode}</strong>
                      <small>{t("browse.promo.megaSub")}</small>
                    </div>
                    <Countdown />
                  </div>
                </div>

                <div className="campaignBenefitStrip">
                  {(benefits.length
                    ? benefits
                    : [
                        t("browse.promo.freeShippingDeals"),
                        t("browse.promo.flashDiscounts"),
                        t("browse.promo.limitedVouchers"),
                        t("browse.promo.popularParts"),
                      ]
                  ).map((item, index) => (
                    <span key={item + index}>
                      <b>0{index + 1}</b>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {vouchers.length > 0 && (onlyVouchers || templateType !== "voucher_blast") ? (
          <div className="voucherSection">
            <div className="voucherSectionHead">
              <div>
                <span>{t("browse.promo.mivoVouchers")}</span>
                <h2>{t("browse.promo.claimBefore")}</h2>
              </div>
              <Link href="/account/vouchers">{t("browse.promo.myVouchers")} <span aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 8h9M8 4l4 4-4 4"/></svg></span></Link>
            </div>

            <div className="voucherRail">
              {vouchers.slice(0, 6).map((voucher) => {
                const claimed = claimedIds.includes(voucher.id);

                return (
                  <article className="voucherCard" key={voucher.id}>
                    <div className="voucherValue">
                      <span>{voucher.code}</span>
                      <strong>{voucherValue(voucher, t)}</strong>
                      <small>
                        {t("browse.promo.minSpend", {
                          amount: formatPrice(Number(voucher.minimum_spend)),
                        })}
                        {voucher.max_discount
                          ? " · " +
                            t("browse.promo.cap", {
                              amount: formatPrice(Number(voucher.max_discount)),
                            })
                          : ""}
                      </small>
                    </div>

                    <div className="voucherAction">
                      <span>
                        {voucher.first_order_only
                          ? t("browse.promo.firstOrder")
                          : t("browse.promo.limitedVoucher")}
                      </span>
                      <button
                        type="button"
                        disabled={claimed || busyId === voucher.id}
                        onClick={(event) => void claim(voucher, event.currentTarget)}
                      >
                        {claimed
                          ? t("browse.promo.claimed")
                          : busyId === voucher.id
                            ? t("browse.promo.claiming")
                            : t("browse.promo.claim")}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {message ? <p className="voucherMessage">{message}</p> : null}
          </div>
        ) : null}

        {deals.length > 0 && !onlyVouchers && templateType !== "flash_deal_grid" ? (
          <div className="flashDealsSection">
            <div className="flashDealsHead">
              <div>
                <span>{t("browse.promo.flashDeals")}</span>
                <h2>{t("browse.promo.limitedPrices")}</h2>
              </div>
              <Link href="/products">{t("browse.promo.viewAllDeals")} <span aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 8h9M8 4l4 4-4 4"/></svg></span></Link>
            </div>

            <div className="flashDealsGrid">
              {deals.map(({ product, deal }) => (
                <Link
                  href={"/products/" + product.slug}
                  className="flashDealCard"
                  key={product.slug}
                >
                  <div className="flashDealImage">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} />
                    ) : (
                      <span>{product.icon}</span>
                    )}
                    <b>-{deal.percent}%</b>
                  </div>

                  <div className="flashDealInfo">
                    <span>{product.brand}</span>
                    <strong>{product.name}</strong>
                    <div>
                      <b>{formatPrice(deal.price)}</b>
                      <del>{formatPrice(deal.compareAt)}</del>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

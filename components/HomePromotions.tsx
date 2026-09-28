"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/data/products";
import { formatPrice } from "@/data/products";

type Campaign = {
  id: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
  cta_label: string;
  landing_path: string;
  theme: string;
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

function voucherValue(voucher: Voucher) {
  if (voucher.discount_type === "free_shipping") return "FREE SHIPPING";
  if (voucher.discount_type === "percent") {
    return Number(voucher.discount_value) + "% OFF";
  }
  return "RM" + Number(voucher.discount_value).toFixed(0) + " OFF";
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

export default function HomePromotions({
  products,
}: {
  products: Product[];
}) {
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
              "id, title, subtitle, badge, cta_label, landing_path, theme, desktop_image_url, mobile_image_url, display_mode, overlay_opacity, show_countdown, image_position, ends_at"
            )
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("vouchers")
            .select(
              "id, code, name, description, discount_type, discount_value, minimum_spend, max_discount, first_order_only, ends_at"
            )
            .eq("is_active", true)
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

  async function claim(voucher: Voucher) {
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
      setMessage(voucher.code + " added to My Vouchers.");
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Unable to claim voucher."
      );
    } finally {
      setBusyId("");
    }
  }

  if (!campaign && vouchers.length === 0 && deals.length === 0) {
    return null;
  }

  const countdown =
    campaign && campaign.show_countdown
      ? countdownLabel(campaign.ends_at, now)
      : null;

  return (
    <section className="homePromotions">
      <div className="container">
        {campaign ? (
          <div
            className={
              "campaignBanner" +
              (campaign.desktop_image_url ? " hasImage" : "") +
              (campaign.display_mode === "image_only" ? " imageOnly" : "")
            }
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
                  style={{ objectPosition: campaign.image_position || "center" }}
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
            ) : (
              <>
                <div className="campaignBannerCopy">
                  <span>{campaign.badge || "MIVO CAMPAIGN"}</span>
                  <h2>{campaign.title}</h2>
                  <p>{campaign.subtitle}</p>
                  <Link href={campaign.landing_path || "/products"}>
                    {campaign.cta_label || "SHOP NOW"} <b>→</b>
                  </Link>
                </div>

                {countdown ? (
                  <div className="campaignCountdown">
                    <span>ENDS IN</span>
                    <div>
                      <strong>{countdown.days}</strong>
                      <small>DAYS</small>
                    </div>
                    <i>:</i>
                    <div>
                      <strong>{countdown.hours}</strong>
                      <small>HRS</small>
                    </div>
                    <i>:</i>
                    <div>
                      <strong>{countdown.minutes}</strong>
                      <small>MIN</small>
                    </div>
                    <i>:</i>
                    <div>
                      <strong>{countdown.seconds}</strong>
                      <small>SEC</small>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {vouchers.length > 0 ? (
          <div className="voucherSection">
            <div className="voucherSectionHead">
              <div>
                <span>MIVO VOUCHERS</span>
                <h2>Claim before checkout.</h2>
              </div>
              <Link href="/account/vouchers">MY VOUCHERS →</Link>
            </div>

            <div className="voucherRail">
              {vouchers.slice(0, 6).map((voucher) => {
                const claimed = claimedIds.includes(voucher.id);

                return (
                  <article className="voucherCard" key={voucher.id}>
                    <div className="voucherValue">
                      <span>{voucher.code}</span>
                      <strong>{voucherValue(voucher)}</strong>
                      <small>
                        Min. spend {formatPrice(Number(voucher.minimum_spend))}
                        {voucher.max_discount
                          ? " · Cap " +
                            formatPrice(Number(voucher.max_discount))
                          : ""}
                      </small>
                    </div>

                    <div className="voucherAction">
                      <span>
                        {voucher.first_order_only
                          ? "FIRST ORDER"
                          : "LIMITED VOUCHER"}
                      </span>
                      <button
                        type="button"
                        disabled={claimed || busyId === voucher.id}
                        onClick={() => void claim(voucher)}
                      >
                        {claimed
                          ? "CLAIMED"
                          : busyId === voucher.id
                            ? "CLAIMING..."
                            : "CLAIM"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {message ? <p className="voucherMessage">{message}</p> : null}
          </div>
        ) : null}

        {deals.length > 0 ? (
          <div className="flashDealsSection">
            <div className="flashDealsHead">
              <div>
                <span>FLASH DEALS</span>
                <h2>Limited-time part prices.</h2>
              </div>
              <Link href="/products">VIEW ALL DEALS →</Link>
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

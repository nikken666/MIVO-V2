"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/data/products";
import { formatPrice } from "@/data/products";

type Deal = {
  product: Product;
  price: number;
  compareAt: number;
  percent: number;
  stock: number | null;
};

// Best discounted active variant of a product, if any.
function bestDeal(product: Product): Deal | null {
  const candidates = (product.variants || [])
    .filter((variant) => variant.isActive)
    .map((variant) => ({
      price: Number(variant.price),
      compareAt: Number(variant.compareAtPrice || 0),
      stock: typeof variant.stock === "number" ? variant.stock : null,
    }))
    .filter((item) => item.compareAt > item.price);

  if (!candidates.length) return null;

  const best = candidates.sort(
    (a, b) => (b.compareAt - b.price) / b.compareAt - (a.compareAt - a.price) / a.compareAt
  )[0];

  return {
    product,
    price: best.price,
    compareAt: best.compareAt,
    stock: best.stock,
    percent: Math.max(1, Math.round(((best.compareAt - best.price) / best.compareAt) * 100)),
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export default function FlashSale({ products }: { products: Product[] }) {
  const deals = useMemo(
    () =>
      products
        .map(bestDeal)
        .filter((deal): deal is Deal => Boolean(deal))
        .sort((a, b) => b.percent - a.percent)
        .slice(0, 10),
    [products]
  );

  // The countdown follows the soonest-ending live campaign; without one there
  // is no real deadline, so no timer is shown.
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const iso = new Date().toISOString();
        const { data } = await createClient()
          .from("promotion_campaigns")
          .select("ends_at")
          .eq("is_active", true)
          .lte("starts_at", iso)
          .gte("ends_at", iso)
          .order("ends_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (active && data?.ends_at) setEndsAt(new Date(data.ends_at).getTime());
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!endsAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  if (!deals.length) return null;

  const remaining = endsAt ? Math.max(0, Math.floor((endsAt - now) / 1000)) : 0;
  const days = Math.floor(remaining / 86400);
  const clock = [
    Math.floor((remaining % 86400) / 3600),
    Math.floor((remaining % 3600) / 60),
    remaining % 60,
  ].map(pad);

  return (
    <section className="container shopSection">
      <div className="flashSale">
        <div className="flashSaleHead">
          <h2>
            <span className="flashSaleBolt" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z" /></svg>
            </span>
            Flash sale
          </h2>
          {endsAt && remaining > 0 ? (
            <div className="flashSaleClock" aria-label="Time left">
              <small>Ends in</small>
              {days > 0 ? <b>{days}d</b> : null}
              <b>{clock[0]}</b>:<b>{clock[1]}</b>:<b className="tick">{clock[2]}</b>
            </div>
          ) : (
            <small className="flashSaleNote">Limited-time prices</small>
          )}
          <Link href="/products" className="shopSeeAll">
            See all ›
          </Link>
        </div>

        <div className="flashSaleRail">
          {deals.map((deal) => {
            const lowStock = deal.stock !== null && deal.stock <= 20;
            // Bar fills as stock runs low (real stock, not invented "sold" counts).
            const bar = deal.stock === null ? 30 : Math.max(12, Math.min(95, 100 - deal.stock * 4));

            return (
              <Link href={"/products/" + deal.product.slug} className="flashSaleCard" key={deal.product.slug}>
                <div className="flashSaleImage">
                  {deal.product.imageUrl ? (
                    <img src={deal.product.imageUrl} alt={deal.product.name} loading="lazy" />
                  ) : (
                    <span>{deal.product.icon}</span>
                  )}
                  <span className="flashSaleBadge">-{deal.percent}%</span>
                </div>
                <div className="flashSaleInfo">
                  <strong>{formatPrice(deal.price)}</strong>
                  <del>{formatPrice(deal.compareAt)}</del>
                  <div className="flashSaleBar" aria-hidden="true">
                    <i style={{ width: bar + "%" }} />
                    <span>{lowStock ? "Only " + deal.stock + " left" : "In stock"}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

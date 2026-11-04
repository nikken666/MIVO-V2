"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";
import { useT } from "./LanguageProvider";

type Promo = { name: string; min_spend: number; max_subsidy: number | null };

/** A3: "RM xx more for free shipping" with a bar that fills as the cart grows. */
export default function FreeShippingProgress({ subtotal, promo }: { subtotal: number; promo?: Promo | null }) {
  const t = useT();
  const [loaded, setLoaded] = useState<Promo | null>(null);

  useEffect(() => {
    if (promo !== undefined) return;
    let active = true;
    void createClient()
      .rpc("active_shipping_promotion")
      .then(({ data }) => {
        if (active) setLoaded((data as Promo | null) || null);
      });
    return () => {
      active = false;
    };
  }, [promo]);

  const current = promo !== undefined ? promo : loaded;
  const min = Number(current?.min_spend || 0);
  if (!current || !(min > 0) || subtotal <= 0) return null;

  const reached = subtotal >= min;
  const percent = Math.min(100, Math.round((subtotal / min) * 100));
  return (
    <div className={"freeShipProgress" + (reached ? " reached" : "")} role="status">
      <p>
        {reached
          ? t("buy.ship.unlocked")
          : t("buy.co.freeShippingNudge", { amount: formatPrice(min - subtotal) })}
      </p>
      <div className="freeShipTrack" aria-hidden="true">
        <span style={{ width: percent + "%" }} />
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { voucherAllowed, voucherUses } from "@/lib/vouchers";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";
import { useT } from "@/components/LanguageProvider";
import type { Translate } from "@/lib/i18n";
import { friendlyError } from "@/lib/i18n/errors";
import { celebrateClaim } from "@/lib/flyToCart";

type Voucher = {
  id: string;
  code: string;
  name: string;
  discount_type: "fixed" | "percent" | "free_shipping";
  discount_value: number | string;
  minimum_spend: number | string;
  first_order_only: boolean;
  starts_at: string;
  ends_at: string;
};

function valueLabel(t: Translate, voucher: Voucher) {
  if (voucher.discount_type === "free_shipping") return t("buy.voucher.freeShipping");
  if (voucher.discount_type === "percent") {
    return t("buy.voucher.percentOff", { n: Number(voucher.discount_value) });
  }
  return t("buy.voucher.amountOff", { n: Number(voucher.discount_value).toFixed(0) });
}

export default function CartVoucherStrip() {
  const t = useT();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [claimedIds, setClaimedIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      const supabase = createClient();

      const [{ data: voucherData }, auth] = await Promise.all([
        supabase
          .from("vouchers")
          .select("*")
          .eq("is_active", true)
          .gte("ends_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.auth.getUser(),
      ]);

      if (!active) return;

      let available = (voucherData as Voucher[] | null) || [];

      if (auth.data.user) {
        const userId = auth.data.user.id;
        const [
          { data: claimed },
          { data: redemptions },
          { count: paidOrderCount },
        ] = await Promise.all([
          supabase
            .from("customer_vouchers")
            .select("voucher_id")
            .eq("user_id", userId),
          supabase
            .from("voucher_redemptions")
            .select("voucher_id, status")
            .eq("user_id", userId)
            .in("status", ["reserved", "redeemed"]),
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .in("status", ["paid", "processing", "packed", "shipped", "delivered", "completed"]),
        ]);

        if (!active) return;

        const uses = voucherUses(redemptions as Array<{ voucher_id: string; status: string }> | null);
        const claimedSet = new Set(((claimed as Array<{ voucher_id: string }> | null) || []).map((row) => row.voucher_id));
        const now = Date.now();

        available = available.filter((voucher) => {
          if (!voucherAllowed(voucher, { paidOrders: Number(paidOrderCount || 0), claimed: claimedSet.has(voucher.id), uses })) {
            return false;
          }
          const startsAt = new Date(voucher.starts_at).getTime();
          const endsAt = new Date(voucher.ends_at).getTime();
          if (Number.isFinite(startsAt) && startsAt > now) return false;
          if (Number.isFinite(endsAt) && endsAt < now) return false;
          return true;
        });

        setClaimedIds(Array.from(claimedSet));
      }

      setVouchers(available.slice(0, 4));
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  async function claim(voucher: Voucher, button?: HTMLElement) {
    setMessage("");
    setBusyId(voucher.id);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login?next=/cart";
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
      setMessage(t("buy.voucher.claimedMsg", { code: voucher.code }));
    } catch (caught) {
      setMessage(
        friendlyError(caught, t, "buy.voucher.claimFailed")
      );
    } finally {
      setBusyId("");
    }
  }

  if (!vouchers.length) return null;

  return (
    <section className="cartVoucherStrip">
      <div className="cartVoucherHead">
        <div>
          <span>{t("buy.voucher.eyebrow")}</span>
          <strong>{t("buy.voucher.saveMore")}</strong>
        </div>
        <Link href="/account/vouchers">{t("buy.voucher.myVouchers")}</Link>
      </div>

      <div className="cartVoucherMiniGrid">
        {vouchers.map((voucher) => {
          const claimed = claimedIds.includes(voucher.id);

          return (
            <article key={voucher.id}>
              <div>
                <span>{voucher.code}</span>
                <strong>{valueLabel(t, voucher)}</strong>
                <small>
                  {t("buy.voucher.minSpend", {
                    amount: formatPrice(Number(voucher.minimum_spend)),
                  })}
                </small>
              </div>
              <button
                type="button"
                disabled={claimed || busyId === voucher.id}
                onClick={(event) => void claim(voucher, event.currentTarget)}
              >
                {claimed
                  ? t("buy.voucher.claimed")
                  : busyId === voucher.id
                    ? "..."
                    : t("buy.voucher.claim")}
              </button>
            </article>
          );
        })}
      </div>

      {message ? <p>{message}</p> : null}
    </section>
  );
}

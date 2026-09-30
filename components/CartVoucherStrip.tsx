"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";

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

function valueLabel(voucher: Voucher) {
  if (voucher.discount_type === "free_shipping") return "FREE SHIPPING";
  if (voucher.discount_type === "percent") {
    return Number(voucher.discount_value) + "% OFF";
  }
  return "RM" + Number(voucher.discount_value).toFixed(0) + " OFF";
}

export default function CartVoucherStrip() {
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
          .select(
            "id, code, name, discount_type, discount_value, minimum_spend, first_order_only, starts_at, ends_at"
          )
          .eq("is_active", true)
          .order("created_at", { ascending: true })
          .limit(4),
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
            .in("status", ["paid", "processing", "packed", "shipped", "delivered"]),
        ]);

        if (!active) return;

        const blockedIds = new Set(
          ((redemptions as Array<{ voucher_id: string; status: string }> | null) || [])
            .map((row) => row.voucher_id)
        );
        const now = Date.now();

        available = available.filter((voucher) => {
          if (blockedIds.has(voucher.id)) return false;
          if (voucher.first_order_only && Number(paidOrderCount || 0) > 0) {
            return false;
          }
          const startsAt = new Date(voucher.starts_at).getTime();
          const endsAt = new Date(voucher.ends_at).getTime();
          if (Number.isFinite(startsAt) && startsAt > now) return false;
          if (Number.isFinite(endsAt) && endsAt < now) return false;
          return true;
        });

        setClaimedIds(
          ((claimed as Array<{ voucher_id: string }> | null) || [])
            .map((row) => row.voucher_id)
            .filter((id) => !blockedIds.has(id))
        );
      }

      setVouchers(available);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  async function claim(voucher: Voucher) {
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
      setMessage(voucher.code + " claimed.");
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Unable to claim voucher."
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
          <span>MIVO VOUCHERS</span>
          <strong>Save more at checkout</strong>
        </div>
        <Link href="/account/vouchers">MY VOUCHERS →</Link>
      </div>

      <div className="cartVoucherMiniGrid">
        {vouchers.map((voucher) => {
          const claimed = claimedIds.includes(voucher.id);

          return (
            <article key={voucher.id}>
              <div>
                <span>{voucher.code}</span>
                <strong>{valueLabel(voucher)}</strong>
                <small>
                  Min. spend {formatPrice(Number(voucher.minimum_spend))}
                </small>
              </div>
              <button
                type="button"
                disabled={claimed || busyId === voucher.id}
                onClick={() => void claim(voucher)}
              >
                {claimed
                  ? "CLAIMED"
                  : busyId === voucher.id
                    ? "..."
                    : "CLAIM"}
              </button>
            </article>
          );
        })}
      </div>

      {message ? <p>{message}</p> : null}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "./LanguageProvider";
import { friendlyError } from "@/lib/i18n/errors";

type ShopVoucher = {
  id: string;
  code: string;
  name: string;
  discount_type: "fixed" | "percent";
  discount_value: number | string;
  minimum_spend: number | string;
  max_discount: number | string | null;
  ends_at: string;
};

/** A shop's own vouchers (Shopee-style tickets) with Claim buttons. Hidden when the shop has none. */
export default function ShopVouchers({ sellerId, compact = false }: { sellerId?: string | null; compact?: boolean }) {
  const t = useT();
  const [vouchers, setVouchers] = useState<ShopVoucher[]>([]);
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!sellerId) return;
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("shop_vouchers", { p_seller_id: sellerId });
      if (!active || error) return;
      const list = (data as ShopVoucher[] | null) || [];
      setVouchers(list);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && list.length) {
        const { data: mine } = await supabase
          .from("customer_vouchers")
          .select("voucher_id")
          .eq("user_id", user.id)
          .in("voucher_id", list.map((v) => v.id));
        if (active) setClaimed(new Set(((mine as Array<{ voucher_id: string }> | null) || []).map((r) => r.voucher_id)));
      }
    })();
    return () => {
      active = false;
    };
  }, [sellerId]);

  async function claim(voucher: ShopVoucher) {
    setBusy(voucher.id);
    setMessage("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
        return;
      }
      const { error } = await supabase.rpc("claim_voucher", { p_voucher_id: voucher.id });
      if (error && !/already/i.test(error.message)) throw error;
      setClaimed((current) => new Set(current).add(voucher.id));
      setMessage(t("buy.voucher.claimedMsg", { code: voucher.code }));
    } catch (caught) {
      setMessage(friendlyError(caught, t, "buy.voucher.claimFailed"));
    } finally {
      setBusy("");
    }
  }

  if (!vouchers.length) return null;

  return (
    <section className={"shopVouchers" + (compact ? " compact" : "")} aria-label={t("buy.voucher.shopVouchers")}>
      <strong className="shopVouchersTitle">{t("buy.voucher.shopVouchers")}</strong>
      <div className="shopVouchersRow">
        {vouchers.map((v) => (
          <div className="shopVoucherTicket" key={v.id}>
            <div>
              <b>
                {v.discount_type === "percent"
                  ? t("buy.voucher.percentOff", { n: Number(v.discount_value) })
                  : t("buy.voucher.amountOff", { n: Number(v.discount_value).toFixed(0) })}
              </b>
              <small>{t("buy.voucher.minSpend", { amount: "RM" + Number(v.minimum_spend).toFixed(0) })}</small>
            </div>
            <button type="button" disabled={busy === v.id || claimed.has(v.id)} onClick={() => void claim(v)}>
              {claimed.has(v.id) ? t("buy.voucher.claimed") : t("buy.voucher.claim")}
            </button>
          </div>
        ))}
      </div>
      {message ? <small className="shopVouchersMsg">{message}</small> : null}
    </section>
  );
}

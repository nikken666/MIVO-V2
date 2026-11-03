"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";
import { useT } from "@/components/LanguageProvider";
import type { Translate } from "@/lib/i18n";
import { intlTag } from "@/lib/i18n/format";
import { friendlyError } from "@/lib/i18n/errors";

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
  starts_at: string;
  ends_at: string;
};

type ClaimedVoucher = Voucher & {
  claimed_at: string;
};

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString(intlTag(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function valueLabel(voucher: Voucher, t: Translate) {
  if (voucher.discount_type === "free_shipping") return t("account.vouchers.freeShipping");
  if (voucher.discount_type === "percent") {
    return t("account.vouchers.off", { value: Number(voucher.discount_value) + "%" });
  }
  return t("account.vouchers.off", { value: "RM" + Number(voucher.discount_value).toFixed(0) });
}

export default function MyVouchersPage() {
  const router = useRouter();
  const t = useT();
  const [vouchers, setVouchers] = useState<ClaimedVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login?next=/account/vouchers");
          return;
        }

        const [
          { data: claimed, error: claimError },
          { data: redemptions, error: redemptionError },
          { count: paidOrderCount, error: paidOrderError },
        ] = await Promise.all([
          supabase
            .from("customer_vouchers")
            .select("voucher_id, claimed_at")
            .eq("user_id", user.id)
            .order("claimed_at", { ascending: false }),
          supabase
            .from("voucher_redemptions")
            .select("voucher_id, status")
            .eq("user_id", user.id)
            .in("status", ["reserved", "redeemed"]),
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .in("status", ["paid", "processing", "packed", "shipped", "delivered"]),
        ]);

        if (claimError) throw claimError;
        if (redemptionError) throw redemptionError;
        if (paidOrderError) throw paidOrderError;

        const blockedIds = new Set(
          ((redemptions as Array<{ voucher_id: string; status: string }> | null) || [])
            .map((row) => row.voucher_id)
        );

        const rows =
          ((claimed as Array<{
            voucher_id: string;
            claimed_at: string;
          }> | null) || []).filter((row) => !blockedIds.has(row.voucher_id));

        const ids = rows.map((row) => row.voucher_id);

        if (!ids.length) {
          if (active) setVouchers([]);
          return;
        }

        const { data: voucherData, error: voucherError } = await supabase
          .from("vouchers")
          .select(
            "id, code, name, description, discount_type, discount_value, minimum_spend, max_discount, first_order_only, starts_at, ends_at"
          )
          .in("id", ids);

        if (voucherError) throw voucherError;

        const byId = new Map(
          ((voucherData as Voucher[] | null) || [])
            .filter(
              (voucher) =>
                !voucher.first_order_only || Number(paidOrderCount || 0) === 0
            )
            .map((voucher) => [voucher.id, voucher])
        );

        if (!active) return;

        setVouchers(
          rows
            .map((row) => {
              const voucher = byId.get(row.voucher_id);
              return voucher
                ? { ...voucher, claimed_at: row.claimed_at }
                : null;
            })
            .filter((value): value is ClaimedVoucher => Boolean(value))
        );
      } catch (caught) {
        if (!active) return;
        setError(
          friendlyError(caught, t, "account.vouchers.loadError")
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="accountDataPage myVouchersPage">
      <div className="container">
        <div className="accountDataHeader">
          <div>
            <span>{t("account.common.mivoAccount")}</span>
            <h1>{t("account.vouchers.title")}</h1>
            <p>{t("account.vouchers.subtitle")}</p>
          </div>
          <Link href="/account">← {t("account.common.backAccount")}</Link>
        </div>

        {error ? <p className="checkoutError">{error}</p> : null}

        {loading ? (
          <p className="accountDataNotice">{t("account.vouchers.loading")}</p>
        ) : vouchers.length === 0 ? (
          <div className="ordersEmpty">
            <strong>{t("account.vouchers.emptyTitle")}</strong>
            <p>{t("account.vouchers.emptyText")}</p>
            <Link href="/">{t("account.vouchers.viewPromotions")}</Link>
          </div>
        ) : (
          <div className="myVoucherGrid">
            {vouchers.map((voucher) => {
              const expired = new Date(voucher.ends_at).getTime() < Date.now();

              return (
                <article
                  className={
                    "myVoucherCard" + (expired ? " expired" : "")
                  }
                  key={voucher.id}
                >
                  <div>
                    <span>{voucher.code}</span>
                    <strong>{valueLabel(voucher, t)}</strong>
                    <p>{voucher.description || voucher.name}</p>
                  </div>

                  <div className="myVoucherMeta">
                    <span>
                      {t("account.vouchers.minSpend", { price: formatPrice(Number(voucher.minimum_spend)) })}
                    </span>
                    {voucher.max_discount ? (
                      <span>
                        {t("account.vouchers.maxDiscount", { price: formatPrice(Number(voucher.max_discount)) })}
                      </span>
                    ) : null}
                    {voucher.first_order_only ? (
                      <span>{t("account.vouchers.firstOrder")}</span>
                    ) : null}
                    <span>{t("account.vouchers.validUntil", { date: dateLabel(voucher.ends_at) })}</span>
                  </div>

                  <Link
                    href={expired ? "/" : "/products"}
                    className={expired ? "disabled" : ""}
                  >
                    {expired ? t("account.status.expired") : t("account.vouchers.useNow")}

                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

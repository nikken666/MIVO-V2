"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";

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
  return new Date(value).toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function valueLabel(voucher: Voucher) {
  if (voucher.discount_type === "free_shipping") return "FREE SHIPPING";
  if (voucher.discount_type === "percent") {
    return Number(voucher.discount_value) + "% OFF";
  }
  return "RM" + Number(voucher.discount_value).toFixed(0) + " OFF";
}

export default function MyVouchersPage() {
  const router = useRouter();
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

        const { data: claimed, error: claimError } = await supabase
          .from("customer_vouchers")
          .select("voucher_id, claimed_at")
          .eq("user_id", user.id)
          .order("claimed_at", { ascending: false });

        if (claimError) throw claimError;

        const rows =
          (claimed as Array<{
            voucher_id: string;
            claimed_at: string;
          }> | null) || [];
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
          ((voucherData as Voucher[] | null) || []).map((voucher) => [
            voucher.id,
            voucher,
          ])
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
          caught instanceof Error ? caught.message : "Unable to load vouchers."
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
            <span>MIVO ACCOUNT</span>
            <h1>My Vouchers</h1>
            <p>Claimed discounts ready for your next checkout.</p>
          </div>
          <Link href="/account">← ACCOUNT</Link>
        </div>

        {error ? <p className="checkoutError">{error}</p> : null}

        {loading ? (
          <p className="accountDataNotice">Loading vouchers...</p>
        ) : vouchers.length === 0 ? (
          <div className="ordersEmpty">
            <strong>No vouchers claimed yet.</strong>
            <p>Visit the MIVO home page and claim an available promotion.</p>
            <Link href="/">VIEW PROMOTIONS →</Link>
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
                    <strong>{valueLabel(voucher)}</strong>
                    <p>{voucher.description || voucher.name}</p>
                  </div>

                  <div className="myVoucherMeta">
                    <span>
                      Min. spend {formatPrice(Number(voucher.minimum_spend))}
                    </span>
                    {voucher.max_discount ? (
                      <span>
                        Max discount {formatPrice(Number(voucher.max_discount))}
                      </span>
                    ) : null}
                    {voucher.first_order_only ? (
                      <span>First order only</span>
                    ) : null}
                    <span>Valid until {dateLabel(voucher.ends_at)}</span>
                  </div>

                  <Link
                    href={expired ? "/" : "/products"}
                    className={expired ? "disabled" : ""}
                  >
                    {expired ? "EXPIRED" : "USE NOW →"}
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

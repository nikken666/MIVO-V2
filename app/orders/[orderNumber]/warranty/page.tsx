"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/LanguageProvider";
import type { Key, Translate } from "@/lib/i18n";
import { intlTag } from "@/lib/i18n/format";
import { friendlyError } from "@/lib/i18n/errors";

type WarrantyOrder = {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  paid_at: string | null;
};

type WarrantyItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  variant_name: string | null;
  warranty_months: number | null;
  image_url?: string | null;
};

type WarrantyClaimSummary = {
  id: string;
  claim_number: string;
  order_item_id: string;
  status: string;
  created_at: string;
};

function addMonths(value: string, months: number) {
  const date = new Date(value);
  const result = new Date(date);
  const day = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(day, lastDay));
  return result;
}

function dateLabel(value: Date | string | null) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);

  return date.toLocaleDateString(intlTag(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatStatus(value: string, t: Translate) {
  const key = ("account.status." + value) as Key;
  const label = t(key);
  if (label !== key) return label;
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function OrderWarrantyPage() {
  const params = useParams();
  const router = useRouter();
  const t = useT();
  const orderNumber = String(params.orderNumber || "");

  const [order, setOrder] = useState<WarrantyOrder | null>(null);
  const [items, setItems] = useState<WarrantyItem[]>([]);
  const [warrantyStart, setWarrantyStart] = useState<string | null>(null);
  const [claimsByItem, setClaimsByItem] = useState<
    Record<string, WarrantyClaimSummary>
  >({});
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
          router.replace(
            "/login?next=" +
              encodeURIComponent(
                "/orders/" + orderNumber + "/warranty"
              )
          );
          return;
        }

        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("id, order_number, status, created_at, paid_at")
          .eq("order_number", orderNumber)
          .eq("user_id", user.id)
          .maybeSingle();

        if (orderError || !orderData) {
          throw orderError || new Error(t("account.detail.notFound"));
        }

        if (orderData.status !== "delivered" && orderData.status !== "completed") {
          router.replace(
            "/orders/" + encodeURIComponent(orderNumber)
          );
          return;
        }

        const { data: itemData, error: itemError } = await supabase
          .from("order_items")
          .select(
            "id, product_id, product_name, variant_name, warranty_months"
          )
          .eq("order_id", orderData.id)
          .order("created_at", { ascending: true });

        if (itemError) throw itemError;

        const rawItems =
          (itemData as Omit<WarrantyItem, "image_url">[] | null) || [];
        // Every item can be claimed: one without a set warranty is reviewed by MIVO.
        const warrantiedItems = rawItems;

        if (warrantiedItems.length === 0) {
          throw new Error(t("account.warranty.noWarranty"));
        }

        const productIds = Array.from(
          new Set(
            warrantiedItems
              .map((item) => item.product_id)
              .filter((value): value is string => Boolean(value))
          )
        );
        const imageMap = new Map<string, string>();

        if (productIds.length > 0) {
          const { data: products, error: productError } = await supabase
            .from("products")
            .select("id, primary_image_url")
            .in("id", productIds);

          if (productError) throw productError;

          (
            (products as Array<{
              id: string;
              primary_image_url: string | null;
            }> | null) || []
          ).forEach((product) => {
            if (product.primary_image_url) {
              imageMap.set(product.id, product.primary_image_url);
            }
          });

          const missing = productIds.filter(
            (productId) => !imageMap.has(productId)
          );

          if (missing.length > 0) {
            const { data: images, error: imageError } = await supabase
              .from("product_images")
              .select("product_id, image_url, sort_order")
              .in("product_id", missing)
              .order("sort_order", { ascending: true });

            if (imageError) throw imageError;

            (
              (images as Array<{
                product_id: string;
                image_url: string;
                sort_order: number;
              }> | null) || []
            ).forEach((image) => {
              if (!imageMap.has(image.product_id) && image.image_url) {
                imageMap.set(image.product_id, image.image_url);
              }
            });
          }
        }

        const { data: deliveredHistory } = await supabase
          .from("order_status_history")
          .select("created_at")
          .eq("order_id", orderData.id)
          .eq("new_status", "delivered")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: claimData, error: claimError } = await supabase
          .from("warranty_claims")
          .select("id, claim_number, order_item_id, status, created_at")
          .eq("order_id", orderData.id)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (claimError) throw claimError;

        const latestClaims: Record<string, WarrantyClaimSummary> = {};

        (
          (claimData as WarrantyClaimSummary[] | null) || []
        ).forEach((claim) => {
          if (!latestClaims[claim.order_item_id]) {
            latestClaims[claim.order_item_id] = claim;
          }
        });

        if (!active) return;

        setClaimsByItem(latestClaims);
        setOrder(orderData as WarrantyOrder);
        setWarrantyStart(
          deliveredHistory?.created_at ||
            orderData.paid_at ||
            orderData.created_at
        );
        setItems(
          warrantiedItems.map((item) => ({
            ...item,
            image_url: item.product_id
              ? imageMap.get(item.product_id) || null
              : null,
          }))
        );
      } catch (caught) {
        if (!active) return;
        setError(
          friendlyError(caught, t, "account.warranty.loadError")
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [orderNumber, router]);

  const activeCount = useMemo(() => {
    if (!warrantyStart) return 0;

    return items.filter((item) => {
      if (Number(item.warranty_months || 0) <= 0) return true;
      const expiry = addMonths(
        warrantyStart,
        Number(item.warranty_months || 0)
      );
      return expiry.getTime() >= Date.now();
    }).length;
  }, [items, warrantyStart]);

  if (loading) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <p className="accountDataNotice">{t("account.warranty.loading")}</p>
        </div>
      </main>
    );
  }

  if (error || !order || !warrantyStart) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <div className="ordersEmpty">
            <strong>{t("account.warranty.unavailable")}</strong>
            <p>{error || t("account.warranty.notFound")}</p>
            <Link href={"/orders/" + encodeURIComponent(orderNumber)}>
              {t("account.receipt.backToOrder")} →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="accountDataPage warrantyPage">
      <div className="container">
        <div className="accountDataHeader">
          <div>
            <span>{t("account.warranty.eyebrow")}</span>
            <h1>{t("account.warranty.title")}</h1>
            <p>
              {t("account.warranty.subtitle", { order: order.order_number, n: activeCount })}
            </p>
          </div>

          <Link href={"/orders/" + encodeURIComponent(order.order_number)}>
            ← {t("account.receipt.orderDetails")}
          </Link>
        </div>

        <section className="warrantyOverview">
          <div>
            <span>{t("account.warranty.start")}</span>
            <strong>{dateLabel(warrantyStart)}</strong>
          </div>
          <div>
            <span>{t("account.warranty.orderStatus")}</span>
            <strong>{t("account.status.completed")}</strong>
          </div>
          <div>
            <span>{t("account.warranty.coveredItems")}</span>
            <strong>{items.length}</strong>
          </div>
        </section>

        <div className="warrantyItemList">
          {items.map((item) => {
            const months = Number(item.warranty_months || 0);
            const expiry = addMonths(warrantyStart, months);
            const reviewOnly = months <= 0;
            const active = reviewOnly || expiry.getTime() >= Date.now();

            return (
              <article className="warrantyItemCard" key={item.id}>
                <div className="warrantyItemImage">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.product_name} />
                  ) : (
                    <span>M</span>
                  )}
                </div>

                <div className="warrantyItemInfo">
                  <span>{active ? t("account.warranty.activeWarranty") : t("account.warranty.ended")}</span>
                  <strong>{item.product_name}</strong>
                  {item.variant_name ? (
                    <small>{item.variant_name}</small>
                  ) : null}
                </div>

                <div className="warrantyItemPeriod">
                  <div>
                    <span>{t("account.warranty.period")}</span>
                    <strong>
                      {reviewOnly ? t("account.warranty.mivoReview") : t("account.warranty.months", { n: months })}
                    </strong>
                  </div>
                  {reviewOnly ? null : (
                    <div>
                      <span>{t("account.warranty.expires")}</span>
                      <strong>{dateLabel(expiry)}</strong>
                    </div>
                  )}
                  <b className={active ? "active" : "expired"}>
                    {active ? t("account.status.active") : t("account.status.expired")}
                  </b>
                </div>

                <div className="warrantyItemActions">
                  {claimsByItem[item.id] ? (
                    <small>
                      {t("account.warranty.latestClaim", { n: claimsByItem[item.id].claim_number })} ·{" "}
                      {formatStatus(claimsByItem[item.id].status, t)}
                    </small>
                  ) : null}

                  {active &&
                  !["new", "reviewing", "approved"].includes(
                    claimsByItem[item.id]?.status || ""
                  ) ? (
                    <Link
                      href={
                        "/orders/" +
                        encodeURIComponent(order.order_number) +
                        "/warranty/claim?item=" +
                        encodeURIComponent(item.id)
                      }
                      className="orderPrimaryButton"
                    >
                      {t("account.warranty.submitClaim")}
                    </Link>
                  ) : claimsByItem[item.id] ? (
                    <Link
                      href="/account/claims"
                      className="orderGhostButton"
                    >
                      {t("account.warranty.viewClaim")}
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        <section className="warrantyTermsCard">
          <span>{t("account.warranty.important")}</span>
          <h2>{t("account.warranty.recordTitle")}</h2>
          <p>
            {t("account.warranty.recordText")}
          </p>

        </section>
      </div>
    </main>
  );
}

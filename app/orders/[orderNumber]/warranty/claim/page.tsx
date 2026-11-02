"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/LanguageProvider";
import { intlTag } from "@/lib/i18n/format";
import { friendlyError } from "@/lib/i18n/errors";

type ClaimOrder = {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  paid_at: string | null;
};

type ClaimItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  variant_name: string | null;
  warranty_months: number | null;
  image_url?: string | null;
};

type PhotoDraft = {
  file: File;
  preview: string;
};

type ClaimResult = {
  id: string;
  claim_number: string;
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

export default function WarrantyClaimPage() {
  const params = useParams();
  const router = useRouter();
  const t = useT();
  const orderNumber = String(params.orderNumber || "");

  const [order, setOrder] = useState<ClaimOrder | null>(null);
  const [item, setItem] = useState<ClaimItem | null>(null);
  const [warrantyStart, setWarrantyStart] = useState<string | null>(null);
  const [issueType, setIssueType] = useState("defect");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [claim, setClaim] = useState<ClaimResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const search = new URLSearchParams(window.location.search);
        const orderItemId = search.get("item") || "";

        if (!orderItemId) {
          throw new Error(t("account.claim.chooseItem"));
        }

        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace(
            "/login?next=" +
              encodeURIComponent(
                "/orders/" +
                  orderNumber +
                  "/warranty/claim?item=" +
                  orderItemId
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

        if (orderData.status !== "delivered") {
          throw new Error(t("account.claim.afterDelivery"));
        }

        const { data: itemData, error: itemError } = await supabase
          .from("order_items")
          .select(
            "id, product_id, product_name, variant_name, warranty_months"
          )
          .eq("id", orderItemId)
          .eq("order_id", orderData.id)
          .maybeSingle();

        if (itemError || !itemData) {
          throw itemError || new Error(t("account.claim.itemNotFound"));
        }

        const months = Number(itemData.warranty_months || 0);

        if (months <= 0) {
          throw new Error(t("account.claim.noCoverage"));
        }

        const { data: activeClaim } = await supabase
          .from("warranty_claims")
          .select("claim_number, status")
          .eq("order_item_id", itemData.id)
          .eq("user_id", user.id)
          .in("status", ["new", "reviewing", "approved"])
          .limit(1)
          .maybeSingle();

        if (activeClaim) {
          router.replace("/account/claims");
          return;
        }

        let imageUrl: string | null = null;

        if (itemData.product_id) {
          const { data: productData } = await supabase
            .from("products")
            .select("primary_image_url")
            .eq("id", itemData.product_id)
            .maybeSingle();

          imageUrl = productData?.primary_image_url || null;

          if (!imageUrl) {
            const { data: imageData } = await supabase
              .from("product_images")
              .select("image_url")
              .eq("product_id", itemData.product_id)
              .order("sort_order", { ascending: true })
              .limit(1)
              .maybeSingle();

            imageUrl = imageData?.image_url || null;
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

        const startAt =
          deliveredHistory?.created_at ||
          orderData.paid_at ||
          orderData.created_at;
        const expiry = addMonths(startAt, months);

        if (Date.now() > expiry.getTime()) {
          throw new Error(t("account.claim.expired"));
        }

        if (!active) return;

        setOrder(orderData as ClaimOrder);
        setItem({
          ...(itemData as Omit<ClaimItem, "image_url">),
          image_url: imageUrl,
        });
        setWarrantyStart(startAt);
      } catch (caught) {
        if (!active) return;
        setError(
          friendlyError(caught, t, "account.claim.prepareError")
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

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;

    const available = Math.max(0, 5 - photos.length);

    if (available < 1) {
      setError(t("account.claim.maxPhotos"));
      return;
    }

    const incoming = Array.from(files).slice(0, available);
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

    for (const file of incoming) {
      if (!allowed.has(file.type)) {
        setError(t("account.review.photoType"));
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError(t("account.review.photoSize"));
        return;
      }
    }

    const previews = await Promise.all(
      incoming.map(
        (file) =>
          new Promise<PhotoDraft>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                file,
                preview: String(reader.result || ""),
              });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          })
      )
    );

    setError("");
    setPhotos((current) => [...current, ...previews]);
  }

  function removePhoto(index: number) {
    setPhotos((current) =>
      current.filter((_, photoIndex) => photoIndex !== index)
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!order || !item) return;

    if (description.trim().length < 10) {
      setError(t("account.claim.moreDetail"));
      return;
    }

    setBusy(true);
    setError("");

    try {
      let imageUrls: string[] = [];

      if (photos.length > 0) {
        const formData = new FormData();
        formData.append("orderNumber", order.order_number);
        formData.append("orderItemId", item.id);

        photos.forEach((photo) => {
          formData.append("images", photo.file);
        });

        const response = await fetch(
          "/api/warranty/claims/images",
          {
            method: "POST",
            body: formData,
          }
        );

        const upload = (await response.json()) as {
          paths?: string[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            upload.error || t("account.claim.uploadError")
          );
        }

        imageUrls = upload.paths || [];
      }

      const supabase = createClient();
      const { data, error: claimError } = await supabase.rpc(
        "create_warranty_claim",
        {
          p_order_number: order.order_number,
          p_order_item_id: item.id,
          p_issue_type: issueType,
          p_description: description.trim(),
          p_image_urls: imageUrls,
        }
      );

      if (claimError) throw claimError;

      setClaim(data as ClaimResult);
    } catch (caught) {
      setError(
        friendlyError(caught, t, "account.claim.submitError")
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <p className="accountDataNotice">{t("account.claim.preparing")}</p>
        </div>
      </main>
    );
  }

  if (error && (!order || !item || !warrantyStart)) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <div className="ordersEmpty">
            <strong>{t("account.claim.unavailable")}</strong>
            <p>{error}</p>
            <Link href={"/orders/" + encodeURIComponent(orderNumber) + "/warranty"}>
              {t("account.claim.backToWarranty")} →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (claim) {
    return (
      <main className="accountDataPage warrantyClaimThanksPage">
        <div className="container">
          <section className="warrantyClaimThanks">
            <div className="warrantyClaimThanksIcon">✓</div>
            <span>{t("account.claim.submitted")}</span>
            <h1>{t("account.claim.receivedTitle")}</h1>
            <p>
              {t("account.claim.receivedText")}
            </p>

            <div className="warrantyClaimNumber">
              <span>{t("account.claim.claimNumber")}</span>
              <strong>{claim.claim_number}</strong>
            </div>

            <div className="warrantyClaimThanksActions">
              <Link href="/account/claims" className="orderPrimaryButton">
                {t("account.claim.viewMyClaims")}
              </Link>
              <Link
                href={
                  "/orders/" +
                  encodeURIComponent(orderNumber) +
                  "/warranty"
                }
                className="orderGhostButton"
              >
                {t("account.claim.backToWarranty")}
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const months = Number(item?.warranty_months || 0);
  const expiry = warrantyStart
    ? addMonths(warrantyStart, months)
    : null;

  return (
    <main className="accountDataPage warrantyClaimPage">
      <div className="container">
        <div className="accountDataHeader">
          <div>
            <span>{t("account.claim.eyebrow")}</span>
            <h1>{t("account.claim.title")}</h1>
            <p>{t("account.detail.orderNo", { n: order?.order_number ?? "" })}</p>
          </div>

          <Link
            href={
              "/orders/" +
              encodeURIComponent(orderNumber) +
              "/warranty"
            }
          >
            ← {t("account.orders.warranty")}
          </Link>
        </div>

        <div className="warrantyClaimLayout">
          <aside className="warrantyClaimProductCard">
            <div className="warrantyClaimProductImage">
              {item?.image_url ? (
                <img src={item.image_url} alt={item.product_name} />
              ) : (
                <span>M</span>
              )}
            </div>

            <span>{t("account.claim.item")}</span>
            <strong>{item?.product_name}</strong>
            {item?.variant_name ? <small>{item.variant_name}</small> : null}

            <div className="warrantyClaimCoverage">
              <div>
                <span>{t("account.warranty.period")}</span>
                <strong>{t("account.warranty.months", { n: months })}</strong>
              </div>
              <div>
                <span>{t("account.warranty.expires")}</span>
                <strong>{dateLabel(expiry)}</strong>
              </div>
            </div>
          </aside>

          <form className="warrantyClaimForm" onSubmit={submit}>
            <div className="warrantyClaimFormHead">
              <span>{t("account.claim.details")}</span>
              <h2>{t("account.claim.whatHappened")}</h2>
              <p>
                {t("account.claim.detailsText")}
              </p>
            </div>

            <label className="warrantyClaimField">
              <span>{t("account.claim.issueType")} *</span>
              <select
                value={issueType}
                onChange={(event) => setIssueType(event.target.value)}
              >
                <option value="defect">{t("account.issue.defect")}</option>
                <option value="noise">{t("account.issue.noise")}</option>
                <option value="leakage">{t("account.issue.leakage")}</option>
                <option value="fitment">{t("account.issue.fitment")}</option>
                <option value="damage">{t("account.issue.damage")}</option>
                <option value="performance">{t("account.issue.performance")}</option>
                <option value="other">{t("account.issue.other")}</option>
              </select>
            </label>

            <label className="warrantyClaimField">
              <span>{t("account.claim.describe")} *</span>
              <textarea
                rows={6}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t("account.claim.describePlaceholder")}
              />
              <small>{t("account.claim.characters", { n: description.trim().length })}</small>
            </label>

            <div className="warrantyClaimPhotos">
              <div className="warrantyClaimPhotosHead">
                <div>
                  <span>{t("account.claim.photos")}</span>
                  <small>{t("account.review.photoHint")}</small>
                </div>
                <b>{photos.length} / 5</b>
              </div>

              <div className="warrantyClaimPhotoGrid">
                {photos.map((photo, index) => (
                  <div className="warrantyClaimPhoto" key={photo.preview + index}>
                    <img src={photo.preview} alt={t("account.claim.evidenceAlt")} />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      aria-label={t("account.claim.removePhoto")}
                    >
                      ×
                    </button>
                  </div>
                ))}

                {photos.length < 5 ? (
                  <label className="warrantyClaimPhotoAdd">
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        void addPhotos(event.target.files);
                        event.currentTarget.value = "";
                      }}
                    />
                    <b>＋</b>
                    <span>{t("account.review.addPhotos")}</span>
                    <small>{t("account.review.remaining", { n: 5 - photos.length })}</small>
                  </label>
                ) : null}
              </div>
            </div>

            {error ? <p className="checkoutError">{error}</p> : null}

            <div className="warrantyClaimSubmitRow">
              <p>
                {t("account.claim.confirmText")}
              </p>
              <button
                type="submit"
                className="orderPrimaryButton"
                disabled={busy}
              >
                {busy ? t("account.claim.submitting") : t("account.warranty.submitClaim")}

              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

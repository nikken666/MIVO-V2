"use client";

import Link from "next/link";
import ReviewCelebration from "@/components/orders/ReviewCelebration";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/LanguageProvider";
import { friendlyError } from "@/lib/i18n/errors";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
};

type OrderItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string;
  image_url: string | null;
};

type ReviewRow = {
  order_item_id: string;
  rating: number;
  comment: string | null;
  image_urls: string[] | null;
};

type ReviewDraft = {
  rating: number;
  comment: string;
  imageUrls: string[];
};

type ReviewPhotoDraft = {
  file: File;
  preview: string;
};

// Same masking as supabase/review-names.sql: "Ali Buyer" → "A****r".
function maskName(name: string) {
  const value = name.trim();
  if (!value) return "M****r";
  if (value.length <= 2) return value.slice(0, 1) + "*";
  return value.slice(0, 1) + "*".repeat(Math.min(value.length - 2, 4)) + value.slice(-1);
}

export default function OrderReviewPage() {
  const params = useParams();
  const router = useRouter();
  const t = useT();
  const orderNumber = String(params.orderNumber || "");

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [photoDrafts, setPhotoDrafts] = useState<
    Record<string, ReviewPhotoDraft[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  // Show a masked name ("A****r") instead of the customer's name.
  const [anonymous, setAnonymous] = useState(true);
  const [customerName, setCustomerName] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace(
            "/login?next=/orders/" +
              encodeURIComponent(orderNumber) +
              "/review"
          );
          return;
        }

        void supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle()
          .then(({ data: profile }) =>
            setCustomerName(
              (profile as { full_name?: string | null } | null)?.full_name ||
                (user.email || "").split("@")[0]
            )
          );

        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("id, order_number, status")
          .eq("order_number", orderNumber)
          .eq("user_id", user.id)
          .maybeSingle();

        if (orderError || !orderData) {
          throw orderError || new Error(t("account.detail.notFound"));
        }

        if (orderData.status !== "delivered") {
          router.replace(
            "/orders/" + encodeURIComponent(orderNumber)
          );
          return;
        }

        const { data: itemData, error: itemError } = await supabase
          .from("order_items")
          .select("id, product_id, product_name, variant_name, sku")
          .eq("order_id", orderData.id)
          .order("created_at");

        if (itemError) throw itemError;

        const rawItems = (itemData as Omit<OrderItem, "image_url">[] | null) || [];
        const productIds = Array.from(
          new Set(
            rawItems
              .map((item) => item.product_id)
              .filter((value): value is string => Boolean(value))
          )
        );

        const productImageMap = new Map<string, string>();

        if (productIds.length) {
          const { data: productData, error: productError } = await supabase
            .from("products")
            .select("id, primary_image_url")
            .in("id", productIds);

          if (productError) throw productError;

          ((productData as Array<{
            id: string;
            primary_image_url: string | null;
          }> | null) || []).forEach((product) => {
            if (product.primary_image_url) {
              productImageMap.set(product.id, product.primary_image_url);
            }
          });

          const missingProductIds = productIds.filter(
            (productId) => !productImageMap.has(productId)
          );

          if (missingProductIds.length) {
            const { data: imageData, error: imageError } = await supabase
              .from("product_images")
              .select("product_id, image_url, sort_order")
              .in("product_id", missingProductIds)
              .order("sort_order", { ascending: true });

            if (imageError) throw imageError;

            ((imageData as Array<{
              product_id: string;
              image_url: string;
              sort_order: number;
            }> | null) || []).forEach((image) => {
              if (!productImageMap.has(image.product_id) && image.image_url) {
                productImageMap.set(image.product_id, image.image_url);
              }
            });
          }
        }

        const enrichedItems: OrderItem[] = rawItems.map((item) => ({
          ...item,
          image_url: item.product_id
            ? productImageMap.get(item.product_id) || null
            : null,
        }));

        const { data: reviewData, error: reviewError } = await supabase
          .from("product_reviews")
          .select("order_item_id, rating, comment, image_urls")
          .eq("order_id", orderData.id)
          .eq("user_id", user.id);

        if (reviewError) throw reviewError;

        const savedReviews = (reviewData as ReviewRow[] | null) || [];
        const reviewedItemIds = new Set(
          savedReviews.map((review) => review.order_item_id)
        );
        const loadedItems = (itemData as OrderItem[] | null) || [];

        if (
          loadedItems.length > 0 &&
          loadedItems.every((item) => reviewedItemIds.has(item.id))
        ) {
          router.replace(
            "/orders/" + encodeURIComponent(orderNumber)
          );
          return;
        }

        const saved = new Map(
          savedReviews.map((review) => [
            review.order_item_id,
            review,
          ])
        );

        const nextDrafts: Record<string, ReviewDraft> = {};
        loadedItems.forEach((item) => {
          const review = saved.get(item.id);
          nextDrafts[item.id] = {
            rating: review?.rating || 0,
            comment: review?.comment || "",
            imageUrls: review?.image_urls || [],
          };
        });

        if (!active) return;

        setOrder(orderData as OrderRow);
        setItems(enrichedItems);
        setDrafts(nextDrafts);
      } catch (caught) {
        if (!active) return;
        setError(
          friendlyError(caught, t, "account.review.loadError")
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

  function setRating(itemId: string, rating: number) {
    setDrafts((current) => ({
      ...current,
      [itemId]: {
        rating,
        comment: current[itemId]?.comment || "",
        imageUrls: current[itemId]?.imageUrls || [],
      },
    }));
  }

  function setComment(itemId: string, comment: string) {
    setDrafts((current) => ({
      ...current,
      [itemId]: {
        rating: current[itemId]?.rating || 0,
        comment,
        imageUrls: current[itemId]?.imageUrls || [],
      },
    }));
  }

  async function addPhotos(itemId: string, files: FileList | null) {
    if (!files?.length) return;

    const currentSaved = drafts[itemId]?.imageUrls.length || 0;
    const currentLocal = photoDrafts[itemId]?.length || 0;
    const available = Math.max(0, 5 - currentSaved - currentLocal);

    if (available < 1) {
      setError(t("account.review.maxPhotos"));
      return;
    }

    const incoming = Array.from(files).slice(0, available);
    const allowedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);

    for (const file of incoming) {
      if (!allowedTypes.has(file.type)) {
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
          new Promise<ReviewPhotoDraft>((resolve, reject) => {
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
    setPhotoDrafts((current) => ({
      ...current,
      [itemId]: [...(current[itemId] || []), ...previews],
    }));
  }

  function removeLocalPhoto(itemId: string, index: number) {
    setPhotoDrafts((current) => ({
      ...current,
      [itemId]: (current[itemId] || []).filter(
        (_, photoIndex) => photoIndex !== index
      ),
    }));
  }

  function removeSavedPhoto(itemId: string, url: string) {
    setDrafts((current) => ({
      ...current,
      [itemId]: {
        rating: current[itemId]?.rating || 0,
        comment: current[itemId]?.comment || "",
        imageUrls: (current[itemId]?.imageUrls || []).filter(
          (imageUrl) => imageUrl !== url
        ),
      },
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!order) return;

    const unrated = items.find(
      (item) => !drafts[item.id] || drafts[item.id].rating < 1
    );

    if (unrated) {
      setError(t("account.review.rateAll"));
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error(t("account.review.sessionExpired"));

      const uploadedByItem: Record<string, string[]> = {};

      for (const item of items) {
        const photos = photoDrafts[item.id] || [];

        if (!photos.length) {
          uploadedByItem[item.id] = [];
          continue;
        }

        const formData = new FormData();
        formData.append("orderNumber", order.order_number);
        formData.append("orderItemId", item.id);

        photos.forEach((photo) => {
          formData.append("images", photo.file);
        });

        const response = await fetch("/api/reviews/images", {
          method: "POST",
          body: formData,
        });

        const result = (await response.json()) as {
          urls?: string[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(result.error || t("account.review.uploadError"));
        }

        uploadedByItem[item.id] = result.urls || [];
      }

      const payload = items.map((item) => ({
        user_id: user.id,
        order_id: order.id,
        order_item_id: item.id,
        product_id: item.product_id,
        rating: drafts[item.id].rating,
        comment: drafts[item.id].comment.trim() || null,
        image_urls: [
          ...(drafts[item.id].imageUrls || []),
          ...(uploadedByItem[item.id] || []),
        ].slice(0, 5),
        updated_at: new Date().toISOString(),
      }));

      let { error: reviewError } = await supabase
        .from("product_reviews")
        .upsert(
          payload.map((row) => ({ ...row, is_anonymous: anonymous })),
          { onConflict: "order_item_id" }
        );
      // Before supabase/review-names.sql runs there is no is_anonymous column.
      if (reviewError && /is_anonymous/.test(reviewError.message)) {
        ({ error: reviewError } = await supabase
          .from("product_reviews")
          .upsert(payload, { onConflict: "order_item_id" }));
      }

      if (reviewError) throw reviewError;

      setDrafts((current) => {
        const next = { ...current };

        items.forEach((item) => {
          next[item.id] = {
            rating: current[item.id]?.rating || 0,
            comment: current[item.id]?.comment || "",
            imageUrls: [
              ...(current[item.id]?.imageUrls || []),
              ...(uploadedByItem[item.id] || []),
            ].slice(0, 5),
          };
        });

        return next;
      });
      setPhotoDrafts({});
      setMessage("");
      setSubmitted(true);
    } catch (caught) {
      setError(
        friendlyError(caught, t, "account.review.saveError")
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <p className="accountDataNotice">{t("account.review.loading")}</p>
        </div>
      </main>
    );
  }

  if (error && !order) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <div className="ordersEmpty">
            <strong>{t("account.review.cannotRate")}</strong>
            <p>{error}</p>
            <Link href="/orders">{t("account.detail.backToOrders")} →</Link>
          </div>
        </div>
      </main>
    );
  }

  if (submitted && order) {
    const rated = Object.values(drafts).map((draft) => draft.rating).filter((n) => n > 0);
    const averageStars = rated.length ? Math.round(rated.reduce((a, b) => a + b, 0) / rated.length) : 0;
    return (
      <main className="accountDataPage reviewOrderPage reviewThanksPage">
        <div className="container">
          <section className="reviewThanksCard">
            <ReviewCelebration stars={averageStars} />
            <span>{t("account.review.submitted")}</span>
            <h1>{t("account.review.thanksTitle")}</h1>
            <p>
              {t("account.review.thanksText")}
            </p>

            <div className="reviewThanksOrder">
              <span>{t("account.orders.order")}</span>
              <strong>{order.order_number}</strong>
            </div>

            <div className="reviewThanksActions">
              <Link
                href={
                  "/orders/" + encodeURIComponent(order.order_number)
                }
                className="orderPrimaryButton"
              >
                {t("account.receipt.backToOrder")}
              </Link>
              <Link href="/products" className="orderGhostButton">
                {t("account.common.continueShopping")}
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="accountDataPage reviewOrderPage">
      <div className="container">
        <div className="accountDataHeader">
          <div>
            <span>{t("account.common.mivoAccount")}</span>
            <h1>{t("account.review.title")}</h1>
            <p>
              {t("account.review.subtitle", { n: order?.order_number ?? "" })}
            </p>
          </div>

          <Link
            href={"/orders/" + encodeURIComponent(orderNumber)}
          >
            ← {t("account.receipt.orderDetails")}
          </Link>
        </div>

        <form className="reviewOrderForm" onSubmit={submit}>
          {items.map((item) => {
            const draft = drafts[item.id] || {
              rating: 0,
              comment: "",
              imageUrls: [],
            };
            const localPhotos = photoDrafts[item.id] || [];
            const photoCount = draft.imageUrls.length + localPhotos.length;

            return (
              <article className="reviewProductCard" key={item.id}>
                <div className="reviewProductHead">
                  <div className="reviewProductImage">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.product_name}
                      />
                    ) : (
                      <span>M</span>
                    )}
                  </div>
                  <div>
                    <strong>{item.product_name}</strong>
                    <small>{item.variant_name || t("account.common.defaultVariant")}</small>
                  </div>
                </div>

                <div className="reviewStars">
                  <span>{t("account.review.productRating")}</span>
                  <div>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        className={
                          star <= draft.rating ? "active" : ""
                        }
                        onClick={() => setRating(item.id, star)}
                        aria-label={t("account.review.starLabel", { n: star })}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <small>
                    {draft.rating === 5
                      ? t("account.review.rating5")
                      : draft.rating === 4
                        ? t("account.review.rating4")
                        : draft.rating === 3
                          ? t("account.review.rating3")
                          : draft.rating === 2
                            ? t("account.review.rating2")
                            : draft.rating === 1
                              ? t("account.review.rating1")
                              : t("account.review.tapStar")}
                  </small>
                </div>

                <div className="reviewFeedbackColumn">
                  <div className="reviewPhotoUpload">
                    <div className="reviewPhotoUploadHead">
                      <div>
                        <span>{t("account.review.addPhotos")}</span>
                        <small>{t("account.review.addPhotosHint")}</small>
                      </div>
                      <b>{photoCount} / 5</b>
                    </div>

                    <div className="reviewPhotoArea">
                      {photoCount > 0 ? (
                        <div className="reviewPhotoGrid">
                          {draft.imageUrls.map((url) => (
                            <div className="reviewPhotoThumb" key={url}>
                              <img src={url} alt={t("account.review.photoAlt")} />
                              <button
                                type="button"
                                onClick={() =>
                                  removeSavedPhoto(item.id, url)
                                }
                                aria-label={t("account.review.removeSaved")}
                              >
                                ×
                              </button>
                            </div>
                          ))}

                          {localPhotos.map((photo, photoIndex) => (
                            <div
                              className="reviewPhotoThumb"
                              key={photo.preview + photoIndex}
                            >
                              <img
                                src={photo.preview}
                                alt={t("account.review.selectedAlt")}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  removeLocalPhoto(item.id, photoIndex)
                                }
                                aria-label={t("account.review.removeSelected")}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {photoCount < 5 ? (
                        <label className="reviewPhotoAdd">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            onChange={(event) => {
                              void addPhotos(item.id, event.target.files);
                              event.currentTarget.value = "";
                            }}
                          />
                          <b>＋</b>
                          <span>{t("account.review.addPhotos")}</span>
                          <small>{t("account.review.remaining", { n: 5 - photoCount })}</small>
                        </label>
                      ) : null}
                    </div>

                    <small className="reviewPhotoHint">
                      {t("account.review.photoHint")}
                    </small>
                  </div>

                  <label className="reviewComment">
                    <span>{t("account.review.comments")}</span>
                    <textarea
                      rows={4}
                      value={draft.comment}
                      onChange={(event) =>
                        setComment(item.id, event.target.value)
                      }
                      placeholder={t("account.review.commentPlaceholder")}
                    />
                  </label>
                </div>
              </article>
            );
          })}

          {message ? (
            <p className="accountDataSuccess">{message}</p>
          ) : null}
          {error ? <p className="accountDataError">{error}</p> : null}

          <label className="reviewAnonymous">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(event) => setAnonymous(event.target.checked)}
            />
            <span>
              <strong>{t("account.review.anonymous")}</strong>
              <small>
                {anonymous
                  ? t("account.review.anonymousOn", { name: maskName(customerName) })
                  : t("account.review.anonymousOff", { name: customerName || t("buy.pd.customer") })}
              </small>
            </span>
          </label>

          <div className="reviewOrderActions">
            <Link href="/orders" className="orderGhostButton">
              {t("account.detail.backToOrders")}
            </Link>

            <button
              type="submit"
              className="orderPrimaryButton"
              disabled={busy || items.length === 0}
            >
              {busy ? t("account.review.saving") : t("account.review.submit")}

            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

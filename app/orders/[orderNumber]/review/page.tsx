"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

export default function OrderReviewPage() {
  const params = useParams();
  const router = useRouter();
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

        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("id, order_number, status")
          .eq("order_number", orderNumber)
          .eq("user_id", user.id)
          .maybeSingle();

        if (orderError || !orderData) {
          throw orderError || new Error("Order not found.");
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

        const saved = new Map(
          ((reviewData as ReviewRow[] | null) || []).map((review) => [
            review.order_item_id,
            review,
          ])
        );

        const nextDrafts: Record<string, ReviewDraft> = {};
        ((itemData as OrderItem[] | null) || []).forEach((item) => {
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
          caught instanceof Error
            ? caught.message
            : "Unable to load review page."
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
      setError("You can upload up to 5 photos per product.");
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
        setError("Only JPG, PNG and WEBP photos are allowed.");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError("Each photo must be 5MB or smaller.");
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
      setError("Please rate every item before submitting.");
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

      if (!user) throw new Error("Your session has expired.");

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
          throw new Error(result.error || "Unable to upload review photos.");
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

      const { error: reviewError } = await supabase
        .from("product_reviews")
        .upsert(payload, { onConflict: "order_item_id" });

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
      setMessage("Thank you. Your ratings and photos have been saved.");

      window.setTimeout(() => {
        router.replace(
          "/orders/" + encodeURIComponent(order.order_number)
        );
      }, 700);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save your ratings."
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <p className="accountDataNotice">Loading rating form...</p>
        </div>
      </main>
    );
  }

  if (error && !order) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <div className="ordersEmpty">
            <strong>Unable to rate this order.</strong>
            <p>{error}</p>
            <Link href="/orders">BACK TO MY ORDERS →</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="accountDataPage reviewOrderPage">
      <div className="container">
        <div className="accountDataHeader">
          <div>
            <span>MIVO ACCOUNT</span>
            <h1>Rate Your Order</h1>
            <p>
              Order {order?.order_number} · Your feedback helps improve the
              MIVO shopping experience.
            </p>
          </div>

          <Link
            href={"/orders/" + encodeURIComponent(orderNumber)}
          >
            ← ORDER DETAILS
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
                    <small>{item.variant_name || "Default"}</small>
                  </div>
                </div>

                <div className="reviewStars">
                  <span>PRODUCT RATING</span>
                  <div>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        className={
                          star <= draft.rating ? "active" : ""
                        }
                        onClick={() => setRating(item.id, star)}
                        aria-label={star + " star rating"}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <small>
                    {draft.rating === 5
                      ? "Excellent"
                      : draft.rating === 4
                        ? "Good"
                        : draft.rating === 3
                          ? "Okay"
                          : draft.rating === 2
                            ? "Could be better"
                            : draft.rating === 1
                              ? "Poor"
                              : "Tap a star to rate"}
                  </small>
                </div>

                <div className="reviewFeedbackColumn">
                  <div className="reviewPhotoUpload">
                    <div className="reviewPhotoUploadHead">
                      <div>
                        <span>ADD PHOTOS</span>
                        <small>Show other buyers what you received</small>
                      </div>
                      <b>{photoCount} / 5</b>
                    </div>

                    <div className="reviewPhotoArea">
                      {photoCount > 0 ? (
                        <div className="reviewPhotoGrid">
                          {draft.imageUrls.map((url) => (
                            <div className="reviewPhotoThumb" key={url}>
                              <img src={url} alt="Review upload" />
                              <button
                                type="button"
                                onClick={() =>
                                  removeSavedPhoto(item.id, url)
                                }
                                aria-label="Remove saved review photo"
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
                                alt="Selected review upload"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  removeLocalPhoto(item.id, photoIndex)
                                }
                                aria-label="Remove selected review photo"
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
                          <span>ADD PHOTOS</span>
                          <small>{5 - photoCount} remaining</small>
                        </label>
                      ) : null}
                    </div>

                    <small className="reviewPhotoHint">
                      JPG, PNG or WEBP · Max 5MB each
                    </small>
                  </div>

                  <label className="reviewComment">
                    <span>COMMENTS</span>
                    <textarea
                      rows={4}
                      value={draft.comment}
                      onChange={(event) =>
                        setComment(item.id, event.target.value)
                      }
                      placeholder="Share more about the product quality, fitment and your experience."
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

          <div className="reviewOrderActions">
            <Link href="/orders" className="orderGhostButton">
              BACK TO ORDERS
            </Link>

            <button
              type="submit"
              className="orderPrimaryButton"
              disabled={busy || items.length === 0}
            >
              {busy ? "SAVING..." : "SUBMIT RATING"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

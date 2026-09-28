"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

  return date.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function WarrantyClaimPage() {
  const params = useParams();
  const router = useRouter();
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
          throw new Error("Choose a warranty item before submitting a claim.");
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
          throw orderError || new Error("Order not found.");
        }

        if (orderData.status !== "delivered") {
          throw new Error("Warranty claims are available after delivery.");
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
          throw itemError || new Error("Warranty item not found.");
        }

        const months = Number(itemData.warranty_months || 0);

        if (months <= 0) {
          throw new Error("This item does not have warranty coverage.");
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
          throw new Error("The warranty for this item has expired.");
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
          caught instanceof Error
            ? caught.message
            : "Unable to prepare warranty claim."
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
      setError("You can upload up to 5 photos.");
      return;
    }

    const incoming = Array.from(files).slice(0, available);
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

    for (const file of incoming) {
      if (!allowed.has(file.type)) {
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
      setError("Please describe the issue in more detail.");
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
            upload.error || "Unable to upload warranty claim photos."
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
        caught instanceof Error
          ? caught.message
          : "Unable to submit warranty claim."
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <p className="accountDataNotice">Preparing warranty claim...</p>
        </div>
      </main>
    );
  }

  if (error && (!order || !item || !warrantyStart)) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <div className="ordersEmpty">
            <strong>Warranty claim unavailable.</strong>
            <p>{error}</p>
            <Link href={"/orders/" + encodeURIComponent(orderNumber) + "/warranty"}>
              BACK TO WARRANTY →
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
            <span>CLAIM SUBMITTED</span>
            <h1>We received your warranty claim.</h1>
            <p>
              MIVO will review the order, product and evidence you submitted.
              You can follow the claim status from your account.
            </p>

            <div className="warrantyClaimNumber">
              <span>CLAIM NUMBER</span>
              <strong>{claim.claim_number}</strong>
            </div>

            <div className="warrantyClaimThanksActions">
              <Link href="/account/claims" className="orderPrimaryButton">
                VIEW MY CLAIMS
              </Link>
              <Link
                href={
                  "/orders/" +
                  encodeURIComponent(orderNumber) +
                  "/warranty"
                }
                className="orderGhostButton"
              >
                BACK TO WARRANTY
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
            <span>MIVO WARRANTY CLAIM</span>
            <h1>Submit a Claim</h1>
            <p>Order {order?.order_number}</p>
          </div>

          <Link
            href={
              "/orders/" +
              encodeURIComponent(orderNumber) +
              "/warranty"
            }
          >
            ← WARRANTY
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

            <span>WARRANTY ITEM</span>
            <strong>{item?.product_name}</strong>
            {item?.variant_name ? <small>{item.variant_name}</small> : null}

            <div className="warrantyClaimCoverage">
              <div>
                <span>PERIOD</span>
                <strong>{months} MONTHS</strong>
              </div>
              <div>
                <span>EXPIRES</span>
                <strong>{dateLabel(expiry)}</strong>
              </div>
            </div>
          </aside>

          <form className="warrantyClaimForm" onSubmit={submit}>
            <div className="warrantyClaimFormHead">
              <span>CLAIM DETAILS</span>
              <h2>Tell us what happened.</h2>
              <p>
                Add clear photos and enough detail for the MIVO team to review
                your claim.
              </p>
            </div>

            <label className="warrantyClaimField">
              <span>ISSUE TYPE *</span>
              <select
                value={issueType}
                onChange={(event) => setIssueType(event.target.value)}
              >
                <option value="defect">Product defect</option>
                <option value="noise">Noise / abnormal sound</option>
                <option value="leakage">Leakage</option>
                <option value="fitment">Fitment issue</option>
                <option value="damage">Damage</option>
                <option value="performance">Performance issue</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="warrantyClaimField">
              <span>DESCRIBE THE ISSUE *</span>
              <textarea
                rows={6}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe when the issue started, what happened and what you observed."
              />
              <small>{description.trim().length} characters</small>
            </label>

            <div className="warrantyClaimPhotos">
              <div className="warrantyClaimPhotosHead">
                <div>
                  <span>PHOTOS</span>
                  <small>JPG, PNG or WEBP · Max 5MB each</small>
                </div>
                <b>{photos.length} / 5</b>
              </div>

              <div className="warrantyClaimPhotoGrid">
                {photos.map((photo, index) => (
                  <div className="warrantyClaimPhoto" key={photo.preview + index}>
                    <img src={photo.preview} alt="Claim evidence" />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      aria-label="Remove claim photo"
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
                    <span>ADD PHOTOS</span>
                    <small>{5 - photos.length} remaining</small>
                  </label>
                ) : null}
              </div>
            </div>

            {error ? <p className="checkoutError">{error}</p> : null}

            <div className="warrantyClaimSubmitRow">
              <p>
                By submitting this claim, you confirm the information and
                photos provided are related to this product and order.
              </p>
              <button
                type="submit"
                className="orderPrimaryButton"
                disabled={busy}
              >
                {busy ? "SUBMITTING..." : "SUBMIT CLAIM"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

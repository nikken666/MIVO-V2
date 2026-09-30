"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ClaimRow = {
  id: string;
  claim_number: string;
  order_number: string;
  order_item_id: string;
  product_id: string | null;
  product_name: string;
  variant_name: string | null;
  warranty_months: number;
  warranty_start_at: string;
  warranty_expires_at: string;
  issue_type: string;
  description: string;
  image_urls: string[];
  display_image_urls?: string[];
  status: string;
  admin_note: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  image_url?: string | null;
};

function dateLabel(value: string) {
  return new Date(value).toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}

export default function MyWarrantyClaimsPage() {
  const router = useRouter();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
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
          router.replace("/login?next=/account/claims");
          return;
        }

        const { data, error: claimError } = await supabase
          .from("warranty_claims")
          .select(
            "id, claim_number, order_number, order_item_id, product_id, product_name, variant_name, warranty_months, warranty_start_at, warranty_expires_at, issue_type, description, image_urls, status, admin_note, resolution_note, created_at, updated_at"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (claimError) throw claimError;

        const rows = (data as ClaimRow[] | null) || [];
        const productIds = Array.from(
          new Set(
            rows
              .map((claim) => claim.product_id)
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
        }

        const privatePaths = Array.from(
          new Set(
            rows
              .flatMap((claim) => claim.image_urls || [])
              .filter((url) => url && !url.startsWith("http"))
          )
        );
        const signedMap = new Map<string, string>();

        if (privatePaths.length > 0) {
          const { data: signedData, error: signedError } = await supabase.storage
            .from("warranty-claim-images")
            .createSignedUrls(privatePaths, 3600);

          if (signedError) throw signedError;

          (signedData || []).forEach((item, index) => {
            if (item.signedUrl) {
              signedMap.set(privatePaths[index], item.signedUrl);
            }
          });
        }

        if (!active) return;

        const enriched = rows.map((claim) => ({
          ...claim,
          image_url: claim.product_id
            ? imageMap.get(claim.product_id) || null
            : null,
          display_image_urls: (claim.image_urls || [])
            .map((url) =>
              url.startsWith("http") ? url : signedMap.get(url) || ""
            )
            .filter(Boolean),
        }));

        setClaims(enriched);

        const search = new URLSearchParams(window.location.search);
        const requestedClaim = search.get("claim") || "";

        setSelectedId(
          requestedClaim && enriched.some((claim) => claim.id === requestedClaim)
            ? requestedClaim
            : enriched[0]?.id || ""
        );
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load warranty claims."
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

  const selected = useMemo(
    () => claims.find((claim) => claim.id === selectedId) || null,
    [claims, selectedId]
  );

  if (loading) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <p className="accountDataNotice">Loading claims...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="accountDataPage myClaimsPage">
      <div className="container">
        <div className="accountDataHeader">
          <div>
            <span>MIVO ACCOUNT</span>
            <h1>My Warranty Claims</h1>
            <p>Track warranty requests and MIVO review updates.</p>
          </div>

          <Link href="/account">← ACCOUNT</Link>
        </div>

        {error ? <p className="checkoutError">{error}</p> : null}

        {claims.length === 0 ? (
          <div className="ordersEmpty">
            <strong>No warranty claims yet.</strong>
            <p>
              Active warranty items can be claimed from the order warranty
              page.
            </p>
            <Link href="/orders">VIEW MY ORDERS</Link>
          </div>
        ) : (
          <div className="myClaimsLayout">
            <aside className="myClaimsList">
              {claims.map((claim) => (
                <button
                  type="button"
                  key={claim.id}
                  className={
                    "myClaimListItem" +
                    (claim.id === selectedId ? " active" : "")
                  }
                  onClick={() => setSelectedId(claim.id)}
                >
                  <div>
                    <span>{claim.claim_number}</span>
                    <strong>{claim.product_name}</strong>
                    <small>{dateLabel(claim.created_at)}</small>
                  </div>
                  <b className={"claimStatus status-" + claim.status}>
                    {statusLabel(claim.status)}
                  </b>
                </button>
              ))}
            </aside>

            {selected ? (
              <section className="myClaimDetail">
                <div className="myClaimDetailHead">
                  <div>
                    <span>CLAIM {selected.claim_number}</span>
                    <h2>{selected.product_name}</h2>
                    {selected.variant_name ? (
                      <p>{selected.variant_name}</p>
                    ) : null}
                  </div>
                  <b className={"claimStatus status-" + selected.status}>
                    {statusLabel(selected.status)}
                  </b>
                </div>

                <div className="myClaimSummary">
                  <div>
                    <span>ORDER</span>
                    <strong>{selected.order_number}</strong>
                  </div>
                  <div>
                    <span>ISSUE</span>
                    <strong>{statusLabel(selected.issue_type)}</strong>
                  </div>
                  <div>
                    <span>SUBMITTED</span>
                    <strong>{dateLabel(selected.created_at)}</strong>
                  </div>
                  <div>
                    <span>WARRANTY EXPIRES</span>
                    <strong>{dateLabel(selected.warranty_expires_at)}</strong>
                  </div>
                </div>

                <div className="myClaimDescription">
                  <span>YOUR DESCRIPTION</span>
                  <p>{selected.description}</p>
                </div>

                {(selected.display_image_urls || []).length > 0 ? (
                  <div className="myClaimEvidence">
                    <span>YOUR PHOTOS</span>
                    <div>
                      {(selected.display_image_urls || []).map((url) => (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          key={url}
                        >
                          <img src={url} alt="Warranty claim evidence" />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selected.admin_note ? (
                  <div className="myClaimUpdate">
                    <span>MIVO UPDATE</span>
                    <p>{selected.admin_note}</p>
                  </div>
                ) : null}

                {selected.resolution_note ? (
                  <div className="myClaimResolution">
                    <span>RESOLUTION</span>
                    <p>{selected.resolution_note}</p>
                  </div>
                ) : null}

                <div className="myClaimActions">
                  <Link
                    href={
                      "/orders/" +
                      encodeURIComponent(selected.order_number) +
                      "/warranty"
                    }
                    className="orderGhostButton"
                  >
                    VIEW WARRANTY
                  </Link>
                  <Link
                    href={
                      "/orders/" +
                      encodeURIComponent(selected.order_number)
                    }
                    className="orderGhostButton"
                  >
                    VIEW ORDER
                  </Link>
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}

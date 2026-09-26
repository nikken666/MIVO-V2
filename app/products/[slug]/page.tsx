export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import ProductDetailClient from "@/components/ProductDetailClient";
import {
  getActiveProductBySlug,
  getActiveProducts,
  getProductPublicReviews,
} from "@/lib/catalog";
import { getLiveProductFitmentDetail } from "@/lib/liveFitment";
import {
  getProductFitmentStatus,
  type SelectedVehicle,
} from "@/data/fitments";

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const product = await getActiveProductBySlug(slug);

  if (!product) notFound();

  const vehicleId =
    typeof query.vehicle === "string" ? query.vehicle : "";
  const make = typeof query.make === "string" ? query.make : "";
  const model = typeof query.model === "string" ? query.model : "";
  const generation =
    typeof query.generation === "string" ? query.generation : "";
  const year = typeof query.year === "string" ? query.year : "";
  const variant =
    typeof query.variant === "string" ? query.variant : "";
  const transmission =
    typeof query.transmission === "string" ? query.transmission : "";

  const selectedVehicle: SelectedVehicle | null = vehicleId
    ? {
        vehicleId,
        year,
        variant,
        transmission,
      }
    : null;

  let fitmentStatus = selectedVehicle
    ? getProductFitmentStatus(product.slug, selectedVehicle)
    : undefined;
  let variantFitmentStatuses: Record<string, import("@/data/fitments").FitmentStatus> = {};

  if (selectedVehicle && product.id) {
    const live = await getLiveProductFitmentDetail(
      product.id,
      (product.variants || []).map((variant) => variant.id),
      selectedVehicle
    );

    if (live) {
      fitmentStatus = live.productStatus;
      variantFitmentStatuses = live.variantStatuses;
    }
  }

  const selectedVehicleLabel = [
    make,
    model,
    generation,
    year,
    variant,
    transmission,
  ]
    .filter(Boolean)
    .join(" ");

  const [productReviews, allProducts] = await Promise.all([
    product.id ? getProductPublicReviews(product.id) : Promise.resolve([]),
    getActiveProducts(),
  ]);

  const relatedProducts = allProducts
    .filter((item) => item.slug !== product.slug)
    .map((item) => ({
      item,
      score:
        (item.category === product.category ? 2 : 0) +
        (item.brand === product.brand ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ item }) => item);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://mivo-v2.vercel.app";
  const productUrl = siteUrl + "/products/" + product.slug;
  const activeVariants = (product.variants || []).filter(
    (item) => item.isActive
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": activeVariants.length > 1 ? "ProductGroup" : "Product",
    name: product.name,
    description: product.description,
    image: product.imageUrls?.length
      ? product.imageUrls
      : product.imageUrl
        ? [product.imageUrl]
        : undefined,
    brand: {
      "@type": "Brand",
      name: product.brand,
    },
    url: productUrl,
    productGroupID:
      activeVariants.length > 1 ? product.id || product.slug : undefined,
    sku:
      activeVariants.length === 1
        ? activeVariants[0]?.sku
        : product.sku,
    aggregateRating:
      product.reviews > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: Number(product.rating || 0).toFixed(1),
            reviewCount: product.reviews,
          }
        : undefined,
    review:
      productReviews.length > 0
        ? productReviews.slice(0, 10).map((review) => ({
            "@type": "Review",
            reviewRating: {
              "@type": "Rating",
              ratingValue: review.rating,
              bestRating: 5,
            },
            author: {
              "@type": "Person",
              name: "Verified MIVO Buyer",
            },
            reviewBody: review.comment || undefined,
          }))
        : undefined,
    offers:
      activeVariants.length <= 1
        ? {
            "@type": "Offer",
            priceCurrency: "MYR",
            price: String(activeVariants[0]?.price ?? product.price),
            availability:
              Number(activeVariants[0]?.stock ?? product.stock ?? 0) > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            url: productUrl,
          }
        : undefined,
    hasVariant:
      activeVariants.length > 1
        ? activeVariants.map((item) => ({
            "@type": "Product",
            name:
              product.name +
              (item.title && item.title !== "Default"
                ? " - " + item.title
                : ""),
            sku: item.sku,
            image: product.imageUrl,
            brand: {
              "@type": "Brand",
              name: product.brand,
            },
            offers: {
              "@type": "Offer",
              priceCurrency: "MYR",
              price: String(item.price),
              availability:
                item.stock > 0
                  ? "https://schema.org/InStock"
                  : "https://schema.org/OutOfStock",
              url: productUrl,
            },
          }))
        : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ProductDetailClient
        product={product}
        productReviews={productReviews}
        relatedProducts={relatedProducts}
        fitmentStatus={fitmentStatus}
        variantFitmentStatuses={variantFitmentStatuses}
        selectedVehicleLabel={selectedVehicleLabel}
      />
    </>
  );
}

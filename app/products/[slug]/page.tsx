export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import ProductDetailClient from "@/components/ProductDetailClient";
import { getActiveProductBySlug } from "@/lib/catalog";
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

  return (
    <ProductDetailClient
      product={product}
      fitmentStatus={fitmentStatus}
      variantFitmentStatuses={variantFitmentStatuses}
      selectedVehicleLabel={selectedVehicleLabel}
    />
  );
}

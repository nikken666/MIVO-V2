export type FitmentRule = {
  vehicleId: string;
  years?: number[];
  variants?: string[];
  transmissions?: string[];
};

export type ProductFitment = {
  universal?: boolean;
  rules?: FitmentRule[];
};

export type FitmentStatus = "fits" | "not-fit" | "unverified" | "universal" | "seller-fits";

export type SelectedVehicle = {
  vehicleId: string;
  year?: string;
  variant?: string;
  transmission?: string;
};

/**
 * Product fitment master table.
 *
 * Keep this conservative: only add a product here when its application
 * has been confirmed. Products absent from this table remain UNVERIFIED.
 */
export const productFitments: Record<string, ProductFitment> = {
  // Vehicle-specific mappings will be added here as confirmed product data
  // becomes available.
};

export function getProductFitmentStatus(
  productSlug: string,
  selected?: SelectedVehicle | null
): FitmentStatus {
  if (!selected?.vehicleId) return "unverified";

  const fitment = productFitments[productSlug];
  if (!fitment) return "unverified";
  if (fitment.universal) return "universal";

  const rules = fitment.rules || [];
  const relatedVehicleRules = rules.filter(
    (rule) => rule.vehicleId === selected.vehicleId
  );

  if (relatedVehicleRules.length === 0) return "not-fit";

  const selectedYear = selected.year ? Number(selected.year) : undefined;

  const matches = relatedVehicleRules.some((rule) => {
    const yearMatches =
      !rule.years?.length ||
      !selectedYear ||
      rule.years.includes(selectedYear);

    const variantMatches =
      !rule.variants?.length ||
      !selected.variant ||
      rule.variants.includes(selected.variant);

    const transmissionMatches =
      !rule.transmissions?.length ||
      !selected.transmission ||
      rule.transmissions.includes(selected.transmission);

    return yearMatches && variantMatches && transmissionMatches;
  });

  return matches ? "fits" : "not-fit";
}

export function fitmentRank(status: FitmentStatus) {
  if (status === "fits") return 0;
  if (status === "universal") return 1;
  if (status === "seller-fits") return 2;
  if (status === "unverified") return 3;
  return 4;
}

/**
 * Fitment is trusted for MIVO Direct parts and for other shops' parts that
 * MIVO staff checked. Other shops' own fitment data is shown as "seller says
 * it fits"; their parts are never hidden as "doesn't fit".
 */
export function isFitmentVerifiedShop(product: {
  sellerTier?: string | null;
  seller?: string | null;
  fitmentVerified?: boolean;
}) {
  if (product.fitmentVerified) return true;
  if (product.sellerTier) return product.sellerTier === "direct";
  // Demo / single-shop catalogue (before shop tiers existed).
  return !product.seller || /^mivo/i.test(product.seller);
}

export function shopFitmentStatus(
  product: { sellerTier?: string | null; seller?: string | null; fitmentVerified?: boolean },
  status: FitmentStatus
): FitmentStatus {
  if (isFitmentVerifiedShop(product)) return status;
  if (status === "fits" || status === "universal") return "seller-fits";
  return "unverified";
}

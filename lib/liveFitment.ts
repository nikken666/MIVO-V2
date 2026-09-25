import { createClient } from "@/lib/supabase/server";
import type { FitmentStatus, SelectedVehicle } from "@/data/fitments";

type FitmentRow = {
  product_id: string;
  variant_id: string | null;
  vehicle_id: string;
  year_from: number | null;
  year_to: number | null;
};

export type LiveProductFitmentDetail = {
  productStatus: FitmentStatus;
  variantStatuses: Record<string, FitmentStatus>;
  confirmedVariantIds: string[];
};

async function matchingVehicleIds(
  selected: SelectedVehicle
): Promise<{ ids: string[]; selectedYear?: number }> {
  const supabase = await createClient();
  const selectedYear = selected.year
    ? Number(selected.year)
    : undefined;

  let vehicleQuery = supabase
    .from("vehicles")
    .select("id")
    .eq("generation_key", selected.vehicleId)
    .eq("is_active", true);

  if (selected.variant) {
    vehicleQuery = vehicleQuery.eq(
      "variant",
      selected.variant
    );
  }

  if (selected.transmission) {
    vehicleQuery = vehicleQuery.eq(
      "transmission",
      selected.transmission
    );
  }

  if (selectedYear) {
    vehicleQuery = vehicleQuery
      .lte("year_from", selectedYear)
      .or(`year_to.is.null,year_to.gte.${selectedYear}`);
  }

  const { data, error } = await vehicleQuery;
  if (error) throw error;

  return {
    ids: (data || []).map((row) => row.id as string),
    selectedYear,
  };
}

function rowMatches(
  row: FitmentRow,
  matchedVehicleIds: Set<string>,
  selectedYear?: number
) {
  if (!matchedVehicleIds.has(row.vehicle_id)) return false;
  if (!selectedYear) return true;
  if (
    row.year_from !== null &&
    selectedYear < row.year_from
  ) {
    return false;
  }
  if (
    row.year_to !== null &&
    selectedYear > row.year_to
  ) {
    return false;
  }
  return true;
}

export async function getLiveFitmentStatuses(
  productIds: string[],
  selected?: SelectedVehicle | null
): Promise<Record<string, FitmentStatus>> {
  if (!selected?.vehicleId || productIds.length === 0) {
    return {};
  }

  try {
    const supabase = await createClient();
    const { ids, selectedYear } =
      await matchingVehicleIds(selected);
    const matchedVehicleIds = new Set(ids);

    const { data: fitmentRows, error: fitmentError } =
      await supabase
        .from("product_vehicle_fitments")
        .select(
          "product_id, variant_id, vehicle_id, year_from, year_to"
        )
        .in("product_id", productIds);

    if (fitmentError) throw fitmentError;

    const rows = (fitmentRows || []) as FitmentRow[];
    const result: Record<string, FitmentStatus> = {};

    for (const productId of productIds) {
      const productRows = rows.filter(
        (row) => row.product_id === productId
      );

      if (productRows.length === 0) {
        result[productId] = "unverified";
        continue;
      }

      result[productId] = productRows.some((row) =>
        rowMatches(row, matchedVehicleIds, selectedYear)
      )
        ? "fits"
        : "not-fit";
    }

    return result;
  } catch {
    return {};
  }
}

export async function getLiveProductFitmentDetail(
  productId: string,
  variantIds: string[],
  selected?: SelectedVehicle | null
): Promise<LiveProductFitmentDetail | null> {
  if (!selected?.vehicleId || !productId) return null;

  try {
    const supabase = await createClient();
    const { ids, selectedYear } =
      await matchingVehicleIds(selected);
    const matchedVehicleIds = new Set(ids);

    const { data, error } = await supabase
      .from("product_vehicle_fitments")
      .select(
        "product_id, variant_id, vehicle_id, year_from, year_to"
      )
      .eq("product_id", productId);

    if (error) throw error;

    const rows = (data || []) as FitmentRow[];
    const variantStatuses: Record<
      string,
      FitmentStatus
    > = {};

    if (rows.length === 0) {
      for (const variantId of variantIds) {
        variantStatuses[variantId] = "unverified";
      }

      return {
        productStatus: "unverified",
        variantStatuses,
        confirmedVariantIds: [],
      };
    }

    const productWideRows = rows.filter(
      (row) => row.variant_id === null
    );

    for (const variantId of variantIds) {
      const specificRows = rows.filter(
        (row) => row.variant_id === variantId
      );
      const relevantRows = [
        ...productWideRows,
        ...specificRows,
      ];

      if (relevantRows.length === 0) {
        variantStatuses[variantId] = "unverified";
        continue;
      }

      variantStatuses[variantId] = relevantRows.some(
        (row) =>
          rowMatches(
            row,
            matchedVehicleIds,
            selectedYear
          )
      )
        ? "fits"
        : "not-fit";
    }

    const anyRowMatches = rows.some((row) =>
      rowMatches(row, matchedVehicleIds, selectedYear)
    );

    let productStatus: FitmentStatus;

    if (anyRowMatches) {
      productStatus = "fits";
    } else if (productWideRows.length > 0) {
      productStatus = "not-fit";
    } else {
      const explicitlyCoveredVariants = new Set(
        rows
          .map((row) => row.variant_id)
          .filter(
            (id): id is string => Boolean(id)
          )
      );

      const allVariantsCovered =
        variantIds.length > 0 &&
        variantIds.every((id) =>
          explicitlyCoveredVariants.has(id)
        );

      productStatus = allVariantsCovered
        ? "not-fit"
        : "unverified";
    }

    const confirmedVariantIds = variantIds.filter(
      (id) => variantStatuses[id] === "fits"
    );

    return {
      productStatus,
      variantStatuses,
      confirmedVariantIds,
    };
  } catch {
    return null;
  }
}

import { createClient } from "@/lib/supabase/server";
import type { FitmentStatus, SelectedVehicle } from "@/data/fitments";

type FitmentRow = {
  product_id: string;
  vehicle_id: string;
  year_from: number | null;
  year_to: number | null;
};

export async function getLiveFitmentStatuses(
  productIds: string[],
  selected?: SelectedVehicle | null
): Promise<Record<string, FitmentStatus>> {
  if (!selected?.vehicleId || productIds.length === 0) return {};

  try {
    const supabase = await createClient();
    const selectedYear = selected.year ? Number(selected.year) : undefined;

    let vehicleQuery = supabase
      .from("vehicles")
      .select("id")
      .eq("generation_key", selected.vehicleId)
      .eq("is_active", true);

    if (selected.variant) {
      vehicleQuery = vehicleQuery.eq("variant", selected.variant);
    }

    if (selected.transmission) {
      vehicleQuery = vehicleQuery.eq("transmission", selected.transmission);
    }

    if (selectedYear) {
      vehicleQuery = vehicleQuery
        .lte("year_from", selectedYear)
        .or(`year_to.is.null,year_to.gte.${selectedYear}`);
    }

    const { data: vehicleRows, error: vehicleError } = await vehicleQuery;
    if (vehicleError) throw vehicleError;

    const vehicleIds = (vehicleRows || []).map((row) => row.id as string);

    const { data: fitmentRows, error: fitmentError } = await supabase
      .from("product_vehicle_fitments")
      .select("product_id, vehicle_id, year_from, year_to")
      .in("product_id", productIds);

    if (fitmentError) throw fitmentError;

    const rows = (fitmentRows || []) as FitmentRow[];
    const matchedVehicleIds = new Set(vehicleIds);
    const result: Record<string, FitmentStatus> = {};

    for (const productId of productIds) {
      const productRows = rows.filter((row) => row.product_id === productId);

      if (productRows.length === 0) {
        result[productId] = "unverified";
        continue;
      }

      const fits = productRows.some((row) => {
        if (!matchedVehicleIds.has(row.vehicle_id)) return false;
        if (!selectedYear) return true;
        if (row.year_from !== null && selectedYear < row.year_from) return false;
        if (row.year_to !== null && selectedYear > row.year_to) return false;
        return true;
      });

      result[productId] = fits ? "fits" : "not-fit";
    }

    return result;
  } catch {
    return {};
  }
}

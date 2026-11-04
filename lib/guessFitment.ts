// "Probably fits": the car a product is for, read from its name (e.g.
// "NIKKEN DRIVE SHAFT BOOT HONDA BRV TSAA"). Used only when the product has no
// fitment saved, and always shown as not confirmed. Nothing is written to the
// database; saved fitment always wins.

import { vehicleDatabase } from "@/data/vehicles";
import { suggestFitment, type Generation } from "./fitmentSuggest";

let generations: Generation[] | null = null;
function allGenerations(): Generation[] {
  if (!generations) {
    generations = vehicleDatabase.flatMap((make) =>
      make.vehicles.map((v) => ({
        key: v.id,
        make: make.make,
        model: v.model,
        generation: v.generation || "",
        yearFrom: v.startYear,
        yearTo: v.endYear ?? null,
      }))
    );
  }
  return generations;
}

// Same name → same answer, so remember it (the catalogue reloads every minute).
const memo = new Map<string, ReadonlySet<string>>();
const EMPTY: ReadonlySet<string> = new Set();

// "SESUAI UNTUK: ...", "Suitable for: ...", "适用车型：..." in a description.
const FIT_SECTION = /(SESUAI\s+UNTUK|SUITABLE\s+FOR|FITS?\s+FOR|FITMENT|COMPATIBLE\s+(?:WITH|FOR)|APPLICABLE\s+(?:TO|FOR)|APPLICATION|适用车型|适用|适合)\s*[:：]?/i;
function fitSection(description: string | null | undefined) {
  const text = String(description || "");
  const m = text.match(FIT_SECTION);
  return m && m.index !== undefined ? text.slice(m.index, m.index + 600) : "";
}

/** Vehicle generation ids (data/vehicles.ts ids) the product name (or its "suitable for" list) points to. */
export function guessedVehicleIds(name: string | null | undefined, description?: string | null): ReadonlySet<string> {
  const fromName = guessFrom(String(name || "").trim());
  if (fromName.size || !description) return fromName;
  return guessFrom(fitSection(description));
}

function guessFrom(title: string): ReadonlySet<string> {
  if (!title) return EMPTY;
  const hit = memo.get(title);
  if (hit) return hit;
  let result: ReadonlySet<string> = EMPTY;
  try {
    const keys = suggestFitment(title, allGenerations()).map((s) => s.generationKey);
    if (keys.length) result = new Set(keys);
  } catch {
    // an odd title never breaks the catalogue
  }
  if (memo.size > 50_000) memo.clear();
  memo.set(title, result);
  return result;
}

/** True when the name suggests this car and nothing saved says otherwise. */
export function nameSuggestsVehicle(
  product: { name: string; description?: string | null; fitmentLevel?: string | null; isUniversalFitment?: boolean },
  vehicleId: string
) {
  if (!vehicleId || product.isUniversalFitment) return false;
  if (product.fitmentLevel && product.fitmentLevel !== "none") return false;
  return guessedVehicleIds(product.name, product.description).has(vehicleId);
}

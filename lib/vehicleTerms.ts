import { vehicleDatabase } from "@/data/vehicles";

// Car makes and models people type into search ("myvi brake pad").
const models = new Map<string, { make: string; model: string }>();
const makes = new Map<string, string>();
for (const entry of vehicleDatabase) {
  makes.set(entry.make.toLowerCase(), entry.make);
  for (const vehicle of entry.vehicles) {
    models.set(vehicle.model.toLowerCase(), { make: entry.make, model: vehicle.model });
  }
}

export function isVehicleWord(word: string) {
  const w = word.toLowerCase();
  return models.has(w) || makes.has(w);
}

/** The car model (or make) mentioned in a search, if any. */
export function vehicleInQuery(query: string): { make: string; model: string | null } | null {
  const words = query.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
  for (const word of words) {
    const hit = models.get(word);
    if (hit) return hit;
  }
  for (const word of words) {
    const make = makes.get(word);
    if (make) return { make, model: null };
  }
  return null;
}

// Suggest vehicle fitment from a product title such as
//   "KYB SUSPENSION KIT (RACK END) FOR TOYOTA VIOS NCP93 07~12, YARIS NCP91 08~18"
// Suggestions are for an admin to confirm — never saved automatically.

export type Generation = {
  key: string; // vehicles.generation_key
  make: string;
  model: string;
  generation: string;
  yearFrom: number;
  yearTo: number | null;
};

export type Confidence = "high" | "medium" | "low";

export type FitmentSuggestion = {
  generationKey: string;
  make: string;
  model: string;
  generation: string;
  yearFrom: number;
  yearTo: number | null;
  confidence: Confidence;
  reason: string;
};

const upper = (s: string) => s.toUpperCase();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Words that appear in generation names but say nothing about the chassis.
const NOISE = new Set([
  "GEN", "PRE", "FL", "FACELIFT", "MODEL", "LATE", "OLD", "NEW", "LAUNCH", "UPDATE",
  "HYBRID", "ELECTRIC", "HEV", "SPORT", "EDITION", "MARK", "MK", "CKD", "CBU", "LWB",
  "DNGA", "BOLD", "SE", "MC", "RC", "STANDARD", "PREMIUM", "ICON", "LAGI", "BEST",
]);

/** Chassis / generation codes for a generation, e.g. "NCP93 (Gen 2)" → ["NCP93"]. */
function generationCodes(generation: string): string[] {
  return upper(generation)
    .split(/[^A-Z0-9]+/)
    .filter((t) => t.length >= 2 && !NOISE.has(t) && (/\d/.test(t) || /^[A-Z]{2,3}$/.test(t)));
}

/** Codes written in a title fragment; expands "AE100/101/111" → AE100, AE101, AE111. */
function titleCodes(fragment: string): Set<string> {
  const codes = new Set<string>();
  const text = upper(fragment);
  for (const m of text.matchAll(/\b([A-Z]{1,4})(\d{1,3}[A-Z]?)((?:\s*\/\s*\d{1,3}[A-Z]?)*)/g)) {
    codes.add(m[1] + m[2]);
    for (const extra of m[3].split("/").map((s) => s.trim()).filter(Boolean)) codes.add(m[1] + extra);
  }
  for (const m of text.matchAll(/\b([A-Z]{2,3})\b/g)) codes.add(m[1]);
  return codes;
}

function fullYear(two: string): number {
  const n = Number(two);
  if (two.length === 4) return n;
  return n <= 40 ? 2000 + n : 1900 + n;
}

/** First year range in a fragment: "07~12", "(17~20)", "17~", "2008-2013". */
function yearRange(fragment: string): { from: number; to: number | null } | null {
  const m = fragment.match(/(?<![A-Z0-9])((?:19|20)\d{2}|\d{2})\s*(?:~|-|–|TO)\s*((?:19|20)\d{2}|\d{2})?(?![0-9])/i);
  if (m) {
    const from = fullYear(m[1]);
    const to = m[2] ? fullYear(m[2]) : null;
    if (from >= 1980 && from <= 2040 && (to === null || to >= from)) return { from, to };
  }
  const single = fragment.match(/(?<![0-9])((?:19|20)\d{2})(?![0-9])/);
  if (single) {
    const y = Number(single[1]);
    return { from: y, to: y };
  }
  return null;
}

const overlaps = (g: Generation, from: number, to: number | null) =>
  g.yearFrom <= (to ?? 9999) && (g.yearTo ?? 9999) >= from;

const CURRENT_YEAR = new Date().getFullYear();
const overlapYears = (g: Generation, from: number, to: number | null) =>
  Math.min(to ?? CURRENT_YEAR, g.yearTo ?? CURRENT_YEAR) - Math.max(from, g.yearFrom) + 1;

/** "ZZE12" also matches a generation coded "E120" (chassis prefix dropped). */
function codeMatches(genCode: string, codes: Set<string>): boolean {
  if (codes.has(genCode)) return true;
  for (const code of codes) {
    const tail = code.match(/^[A-Z]{2,}([A-Z]\d{2,}[A-Z]?)$/)?.[1];
    if (tail && genCode.startsWith(tail)) return true;
  }
  return false;
}

export function suggestFitment(title: string, generations: Generation[]): FitmentSuggestion[] {
  const text = upper(title);

  // Models, longest first so "COROLLA ALTIS" wins over "COROLLA".
  const models = new Map<string, Generation[]>();
  for (const g of generations) {
    const k = g.make + "|" + g.model;
    models.set(k, [...(models.get(k) || []), g]);
  }
  const modelList = [...models.entries()]
    .map(([k, gens]) => ({ key: k, make: gens[0].make, model: gens[0].model, gens }))
    .sort((a, b) => b.model.length - a.model.length);

  type Hit = { start: number; end: number; entry: (typeof modelList)[number] };
  const hits: Hit[] = [];
  for (const entry of modelList) {
    const words = upper(entry.model).split(/[^A-Z0-9]+/).filter(Boolean);
    if (!words.length) continue;
    // Short or numeric model names (e.g. "86") need the make in the title.
    const risky = words.join("").length <= 3 || /^\d+$/.test(words.join(""));
    if (risky && !text.includes(upper(entry.make))) continue;
    const re = new RegExp("(?<![A-Z0-9])" + words.map(escape).join("[\\s\\-]*") + "(?![A-Z0-9])", "g");
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (hits.some((h) => start < h.end && end > h.start)) continue; // overlapping a longer model
      hits.push({ start, end, entry });
    }
  }
  hits.sort((a, b) => a.start - b.start);

  // A model glued to the previous one ("MYVI GEN 2") is a qualifier, not a car.
  const accepted = hits.filter((hit, i) => {
    if (i === 0) return true;
    const gap = text.slice(hits[i - 1].end, hit.start);
    return /[,/&;+]|\bAND\b|\bDAN\b/.test(gap) || gap.trim().length > 12;
  });

  const out: FitmentSuggestion[] = [];
  const seen = new Set<string>();
  accepted.forEach((hit, i) => {
    const next = accepted[i + 1]?.start ?? text.length;
    // Context: the model's own words plus text up to the next model.
    const window = text.slice(hit.end, next);
    const range = yearRange(window);
    const codes = titleCodes(window);
    const genNumber = window.match(/\bGEN(?:ERATION)?\s*-?\s*(\d)\b/)?.[1];

    const matchCode = (g: Generation) => generationCodes(g.generation).some((c) => codeMatches(c, codes));
    // "COROLLA ALTIS AE100/101, ZZE12" — some codes may belong to a sibling
    // model ("Corolla"), so include matches from both.
    const byCode = [
      ...hit.entry.gens.filter(matchCode),
      ...modelList
        .filter((m) => m !== hit.entry && m.make === hit.entry.make && upper(hit.entry.model).startsWith(upper(m.model)))
        .flatMap((m) => m.gens.filter(matchCode)),
    ];
    const byGenNumber = genNumber
      ? hit.entry.gens.filter((g) => new RegExp("^GEN\\s*" + genNumber + "\\b", "i").test(g.generation))
      : [];
    let byYears = range ? hit.entry.gens.filter((g) => overlaps(g, range.from, range.to)) : [];
    // Drop generations that only touch the range by one boundary year.
    if (range && byYears.some((g) => overlapYears(g, range.from, range.to) >= 2)) {
      byYears = byYears.filter((g) => overlapYears(g, range.from, range.to) >= 2);
    }

    let chosen: Generation[];
    let confidence: Confidence;
    let reason: string;
    if (byCode.length) {
      chosen = range ? byCode.filter((g) => overlaps(g, range.from, range.to)) : byCode;
      if (!chosen.length) chosen = byCode;
      confidence = "high";
      reason = "Code match (" + [...new Set(byCode.map((g) => g.model + " " + g.generation))].slice(0, 2).join(", ") + ")";
    } else if (byGenNumber.length) {
      chosen = range ? byGenNumber.filter((g) => overlaps(g, range.from, range.to)) : byGenNumber;
      if (!chosen.length) chosen = byGenNumber;
      confidence = "high";
      reason = "Gen " + genNumber;
    } else if (byYears.length) {
      chosen = byYears;
      confidence = "medium";
      reason = "Years " + range!.from + "–" + (range!.to ?? "now");
    } else {
      chosen = hit.entry.gens;
      confidence = "low";
      reason = "Model only";
    }

    for (const g of chosen) {
      if (seen.has(g.key)) continue;
      seen.add(g.key);
      // Fitment years = generation years, narrowed by the title's range.
      const yearFrom = range ? Math.max(g.yearFrom, range.from) : g.yearFrom;
      const genTo = g.yearTo;
      const yearTo = range && range.to !== null ? (genTo === null ? range.to : Math.min(genTo, range.to)) : genTo;
      out.push({
        generationKey: g.key,
        make: g.make,
        model: g.model,
        generation: g.generation,
        yearFrom,
        yearTo: yearTo !== null && yearTo < yearFrom ? yearFrom : yearTo,
        confidence,
        reason,
      });
    }
  });

  return out;
}

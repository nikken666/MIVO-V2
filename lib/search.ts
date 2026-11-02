import type { Product } from "@/data/products";

// Catalogue search: every word may appear anywhere (name, brand, SKU / OEM,
// category, shop, variation, description), in any order. SKUs and OEM numbers
// also match without dashes or spaces ("04465-0D130" = "044650d130").
// When no product has every word, the closest matches are returned instead.

const stopWords = new Set(["for", "the", "and", "of", "with", "a", "an", "to", "kereta", "untuk"]);

const synonyms: Record<string, string[]> = {
  absorber: ["shock"],
  shock: ["absorber"],
  pad: ["pads"],
  pads: ["pad"],
  disc: ["rotor"],
  rotor: ["disc"],
  oil: ["lubricant"],
  battery: ["bateri"],
  bateri: ["battery"],
  tayar: ["tyre", "tire"],
  tyre: ["tire"],
  tire: ["tyre"],
  minyak: ["oil"],
  brek: ["brake"],
  brake: ["braking"],
};

const normalise = (value: string) =>
  value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
const compact = (value: string) => normalise(value).replace(/[^a-z0-9]/g, "");

type Field = { text: string; compact: string; weight: number };

function fieldsFor(product: Product): Field[] {
  const variants = product.variants || [];
  const raw: Array<[string, number]> = [
    [product.name, 5],
    [product.brand, 4],
    [[product.sku || "", ...variants.map((v) => v.sku)].join(" "), 6],
    [product.category, 3],
    [product.seller || "", 2],
    [variants.map((v) => [v.title, v.variation1Value, v.variation2Value].filter(Boolean).join(" ")).join(" "), 2],
    [[product.shortDescription || "", product.description || ""].join(" "), 1],
  ];
  return raw
    .filter(([text]) => text.trim())
    .map(([text, weight]) => ({ text: normalise(text), compact: compact(text), weight }));
}

function tokenScore(token: string, fields: Field[]): number {
  const singular = token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token;
  const forms = [token, singular, ...(synonyms[token] || []), ...(synonyms[singular] || [])];
  const tokenCompact = compact(token);
  let best = 0;
  for (const field of fields) {
    let hit = forms.some((form) => field.text.includes(form));
    // SKU / OEM style tokens: ignore dashes and spaces.
    if (!hit && tokenCompact.length >= 3 && /\d/.test(tokenCompact)) {
      hit = field.compact.includes(tokenCompact);
    }
    if (hit) {
      // Whole-word hits rank above partial ones.
      const wordHit = new RegExp("(^|[^a-z0-9])" + token.replace(/[^a-z0-9]/g, "") + "([^a-z0-9]|$)").test(field.text);
      best = Math.max(best, field.weight * (wordHit ? 2 : 1));
    }
  }
  return best;
}

export function searchProducts(products: Product[], query: string): {
  items: Product[];
  exact: boolean;
} {
  const tokens = normalise(query)
    .split(/[\s,/|+]+/)
    .map((t) => t.trim())
    .filter((t) => t && !stopWords.has(t));
  if (!tokens.length) return { items: products, exact: true };

  const scored = products.map((product, index) => {
    const fields = fieldsFor(product);
    const scores = tokens.map((token) => tokenScore(token, fields));
    const matched = scores.filter((s) => s > 0).length;
    // Whole query as a phrase in the name ranks highest.
    const phrase = fields[0]?.text.includes(normalise(query).trim()) ? 20 : 0;
    return { product, index, matched, score: scores.reduce((a, b) => a + b, 0) + phrase };
  });

  const byRelevance = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    b.matched - a.matched || b.score - a.score || a.index - b.index;

  const all = scored.filter((s) => s.matched === tokens.length).sort(byRelevance);
  if (all.length) return { items: all.map((s) => s.product), exact: true };

  const needed = Math.max(1, Math.ceil(tokens.length / 2));
  const close = scored.filter((s) => s.matched >= needed).sort(byRelevance);
  return { items: close.map((s) => s.product), exact: false };
}

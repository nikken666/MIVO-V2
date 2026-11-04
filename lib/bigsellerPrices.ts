// BigSeller "Online products" export: Shopee's own price (价格) and the
// campaign price (促销价) per option, keyed by Shopee Variation ID (变种ID).
// Shopee's Mass Update files only carry the original price, so MIVO takes
// the discount from here: price = 促销价, original (struck-through) = 价格.

import type { ImportProduct, Table } from "./shopeeImport";

export type BigSellerPrice = { original: number | null; promo: number | null; sku: string };

const VARIATION_ID = /^(变种|规格|变体)\s*ID$|^variation\s*id$|^model\s*id$/i;
const PROMO = /促销价|活动价|折扣价|promotion\s*price|promo\s*price|discount(ed)?\s*price|campaign\s*price/i;
const PRICE = /^(价格|售价|原价)$|^price$|^original\s*price$/i;
const SKU = /^sku$/i;

function headerRow(table: Table) {
  for (let i = 0; i < Math.min(table.rows.length, 6); i++) {
    const cells = table.rows[i].map((c) => String(c ?? "").trim());
    const vid = cells.findIndex((c) => VARIATION_ID.test(c));
    const promo = cells.findIndex((c) => PROMO.test(c));
    if (vid >= 0 && promo >= 0) {
      return { index: i, vid, promo, price: cells.findIndex((c) => PRICE.test(c)), sku: cells.findIndex((c) => SKU.test(c)) };
    }
  }
  return null;
}

/** A BigSeller-style price list (has Variation ID and a promotion price column). */
export function isPriceTable(table: Table) {
  return Boolean(headerRow(table));
}

const id = (value: unknown) => String(value ?? "").trim().replace(/\.0+$/, "");
const money = (value: unknown) => {
  const n = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return String(value ?? "").trim() && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

export function parsePriceTables(tables: Table[]) {
  const byVariationId = new Map<string, BigSellerPrice>();
  const skuCount = new Map<string, number>();
  const bySku = new Map<string, BigSellerPrice>();
  let rows = 0;
  for (const table of tables) {
    const h = headerRow(table);
    if (!h) continue;
    for (const row of table.rows.slice(h.index + 1)) {
      const variationId = id(row[h.vid]);
      const sku = h.sku >= 0 ? String(row[h.sku] ?? "").trim().toUpperCase() : "";
      const entry = { original: h.price >= 0 ? money(row[h.price]) : null, promo: money(row[h.promo]), sku };
      if (!variationId && !sku) continue;
      rows++;
      if (variationId) byVariationId.set(variationId, entry);
      if (sku) {
        skuCount.set(sku, (skuCount.get(sku) || 0) + 1);
        bySku.set(sku, entry);
      }
    }
  }
  // A SKU is only used to match when it appears once (Shopee allows repeats).
  for (const [sku, n] of skuCount) if (n > 1) bySku.delete(sku);
  return { rows, byVariationId, bySku };
}

export type PriceList = ReturnType<typeof parsePriceTables>;

/** Price lookup for one option: Variation ID first, then a unique SKU. */
export function priceFor(list: PriceList, variationId: string | null, sku: string) {
  return (variationId && list.byVariationId.get(id(variationId))) || (sku && list.bySku.get(sku.toUpperCase())) || null;
}

/** Sale price and original price for an option, from the price list. */
export function salePrice(entry: BigSellerPrice | null, fallback: number | null): { price: number | null; compareAt: number | null } {
  const original = entry?.original ?? fallback;
  if (entry?.promo && original && entry.promo < original) return { price: entry.promo, compareAt: original };
  return { price: original, compareAt: null };
}

/** Apply the price list to parsed Shopee products. Returns how many options it found. */
export function applyPriceList(products: ImportProduct[], list: PriceList) {
  let matched = 0;
  let discounted = 0;
  for (const product of products) {
    for (const variant of product.variants) {
      const entry = priceFor(list, variant.variationId, variant.sku);
      if (!entry) continue;
      matched++;
      const { price, compareAt } = salePrice(entry, variant.price);
      variant.price = price;
      variant.compareAtPrice = compareAt;
      if (compareAt) discounted++;
    }
  }
  return { matched, discounted };
}

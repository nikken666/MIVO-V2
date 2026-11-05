// Import from Shopee, second time round: find the products a shop already has
// (by Shopee Item ID, else by name) and work out which options' price / stock
// change, instead of adding the listing again.

import type { ImportProduct } from "./shopeeImport";
import { priceFor, salePrice, type PriceList } from "./bigsellerPrices";

export type ShopProduct = { id: string; name: string; external_ref: string | null };
export type ShopVariant = {
  id: string;
  product_id: string;
  sku: string;
  variation_1_value: string | null;
  variation_2_value: string | null;
  price: number;
  compare_at_price: number | null;
  stock_on_hand: number;
  external_ref: string | null;
};
export type VariantChange = {
  id: string;
  price: number;
  compare_at_price: number | null;
  stock: number | null;
  external_ref: string | null;
  before: { price: number; compare_at_price: number | null; stock: number };
};

const norm = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const money = (value: unknown) => Math.round(Number(value || 0) * 100) / 100;
export const productRef = (productId: string | null | undefined) => (productId ? "shopee:" + productId : null);
export const variantRef = (variationId: string | null | undefined) => (variationId ? "shopee:" + variationId : null);

export type ShopIndex = ReturnType<typeof buildShopIndex>;

export function buildShopIndex(products: ShopProduct[], variants: ShopVariant[]) {
  const byRef = new Map<string, ShopProduct>();
  const byName = new Map<string, ShopProduct>();
  const allByName = new Map<string, ShopProduct[]>();
  const nameCount = new Map<string, number>();
  for (const p of products) {
    if (p.external_ref) byRef.set(p.external_ref, p);
    const key = norm(p.name);
    if (!key) continue;
    nameCount.set(key, (nameCount.get(key) || 0) + 1);
    byName.set(key, p);
    allByName.set(key, [...(allByName.get(key) || []), p]);
  }
  // Two products with the same name can't be told apart by name.
  for (const [key, n] of nameCount) if (n > 1) byName.delete(key);
  const variantsOf = new Map<string, ShopVariant[]>();
  const variantByRef = new Map<string, ShopVariant>();
  const skuCount = new Map<string, number>();
  const variantBySku = new Map<string, ShopVariant>();
  for (const v of variants) {
    variantsOf.set(v.product_id, [...(variantsOf.get(v.product_id) || []), v]);
    if (v.external_ref) variantByRef.set(v.external_ref, v);
    const sku = String(v.sku || "").trim().toUpperCase();
    if (sku) {
      skuCount.set(sku, (skuCount.get(sku) || 0) + 1);
      variantBySku.set(sku, v);
    }
  }
  for (const [sku, n] of skuCount) if (n > 1) variantBySku.delete(sku);
  return { byRef, byName, allByName, variantsOf, variantByRef, variantBySku, size: products.length };
}

/**
 * The shop's copy of each uploaded Shopee listing: by Shopee Item ID, else by
 * name when that name is unique in the upload and in the shop. Each shop
 * product is claimed by one listing at most.
 */
export function matchProducts(index: ShopIndex, products: ImportProduct[]): Map<string, ShopProduct> {
  const out = new Map<string, ShopProduct>();
  const claimed = new Set<string>();
  const uploadedNames = new Map<string, number>();
  for (const p of products) uploadedNames.set(norm(p.name), (uploadedNames.get(norm(p.name)) || 0) + 1);
  // Item IDs first, so a name match can't take a product another listing owns.
  for (const p of products) {
    const ref = productRef(p.productId);
    const hit = ref ? index.byRef.get(ref) : undefined;
    if (hit && !claimed.has(hit.id)) {
      out.set(p.key, hit);
      claimed.add(hit.id);
    }
  }
  for (const p of products) {
    if (out.has(p.key) || uploadedNames.get(norm(p.name)) !== 1) continue;
    const hit = index.byName.get(norm(p.name));
    // A product that already carries a different Shopee ID belongs to another listing.
    if (!hit || claimed.has(hit.id) || (hit.external_ref && hit.external_ref !== productRef(p.productId))) continue;
    out.set(p.key, hit);
    claimed.add(hit.id);
  }
  // Same name on several listings: pair them up by identical options (SKU + option values).
  const signature = (items: Array<{ sku: string; v1: unknown; v2: unknown }>) =>
    items.map((i) => [String(i.sku).trim().toUpperCase(), norm(i.v1), norm(i.v2)].join("~")).sort().join("|");
  for (const p of products) {
    if (out.has(p.key)) continue;
    const want = signature(p.variants.map((v) => ({ sku: v.sku, v1: v.value1, v2: v.value2 })));
    const hit = (index.allByName.get(norm(p.name)) || []).find(
      (candidate) =>
        !claimed.has(candidate.id) &&
        (!candidate.external_ref || candidate.external_ref === productRef(p.productId)) &&
        signature((index.variantsOf.get(candidate.id) || []).map((v) => ({ sku: v.sku, v1: v.variation_1_value, v2: v.variation_2_value }))) === want
    );
    if (hit) {
      out.set(p.key, hit);
      claimed.add(hit.id);
    }
  }
  return out;
}

function matchVariant(index: ShopIndex, shopProduct: ShopProduct, variant: ImportProduct["variants"][number], only: boolean) {
  const ref = variantRef(variant.variationId);
  if (ref) {
    const byRef = index.variantByRef.get(ref);
    if (byRef && byRef.product_id === shopProduct.id) return byRef;
  }
  const options = index.variantsOf.get(shopProduct.id) || [];
  const v1 = norm(variant.value1);
  const v2 = norm(variant.value2);
  const byValues = options.find((o) => norm(o.variation_1_value) === v1 && norm(o.variation_2_value) === v2);
  if (byValues) return byValues;
  if (only && options.length === 1) return options[0];
  const sku = variant.sku.toUpperCase();
  const bySku = options.filter((o) => String(o.sku).trim().toUpperCase() === sku);
  return bySku.length === 1 ? bySku[0] : null;
}

function changeFor(
  current: ShopVariant,
  price: number | null,
  compareAt: number | null,
  stock: number | null,
  ref: string | null
): VariantChange | null {
  if (price == null || !(price >= 0)) return null;
  const next = { price: money(price), compare_at_price: compareAt && compareAt > price ? money(compareAt) : null };
  const priceChanged = money(current.price) !== next.price || (current.compare_at_price ? money(current.compare_at_price) : null) !== next.compare_at_price;
  const stockChanged = stock != null && Math.round(stock) !== Number(current.stock_on_hand);
  const refMissing = Boolean(ref && current.external_ref !== ref);
  if (!priceChanged && !stockChanged && !refMissing) return null;
  return {
    id: current.id,
    ...next,
    stock: stockChanged ? Math.max(0, Math.round(stock!)) : null,
    external_ref: ref,
    before: { price: Number(current.price), compare_at_price: current.compare_at_price, stock: Number(current.stock_on_hand) },
  };
}

/** What changes for a listing the shop already has. */
export function planUpdate(index: ShopIndex, shopProduct: ShopProduct, product: ImportProduct, options: { stock: boolean }) {
  const changes: VariantChange[] = [];
  // Options Shopee has that the shop doesn't (e.g. skipped earlier for 0 stock).
  const missing: ImportProduct["variants"] = [];
  const only = product.variants.length === 1;
  for (const variant of product.variants) {
    const current = matchVariant(index, shopProduct, variant, only);
    if (!current) {
      missing.push(variant);
      continue;
    }
    const change = changeFor(current, variant.price, variant.compareAtPrice, options.stock ? variant.stock : null, variantRef(variant.variationId));
    if (change) changes.push(change);
  }
  const ref = productRef(product.productId);
  return { changes, missing, newOptions: missing.length, productRef: ref && shopProduct.external_ref !== ref ? ref : null };
}

/** Only a price list was uploaded: update the shop's options it can find. */
export function planPriceListOnly(index: ShopIndex, list: PriceList) {
  const changes: VariantChange[] = [];
  let found = 0;
  const seen = new Set<string>();
  const consider = (current: ShopVariant | undefined, variationId: string | null, entry: ReturnType<typeof priceFor>) => {
    if (!current || !entry || seen.has(current.id)) return;
    seen.add(current.id);
    found++;
    const { price, compareAt } = salePrice(entry, Number(current.price));
    const change = changeFor(current, price, compareAt, null, variantRef(variationId));
    if (change) changes.push(change);
  };
  for (const [variationId, entry] of list.byVariationId) {
    consider(index.variantByRef.get("shopee:" + variationId) || (entry.sku ? index.variantBySku.get(entry.sku) : undefined), variationId, entry);
  }
  for (const [sku, entry] of list.bySku) consider(index.variantBySku.get(sku), null, entry);
  return { changes, found };
}

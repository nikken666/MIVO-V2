// Parse Shopee Seller Centre product exports (mass-upload or mass-update
// templates, .xlsx or .csv) into MIVO products + variants.
//
// Shopee templates differ by region and version, so columns are matched by
// name (English labels or technical keys) rather than by position, and the
// header row is detected automatically. Several files (e.g. basic info,
// sales info and media info) can be merged; rows are joined by Product ID.

export type Cell = string | number | boolean | Date | null | undefined;
export type Table = { name: string; rows: Cell[][] };

type Field =
  | "productId" | "groupNo" | "name" | "description" | "category" | "parentSku"
  | "variationId" | "variationName" | "var1Name" | "var1Option" | "var2Name" | "var2Option"
  | "sku" | "price" | "stock" | "weight" | "length" | "width" | "height"
  | "cover" | "image" | "variationImage";

export type ImportVariant = {
  key: string;
  sku: string;
  skuGenerated: boolean;
  value1: string | null;
  value2: string | null;
  price: number | null;
  /** Original price shown struck through (from a BigSeller price list). */
  compareAtPrice: number | null;
  /** Shopee Variation ID, when the file has it. */
  variationId: string | null;
  stock: number | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  image: string | null;
};

export type ImportProduct = {
  key: string;
  productId: string | null;
  name: string;
  description: string;
  shopeeCategory: string;
  parentSku: string;
  variation1Name: string | null;
  variation2Name: string | null;
  images: string[];
  variants: ImportVariant[];
  errors: string[];
  warnings: string[];
};

const norm = (value: unknown) =>
  String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Order matters: more specific patterns first.
const matchers: Array<[Field, RegExp]> = [
  ["variationImage", /imagepervariation|variationimage/],
  ["var1Option", /optionforvariation1|variation1option|option1$/],
  ["var2Option", /optionforvariation2|variation2option|option2$/],
  ["var1Name", /variationname1|variation1name|^variation1$|tier1name/],
  ["var2Name", /variationname2|variation2name|^variation2$|tier2name/],
  ["groupNo", /variationintegration|integrationno/],
  ["variationId", /variationid|modelid/],
  ["productId", /^(ps|et)?(product|item)id$|^productid/],
  ["parentSku", /parentsku|skuparent|productsku/],
  ["name", /productname|itemname|producttitle|^title$/],
  ["description", /description/],
  ["category", /^(ps)?category/],
  ["variationName", /variationname|^variation$|modelname|optionname/],
  ["cover", /coverimage|mainimage|itemcoverimage|imageurl1$|^image1url$/],
  ["image", /(item|product)image\d+|^image\d+$|itemimage/],
  ["sku", /sku/],
  ["price", /price/],
  ["stock", /stock|quantity/],
  ["weight", /weight/],
  ["length", /length/],
  ["width", /width/],
  ["height", /height/],
];

// Chinese headers (BigSeller / Shopee CN-language exports).
const zhMatchers: Array<[Field, RegExp]> = [
  ["variationImage", /(规格|变种|变体|SKU).*(图片|图)/i],
  ["productId", /^(产品|商品)\s*(ID|编号)$/i],
  ["parentSku", /(父|主)\s*SKU/i],
  ["name", /(产品|商品)(名称|标题)|^标题$/],
  ["description", /描述|详情/],
  ["category", /类目|分类/],
  ["variationName", /(变种|规格|变体)(名称|属性|值)?$/],
  ["cover", /主图|封面/],
  ["image", /^(图片|附图|产品图片|商品图片)\s*\d*$/],
  ["sku", /SKU/i],
  ["price", /价格|售价|单价/],
  ["stock", /库存|数量/],
  ["weight", /重量/],
  ["length", /长度/],
  ["width", /宽度/],
  ["height", /高度/],
];

function fieldFor(header: Cell): Field | null {
  const raw = String(header ?? "").trim();
  if (/[\u4e00-\u9fff]/.test(raw) && raw.length <= 30) {
    for (const [field, re] of zhMatchers) if (re.test(raw)) return field;
  }
  // Technical keys look like "et_title_product_id"; drop the prefix.
  const h = norm(header).replace(/^ettitle/, "");
  if (!h || h.length > 60) return null;
  for (const [field, re] of matchers) if (re.test(h)) return field;
  return null;
}

type ColumnMap = Map<number, Field>;

function detectHeader(rows: Cell[][]): { index: number; columns: ColumnMap } | null {
  let best: { index: number; columns: ColumnMap; score: number } | null = null;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const columns: ColumnMap = new Map();
    const seen = new Set<Field>();
    rows[i].forEach((cell, col) => {
      const field = fieldFor(cell);
      if (!field) return;
      // Keep the first column for single-value fields; images can repeat.
      if (field !== "image" && seen.has(field)) return;
      seen.add(field);
      columns.set(col, field);
    });
    const score = seen.size;
    if (score >= 3 && (!best || score > best.score)) best = { index: i, columns, score };
  }
  return best ? { index: best.index, columns: best.columns } : null;
}

const text = (value: Cell) =>
  value instanceof Date ? value.toISOString() : String(value ?? "").trim();

function num(value: Cell): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = text(value).replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const SHOPEE_IMAGE_BASE = "https://down-my.img.susercontent.com/file/";
function imageUrl(value: Cell): string | null {
  const v = text(value);
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z0-9_-]{16,}$/i.test(v)) return SHOPEE_IMAGE_BASE + v;
  return null;
}

// Template guidance rows ("Mandatory", "Please enter…") are not products.
const guidance = /mandatory|optional|required|please (enter|fill|select)|characters|e\.g\.|example|template|^\*/i;

type RowRecord = Partial<Record<Exclude<Field, "image">, string>> & { images: string[] };

// Only sheets with SKU / price / variation columns describe variations; others
// (e.g. listing or republish reports with a Stock column) only add product info.
function hasVariantColumns(table: Table): boolean {
  const header = detectHeader(table.rows);
  if (!header) return false;
  const fields = new Set(header.columns.values());
  return ["sku", "price", "variationId", "var1Option", "variationName"].some((f) => fields.has(f as Field));
}

function readRows(table: Table): RowRecord[] {
  const header = detectHeader(table.rows);
  if (!header) return [];
  const out: RowRecord[] = [];
  for (const row of table.rows.slice(header.index + 1)) {
    const record: RowRecord = { images: [] };
    header.columns.forEach((field, col) => {
      const value = row[col];
      if (field === "image" || field === "cover") {
        const url = imageUrl(value);
        if (url) {
          if (field === "cover") record.cover = url;
          else record.images.push(url);
        }
        return;
      }
      const v = text(value);
      if (v) record[field as Exclude<Field, "image">] = v;
    });
    const identity = record.name || record.sku || record.productId || record.parentSku;
    if (!identity) continue;
    // Shopee's hidden template row ("basic_info", "sales_info", …) under the keys.
    if (record.productId && !/^\d+$/.test(record.productId)) continue;
    const probe = [record.name, record.sku, record.price, record.stock].filter(Boolean).join(" ");
    if (guidance.test(probe)) continue;
    // A header repeated inside the data (some exports have two header rows).
    if (fieldFor(record.name) === "name" || fieldFor(record.price) === "price") continue;
    out.push(record);
  }
  return out;
}

export function parseShopeeTables(tables: Table[]): {
  products: ImportProduct[];
  recognisedFiles: string[];
  unrecognisedFiles: string[];
} {
  const products = new Map<string, ImportProduct>();
  const variantsByKey = new Map<string, ImportVariant>();
  const recognisedFiles: string[] = [];
  const unrecognisedFiles: string[] = [];

  tables.forEach((table, fileIndex) => {
    const rows = readRows(table);
    if (!rows.length) {
      unrecognisedFiles.push(table.name);
      return;
    }
    recognisedFiles.push(table.name);
    const variantSheet = hasVariantColumns(table);

    let lastGroupKey = "";
    for (const r of rows) {
      const productKey =
        (r.productId && "id:" + r.productId) ||
        (r.groupNo && "grp:" + fileIndex + ":" + r.groupNo) ||
        (r.parentSku && "psku:" + r.parentSku.toUpperCase()) ||
        (r.name && "name:" + r.name.toLowerCase()) ||
        lastGroupKey;
      if (!productKey) continue;
      lastGroupKey = productKey;

      let product = products.get(productKey);
      if (!product) {
        product = {
          key: productKey,
          productId: r.productId || null,
          name: "",
          description: "",
          shopeeCategory: "",
          parentSku: "",
          variation1Name: null,
          variation2Name: null,
          images: [],
          variants: [],
          errors: [],
          warnings: [],
        };
        products.set(productKey, product);
      }
      product.name ||= r.name || "";
      product.description ||= r.description || "";
      product.shopeeCategory ||= r.category || "";
      product.parentSku ||= r.parentSku || "";
      product.variation1Name ||= r.var1Name || null;
      product.variation2Name ||= r.var2Name || null;
      for (const url of [r.cover, ...r.images]) {
        if (url && !product.images.includes(url)) product.images.push(url);
      }

      // Variant-level data present on this row?
      let value1 = r.var1Option || null;
      let value2 = r.var2Option || null;
      if (!value1 && r.variationName) {
        const [a, b] = r.variationName.split(/[,，]/).map((s) => s.trim());
        value1 = a || null;
        value2 = b || null;
      }
      const hasVariantData =
        variantSheet && (r.sku || r.variationId || r.price || r.stock || value1);
      if (!hasVariantData) continue;

      const variantKey =
        (r.variationId && "vid:" + r.variationId) ||
        productKey + "|" + (r.sku || [value1, value2].filter(Boolean).join("/") || "default");
      let variant = variantsByKey.get(variantKey);
      if (!variant) {
        variant = {
          key: variantKey,
          sku: "",
          skuGenerated: false,
          value1: null,
          value2: null,
          price: null,
          compareAtPrice: null,
          variationId: r.variationId ? String(r.variationId).trim() : null,
          stock: null,
          weight: null,
          length: null,
          width: null,
          height: null,
          image: null,
        };
        variantsByKey.set(variantKey, variant);
        product.variants.push(variant);
      }
      variant.sku ||= (r.sku || "").toUpperCase();
      variant.value1 ||= value1;
      variant.value2 ||= value2;
      variant.price ??= num(r.price ?? null);
      variant.stock ??= num(r.stock ?? null);
      variant.weight ??= num(r.weight ?? null);
      variant.length ??= num(r.length ?? null);
      variant.width ??= num(r.width ?? null);
      variant.height ??= num(r.height ?? null);
      variant.image ||= imageUrl(r.variationImage ?? null);
    }
  });

  // Finalise: names, generated SKUs, validation.
  for (const product of products.values()) {
    const multi = product.variants.length > 1 || product.variants.some((v) => v.value1);
    if (multi) {
      product.variation1Name ||= "Variation";
      if (product.variants.some((v) => v.value2)) product.variation2Name ||= "Option";
    } else {
      product.variation1Name = null;
      product.variation2Name = null;
    }

    const base = (product.parentSku || (product.productId ? "SHP-" + product.productId : "SHP-" + product.name.slice(0, 12)))
      .toUpperCase()
      .replace(/\s+/g, "-");
    product.variants.forEach((variant, index) => {
      if (!variant.sku) {
        variant.sku = product.variants.length > 1 ? base + "-" + (index + 1) : base;
        variant.skuGenerated = true;
      }
    });

    if (!product.name) product.errors.push("Missing product name");
    if (!product.variants.length) product.errors.push("No price / stock rows");
    if (product.variants.some((v) => v.price === null || v.price < 0)) product.errors.push("Missing price");
    if (!product.images.length) product.warnings.push("No images");
    if (product.variants.some((v) => v.skuGenerated)) product.warnings.push("SKU generated");
    if (product.variants.some((v) => v.stock === null)) product.warnings.push("Stock missing (set to 0)");
    // Shopee allows the same SKU on two options of one listing (e.g. one part
    // for two car models). Kept as-is: they share one stock.
    const skus = product.variants.map((v) => v.sku);
    if (new Set(skus).size !== skus.length) product.warnings.push("Same SKU on several options (shared stock)");
  }

  // A file counts as recognised when any of its sheets is (Shopee adds helper
  // sheets such as "HiddenSizeSelect"); only report files with nothing usable.
  const fileOf = (name: string) => name.split(" › ")[0];
  const usableFiles = new Set(recognisedFiles.map(fileOf));
  return {
    products: [...products.values()],
    recognisedFiles,
    unrecognisedFiles: unrecognisedFiles.filter((name) => !usableFiles.has(fileOf(name))),
  };
}

// Minimal CSV reader (quotes, commas, newlines in quotes).
export function parseCsv(content: string): Cell[][] {
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (quoted) {
      if (ch === '"' && content[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && content[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Guess a brand from the product name or SKU (e.g. "KYB …", "NIKKEN …"). */
export function guessBrandId(
  product: Pick<ImportProduct, "name" | "parentSku">,
  brands: Array<{ id: string; name: string }>
): string | null {
  const haystack = (" " + product.name + " " + product.parentSku + " ").toUpperCase();
  const hit = brands
    .filter((brand) => brand.name.trim().length >= 2)
    .sort((a, b) => b.name.length - a.name.length)
    .find((brand) => {
      const escaped = brand.name.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp("[^A-Z0-9]" + escaped + "[^A-Z0-9]").test(haystack);
    });
  return hit?.id || null;
}

/** Guess a MIVO category from the product name / Shopee category text. */
export function guessCategoryId(
  product: Pick<ImportProduct, "name" | "shopeeCategory">,
  categories: Array<{ id: string; name: string }>
): string | null {
  const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const target = new Set(words(product.name + " " + product.shopeeCategory));
  let best: { id: string; score: number } | null = null;
  for (const category of categories) {
    const cw = words(category.name);
    if (!cw.length) continue;
    const hits = cw.filter((w) => target.has(w) || target.has(w.replace(/s$/, ""))).length;
    const score = hits / cw.length;
    if (hits > 0 && (!best || score > best.score)) best = { id: category.id, score };
  }
  return best && best.score >= 0.5 ? best.id : null;
}

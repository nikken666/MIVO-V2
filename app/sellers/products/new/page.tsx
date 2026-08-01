"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CategoryPicker, {
  type CategoryNode,
} from "@/components/CategoryPicker";
import styles from "../../Seller.module.css";
import variationStyles from "./VariationEditor.module.css";

type Option = { id: string; name: string };

type ApprovedSeller = {
  id: string;
  shop_name: string;
  status: string;
};

type VariantDraft = {
  key: string;
  variation1Value: string;
  variation2Value: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  active: boolean;
};

type BulkDraft = {
  price: string;
  compareAtPrice: string;
  stock: string;
  weight: string;
  length: string;
  width: string;
  height: string;
};

const emptyBulk: BulkDraft = {
  price: "",
  compareAtPrice: "",
  stock: "",
  weight: "",
  length: "",
  width: "",
  height: "",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeFileName(value: string) {
  const parts = value.toLowerCase().split(".");
  const extension = parts.length > 1 ? parts.pop() : "jpg";
  const base = parts
    .join(".")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return `${base || "product"}.${extension}`;
}

function combinationKey(value1: string, value2: string) {
  return `${value1}\u241f${value2}`;
}

function newCombination(
  value1: string,
  value2: string,
  previous?: VariantDraft
): VariantDraft {
  return {
    key: combinationKey(value1, value2),
    variation1Value: value1,
    variation2Value: value2,
    sku: previous?.sku || "",
    price: previous?.price || "",
    compareAtPrice: previous?.compareAtPrice || "",
    stock: previous?.stock || "0",
    weight: previous?.weight || "0",
    length: previous?.length || "0",
    width: previous?.width || "0",
    height: previous?.height || "0",
    active: previous?.active ?? true,
  };
}

export default function NewSellerProductPage() {
  const router = useRouter();

  const [seller, setSeller] =
    useState<ApprovedSeller | null>(null);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const [hasVariations, setHasVariations] = useState(false);
  const [variation1Name, setVariation1Name] = useState("");
  const [variation2Name, setVariation2Name] = useState("");
  const [variation1Input, setVariation1Input] = useState("");
  const [variation2Input, setVariation2Input] = useState("");
  const [variation1Options, setVariation1Options] = useState<string[]>([]);
  const [variation2Options, setVariation2Options] = useState<string[]>([]);
  const [showVariation2, setShowVariation2] = useState(false);
  const [variantRows, setVariantRows] = useState<VariantDraft[]>([]);
  const [bulk, setBulk] = useState<BulkDraft>(emptyBulk);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href =
          "/login?next=/sellers/products/new";
        return;
      }

      const [
        { data: sellerData, error: sellerError },
        { data: categoryData, error: categoryError },
        { data: brandData, error: brandError },
      ] = await Promise.all([
        supabase
          .from("sellers")
          .select("id, shop_name, status")
          .eq("owner_id", user.id)
          .maybeSingle(),
        supabase
          .from("categories")
          .select("id, name, slug, parent_id, sort_order")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("brands")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
      ]);

      if (sellerError || categoryError || brandError) {
        setError(
          sellerError?.message ||
            categoryError?.message ||
            brandError?.message ||
            "Unable to load seller tools."
        );
        setLoading(false);
        return;
      }

      if (!sellerData || sellerData.status !== "approved") {
        window.location.href = "/sellers";
        return;
      }

      setSeller(sellerData as ApprovedSeller);
      setCategories(
        (categoryData as CategoryNode[] | null) || []
      );
      setBrands((brandData as Option[] | null) || []);
      setLoading(false);
    }

    void load();
  }, []);

  useEffect(() => {
    const urls = files.map((file) =>
      URL.createObjectURL(file)
    );
    setPreviews(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  useEffect(() => {
    if (!hasVariations || variation1Options.length === 0) {
      setVariantRows([]);
      return;
    }

    const secondValues =
      showVariation2 && variation2Options.length > 0
        ? variation2Options
        : [""];

    setVariantRows((current) => {
      const previousByKey = new Map(
        current.map((row) => [row.key, row])
      );

      return variation1Options.flatMap((value1) =>
        secondValues.map((value2) =>
          newCombination(
            value1,
            value2,
            previousByKey.get(combinationKey(value1, value2))
          )
        )
      );
    });
  }, [
    hasVariations,
    showVariation2,
    variation1Options,
    variation2Options,
  ]);

  const combinationCount = variantRows.length;

  function addOption(
    input: string,
    setInput: (value: string) => void,
    options: string[],
    setOptions: (values: string[]) => void
  ) {
    const value = input.trim();

    if (!value) return;
    if (options.some((option) => option.toLowerCase() === value.toLowerCase())) {
      setError(`Duplicate variation option: ${value}`);
      return;
    }

    const nextCount =
      setOptions === setVariation1Options
        ? (options.length + 1) *
          Math.max(
            1,
            showVariation2 ? variation2Options.length : 1
          )
        : variation1Options.length * (options.length + 1);

    if (nextCount > 100) {
      setError("Maximum 100 variation combinations per product.");
      return;
    }

    setError("");
    setOptions([...options, value]);
    setInput("");
  }

  function enterOption(
    event: KeyboardEvent<HTMLInputElement>,
    input: string,
    setInput: (value: string) => void,
    options: string[],
    setOptions: (values: string[]) => void
  ) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    addOption(input, setInput, options, setOptions);
  }

  function removeOption(
    value: string,
    options: string[],
    setOptions: (values: string[]) => void
  ) {
    setOptions(options.filter((option) => option !== value));
  }

  function updateVariant(
    key: string,
    field: keyof Omit<
      VariantDraft,
      "key" | "variation1Value" | "variation2Value"
    >,
    value: string | boolean
  ) {
    setVariantRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, [field]: value } : row
      )
    );
  }

  function applyBulk() {
    setVariantRows((current) =>
      current.map((row) => ({
        ...row,
        price: bulk.price || row.price,
        compareAtPrice:
          bulk.compareAtPrice || row.compareAtPrice,
        stock: bulk.stock || row.stock,
        weight: bulk.weight || row.weight,
        length: bulk.length || row.length,
        width: bulk.width || row.width,
        height: bulk.height || row.height,
      }))
    );
  }

  function chooseImages(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const chosen = Array.from(
      event.target.files || []
    ).slice(0, 8);

    const invalid = chosen.find(
      (file) =>
        !["image/jpeg", "image/png", "image/webp"].includes(
          file.type
        ) ||
        file.size > 5 * 1024 * 1024
    );

    if (invalid) {
      setError(
        "Images must be JPG, PNG or WEBP and each image must be below 5MB."
      );
      event.target.value = "";
      return;
    }

    setError("");
    setFiles(chosen);
  }

  function prepareVariantRows(form: FormData) {
    if (!hasVariations) {
      const sku = String(form.get("sku") || "")
        .trim()
        .toUpperCase();
      const price = Number(form.get("price"));
      const compareAtPriceText = String(
        form.get("compare_at_price") || ""
      );
      const stock = Number(form.get("stock_on_hand"));

      if (!sku) throw new Error("SKU is required.");
      if (!Number.isFinite(price) || price < 0) {
        throw new Error("Enter a valid selling price.");
      }
      if (!Number.isInteger(stock) || stock < 0) {
        throw new Error("Stock must be a whole number.");
      }

      return [
        {
          title: "Default",
          variation_1_value: null,
          variation_2_value: null,
          sku,
          price,
          compare_at_price: compareAtPriceText
            ? Number(compareAtPriceText)
            : null,
          stock_on_hand: stock,
          stock_reserved: 0,
          weight_kg: Number(form.get("weight_kg")) || 0,
          length_cm: Number(form.get("length_cm")) || 0,
          width_cm: Number(form.get("width_cm")) || 0,
          height_cm: Number(form.get("height_cm")) || 0,
          is_active: true,
        },
      ];
    }

    if (!variation1Name.trim()) {
      throw new Error("Variation 1 name is required.");
    }
    if (variation1Options.length === 0) {
      throw new Error("Add at least one option for Variation 1.");
    }
    if (showVariation2 && !variation2Name.trim()) {
      throw new Error("Variation 2 name is required.");
    }
    if (showVariation2 && variation2Options.length === 0) {
      throw new Error("Add at least one option for Variation 2.");
    }

    const activeRows = variantRows.filter((row) => row.active);
    if (activeRows.length === 0) {
      throw new Error("Enable at least one variation combination.");
    }

    const prepared = activeRows.map((row) => {
      const sku = row.sku.trim().toUpperCase();
      const price = Number(row.price);
      const compareAtPrice = row.compareAtPrice
        ? Number(row.compareAtPrice)
        : null;
      const stock = Number(row.stock);

      if (!sku) {
        throw new Error(
          `SKU is required for ${row.variation1Value}${
            row.variation2Value
              ? ` / ${row.variation2Value}`
              : ""
          }.`
        );
      }
      if (!Number.isFinite(price) || price < 0) {
        throw new Error(`Invalid price for SKU ${sku}.`);
      }
      if (!Number.isInteger(stock) || stock < 0) {
        throw new Error(`Invalid stock for SKU ${sku}.`);
      }

      return {
        title: [row.variation1Value, row.variation2Value]
          .filter(Boolean)
          .join(" / "),
        variation_1_value: row.variation1Value,
        variation_2_value: row.variation2Value || null,
        sku,
        price,
        compare_at_price: compareAtPrice,
        stock_on_hand: stock,
        stock_reserved: 0,
        weight_kg: Number(row.weight) || 0,
        length_cm: Number(row.length) || 0,
        width_cm: Number(row.width) || 0,
        height_cm: Number(row.height) || 0,
        is_active: true,
      };
    });

    const duplicateSku = prepared.find(
      (row, index) =>
        prepared.findIndex((other) => other.sku === row.sku) !==
        index
    );

    if (duplicateSku) {
      throw new Error(`Duplicate SKU: ${duplicateSku.sku}`);
    }

    return prepared;
  }

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (!seller) return;

    const supabase = createClient();
    const form = new FormData(event.currentTarget);

    setBusy(true);
    setProgress("Checking product information...");
    setError("");

    let productId: string | null = null;
    const uploadedPaths: string[] = [];

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your login session expired.");
      }

      const name = String(form.get("name") || "").trim();
      const categoryId =
        String(form.get("category_id") || "") || null;
      const brandId =
        String(form.get("brand_id") || "") || null;
      const description = String(
        form.get("description") || ""
      ).trim();
      const shortDescription = String(
        form.get("short_description") || ""
      ).trim();
      const warranty = Number(
        form.get("warranty_months") || 0
      );

      if (!name) throw new Error("Product name is required.");
      if (!categoryId) {
        throw new Error("Select the final product category.");
      }
      if (files.length === 0) {
        throw new Error("Upload at least one product image.");
      }

      const preparedVariants = prepareVariantRows(form);

      setProgress("Uploading product images...");

      const imageRows: Array<{
        image_url: string;
        alt_text: string;
        sort_order: number;
      }> = [];

      for (const [index, file] of files.entries()) {
        const path = `${
          seller.id
        }/${crypto.randomUUID()}-${safeFileName(file.name)}`;

        const { error: uploadError } =
          await supabase.storage
            .from("product-images")
            .upload(path, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type,
            });

        if (uploadError) throw uploadError;
        uploadedPaths.push(path);

        const { data: publicData } =
          supabase.storage
            .from("product-images")
            .getPublicUrl(path);

        imageRows.push({
          image_url: publicData.publicUrl,
          alt_text: name,
          sort_order: index,
        });
      }

      setProgress("Creating product and SKU combinations...");

      const slug = `${
        slugify(name) || "product"
      }-${Date.now().toString(36)}`;

      const { data: product, error: productError } =
        await supabase
          .from("products")
          .insert({
            seller_id: seller.id,
            category_id: categoryId,
            brand_id: brandId,
            name,
            slug,
            short_description:
              shortDescription || null,
            description: description || null,
            primary_image_url: imageRows[0].image_url,
            warranty_months:
              Number.isFinite(warranty) && warranty >= 0
                ? warranty
                : 0,
            variation_1_name: hasVariations
              ? variation1Name.trim()
              : null,
            variation_2_name:
              hasVariations && showVariation2
                ? variation2Name.trim()
                : null,
            status: "pending_review",
            created_by: user.id,
          })
          .select("id")
          .single();

      if (productError) throw productError;
      productId = product.id;

      const { error: variantError } = await supabase
        .from("product_variants")
        .insert(
          preparedVariants.map((variant) => ({
            product_id: product.id,
            seller_id: seller.id,
            ...variant,
          }))
        );

      if (variantError) throw variantError;

      const { error: imageError } = await supabase
        .from("product_images")
        .insert(
          imageRows.map((image) => ({
            product_id: product.id,
            ...image,
          }))
        );

      if (imageError) throw imageError;

      setProgress(
        "Product and variations submitted for MIVO review."
      );
      router.push("/sellers/products");
      router.refresh();
    } catch (caught) {
      if (productId) {
        await supabase
          .from("products")
          .delete()
          .eq("id", productId);
      }

      if (uploadedPaths.length > 0) {
        await supabase.storage
          .from("product-images")
          .remove(uploadedPaths);
      }

      const supabaseError = caught as {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

const errorMessage = [
  supabaseError?.message,
  supabaseError?.details,
  supabaseError?.hint,
  supabaseError?.code
    ? `Error code: ${supabaseError.code}`
    : "",
]
  .filter(Boolean)
  .join(" | ");

console.error("Product upload failed:", caught);

setError(
  caught instanceof Error
    ? caught.message
    : errorMessage || "Unable to upload product."
);
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="container pageShell">
        <section className={styles.panel}>
          Loading seller tools...
        </section>
      </main>
    );
  }

  return (
    <main className="container pageShell">
      <section className={styles.panel}>
        <div className={styles.titleRow}>
          <div>
            <span className={styles.eyebrow}>
              SELLER PRODUCT UPLOAD
            </span>
            <h1>Add a product</h1>
            <p>
              Shop: {seller?.shop_name}. Variations are optional.
              Sellers can create one or two custom variation groups.
            </p>
          </div>

          <Link
            href="/sellers/products"
            className={styles.secondaryButton}
          >
            Manage products
          </Link>
        </div>

        <form className={styles.form} onSubmit={submit}>
          <div className={styles.formGrid}>
            <label className={styles.fullWidth}>
              <span>Product name *</span>
              <input
                name="name"
                required
                placeholder="Example: NIKKEN ULTIMAX Shock Absorber"
              />
            </label>

            <label>
              <span>Brand</span>
              <select name="brand_id" defaultValue="">
                <option value="">Choose brand</option>
                {brands.map((brand) => (
                  <option value={brand.id} key={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>

            <CategoryPicker
              categories={categories}
              name="category_id"
              required
            />

            <label>
              <span>Warranty months</span>
              <input
                name="warranty_months"
                type="number"
                min="0"
                step="1"
                defaultValue="12"
              />
            </label>

            <label className={styles.fullWidth}>
              <span>Short description</span>
              <input
                name="short_description"
                maxLength={220}
                placeholder="Short summary shown on product cards"
              />
            </label>

            <label className={styles.fullWidth}>
              <span>Product description</span>
              <textarea
                name="description"
                placeholder="Product details, package contents, fitment notes and warranty information"
              />
            </label>

            <section className={variationStyles.section}>
              <div className={variationStyles.toggleRow}>
                <div>
                  <strong>This product has variations</strong>
                  <p className={variationStyles.note}>
                    Leave this off for a normal single-SKU product.
                  </p>
                </div>

                <button
                  type="button"
                  aria-pressed={hasVariations}
                  className={`${variationStyles.switch} ${
                    hasVariations
                      ? variationStyles.switchOn
                      : ""
                  }`}
                  onClick={() => {
                    setHasVariations((current) => !current);
                    setError("");
                  }}
                />
              </div>

              {!hasVariations ? (
                <div className={variationStyles.singleGrid}>
                  <label>
                    <span>SKU *</span>
                    <input
                      name="sku"
                      required
                      placeholder="NIKKEN-MYVI-ABS-FR"
                    />
                  </label>

                  <label>
                    <span>Selling price (RM) *</span>
                    <input
                      name="price"
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      placeholder="199.00"
                    />
                  </label>

                  <label>
                    <span>Original price (RM)</span>
                    <input
                      name="compare_at_price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="239.00"
                    />
                  </label>

                  <label>
                    <span>Stock *</span>
                    <input
                      name="stock_on_hand"
                      type="number"
                      required
                      min="0"
                      step="1"
                      defaultValue="0"
                    />
                  </label>

                  <label>
                    <span>Weight (kg)</span>
                    <input
                      name="weight_kg"
                      type="number"
                      min="0"
                      step="0.001"
                      defaultValue="0"
                    />
                  </label>

                  <label>
                    <span>Length (cm)</span>
                    <input
                      name="length_cm"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue="0"
                    />
                  </label>

                  <label>
                    <span>Width (cm)</span>
                    <input
                      name="width_cm"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue="0"
                    />
                  </label>

                  <label>
                    <span>Height (cm)</span>
                    <input
                      name="height_cm"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue="0"
                    />
                  </label>
                </div>
              ) : (
                <>
                  <section className={variationStyles.groupCard}>
                    <div className={variationStyles.sectionHeader}>
                      <div>
                        <h3>Variation 1</h3>
                        <p className={variationStyles.note}>
                          Seller chooses the name and options.
                        </p>
                      </div>
                    </div>

                    <label>
                      <span>Variation name *</span>
                      <input
                        value={variation1Name}
                        onChange={(event) =>
                          setVariation1Name(event.target.value)
                        }
                        placeholder="Example: Car Model, Colour, Size, Position"
                      />
                    </label>

                    <div className={variationStyles.optionRow}>
                      <label>
                        <span>Add option</span>
                        <input
                          value={variation1Input}
                          onChange={(event) =>
                            setVariation1Input(event.target.value)
                          }
                          onKeyDown={(event) =>
                            enterOption(
                              event,
                              variation1Input,
                              setVariation1Input,
                              variation1Options,
                              setVariation1Options
                            )
                          }
                          placeholder="Example: MYVI"
                        />
                      </label>

                      <button
                        type="button"
                        className={variationStyles.secondary}
                        onClick={() =>
                          addOption(
                            variation1Input,
                            setVariation1Input,
                            variation1Options,
                            setVariation1Options
                          )
                        }
                      >
                        Add
                      </button>
                    </div>

                    <div className={variationStyles.optionList}>
                      {variation1Options.map((option) => (
                        <span
                          className={variationStyles.optionChip}
                          key={option}
                        >
                          {option}
                          <button
                            type="button"
                            onClick={() =>
                              removeOption(
                                option,
                                variation1Options,
                                setVariation1Options
                              )
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </section>

                  {!showVariation2 ? (
                    <button
                      type="button"
                      className={variationStyles.secondary}
                      onClick={() => setShowVariation2(true)}
                    >
                      + Add Variation 2
                    </button>
                  ) : (
                    <section className={variationStyles.groupCard}>
                      <div className={variationStyles.sectionHeader}>
                        <div>
                          <h3>Variation 2</h3>
                          <p className={variationStyles.note}>
                            Optional second variation group.
                          </p>
                        </div>

                        <button
                          type="button"
                          className={`${variationStyles.secondary} ${variationStyles.remove}`}
                          onClick={() => {
                            setShowVariation2(false);
                            setVariation2Name("");
                            setVariation2Input("");
                            setVariation2Options([]);
                          }}
                        >
                          Remove Variation 2
                        </button>
                      </div>

                      <label>
                        <span>Variation name *</span>
                        <input
                          value={variation2Name}
                          onChange={(event) =>
                            setVariation2Name(event.target.value)
                          }
                          placeholder="Example: Position, Colour, Type"
                        />
                      </label>

                      <div className={variationStyles.optionRow}>
                        <label>
                          <span>Add option</span>
                          <input
                            value={variation2Input}
                            onChange={(event) =>
                              setVariation2Input(event.target.value)
                            }
                            onKeyDown={(event) =>
                              enterOption(
                                event,
                                variation2Input,
                                setVariation2Input,
                                variation2Options,
                                setVariation2Options
                              )
                            }
                            placeholder="Example: FRONT LH"
                          />
                        </label>

                        <button
                          type="button"
                          className={variationStyles.secondary}
                          onClick={() =>
                            addOption(
                              variation2Input,
                              setVariation2Input,
                              variation2Options,
                              setVariation2Options
                            )
                          }
                        >
                          Add
                        </button>
                      </div>

                      <div className={variationStyles.optionList}>
                        {variation2Options.map((option) => (
                          <span
                            className={variationStyles.optionChip}
                            key={option}
                          >
                            {option}
                            <button
                              type="button"
                              onClick={() =>
                                removeOption(
                                  option,
                                  variation2Options,
                                  setVariation2Options
                                )
                              }
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {combinationCount > 0 && (
                    <>
                      <section className={variationStyles.bulkCard}>
                        <strong>
                          Batch edit all {combinationCount} combinations
                        </strong>

                        <div className={variationStyles.bulkGrid}>
                          {(
                            [
                              ["price", "Price"],
                              ["compareAtPrice", "Original price"],
                              ["stock", "Stock"],
                              ["weight", "Weight kg"],
                              ["length", "Length cm"],
                              ["width", "Width cm"],
                              ["height", "Height cm"],
                            ] as Array<[keyof BulkDraft, string]>
                          ).map(([field, label]) => (
                            <label key={field}>
                              <span>{label}</span>
                              <input
                                type="number"
                                min="0"
                                step={
                                  field === "stock" ? "1" : "0.01"
                                }
                                value={bulk[field]}
                                onChange={(event) =>
                                  setBulk((current) => ({
                                    ...current,
                                    [field]: event.target.value,
                                  }))
                                }
                              />
                            </label>
                          ))}

                          <button
                            type="button"
                            className={variationStyles.secondary}
                            onClick={applyBulk}
                          >
                            Apply to all
                          </button>
                        </div>
                      </section>

                      <div className={variationStyles.matrix}>
                        <div className={variationStyles.matrixHeader}>
                          <span>{variation1Name || "Variation 1"}</span>
                          <span>
                            {showVariation2
                              ? variation2Name || "Variation 2"
                              : "—"}
                          </span>
                          <span>SKU *</span>
                          <span>Price *</span>
                          <span>Original</span>
                          <span>Stock *</span>
                          <span>Weight kg</span>
                          <span>Length cm</span>
                          <span>Width cm</span>
                          <span>Height cm</span>
                          <span>Active</span>
                        </div>

                        {variantRows.map((row) => (
                          <div
                            className={variationStyles.matrixRow}
                            key={row.key}
                          >
                            <span className={variationStyles.optionCell}>
                              {row.variation1Value}
                            </span>
                            <span className={variationStyles.optionCell}>
                              {row.variation2Value || "—"}
                            </span>

                            <input
                              value={row.sku}
                              onChange={(event) =>
                                updateVariant(
                                  row.key,
                                  "sku",
                                  event.target.value
                                )
                              }
                              placeholder="Unique SKU"
                            />

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.price}
                              onChange={(event) =>
                                updateVariant(
                                  row.key,
                                  "price",
                                  event.target.value
                                )
                              }
                            />

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.compareAtPrice}
                              onChange={(event) =>
                                updateVariant(
                                  row.key,
                                  "compareAtPrice",
                                  event.target.value
                                )
                              }
                            />

                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={row.stock}
                              onChange={(event) =>
                                updateVariant(
                                  row.key,
                                  "stock",
                                  event.target.value
                                )
                              }
                            />

                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={row.weight}
                              onChange={(event) =>
                                updateVariant(
                                  row.key,
                                  "weight",
                                  event.target.value
                                )
                              }
                            />

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.length}
                              onChange={(event) =>
                                updateVariant(
                                  row.key,
                                  "length",
                                  event.target.value
                                )
                              }
                            />

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.width}
                              onChange={(event) =>
                                updateVariant(
                                  row.key,
                                  "width",
                                  event.target.value
                                )
                              }
                            />

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.height}
                              onChange={(event) =>
                                updateVariant(
                                  row.key,
                                  "height",
                                  event.target.value
                                )
                              }
                            />

                            <label
                              className={variationStyles.activeToggle}
                            >
                              <input
                                type="checkbox"
                                checked={row.active}
                                onChange={(event) =>
                                  updateVariant(
                                    row.key,
                                    "active",
                                    event.target.checked
                                  )
                                }
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </section>

            <label
              className={`${styles.fullWidth} ${styles.fileBox}`}
            >
              <span>Product images * (maximum 8)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={chooseImages}
              />
              <span className={styles.help}>
                JPG, PNG or WEBP. Maximum 5MB per image. The
                first image becomes the main product image.
              </span>
            </label>
          </div>

          {previews.length > 0 && (
            <div className={styles.previewGrid}>
              {previews.map((preview, index) => (
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  key={preview}
                />
              ))}
            </div>
          )}

          {progress && (
            <p className={styles.success}>{progress}</p>
          )}
          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button
              className="redButton"
              type="submit"
              disabled={busy}
            >
              {busy
                ? "Uploading..."
                : "Submit product for review"}
            </button>

            <Link
              href="/sellers/products"
              className={styles.secondaryButton}
            >
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}

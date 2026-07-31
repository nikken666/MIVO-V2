"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../../Seller.module.css";

type Option = { id: string; name: string };
type ApprovedSeller = { id: string; shop_name: string; status: string };

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

export default function NewSellerProductPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [seller, setSeller] = useState<ApprovedSeller | null>(null);
  const [categories, setCategories] = useState<Option[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login?next=/sellers/products/new";
        return;
      }

      const [{ data: sellerData }, { data: categoryData }, { data: brandData }] =
        await Promise.all([
          supabase
            .from("sellers")
            .select("id, shop_name, status")
            .eq("owner_id", user.id)
            .maybeSingle(),
          supabase
            .from("categories")
            .select("id, name")
            .eq("is_active", true)
            .order("sort_order"),
          supabase
            .from("brands")
            .select("id, name")
            .eq("is_active", true)
            .order("name"),
        ]);

      if (!sellerData || sellerData.status !== "approved") {
        window.location.href = "/sellers";
        return;
      }

      setSeller(sellerData as ApprovedSeller);
      setCategories((categoryData as Option[] | null) || []);
      setBrands((brandData as Option[] | null) || []);
      setLoading(false);
    }

    void load();
  }, [supabase]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  function chooseImages(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files || []).slice(0, 8);
    const invalid = chosen.find(
      (file) =>
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024
    );

    if (invalid) {
      setError(
        "Images must be JPG, PNG or WEBP and each file must be below 5MB."
      );
      event.target.value = "";
      return;
    }

    setError("");
    setFiles(chosen);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!seller) return;

    setBusy(true);
    setProgress("Checking account...");
    setError("");

    const form = new FormData(event.currentTarget);
    let productId: string | null = null;
    const uploadedPaths: string[] = [];

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Your login session expired.");

      const name = String(form.get("name") || "").trim();
      const sku = String(form.get("sku") || "").trim().toUpperCase();
      const categoryId = String(form.get("category_id") || "") || null;
      const brandId = String(form.get("brand_id") || "") || null;
      const description = String(form.get("description") || "").trim();
      const shortDescription = String(
        form.get("short_description") || ""
      ).trim();

      const price = Number(form.get("price"));
      const compareAtPriceValue = String(form.get("compare_at_price") || "");
      const compareAtPrice = compareAtPriceValue
        ? Number(compareAtPriceValue)
        : null;
      const stock = Number(form.get("stock_on_hand"));
      const weight = Number(form.get("weight_kg"));
      const length = Number(form.get("length_cm"));
      const width = Number(form.get("width_cm"));
      const height = Number(form.get("height_cm"));
      const warranty = Number(form.get("warranty_months") || 0);

      if (!name || !sku) throw new Error("Product name and SKU are required.");
      if (!Number.isFinite(price) || price < 0)
        throw new Error("Enter a valid price.");
      if (!Number.isInteger(stock) || stock < 0)
        throw new Error("Stock must be a whole number.");
      if (files.length === 0)
        throw new Error("Upload at least one product image.");

      setProgress("Uploading product images...");

      const imageRows: Array<{
        image_url: string;
        alt_text: string;
        sort_order: number;
      }> = [];

      for (const [index, file] of files.entries()) {
        const path = `${seller.id}/${crypto.randomUUID()}-${safeFileName(
          file.name
        )}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) throw uploadError;
        uploadedPaths.push(path);

        const { data: publicData } = supabase.storage
          .from("product-images")
          .getPublicUrl(path);

        imageRows.push({
          image_url: publicData.publicUrl,
          alt_text: name,
          sort_order: index,
        });
      }

      setProgress("Creating product...");

      const slug = `${slugify(name) || "product"}-${Date.now().toString(36)}`;

      const { data: product, error: productError } = await supabase
        .from("products")
        .insert({
          seller_id: seller.id,
          category_id: categoryId,
          brand_id: brandId,
          name,
          slug,
          short_description: shortDescription || null,
          description: description || null,
          primary_image_url: imageRows[0].image_url,
          warranty_months: warranty,
          status: "pending_review",
          created_by: user.id,
        })
        .select("id")
        .single();

      if (productError) throw productError;
      productId = product.id;

      const { error: variantError } = await supabase
        .from("product_variants")
        .insert({
          product_id: product.id,
          seller_id: seller.id,
          title: "Default",
          sku,
          price,
          compare_at_price: compareAtPrice,
          stock_on_hand: stock,
          stock_reserved: 0,
          weight_kg: Number.isFinite(weight) ? weight : 0,
          length_cm: Number.isFinite(length) ? length : 0,
          width_cm: Number.isFinite(width) ? width : 0,
          height_cm: Number.isFinite(height) ? height : 0,
          is_active: true,
        });

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

      setProgress("Product submitted for MIVO review.");
      router.push("/sellers/products");
      router.refresh();
    } catch (caught) {
      if (productId) {
        await supabase.from("products").delete().eq("id", productId);
      }

      if (uploadedPaths.length > 0) {
        await supabase.storage.from("product-images").remove(uploadedPaths);
      }

      setError(
        caught instanceof Error ? caught.message : "Unable to upload product."
      );
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="container pageShell">
        <section className={styles.panel}>Loading seller tools...</section>
      </main>
    );
  }

  return (
    <main className="container pageShell">
      <section className={styles.panel}>
        <div className={styles.titleRow}>
          <div>
            <span className={styles.eyebrow}>SELLER PRODUCT UPLOAD</span>
            <h1>Add a product</h1>
            <p>
              Shop: {seller?.shop_name}. New listings are submitted as pending
              review and are not public until MIVO approves them.
            </p>
          </div>
          <Link href="/sellers/products" className={styles.secondaryButton}>
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
                placeholder="Example: NIKKEN ULTIMAX Front Absorber Set"
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

            <label>
              <span>Category</span>
              <select name="category_id" defaultValue="">
                <option value="">Choose category</option>
                {categories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>SKU *</span>
              <input name="sku" required placeholder="NIKKEN-MYVI-ABS-FR" />
            </label>

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

            <label className={`${styles.fullWidth} ${styles.fileBox}`}>
              <span>Product images * (maximum 8)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={chooseImages}
              />
              <span className={styles.help}>
                JPG, PNG or WEBP. Maximum 5MB per image. The first image becomes
                the main product image.
              </span>
            </label>
          </div>

          {previews.length > 0 && (
            <div className={styles.previewGrid}>
              {previews.map((preview, index) => (
                <img src={preview} alt={`Preview ${index + 1}`} key={preview} />
              ))}
            </div>
          )}

          {progress && <p className={styles.success}>{progress}</p>}
          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button className="redButton" type="submit" disabled={busy}>
              {busy ? "Uploading..." : "Submit product for review"}
            </button>
            <Link href="/sellers/products" className={styles.secondaryButton}>
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}

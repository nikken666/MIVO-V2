"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../../Admin.module.css";

type Option = { id: string; name: string };
type Store = { id: string; shop_name: string; status: string };
type Category = { id: string; name: string; parent_id: string | null };

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

  return (base || "product") + "." + extension;
}

export default function AdminNewProductPage() {
  const router = useRouter();

  const [store, setStore] = useState<Store | null>(null);
  const [brands, setBrands] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = "/login?next=/admin/products/new";
          return;
        }

        const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
        if (adminError) throw adminError;
        if (!isAdmin) {
          window.location.href = "/";
          return;
        }

        const [
          { data: sellerData, error: sellerError },
          { data: brandData, error: brandError },
          { data: categoryData, error: categoryError },
        ] = await Promise.all([
          supabase
            .from("sellers")
            .select("id, shop_name, status")
            .eq("status", "approved")
            .limit(1)
            .maybeSingle(),
          supabase
            .from("brands")
            .select("id, name")
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("categories")
            .select("id, name, parent_id")
            .eq("is_active", true)
            .order("sort_order"),
        ]);

        if (sellerError || brandError || categoryError) {
          throw sellerError || brandError || categoryError;
        }

        setStore((sellerData as Store | null) || null);
        setBrands((brandData as Option[] | null) || []);
        setCategories((categoryData as Category[] | null) || []);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load product form.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  function chooseImages(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []).slice(0, 8);
    const invalid = selected.find(
      (file) =>
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024
    );

    if (invalid) {
      setError("Images must be JPG, PNG or WEBP and below 5MB each.");
      event.target.value = "";
      return;
    }

    setError("");
    setFiles(selected);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const supabase = createClient();
    const form = new FormData(event.currentTarget);
    const sellerId = store?.id || "";
    const name = String(form.get("name") || "").trim();
    const sku = String(form.get("sku") || "").trim().toUpperCase();
    const price = Number(form.get("price"));
    const stock = Number(form.get("stock_on_hand"));
    const categoryId = String(form.get("category_id") || "");
    const brandId = String(form.get("brand_id") || "");
    const status = String(form.get("status") || "draft");

    setBusy(true);
    setError("");
    setProgress("Checking product information...");

    const uploadedPaths: string[] = [];
    let productId: string | null = null;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Your admin session expired.");
      if (!sellerId) throw new Error("MIVO Direct Store is not configured.");
      if (!name) throw new Error("Product name is required.");
      if (!categoryId) throw new Error("Choose a category.");
      if (!sku) throw new Error("SKU is required.");
      if (!Number.isFinite(price) || price < 0) throw new Error("Enter a valid price.");
      if (!Number.isInteger(stock) || stock < 0) throw new Error("Stock must be a whole number.");
      if (files.length === 0) throw new Error("Upload at least one product image.");

      setProgress("Uploading product images...");

      const imageRows: Array<{
        image_url: string;
        alt_text: string;
        sort_order: number;
      }> = [];

      for (const [index, file] of files.entries()) {
        const path =
          sellerId +
          "/" +
          crypto.randomUUID() +
          "-" +
          safeFileName(file.name);

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

      const slug = (slugify(name) || "product") + "-" + Date.now().toString(36);

      const { data: product, error: productError } = await supabase
        .from("products")
        .insert({
          seller_id: sellerId,
          category_id: categoryId,
          brand_id: brandId || null,
          name,
          slug,
          short_description: String(form.get("short_description") || "").trim() || null,
          description: String(form.get("description") || "").trim() || null,
          primary_image_url: imageRows[0].image_url,
          warranty_months: Number(form.get("warranty_months") || 0),
          variation_1_name: null,
          variation_2_name: null,
          status,
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
          seller_id: sellerId,
          title: "Default",
          variation_1_value: null,
          variation_2_value: null,
          sku,
          price,
          compare_at_price: String(form.get("compare_at_price") || "")
            ? Number(form.get("compare_at_price"))
            : null,
          stock_on_hand: stock,
          stock_reserved: 0,
          weight_kg: Number(form.get("weight_kg") || 0),
          length_cm: Number(form.get("length_cm") || 0),
          width_cm: Number(form.get("width_cm") || 0),
          height_cm: Number(form.get("height_cm") || 0),
          is_active: true,
        });

      if (variantError) throw variantError;

      const { error: imageError } = await supabase.from("product_images").insert(
        imageRows.map((image) => ({
          product_id: product.id,
          ...image,
        }))
      );

      if (imageError) throw imageError;

      setProgress("Product created successfully.");
      router.push("/admin/products");
      router.refresh();
    } catch (caught) {
      if (productId) {
        await supabase.from("products").delete().eq("id", productId);
      }

      if (uploadedPaths.length > 0) {
        await supabase.storage.from("product-images").remove(uploadedPaths);
      }

      const message =
        caught && typeof caught === "object" && "message" in caught
          ? String((caught as { message?: string }).message || "Upload failed.")
          : "Unable to upload product.";

      setError(message);
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.adminShell}>
      <div className="container">
        <div className={styles.adminTop}>
          <div>
            <span className={styles.adminEyebrow}>MIVO ADMIN · NEW LISTING</span>
            <h1>Add Product</h1>
            <p>Create a product directly from the MIVO Admin Console.</p>
          </div>
          <a href="/admin/products" className={styles.adminSecondary}>
            ← PRODUCTS
          </a>
        </div>

        <nav className={styles.adminNav}>
          <a href="/admin">Dashboard</a>
          <a href="/admin/products">Products</a>
          <a href="/admin/products/new">Add Product</a>
          
          <a href="/admin/orders">Orders</a>
        </nav>

        <section className={styles.adminPanel}>
          {loading ? (
            <p className={styles.adminNotice}>Loading product tools...</p>
          ) : (
            <form className={styles.adminForm} onSubmit={submit}>
              <div className={styles.adminFormGrid}>
                <label className={styles.adminField + " " + styles.full}>
                  <span>PRODUCT NAME *</span>
                  <input
                    name="name"
                    required
                    placeholder="Example: NIKKEN Drive Shaft RH"
                  />
                </label>

                <div className={styles.adminField}>
                  <span>STORE</span>
                  <div className={styles.adminNotice}>
                    {store?.shop_name || "MIVO DIRECT STORE"}
                  </div>
                </div>

                <label className={styles.adminField}>
                  <span>LISTING STATUS</span>
                  <select name="status" defaultValue="active">
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="pending_review">Pending review</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>

                <label className={styles.adminField}>
                  <span>BRAND</span>
                  <select name="brand_id" defaultValue="">
                    <option value="">No brand</option>
                    {brands.map((brand) => (
                      <option value={brand.id} key={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.adminField}>
                  <span>CATEGORY *</span>
                  <select name="category_id" defaultValue="" required>
                    <option value="">Choose category</option>
                    {categories.map((category) => (
                      <option value={category.id} key={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.adminField + " " + styles.full}>
                  <span>SHORT DESCRIPTION</span>
                  <input
                    name="short_description"
                    placeholder="Short catalogue description"
                  />
                </label>

                <label className={styles.adminField + " " + styles.full}>
                  <span>DESCRIPTION</span>
                  <textarea
                    name="description"
                    placeholder="Product specifications, features and details"
                  />
                </label>

                <div className={styles.adminSectionTitle + " " + styles.full}>
                  SKU & INVENTORY
                </div>

                <label className={styles.adminField}>
                  <span>SKU *</span>
                  <input name="sku" required placeholder="NKK-DS-001" />
                </label>

                <label className={styles.adminField}>
                  <span>SELLING PRICE (RM) *</span>
                  <input name="price" type="number" min="0" step="0.01" required />
                </label>

                <label className={styles.adminField}>
                  <span>ORIGINAL PRICE (RM)</span>
                  <input name="compare_at_price" type="number" min="0" step="0.01" />
                </label>

                <label className={styles.adminField}>
                  <span>STOCK *</span>
                  <input
                    name="stock_on_hand"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue="0"
                    required
                  />
                </label>

                <label className={styles.adminField}>
                  <span>WARRANTY (MONTHS)</span>
                  <input
                    name="warranty_months"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue="0"
                  />
                </label>

                <label className={styles.adminField}>
                  <span>WEIGHT (KG)</span>
                  <input name="weight_kg" type="number" min="0" step="0.001" />
                </label>

                <label className={styles.adminField}>
                  <span>LENGTH (CM)</span>
                  <input name="length_cm" type="number" min="0" step="0.01" />
                </label>

                <label className={styles.adminField}>
                  <span>WIDTH (CM)</span>
                  <input name="width_cm" type="number" min="0" step="0.01" />
                </label>

                <label className={styles.adminField}>
                  <span>HEIGHT (CM)</span>
                  <input name="height_cm" type="number" min="0" step="0.01" />
                </label>

                <div className={styles.adminSectionTitle + " " + styles.full}>
                  PRODUCT IMAGES
                </div>

                <label className={styles.adminField + " " + styles.full}>
                  <div className={styles.adminUploadBox}>
                    <span>UPLOAD IMAGES * · MAXIMUM 8</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={chooseImages}
                    />
                    <p style={{ margin: "8px 0 0", color: "#858b8f", fontSize: 10 }}>
                      JPG, PNG or WEBP · maximum 5MB each · first image becomes the main image.
                    </p>
                  </div>
                </label>
              </div>

              {previews.length > 0 ? (
                <div className={styles.adminPreviewGrid}>
                  {previews.map((preview, index) => (
                    <img src={preview} alt={"Preview " + (index + 1)} key={preview} />
                  ))}
                </div>
              ) : null}

              {progress ? <p className={styles.adminSuccess}>{progress}</p> : null}
              {error ? <p className={styles.adminError}>{error}</p> : null}

              <div className={styles.adminActions}>
                <button className={styles.adminAction} type="submit" disabled={busy}>
                  {busy ? "UPLOADING..." : "CREATE PRODUCT"}
                </button>
                <a href="/admin/products" className={styles.adminSecondary}>
                  CANCEL
                </a>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

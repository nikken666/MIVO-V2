"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CategoryPicker, { type CategoryNode } from "@/components/CategoryPicker";
import AdminFitmentBuilder, {
  type AdminFitmentDraft,
} from "@/components/AdminFitmentBuilder";
import styles from "../../../Admin.module.css";

type Option = { id: string; name: string };

type EditProduct = {
  id: string;
  seller_id: string;
  category_id: string | null;
  brand_id: string | null;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  primary_image_url: string | null;
  warranty_months: number;
  status: string;
  published_at: string | null;
  variation_1_name: string | null;
  variation_2_name: string | null;
};

type EditVariant = {
  id: string;
  title: string | null;
  variation_1_value: string | null;
  variation_2_value: string | null;
  sku: string;
  price: number | string;
  compare_at_price: number | string | null;
  stock_on_hand: number;
  stock_reserved: number;
  low_stock_threshold: number | string;
  weight_kg: number | string;
  length_cm: number | string;
  width_cm: number | string;
  height_cm: number | string;
};

type VehicleRow = {
  id: string;
  generation_key: string | null;
  make: string;
  model: string;
  generation: string | null;
  variant: string | null;
  transmission: string | null;
  year_from: number | null;
  year_to: number | null;
};

type FitmentRow = {
  id: string;
  vehicle_id: string;
  variant_id: string | null;
  year_from: number | null;
  year_to: number | null;
};

type ImageDraft = {
  key: string;
  id?: string;
  url: string;
  file?: File;
};

type ProductImageRow = {
  id: string;
  image_url: string;
  sort_order: number;
};

type ShippingValues = {
  weight_kg: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
};

function availableStock(variant: EditVariant) {
  return Math.max(
    0,
    Number(variant.stock_on_hand || 0) -
      Number(variant.stock_reserved || 0)
  );
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

function storagePathFromUrl(url: string) {
  const marker = "/storage/v1/object/public/product-images/";
  const index = url.indexOf(marker);
  if (index < 0) return "";
  return decodeURIComponent(url.slice(index + marker.length));
}

function variantTitle(variant: EditVariant) {
  return (
    variant.title?.trim() ||
    [variant.variation_1_value, variant.variation_2_value]
      .filter(Boolean)
      .join(" / ") ||
    "Default"
  );
}

function shippingFromVariant(variant?: EditVariant): ShippingValues {
  return {
    weight_kg: String(Number(variant?.weight_kg || 0)),
    length_cm: String(Number(variant?.length_cm || 0)),
    width_cm: String(Number(variant?.width_cm || 0)),
    height_cm: String(Number(variant?.height_cm || 0)),
  };
}

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const productId = params?.id || "";

  const [product, setProduct] = useState<EditProduct | null>(null);
  const [variants, setVariants] = useState<EditVariant[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [vehicleRows, setVehicleRows] = useState<VehicleRow[]>([]);
  const [fitments, setFitments] = useState<AdminFitmentDraft[]>([]);
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [originalImageRows, setOriginalImageRows] = useState<ProductImageRow[]>([]);

  const [shippingMode, setShippingMode] = useState<"same" | "different">("same");
  const [sharedShipping, setSharedShipping] = useState<ShippingValues>({
    weight_kg: "0",
    length_cm: "0",
    width_cm: "0",
    height_cm: "0",
  });

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!productId) return;

    const supabase = createClient();

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href =
            "/login?next=/admin/products/" +
            encodeURIComponent(productId) +
            "/edit";
          return;
        }

        const { data: isAdmin, error: adminError } =
          await supabase.rpc("is_admin");

        if (adminError) throw adminError;
        if (!isAdmin) {
          window.location.href = "/";
          return;
        }

        const [
          productResult,
          variantResult,
          brandResult,
          categoryResult,
          vehicleResult,
          fitmentResult,
          imageResult,
        ] = await Promise.all([
          supabase
            .from("products")
            .select(
              "id, seller_id, category_id, brand_id, name, slug, short_description, description, primary_image_url, warranty_months, status, published_at, variation_1_name, variation_2_name"
            )
            .eq("id", productId)
            .single(),
          supabase
            .from("product_variants")
            .select(
              "id, title, variation_1_value, variation_2_value, sku, price, compare_at_price, stock_on_hand, stock_reserved, low_stock_threshold, weight_kg, length_cm, width_cm, height_cm"
            )
            .eq("product_id", productId)
            .order("created_at"),
          supabase
            .from("brands")
            .select("id, name")
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("categories")
            .select("id, name, slug, parent_id, sort_order")
            .eq("is_active", true)
            .order("sort_order"),
          supabase
            .from("vehicles")
            .select(
              "id, generation_key, make, model, generation, variant, transmission, year_from, year_to"
            )
            .eq("is_active", true),
          supabase
            .from("product_vehicle_fitments")
            .select("id, vehicle_id, variant_id, year_from, year_to")
            .eq("product_id", productId),
          supabase
            .from("product_images")
            .select("id, image_url, sort_order")
            .eq("product_id", productId)
            .order("sort_order"),
        ]);

        if (
          productResult.error ||
          variantResult.error ||
          brandResult.error ||
          categoryResult.error ||
          vehicleResult.error ||
          fitmentResult.error ||
          imageResult.error
        ) {
          throw (
            productResult.error ||
            variantResult.error ||
            brandResult.error ||
            categoryResult.error ||
            vehicleResult.error ||
            fitmentResult.error ||
            imageResult.error
          );
        }

        const productRow = productResult.data as EditProduct;
        const variantRows =
          (variantResult.data as EditVariant[] | null) || [];
        const vehicles =
          (vehicleResult.data as VehicleRow[] | null) || [];
        const fitmentRows =
          (fitmentResult.data as FitmentRow[] | null) || [];
        const imageRows =
          (imageResult.data as ProductImageRow[] | null) || [];

        const mappedFitments = fitmentRows
          .map((row) => {
            const vehicle = vehicles.find(
              (item) => item.id === row.vehicle_id
            );
            if (!vehicle?.generation_key) return null;

            const yearFrom =
              row.year_from ??
              vehicle.year_from ??
              new Date().getFullYear();
            const yearTo =
              row.year_to ??
              vehicle.year_to ??
              new Date().getFullYear();

            const targetVariant = row.variant_id
              ? variantRows.find((item) => item.id === row.variant_id)
              : null;
            const targetVariantLabel = targetVariant
              ? [variantTitle(targetVariant), targetVariant.sku]
                  .filter(Boolean)
                  .join(" · ")
              : null;

            return {
              key: [
                row.variant_id || "ALL-SKU",
                vehicle.generation_key,
                yearFrom,
                yearTo,
                vehicle.variant || "",
                vehicle.transmission || "",
              ].join("::"),
              generationKey: vehicle.generation_key,
              make: vehicle.make,
              model: vehicle.model,
              generation: vehicle.generation || vehicle.model,
              yearFrom,
              yearTo,
              variant: vehicle.variant || "ALL",
              transmission: vehicle.transmission || "ALL",
              targetVariantKey: row.variant_id,
              targetVariantId: row.variant_id,
              targetVariantLabel,
            } satisfies AdminFitmentDraft;
          })
          .filter(
            (row): row is AdminFitmentDraft => Boolean(row)
          );

        const uniqueFitments = Array.from(
          new Map(
            mappedFitments.map((item) => [item.key, item])
          ).values()
        );

        const dimensionSignatures = new Set(
          variantRows.map((variant) =>
            [
              Number(variant.weight_kg || 0),
              Number(variant.length_cm || 0),
              Number(variant.width_cm || 0),
              Number(variant.height_cm || 0),
            ].join("|")
          )
        );

        setProduct(productRow);
        setVariants(variantRows);
        setBrands((brandResult.data as Option[] | null) || []);
        setCategories(
          (categoryResult.data as CategoryNode[] | null) || []
        );
        setVehicleRows(vehicles);
        setFitments(uniqueFitments);
        setOriginalImageRows(imageRows);
        setImages(
          imageRows.map((row) => ({
            key: row.id,
            id: row.id,
            url: row.image_url,
          }))
        );

        setSharedShipping(shippingFromVariant(variantRows[0]));
        setShippingMode(
          variantRows.length > 1 && dimensionSignatures.size > 1
            ? "different"
            : "same"
        );
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load product."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [productId]);

  useEffect(() => {
    return () => {
      images.forEach((image) => {
        if (image.file && image.url.startsWith("blob:")) {
          URL.revokeObjectURL(image.url);
        }
      });
    };
  }, [images]);

  const variationLabel = useMemo(() => {
    const names = [
      product?.variation_1_name,
      product?.variation_2_name,
    ].filter(Boolean);

    return names.length > 0
      ? names.join(" + ")
      : "No variation names";
  }, [product]);

  function updateVariant(
    id: string,
    field:
      | "title"
      | "sku"
      | "price"
      | "compare_at_price"
      | "stock_on_hand"
      | "low_stock_threshold"
      | "weight_kg"
      | "length_cm"
      | "width_cm"
      | "height_cm",
    value: string
  ) {
    setVariants((current) =>
      current.map((variant) => {
        if (variant.id !== id) return variant;

        if (field === "stock_on_hand") {
          const available = Number(value);
          return {
            ...variant,
            stock_on_hand:
              (Number.isFinite(available) ? available : 0) +
              Number(variant.stock_reserved || 0),
          };
        }

        return { ...variant, [field]: value };
      })
    );
  }

  function chooseImages(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    const room = Math.max(0, 8 - images.length);
    const chosen = selected.slice(0, room);
    const invalid = chosen.find(
      (file) =>
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024
    );

    if (invalid) {
      setError("Images must be JPG, PNG or WEBP and below 5MB each.");
      event.target.value = "";
      return;
    }

    const next = chosen.map((file) => ({
      key: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      file,
    }));

    setImages((current) => [...current, ...next]);
    setError("");
    event.target.value = "";
  }

  function moveImage(index: number, direction: -1 | 1) {
    setImages((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;

      const next = [...current];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  }

  function removeImage(index: number) {
    setImages((current) => {
      const target = current[index];
      if (target?.file && target.url.startsWith("blob:")) {
        URL.revokeObjectURL(target.url);
      }
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function shippingValue(
    field: keyof ShippingValues,
    value: string
  ) {
    setSharedShipping((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) return;

    const form = new FormData(event.currentTarget);
    const supabase = createClient();

    setBusy(true);
    setError("");
    setMessage("Saving product...");

    const newlyUploadedPaths: string[] = [];

    try {
      if (images.length === 0) {
        throw new Error("Keep at least one product image.");
      }

      const name = String(form.get("name") || "").trim();
      const categoryId = String(form.get("category_id") || "");
      const brandId = String(form.get("brand_id") || "");
      const status = String(form.get("status") || "draft");

      if (!name) throw new Error("Product name is required.");
      if (!categoryId) throw new Error("Choose the final category.");

      for (const variant of variants) {
        const price = Number(variant.price);
        const stock = availableStock(variant);
        const threshold = Number(variant.low_stock_threshold || 0);

        if (!variant.sku.trim()) {
          throw new Error("Every variation needs a SKU.");
        }
        if (!Number.isFinite(price) || price < 0) {
          throw new Error("Invalid price for " + variant.sku);
        }
        if (!Number.isInteger(stock) || stock < 0) {
          throw new Error("Invalid stock for " + variant.sku);
        }
        if (!Number.isInteger(threshold) || threshold < 0) {
          throw new Error(
            "Invalid low stock threshold for " + variant.sku
          );
        }
      }

      setMessage("Uploading product images...");

      const finalImages: Array<{
        key: string;
        id?: string;
        url: string;
      }> = [];

      for (const image of images) {
        if (!image.file) {
          finalImages.push({
            key: image.key,
            id: image.id,
            url: image.url,
          });
          continue;
        }

        const path =
          product.seller_id +
          "/" +
          crypto.randomUUID() +
          "-" +
          safeFileName(image.file.name);

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, image.file, {
            cacheControl: "3600",
            upsert: false,
            contentType: image.file.type,
          });

        if (uploadError) throw uploadError;
        newlyUploadedPaths.push(path);

        const { data: publicData } = supabase.storage
          .from("product-images")
          .getPublicUrl(path);

        finalImages.push({
          key: image.key,
          url: publicData.publicUrl,
        });
      }

      const currentExistingIds = new Set(
        finalImages
          .map((image) => image.id)
          .filter((id): id is string => Boolean(id))
      );

      const removedImageRows = originalImageRows.filter(
        (row) => !currentExistingIds.has(row.id)
      );

      if (removedImageRows.length > 0) {
        const { error: deleteRowsError } = await supabase
          .from("product_images")
          .delete()
          .in(
            "id",
            removedImageRows.map((row) => row.id)
          );

        if (deleteRowsError) throw deleteRowsError;

        const paths = removedImageRows
          .map((row) => storagePathFromUrl(row.image_url))
          .filter(Boolean);

        if (paths.length > 0) {
          await supabase.storage.from("product-images").remove(paths);
        }
      }

      for (const [index, image] of finalImages.entries()) {
        if (image.id) {
          const { error: updateImageError } = await supabase
            .from("product_images")
            .update({
              sort_order: index,
              alt_text: name,
            })
            .eq("id", image.id);

          if (updateImageError) throw updateImageError;
        } else {
          const { error: insertImageError } = await supabase
            .from("product_images")
            .insert({
              product_id: product.id,
              image_url: image.url,
              alt_text: name,
              sort_order: index,
            });

          if (insertImageError) throw insertImageError;
        }
      }

      setMessage("Saving product information...");

      const { error: productError } = await supabase
        .from("products")
        .update({
          name,
          category_id: categoryId,
          brand_id: brandId || null,
          short_description:
            String(form.get("short_description") || "").trim() || null,
          description:
            String(form.get("description") || "").trim() || null,
          warranty_months: Number(form.get("warranty_months") || 0),
          variation_1_name:
            String(form.get("variation_1_name") || "").trim() || null,
          variation_2_name:
            String(form.get("variation_2_name") || "").trim() || null,
          primary_image_url: finalImages[0].url,
          status,
          published_at:
            status === "active"
              ? product.published_at || new Date().toISOString()
              : product.published_at,
        })
        .eq("id", product.id);

      if (productError) throw productError;

      for (const variant of variants) {
        const compareAt =
          variant.compare_at_price === null ||
          variant.compare_at_price === ""
            ? null
            : Number(variant.compare_at_price);

        const dimensions =
          shippingMode === "same"
            ? {
                weight_kg: Number(sharedShipping.weight_kg || 0),
                length_cm: Number(sharedShipping.length_cm || 0),
                width_cm: Number(sharedShipping.width_cm || 0),
                height_cm: Number(sharedShipping.height_cm || 0),
              }
            : {
                weight_kg: Number(variant.weight_kg || 0),
                length_cm: Number(variant.length_cm || 0),
                width_cm: Number(variant.width_cm || 0),
                height_cm: Number(variant.height_cm || 0),
              };

        const { error: variantError } = await supabase
          .from("product_variants")
          .update({
            title: variant.title?.trim() || "Default",
            sku: variant.sku.trim().toUpperCase(),
            price: Number(variant.price),
            compare_at_price: compareAt,
            stock_on_hand: Number(variant.stock_on_hand || 0),
            low_stock_threshold: Number(
              variant.low_stock_threshold || 0
            ),
            ...dimensions,
          })
          .eq("id", variant.id);

        if (variantError) throw variantError;
      }

      const { error: deleteFitmentError } = await supabase
        .from("product_vehicle_fitments")
        .delete()
        .eq("product_id", product.id);

      if (deleteFitmentError) throw deleteFitmentError;

      if (fitments.length > 0) {
        const rows = fitments.map((fitment) => {
          const vehicle = vehicleRows.find(
            (row) =>
              row.generation_key === fitment.generationKey &&
              row.variant === fitment.variant &&
              row.transmission === fitment.transmission
          );

          if (!vehicle) {
            throw new Error(
              "Vehicle fitment could not be resolved for " +
                fitment.make +
                " " +
                fitment.model +
                " " +
                fitment.variant
            );
          }

          return {
            product_id: product.id,
            vehicle_id: vehicle.id,
            variant_id:
              fitment.targetVariantId ||
              fitment.targetVariantKey ||
              null,
            year_from: fitment.yearFrom,
            year_to: fitment.yearTo,
            notes: null,
          };
        });

        const { error: insertFitmentError } = await supabase
          .from("product_vehicle_fitments")
          .insert(rows);

        if (insertFitmentError) throw insertFitmentError;
      }

      setMessage("Product updated successfully.");
      window.location.assign("/admin/products");
    } catch (caught) {
      if (newlyUploadedPaths.length > 0) {
        await supabase.storage
          .from("product-images")
          .remove(newlyUploadedPaths);
      }

      setMessage("");
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save product."
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.adminShell}>
        <div className={styles.adminWorkspace}>
          <section className={styles.adminContent}>
            <p className={styles.adminNotice}>
              Loading product editor...
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className={styles.adminShell}>
        <div className={styles.adminWorkspace}>
          <section className={styles.adminContent}>
            <p className={styles.adminError}>
              {error || "Product not found."}
            </p>
            <a
              href="/admin/products"
              className={styles.adminSecondary}
            >
              ← PRODUCTS
            </a>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <aside className={styles.adminSidebar}>
          <a href="/admin" className={styles.adminBrand}>
            <span>MIVO</span>
            <small>STORE CONTROL</small>
          </a>

          <nav className={styles.adminSideNav}>
            <a href="/admin">
              <span>01</span>Dashboard
            </a>
            <a href="/admin/orders">
              <span>02</span>Orders
            </a>
            <a href="/admin/products" className={styles.active}>
              <span>03</span>Products
            </a>
            <a href="/admin/products/new">
              <span>04</span>Add Product
            </a>
          </nav>

          <div className={styles.adminSidebarFoot}>
            <span>EDIT MODE</span>
            <strong>{variants.length} SKU</strong>
            <a href={"/products/" + product.slug}>
              OPEN PRODUCT ↗
            </a>
          </div>
        </aside>

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>
                MIVO STORE CONTROL · EDIT PRODUCT
              </span>
              <h1>Edit Product</h1>
              <p>
                Edit photos, listing information, SKU, price, stock,
                shipping size and vehicle compatibility.
              </p>
            </div>

            <a
              href="/admin/products"
              className={styles.adminSecondary}
            >
              ← PRODUCTS
            </a>
          </header>

          <form onSubmit={save}>
            <div className={styles.productEditorLayout}>
              <nav className={styles.productEditorNav}>
                <span>EDIT PRODUCT</span>
                <a href="#media">01 · Media</a>
                <a href="#basic">02 · Basic Info</a>
                <a href="#variations">03 · Variations</a>
                <a href="#fitment">04 · Vehicle Fitment</a>
                <a href="#shipping">05 · Shipping</a>
                <a href="#publish">06 · Publish</a>
              </nav>

              <div className={styles.productEditorMain}>
                <section id="media" className={styles.productEditorCard}>
                  <div className={styles.productEditorCardHead}>
                    <div>
                      <span>01 · PRODUCT MEDIA</span>
                      <h2>Product Images</h2>
                      <p>
                        Shopee-style image management. First image is the
                        main image. Add, remove or reorder up to 8 photos.
                      </p>
                    </div>
                    <b>{images.length}/8</b>
                  </div>

                  <div className={styles.editImagesGrid}>
                    {images.map((image, index) => (
                      <div className={styles.editImageCard} key={image.key}>
                        <img src={image.url} alt={"Product " + (index + 1)} />
                        {index === 0 ? (
                          <span className={styles.editImageMainBadge}>
                            MAIN
                          </span>
                        ) : null}

                        <div className={styles.editImageControls}>
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveImage(index, -1)}
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                          >
                            REMOVE
                          </button>
                          <button
                            type="button"
                            disabled={index === images.length - 1}
                            onClick={() => moveImage(index, 1)}
                          >
                            →
                          </button>
                        </div>
                      </div>
                    ))}

                    {images.length < 8 ? (
                      <label className={styles.editImageAdd}>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          style={{ display: "none" }}
                          onChange={chooseImages}
                        />
                        <div>
                          <strong>+</strong>
                          <span>ADD IMAGE</span>
                        </div>
                      </label>
                    ) : null}
                  </div>

                  <p className={styles.editImageHint}>
                    JPG / PNG / WEBP · maximum 5MB each · maximum 8 images.
                  </p>
                </section>

                <section id="basic" className={styles.productEditorCard}>
                  <div className={styles.productEditorCardHead}>
                    <div>
                      <span>02 · BASIC INFORMATION</span>
                      <h2>Product Information</h2>
                      <p>
                        Edit title, category, brand and product description.
                      </p>
                    </div>
                  </div>

                  <div className={styles.adminFormGrid}>
                    <label className={styles.adminField + " " + styles.full}>
                      <span>PRODUCT NAME *</span>
                      <input
                        name="name"
                        required
                        maxLength={160}
                        defaultValue={product.name}
                      />
                    </label>

                    <CategoryPicker
                      categories={categories}
                      name="category_id"
                      required
                      initialSelectedId={product.category_id || ""}
                    />

                    <label className={styles.adminField}>
                      <span>BRAND</span>
                      <select
                        name="brand_id"
                        defaultValue={product.brand_id || ""}
                      >
                        <option value="">No brand</option>
                        {brands.map((brand) => (
                          <option value={brand.id} key={brand.id}>
                            {brand.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.adminField + " " + styles.full}>
                      <span>SHORT DESCRIPTION</span>
                      <input
                        name="short_description"
                        maxLength={240}
                        defaultValue={product.short_description || ""}
                      />
                    </label>

                    <label className={styles.adminField + " " + styles.full}>
                      <span>DESCRIPTION</span>
                      <textarea
                        name="description"
                        defaultValue={product.description || ""}
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>VARIATION 1 NAME</span>
                      <input
                        name="variation_1_name"
                        defaultValue={product.variation_1_name || ""}
                        placeholder="Example: Car Model"
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>VARIATION 2 NAME</span>
                      <input
                        name="variation_2_name"
                        defaultValue={product.variation_2_name || ""}
                        placeholder="Example: Position"
                      />
                    </label>
                  </div>
                </section>

                <section id="variations" className={styles.productEditorCard}>
                  <div className={styles.productEditorCardHead}>
                    <div>
                      <span>03 · SALES INFORMATION</span>
                      <h2>SKU Variations</h2>
                      <p>
                        Edit each existing SKU, price and available stock.
                      </p>
                    </div>
                    <b>{variants.length} SKU</b>
                  </div>

                  <div className={styles.adminTableWrap}>
                    <table
                      className={
                        styles.adminTable + " " + styles.editVariantTable
                      }
                    >
                      <thead>
                        <tr>
                          <th>VARIATION</th>
                          <th>SKU</th>
                          <th>PRICE</th>
                          <th>ORIGINAL</th>
                          <th>STOCK</th>
                          <th>LOW STOCK</th>
                        </tr>
                      </thead>

                      <tbody>
                        {variants.map((variant) => (
                          <tr key={variant.id}>
                            <td>
                              <input
                                value={variant.title || "Default"}
                                onChange={(event) =>
                                  updateVariant(
                                    variant.id,
                                    "title",
                                    event.target.value
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                value={variant.sku}
                                onChange={(event) =>
                                  updateVariant(
                                    variant.id,
                                    "sku",
                                    event.target.value
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={String(variant.price)}
                                onChange={(event) =>
                                  updateVariant(
                                    variant.id,
                                    "price",
                                    event.target.value
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={variant.compare_at_price ?? ""}
                                onChange={(event) =>
                                  updateVariant(
                                    variant.id,
                                    "compare_at_price",
                                    event.target.value
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={availableStock(variant)}
                                onChange={(event) =>
                                  updateVariant(
                                    variant.id,
                                    "stock_on_hand",
                                    event.target.value
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={String(
                                  variant.low_stock_threshold
                                )}
                                onChange={(event) =>
                                  updateVariant(
                                    variant.id,
                                    "low_stock_threshold",
                                    event.target.value
                                  )
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="fitment" className={styles.productEditorCard}>
                  <div className={styles.productEditorCardHead}>
                    <div>
                      <span>04 · VEHICLE FITMENT</span>
                      <h2>Compatible Vehicles</h2>
                      <p>
                        Add or remove the vehicles that can use this product.
                      </p>
                    </div>
                  </div>

                  <AdminFitmentBuilder
                    value={fitments}
                    onChange={setFitments}
                    variantOptions={variants.map((variant) => ({
                      key: variant.id,
                      dbId: variant.id,
                      label: variantTitle(variant),
                      sku: variant.sku,
                    }))}
                  />
                </section>

                <section id="shipping" className={styles.productEditorCard}>
                  <div className={styles.productEditorCardHead}>
                    <div>
                      <span>05 · SHIPPING</span>
                      <h2>Weight & Parcel Size</h2>
                      <p>
                        Choose whether every variation shares one parcel size
                        or each SKU has its own measurements.
                      </p>
                    </div>
                  </div>

                  <div className={styles.shippingMode}>
                    <button
                      type="button"
                      className={
                        shippingMode === "same" ? styles.active : ""
                      }
                      onClick={() => setShippingMode("same")}
                    >
                      <strong>SAME SIZE FOR ALL VARIATIONS</strong>
                      <span>
                        One weight and one L × W × H will be applied to every SKU.
                      </span>
                    </button>

                    <button
                      type="button"
                      className={
                        shippingMode === "different" ? styles.active : ""
                      }
                      onClick={() => setShippingMode("different")}
                    >
                      <strong>DIFFERENT SIZE BY VARIATION</strong>
                      <span>
                        Each SKU can have its own weight and parcel dimensions.
                      </span>
                    </button>
                  </div>

                  {shippingMode === "same" ? (
                    <div className={styles.editorTwoCol}>
                      <label className={styles.adminField}>
                        <span>WEIGHT (KG)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={sharedShipping.weight_kg}
                          onChange={(event) =>
                            shippingValue(
                              "weight_kg",
                              event.target.value
                            )
                          }
                        />
                      </label>

                      <label className={styles.adminField}>
                        <span>LENGTH (CM)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={sharedShipping.length_cm}
                          onChange={(event) =>
                            shippingValue(
                              "length_cm",
                              event.target.value
                            )
                          }
                        />
                      </label>

                      <label className={styles.adminField}>
                        <span>WIDTH (CM)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={sharedShipping.width_cm}
                          onChange={(event) =>
                            shippingValue(
                              "width_cm",
                              event.target.value
                            )
                          }
                        />
                      </label>

                      <label className={styles.adminField}>
                        <span>HEIGHT (CM)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={sharedShipping.height_cm}
                          onChange={(event) =>
                            shippingValue(
                              "height_cm",
                              event.target.value
                            )
                          }
                        />
                      </label>
                    </div>
                  ) : (
                    <div className={styles.adminTableWrap}>
                      <table className={styles.variantDimensionTable}>
                        <thead>
                          <tr>
                            <th>VARIATION</th>
                            <th>WEIGHT KG</th>
                            <th>LENGTH CM</th>
                            <th>WIDTH CM</th>
                            <th>HEIGHT CM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variants.map((variant) => (
                            <tr key={variant.id}>
                              <td>
                                <strong>{variantTitle(variant)}</strong>
                                <div>{variant.sku}</div>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  value={String(variant.weight_kg || 0)}
                                  onChange={(event) =>
                                    updateVariant(
                                      variant.id,
                                      "weight_kg",
                                      event.target.value
                                    )
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={String(variant.length_cm || 0)}
                                  onChange={(event) =>
                                    updateVariant(
                                      variant.id,
                                      "length_cm",
                                      event.target.value
                                    )
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={String(variant.width_cm || 0)}
                                  onChange={(event) =>
                                    updateVariant(
                                      variant.id,
                                      "width_cm",
                                      event.target.value
                                    )
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={String(variant.height_cm || 0)}
                                  onChange={(event) =>
                                    updateVariant(
                                      variant.id,
                                      "height_cm",
                                      event.target.value
                                    )
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section id="publish" className={styles.productEditorCard}>
                  <div className={styles.productEditorCardHead}>
                    <div>
                      <span>06 · PUBLISH</span>
                      <h2>Listing Status</h2>
                      <p>
                        Update warranty and storefront visibility.
                      </p>
                    </div>
                  </div>

                  <div className={styles.editorTwoCol}>
                    <label className={styles.adminField}>
                      <span>WARRANTY (MONTHS)</span>
                      <input
                        name="warranty_months"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={product.warranty_months || 0}
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>STATUS</span>
                      <select
                        name="status"
                        defaultValue={product.status}
                      >
                        <option value="active">
                          Active · publish now
                        </option>
                        <option value="draft">Draft</option>
                        <option value="pending_review">
                          Pending review
                        </option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                  </div>
                </section>

                {message ? (
                  <p className={styles.adminSuccess}>{message}</p>
                ) : null}
                {error ? (
                  <p className={styles.adminError}>{error}</p>
                ) : null}

                <div className={styles.productEditorFooter}>
                  <a
                    href="/admin/products"
                    className={styles.adminSecondary}
                  >
                    CANCEL
                  </a>
                  <button
                    type="submit"
                    className={styles.adminAction}
                    disabled={busy}
                  >
                    {busy ? "SAVING..." : "SAVE CHANGES"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

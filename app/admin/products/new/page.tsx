"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import CategoryPicker, { type CategoryNode } from "@/components/CategoryPicker";
import AdminFitmentBuilder, {
  type AdminFitmentDraft,
} from "@/components/AdminFitmentBuilder";
import styles from "../../Admin.module.css";

type Option = { id: string; name: string };
type Store = { id: string; shop_name: string; status: string };
type VehicleDbRow = {
  id: string;
  generation_key: string | null;
  variant: string | null;
  transmission: string | null;
};

type VariantDraft = {
  key: string;
  value1: string;
  value2: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  stock: string;
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

  return (base || "product") + "." + extension;
}

function splitOptions(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function combinationKey(value1: string, value2: string) {
  return value1 + "::" + value2;
}

export default function AdminNewProductPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [brands, setBrands] = useState<Option[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [vehicleRows, setVehicleRows] = useState<VehicleDbRow[]>([]);

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [fitments, setFitments] = useState<AdminFitmentDraft[]>([]);

  const [hasVariations, setHasVariations] = useState(false);
  const [variation1Name, setVariation1Name] = useState("");
  const [variation1Text, setVariation1Text] = useState("");
  const [useVariation2, setUseVariation2] = useState(false);
  const [variation2Name, setVariation2Name] = useState("");
  const [variation2Text, setVariation2Text] = useState("");
  const [variantRows, setVariantRows] = useState<VariantDraft[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const variation1Options = useMemo(
    () => splitOptions(variation1Text),
    [variation1Text]
  );
  const variation2Options = useMemo(
    () => splitOptions(variation2Text),
    [variation2Text]
  );

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

        const { data: isAdmin, error: adminError } = await supabase.rpc(
          "is_admin"
        );
        if (adminError) throw adminError;
        if (!isAdmin) {
          window.location.href = "/";
          return;
        }

        const [
          { data: sellerData, error: sellerError },
          { data: brandData, error: brandError },
          { data: categoryData, error: categoryError },
          { data: vehicleData, error: vehicleError },
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
            .select("id, name, slug, parent_id, sort_order")
            .eq("is_active", true)
            .order("sort_order"),
          supabase
            .from("vehicles")
            .select("id, generation_key, variant, transmission")
            .eq("is_active", true),
        ]);

        if (sellerError || brandError || categoryError || vehicleError) {
          throw sellerError || brandError || categoryError || vehicleError;
        }

        setStore((sellerData as Store | null) || null);
        setBrands((brandData as Option[] | null) || []);
        setCategories((categoryData as CategoryNode[] | null) || []);
        setVehicleRows((vehicleData as VehicleDbRow[] | null) || []);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load product editor."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);

    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  useEffect(() => {
    if (!hasVariations || variation1Options.length === 0) {
      setVariantRows([]);
      return;
    }

    const secondValues =
      useVariation2 && variation2Options.length > 0
        ? variation2Options
        : [""];

    setVariantRows((current) => {
      const previous = new Map(current.map((row) => [row.key, row]));

      return variation1Options.flatMap((value1) =>
        secondValues.map((value2) => {
          const key = combinationKey(value1, value2);
          return (
            previous.get(key) || {
              key,
              value1,
              value2,
              sku: "",
              price: "",
              compareAtPrice: "",
              stock: "0",
            }
          );
        })
      );
    });
  }, [
    hasVariations,
    useVariation2,
    variation1Options,
    variation2Options,
  ]);

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

  function updateVariant(
    key: string,
    field: "sku" | "price" | "compareAtPrice" | "stock",
    value: string
  ) {
    setVariantRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, [field]: value } : row
      )
    );
  }

  function prepareVariants(form: FormData) {
    if (!hasVariations) {
      const sku = String(form.get("sku") || "").trim().toUpperCase();
      const price = Number(form.get("price"));
      const stock = Number(form.get("stock_on_hand"));
      const originalText = String(form.get("compare_at_price") || "");

      if (!sku) throw new Error("SKU is required.");
      if (!Number.isFinite(price) || price < 0) {
        throw new Error("Enter a valid selling price.");
      }
      if (!Number.isInteger(stock) || stock < 0) {
        throw new Error("Stock must be a whole number.");
      }

      return [
        {
          draftKey: "__default__",
          title: "Default",
          variation_1_value: null,
          variation_2_value: null,
          sku,
          price,
          compare_at_price: originalText ? Number(originalText) : null,
          stock_on_hand: stock,
        },
      ];
    }

    if (!variation1Name.trim() || variation1Options.length === 0) {
      throw new Error("Variation 1 needs a name and at least one option.");
    }

    if (
      useVariation2 &&
      (!variation2Name.trim() || variation2Options.length === 0)
    ) {
      throw new Error("Variation 2 needs a name and at least one option.");
    }

    if (variantRows.length === 0 || variantRows.length > 100) {
      throw new Error("Variation combinations must be between 1 and 100.");
    }

    const prepared = variantRows.map((row) => {
      const sku = row.sku.trim().toUpperCase();
      const price = Number(row.price);
      const stock = Number(row.stock);

      if (!sku) {
        throw new Error(
          "SKU is required for " +
            [row.value1, row.value2].filter(Boolean).join(" / ")
        );
      }
      if (!Number.isFinite(price) || price < 0) {
        throw new Error("Invalid price for " + sku);
      }
      if (!Number.isInteger(stock) || stock < 0) {
        throw new Error("Invalid stock for " + sku);
      }

      return {
        draftKey: row.key,
        title: [row.value1, row.value2].filter(Boolean).join(" / "),
        variation_1_value: row.value1,
        variation_2_value: row.value2 || null,
        sku,
        price,
        compare_at_price: row.compareAtPrice
          ? Number(row.compareAtPrice)
          : null,
        stock_on_hand: stock,
      };
    });

    const duplicate = prepared.find(
      (row, index) =>
        prepared.findIndex((other) => other.sku === row.sku) !== index
    );

    if (duplicate) {
      throw new Error("Duplicate SKU: " + duplicate.sku);
    }

    return prepared;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const supabase = createClient();
    const form = new FormData(event.currentTarget);
    const sellerId = store?.id || "";
    const name = String(form.get("name") || "").trim();
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
      if (!categoryId) throw new Error("Choose the final product category.");
      if (files.length === 0) {
        throw new Error("Upload at least one product image.");
      }

      const preparedVariants = prepareVariants(form);

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

      setProgress("Creating product and SKU combinations...");

      const slug =
        (slugify(name) || "product") + "-" + Date.now().toString(36);

      const { data: product, error: productError } = await supabase
        .from("products")
        .insert({
          seller_id: sellerId,
          category_id: categoryId,
          brand_id: brandId || null,
          name,
          slug,
          short_description:
            String(form.get("short_description") || "").trim() || null,
          description:
            String(form.get("description") || "").trim() || null,
          primary_image_url: imageRows[0].image_url,
          warranty_months: Number(form.get("warranty_months") || 0),
          variation_1_name: hasVariations
            ? variation1Name.trim()
            : null,
          variation_2_name:
            hasVariations && useVariation2
              ? variation2Name.trim()
              : null,
          status,
          published_at: status === "active" ? new Date().toISOString() : null,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (productError) throw productError;
      productId = product.id;

      const sharedMeasurements = {
        weight_kg: Number(form.get("weight_kg") || 0),
        length_cm: Number(form.get("length_cm") || 0),
        width_cm: Number(form.get("width_cm") || 0),
        height_cm: Number(form.get("height_cm") || 0),
      };

      const variantInsertRows = preparedVariants.map(
        ({ draftKey: _draftKey, ...variant }) => ({
          product_id: product.id,
          seller_id: sellerId,
          ...variant,
          stock_reserved: 0,
          low_stock_threshold: Number(
            form.get("low_stock_threshold") || 5
          ),
          ...sharedMeasurements,
          is_active: true,
        })
      );

      const {
        data: insertedVariants,
        error: variantError,
      } = await supabase
        .from("product_variants")
        .insert(variantInsertRows)
        .select("id, sku");

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

      if (fitments.length > 0) {
        setProgress("Saving vehicle compatibility...");

        const fitmentRows = fitments.map((fitment) => {
          const vehicle = vehicleRows.find(
            (row) =>
              row.generation_key === fitment.generationKey &&
              row.variant === fitment.variant &&
              row.transmission === fitment.transmission
          );

          if (!vehicle) {
            throw new Error(
              "Vehicle data could not be resolved for " +
                fitment.make +
                " " +
                fitment.model +
                " " +
                fitment.variant
            );
          }

          let targetVariantId: string | null = null;

          if (fitment.targetVariantKey) {
            const preparedTarget = preparedVariants.find(
              (item) => item.draftKey === fitment.targetVariantKey
            );

            if (!preparedTarget) {
              throw new Error(
                "The selected fitment SKU no longer exists."
              );
            }

            const insertedTarget = (insertedVariants || []).find(
              (item) => item.sku === preparedTarget.sku
            );

            if (!insertedTarget?.id) {
              throw new Error(
                "Could not connect fitment to SKU " +
                  preparedTarget.sku
              );
            }

            targetVariantId = insertedTarget.id;
          }

          return {
            product_id: product.id,
            vehicle_id: vehicle.id,
            variant_id: targetVariantId,
            year_from: fitment.yearFrom,
            year_to: fitment.yearTo,
            notes: null,
          };
        });

        const { error: fitmentError } = await supabase
          .from("product_vehicle_fitments")
          .insert(fitmentRows);

        if (fitmentError) throw fitmentError;
      }

      setProgress("Product created successfully.");
      window.location.assign("/admin/products");
    } catch (caught) {
      if (productId) {
        await supabase.from("products").delete().eq("id", productId);
      }

      if (uploadedPaths.length > 0) {
        await supabase.storage.from("product-images").remove(uploadedPaths);
      }

      const message =
        caught && typeof caught === "object" && "message" in caught
          ? String(
              (caught as { message?: string }).message || "Upload failed."
            )
          : "Unable to upload product.";

      setError(message);
      setProgress("");
    } finally {
      setBusy(false);
    }
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
            <a href="/admin/products">
              <span>03</span>Products
            </a>
            <a href="/admin/products/new" className={styles.active}>
              <span>04</span>Add Product
            </a>
            <a href="/admin/shipping">
              <span>05</span>
              Shipping
            </a>
          </nav>

          <div className={styles.adminSidebarFoot}>
            <span>STORE MODE</span>
            <strong>{store?.shop_name || "MIVO DIRECT"}</strong>
            <a href="/">OPEN STOREFRONT ↗</a>
          </div>
        </aside>

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>
                MIVO STORE CONTROL · CATALOGUE
              </span>
              <h1>Add Product</h1>
              <p>
                Shopee-style listing editor with SKU variations and vehicle
                compatibility.
              </p>
            </div>
            <a href="/admin/products" className={styles.adminSecondary}>
              ← PRODUCTS
            </a>
          </header>

          {loading ? (
            <p className={styles.adminNotice}>Loading product editor...</p>
          ) : (
            <form onSubmit={submit}>
              <div className={styles.productEditorLayout}>
                <nav className={styles.productEditorNav}>
                  <span>PRODUCT SETUP</span>
                  <a href="#media">01 · Media</a>
                  <a href="#basic">02 · Basic Info</a>
                  <a href="#sales">03 · Sales Info</a>
                  <a href="#fitment">04 · Vehicle Fitment</a>
                  <a href="#shipping">05 · Shipping</a>
                  <a href="#publish">06 · Publish</a>
                </nav>

                <div className={styles.productEditorMain}>
                  <section
                    id="media"
                    className={styles.productEditorCard}
                  >
                    <div className={styles.productEditorCardHead}>
                      <div>
                        <span>01 · PRODUCT MEDIA</span>
                        <h2>Product Images</h2>
                        <p>
                          Upload up to 8 images. The first image becomes the
                          main listing photo.
                        </p>
                      </div>
                      <b>{files.length}/8</b>
                    </div>

                    <div className={styles.imageUploadGrid}>
                      {previews.map((preview, index) => (
                        <div
                          className={styles.imageUploadTile}
                          key={preview}
                        >
                          <img
                            src={preview}
                            alt={"Product " + (index + 1)}
                          />
                        </div>
                      ))}

                      {files.length < 8 ? (
                        <label
                          className={
                            styles.imageUploadTile +
                            " " +
                            styles.imageUploadButton
                          }
                        >
                          <input
                            style={{ display: "none" }}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            onChange={chooseImages}
                          />
                          <div>
                            <strong>+</strong>
                            <small>ADD IMAGE</small>
                          </div>
                        </label>
                      ) : null}
                    </div>

                    <p className={styles.editorHint}>
                      JPG / PNG / WEBP · maximum 5MB each.
                    </p>
                  </section>

                  <section
                    id="basic"
                    className={styles.productEditorCard}
                  >
                    <div className={styles.productEditorCardHead}>
                      <div>
                        <span>02 · BASIC INFORMATION</span>
                        <h2>Product Information</h2>
                        <p>
                          Similar to Shopee Seller Centre: title, category,
                          brand and description.
                        </p>
                      </div>
                    </div>

                    <div className={styles.adminFormGrid}>
                      <label
                        className={
                          styles.adminField + " " + styles.full
                        }
                      >
                        <span>PRODUCT NAME *</span>
                        <input
                          name="name"
                          required
                          maxLength={160}
                          placeholder="Example: NIKKEN JAPAN PERODUA BEZZA FRONT DRIVE SHAFT RH"
                        />
                      </label>

                      <CategoryPicker
                        categories={categories}
                        name="category_id"
                        required
                      />

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

                      <label
                        className={
                          styles.adminField + " " + styles.full
                        }
                      >
                        <span>SHORT DESCRIPTION</span>
                        <input
                          name="short_description"
                          maxLength={240}
                          placeholder="Short summary shown near the product title"
                        />
                      </label>

                      <label
                        className={
                          styles.adminField + " " + styles.full
                        }
                      >
                        <span>PRODUCT DESCRIPTION</span>
                        <textarea
                          name="description"
                          placeholder="Specifications, product features, package contents, warranty information..."
                        />
                      </label>
                    </div>
                  </section>

                  <section
                    id="sales"
                    className={styles.productEditorCard}
                  >
                    <div className={styles.productEditorCardHead}>
                      <div>
                        <span>03 · SALES INFORMATION</span>
                        <h2>Price, Stock & Variations</h2>
                        <p>
                          Use a simple SKU or create variation combinations like
                          Shopee.
                        </p>
                      </div>
                      {hasVariations ? (
                        <b>{variantRows.length} SKU COMBINATIONS</b>
                      ) : null}
                    </div>

                    <label className={styles.variationToggle}>
                      <div>
                        <strong>This product has variations</strong>
                        <span>
                          Example: Car Model, Position, Side, Size or Type.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={hasVariations}
                        onChange={(e) =>
                          setHasVariations(e.target.checked)
                        }
                      />
                    </label>

                    {!hasVariations ? (
                      <div
                        className={styles.editorTwoCol}
                        style={{ marginTop: 14 }}
                      >
                        <label className={styles.adminField}>
                          <span>SKU *</span>
                          <input
                            name="sku"
                            placeholder="NKK-DS-BEZZA-RH"
                          />
                        </label>

                        <label className={styles.adminField}>
                          <span>SELLING PRICE (RM) *</span>
                          <input
                            name="price"
                            type="number"
                            min="0"
                            step="0.01"
                          />
                        </label>

                        <label className={styles.adminField}>
                          <span>ORIGINAL PRICE (RM)</span>
                          <input
                            name="compare_at_price"
                            type="number"
                            min="0"
                            step="0.01"
                          />
                        </label>

                        <label className={styles.adminField}>
                          <span>STOCK *</span>
                          <input
                            name="stock_on_hand"
                            type="number"
                            min="0"
                            step="1"
                            defaultValue="0"
                          />
                        </label>
                      </div>
                    ) : (
                      <>
                        <div className={styles.variationSimpleGrid}>
                          <label className={styles.adminField}>
                            <span>VARIATION 1 NAME *</span>
                            <input
                              value={variation1Name}
                              onChange={(e) =>
                                setVariation1Name(e.target.value)
                              }
                              placeholder="Example: Car Model"
                            />
                          </label>

                          <label className={styles.adminField}>
                            <span>VARIATION 1 OPTIONS *</span>
                            <input
                              value={variation1Text}
                              onChange={(e) =>
                                setVariation1Text(e.target.value)
                              }
                              placeholder="Example: AXIA, BEZZA, MYVI"
                            />
                            <small className={styles.editorHint}>
                              Separate options with commas.
                            </small>
                          </label>
                        </div>

                        <label
                          className={styles.variationToggle}
                          style={{ marginTop: 12 }}
                        >
                          <div>
                            <strong>Add Variation 2</strong>
                            <span>
                              Example: Position = FRONT LH, FRONT RH.
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={useVariation2}
                            onChange={(e) =>
                              setUseVariation2(e.target.checked)
                            }
                          />
                        </label>

                        {useVariation2 ? (
                          <div className={styles.variationSimpleGrid}>
                            <label className={styles.adminField}>
                              <span>VARIATION 2 NAME *</span>
                              <input
                                value={variation2Name}
                                onChange={(e) =>
                                  setVariation2Name(e.target.value)
                                }
                                placeholder="Example: Position"
                              />
                            </label>

                            <label className={styles.adminField}>
                              <span>VARIATION 2 OPTIONS *</span>
                              <input
                                value={variation2Text}
                                onChange={(e) =>
                                  setVariation2Text(e.target.value)
                                }
                                placeholder="Example: LH, RH"
                              />
                            </label>
                          </div>
                        ) : null}

                        {variantRows.length > 0 ? (
                          <div
                            className={styles.adminTableWrap}
                            style={{ marginTop: 16 }}
                          >
                            <table className={styles.adminTable}>
                              <thead>
                                <tr>
                                  <th>{variation1Name || "VARIATION 1"}</th>
                                  <th>
                                    {useVariation2
                                      ? variation2Name || "VARIATION 2"
                                      : "—"}
                                  </th>
                                  <th>SKU *</th>
                                  <th>PRICE *</th>
                                  <th>ORIGINAL</th>
                                  <th>STOCK *</th>
                                </tr>
                              </thead>
                              <tbody>
                                {variantRows.map((row) => (
                                  <tr key={row.key}>
                                    <td>{row.value1}</td>
                                    <td>{row.value2 || "—"}</td>
                                    <td>
                                      <input
                                        value={row.sku}
                                        onChange={(e) =>
                                          updateVariant(
                                            row.key,
                                            "sku",
                                            e.target.value
                                          )
                                        }
                                      />
                                    </td>
                                    <td>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={row.price}
                                        onChange={(e) =>
                                          updateVariant(
                                            row.key,
                                            "price",
                                            e.target.value
                                          )
                                        }
                                      />
                                    </td>
                                    <td>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={row.compareAtPrice}
                                        onChange={(e) =>
                                          updateVariant(
                                            row.key,
                                            "compareAtPrice",
                                            e.target.value
                                          )
                                        }
                                      />
                                    </td>
                                    <td>
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={row.stock}
                                        onChange={(e) =>
                                          updateVariant(
                                            row.key,
                                            "stock",
                                            e.target.value
                                          )
                                        }
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </>
                    )}

                    <div
                      className={styles.editorTwoCol}
                      style={{ marginTop: 14 }}
                    >
                      <label className={styles.adminField}>
                        <span>LOW STOCK ALERT</span>
                        <input
                          name="low_stock_threshold"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue="5"
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
                    </div>
                  </section>

                  <section
                    id="fitment"
                    className={styles.productEditorCard}
                  >
                    <div className={styles.productEditorCardHead}>
                      <div>
                        <span>04 · VEHICLE FITMENT</span>
                        <h2>Compatible Vehicles</h2>
                        <p>
                          This is what powers “FITS YOUR VEHICLE” on the
                          storefront.
                        </p>
                      </div>
                    </div>

                    <AdminFitmentBuilder
                      value={fitments}
                      onChange={setFitments}
                      variantOptions={
                        hasVariations
                          ? variantRows.map((variant) => ({
                              key: variant.key,
                              label:
                                [variant.value1, variant.value2]
                                  .filter(Boolean)
                                  .join(" / ") || "Default",
                              sku: variant.sku || "SKU not set",
                            }))
                          : []
                      }
                    />
                  </section>

                  <section
                    id="shipping"
                    className={styles.productEditorCard}
                  >
                    <div className={styles.productEditorCardHead}>
                      <div>
                        <span>05 · SHIPPING</span>
                        <h2>Parcel Information</h2>
                        <p>
                          Used later for courier quotations and shipping rules.
                        </p>
                      </div>
                    </div>

                    <div className={styles.editorTwoCol}>
                      <label className={styles.adminField}>
                        <span>WEIGHT (KG)</span>
                        <input
                          name="weight_kg"
                          type="number"
                          min="0"
                          step="0.001"
                        />
                      </label>

                      <label className={styles.adminField}>
                        <span>LENGTH (CM)</span>
                        <input
                          name="length_cm"
                          type="number"
                          min="0"
                          step="0.01"
                        />
                      </label>

                      <label className={styles.adminField}>
                        <span>WIDTH (CM)</span>
                        <input
                          name="width_cm"
                          type="number"
                          min="0"
                          step="0.01"
                        />
                      </label>

                      <label className={styles.adminField}>
                        <span>HEIGHT (CM)</span>
                        <input
                          name="height_cm"
                          type="number"
                          min="0"
                          step="0.01"
                        />
                      </label>
                    </div>
                  </section>

                  <section
                    id="publish"
                    className={styles.productEditorCard}
                  >
                    <div className={styles.productEditorCardHead}>
                      <div>
                        <span>06 · PUBLISH</span>
                        <h2>Listing Status</h2>
                        <p>
                          Save as draft first or publish directly to the MIVO
                          catalogue.
                        </p>
                      </div>
                    </div>

                    <div className={styles.editorTwoCol}>
                      <div className={styles.adminField}>
                        <span>STORE</span>
                        <div className={styles.adminNotice}>
                          {store?.shop_name || "MIVO DIRECT STORE"}
                        </div>
                      </div>

                      <label className={styles.adminField}>
                        <span>STATUS</span>
                        <select name="status" defaultValue="active">
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

                  {progress ? (
                    <p className={styles.adminSuccess}>{progress}</p>
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
                      className={styles.adminAction}
                      type="submit"
                      disabled={busy}
                    >
                      {busy ? "SAVING PRODUCT..." : "SAVE PRODUCT"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CategoryPicker, {
  type CategoryNode,
} from "@/components/CategoryPicker";
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
  year_from: number | null;
  year_to: number | null;
};

function availableStock(variant: EditVariant) {
  return Math.max(
    0,
    Number(variant.stock_on_hand || 0) -
      Number(variant.stock_reserved || 0)
  );
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
            .select("id, vehicle_id, year_from, year_to")
            .eq("product_id", productId),
        ]);

        if (
          productResult.error ||
          variantResult.error ||
          brandResult.error ||
          categoryResult.error ||
          vehicleResult.error ||
          fitmentResult.error
        ) {
          throw (
            productResult.error ||
            variantResult.error ||
            brandResult.error ||
            categoryResult.error ||
            vehicleResult.error ||
            fitmentResult.error
          );
        }

        const productRow = productResult.data as EditProduct;
        const variantRows =
          (variantResult.data as EditVariant[] | null) || [];
        const vehicles =
          (vehicleResult.data as VehicleRow[] | null) || [];
        const fitmentRows =
          (fitmentResult.data as FitmentRow[] | null) || [];

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

            return {
              key: [
                vehicle.generation_key,
                yearFrom,
                yearTo,
                vehicle.variant || "",
                vehicle.transmission || "",
              ].join("::"),
              generationKey: vehicle.generation_key,
              make: vehicle.make,
              model: vehicle.model,
              generation:
                vehicle.generation || vehicle.model,
              yearFrom,
              yearTo,
              variant: vehicle.variant || "ALL",
              transmission:
                vehicle.transmission || "ALL",
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

        setProduct(productRow);
        setVariants(variantRows);
        setBrands(
          (brandResult.data as Option[] | null) || []
        );
        setCategories(
          (categoryResult.data as CategoryNode[] | null) || []
        );
        setVehicleRows(vehicles);
        setFitments(uniqueFitments);
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

  const firstVariant = variants[0];

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
      | "low_stock_threshold",
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

        return {
          ...variant,
          [field]: value,
        };
      })
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!product) return;

    const form = new FormData(event.currentTarget);
    const supabase = createClient();

    setBusy(true);
    setError("");
    setMessage("Saving product...");

    try {
      const name = String(form.get("name") || "").trim();
      const categoryId = String(
        form.get("category_id") || ""
      );
      const brandId = String(form.get("brand_id") || "");
      const status = String(form.get("status") || "draft");

      if (!name) throw new Error("Product name is required.");
      if (!categoryId) {
        throw new Error("Choose the final category.");
      }

      for (const variant of variants) {
        const price = Number(variant.price);
        const stock = availableStock(variant);
        const threshold = Number(
          variant.low_stock_threshold || 0
        );

        if (!variant.sku.trim()) {
          throw new Error("Every variation needs a SKU.");
        }
        if (!Number.isFinite(price) || price < 0) {
          throw new Error(
            "Invalid price for " + variant.sku
          );
        }
        if (!Number.isInteger(stock) || stock < 0) {
          throw new Error(
            "Invalid stock for " + variant.sku
          );
        }
        if (
          !Number.isInteger(threshold) ||
          threshold < 0
        ) {
          throw new Error(
            "Invalid low stock threshold for " +
              variant.sku
          );
        }
      }

      const { error: productError } = await supabase
        .from("products")
        .update({
          name,
          category_id: categoryId,
          brand_id: brandId || null,
          short_description:
            String(
              form.get("short_description") || ""
            ).trim() || null,
          description:
            String(form.get("description") || "").trim() ||
            null,
          warranty_months: Number(
            form.get("warranty_months") || 0
          ),
          variation_1_name:
            String(
              form.get("variation_1_name") || ""
            ).trim() || null,
          variation_2_name:
            String(
              form.get("variation_2_name") || ""
            ).trim() || null,
          status,
          published_at:
            status === "active"
              ? product.published_at ||
                new Date().toISOString()
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

        const { error: variantError } = await supabase
          .from("product_variants")
          .update({
            title:
              variant.title?.trim() || "Default",
            sku: variant.sku.trim().toUpperCase(),
            price: Number(variant.price),
            compare_at_price: compareAt,
            stock_on_hand: Number(
              variant.stock_on_hand || 0
            ),
            low_stock_threshold: Number(
              variant.low_stock_threshold || 0
            ),
            weight_kg: Number(
              form.get("weight_kg") || 0
            ),
            length_cm: Number(
              form.get("length_cm") || 0
            ),
            width_cm: Number(
              form.get("width_cm") || 0
            ),
            height_cm: Number(
              form.get("height_cm") || 0
            ),
          })
          .eq("id", variant.id);

        if (variantError) throw variantError;
      }

      const { error: deleteFitmentError } =
        await supabase
          .from("product_vehicle_fitments")
          .delete()
          .eq("product_id", product.id);

      if (deleteFitmentError) {
        throw deleteFitmentError;
      }

      if (fitments.length > 0) {
        const rows = fitments.map((fitment) => {
          const vehicle = vehicleRows.find(
            (row) =>
              row.generation_key ===
                fitment.generationKey &&
              row.variant === fitment.variant &&
              row.transmission ===
                fitment.transmission
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
            variant_id: null,
            year_from: fitment.yearFrom,
            year_to: fitment.yearTo,
            notes: null,
          };
        });

        const { error: insertFitmentError } =
          await supabase
            .from("product_vehicle_fitments")
            .insert(rows);

        if (insertFitmentError) {
          throw insertFitmentError;
        }
      }

      setMessage("Product updated successfully.");
      window.location.assign("/admin/products");
    } catch (caught) {
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
            <a
              href="/admin/products"
              className={styles.active}
            >
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
                Update listing information, SKU, price,
                stock and vehicle compatibility.
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
                <a href="#overview">01 · Overview</a>
                <a href="#basic">02 · Basic Info</a>
                <a href="#variations">
                  03 · Variations
                </a>
                <a href="#fitment">
                  04 · Vehicle Fitment
                </a>
                <a href="#shipping">05 · Shipping</a>
                <a href="#publish">06 · Publish</a>
              </nav>

              <div className={styles.productEditorMain}>
                <section
                  id="overview"
                  className={styles.productEditorCard}
                >
                  <div className={styles.productEditorCardHead}>
                    <div>
                      <span>01 · CURRENT LISTING</span>
                      <h2>Product Overview</h2>
                      <p>
                        Existing images remain attached to
                        this listing.
                      </p>
                    </div>
                  </div>

                  <div className={styles.editProductHero}>
                    {product.primary_image_url ? (
                      <img
                        src={product.primary_image_url}
                        alt={product.name}
                      />
                    ) : (
                      <div
                        className={
                          styles.adminProductThumb
                        }
                      />
                    )}

                    <div>
                      <strong>{product.name}</strong>
                      <span>
                        {variants.length} SKU ·{" "}
                        {variationLabel}
                      </span>
                      <span>
                        Product ID · {product.id}
                      </span>
                    </div>
                  </div>
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
                        Edit title, category, brand and
                        product description.
                      </p>
                    </div>
                  </div>

                  <div className={styles.adminFormGrid}>
                    <label
                      className={
                        styles.adminField +
                        " " +
                        styles.full
                      }
                    >
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
                      initialSelectedId={
                        product.category_id || ""
                      }
                    />

                    <label className={styles.adminField}>
                      <span>BRAND</span>
                      <select
                        name="brand_id"
                        defaultValue={
                          product.brand_id || ""
                        }
                      >
                        <option value="">No brand</option>
                        {brands.map((brand) => (
                          <option
                            value={brand.id}
                            key={brand.id}
                          >
                            {brand.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label
                      className={
                        styles.adminField +
                        " " +
                        styles.full
                      }
                    >
                      <span>SHORT DESCRIPTION</span>
                      <input
                        name="short_description"
                        maxLength={240}
                        defaultValue={
                          product.short_description || ""
                        }
                      />
                    </label>

                    <label
                      className={
                        styles.adminField +
                        " " +
                        styles.full
                      }
                    >
                      <span>DESCRIPTION</span>
                      <textarea
                        name="description"
                        defaultValue={
                          product.description || ""
                        }
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>VARIATION 1 NAME</span>
                      <input
                        name="variation_1_name"
                        defaultValue={
                          product.variation_1_name || ""
                        }
                        placeholder="Example: Car Model"
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>VARIATION 2 NAME</span>
                      <input
                        name="variation_2_name"
                        defaultValue={
                          product.variation_2_name || ""
                        }
                        placeholder="Example: Position"
                      />
                    </label>
                  </div>
                </section>

                <section
                  id="variations"
                  className={styles.productEditorCard}
                >
                  <div className={styles.productEditorCardHead}>
                    <div>
                      <span>03 · SALES INFORMATION</span>
                      <h2>SKU Variations</h2>
                      <p>
                        Edit each existing SKU, price and
                        available stock.
                      </p>
                    </div>
                    <b>{variants.length} SKU</b>
                  </div>

                  <div className={styles.adminTableWrap}>
                    <table
                      className={
                        styles.adminTable +
                        " " +
                        styles.editVariantTable
                      }
                    >
                      <thead>
                        <tr>
                          <th>VARIATION</th>
                          <th>SKU</th>
                          <th>PRICE</th>
                          <th>ORIGINAL PRICE</th>
                          <th>AVAILABLE STOCK</th>
                          <th>LOW STOCK</th>
                        </tr>
                      </thead>

                      <tbody>
                        {variants.map((variant) => (
                          <tr key={variant.id}>
                            <td>
                              <input
                                value={
                                  variant.title || "Default"
                                }
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
                                value={String(
                                  variant.price
                                )}
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
                                value={
                                  variant.compare_at_price ??
                                  ""
                                }
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
                                value={availableStock(
                                  variant
                                )}
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

                <section
                  id="fitment"
                  className={styles.productEditorCard}
                >
                  <div className={styles.productEditorCardHead}>
                    <div>
                      <span>04 · VEHICLE FITMENT</span>
                      <h2>Compatible Vehicles</h2>
                      <p>
                        Add or remove the vehicles that can
                        use this product.
                      </p>
                    </div>
                  </div>

                  <AdminFitmentBuilder
                    value={fitments}
                    onChange={setFitments}
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
                        These dimensions will be applied to
                        all current SKU variations.
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
                        defaultValue={
                          firstVariant
                            ? Number(
                                firstVariant.weight_kg || 0
                              )
                            : 0
                        }
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>LENGTH (CM)</span>
                      <input
                        name="length_cm"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={
                          firstVariant
                            ? Number(
                                firstVariant.length_cm || 0
                              )
                            : 0
                        }
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>WIDTH (CM)</span>
                      <input
                        name="width_cm"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={
                          firstVariant
                            ? Number(
                                firstVariant.width_cm || 0
                              )
                            : 0
                        }
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>HEIGHT (CM)</span>
                      <input
                        name="height_cm"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={
                          firstVariant
                            ? Number(
                                firstVariant.height_cm || 0
                              )
                            : 0
                        }
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
                        Update warranty and storefront
                        visibility.
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
                        defaultValue={
                          product.warranty_months || 0
                        }
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
                        <option value="draft">
                          Draft
                        </option>
                        <option value="pending_review">
                          Pending review
                        </option>
                        <option value="inactive">
                          Inactive
                        </option>
                      </select>
                    </label>
                  </div>
                </section>

                {message ? (
                  <p className={styles.adminSuccess}>
                    {message}
                  </p>
                ) : null}

                {error ? (
                  <p className={styles.adminError}>
                    {error}
                  </p>
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
                    {busy
                      ? "SAVING..."
                      : "SAVE CHANGES"}
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

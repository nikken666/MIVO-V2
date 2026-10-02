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
  is_universal_fitment: boolean;
  restricted_shipping_states: string[];
};

type EditVariant = {
  id: string;
  sort_order: number;
  title: string | null;
  variation_1_value: string | null;
  variation_2_value: string | null;
  variant_image_url: string | null;
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

type VariationImageEdit = {
  preview: string | null;
  file?: File;
  remove?: boolean;
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
  const [initialVariantIds, setInitialVariantIds] = useState<string[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [vehicleRows, setVehicleRows] = useState<VehicleRow[]>([]);
  const [fitments, setFitments] = useState<AdminFitmentDraft[]>([]);
  const [isUniversalFitment, setIsUniversalFitment] = useState(false);
  const [restrictedShippingStates, setRestrictedShippingStates] = useState<string[]>([]);
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [originalImageRows, setOriginalImageRows] = useState<ProductImageRow[]>([]);
  const [variationImageEdits, setVariationImageEdits] = useState<Record<string, VariationImageEdit>>({});

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
              "id, seller_id, category_id, brand_id, name, slug, short_description, description, primary_image_url, warranty_months, status, published_at, variation_1_name, variation_2_name, is_universal_fitment, restricted_shipping_states"
            )
            .eq("id", productId)
            .single(),
          supabase
            .from("product_variants")
            .select(
              "id, sort_order, title, variation_1_value, variation_2_value, variant_image_url, sku, price, compare_at_price, stock_on_hand, stock_reserved, low_stock_threshold, weight_kg, length_cm, width_cm, height_cm"
            )
            .eq("product_id", productId)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
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
          .map<AdminFitmentDraft | null>((row) => {
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
            };
          })
          .filter(
            (row): row is AdminFitmentDraft => row !== null
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
        setIsUniversalFitment(Boolean(productRow.is_universal_fitment));
        setRestrictedShippingStates(
          Array.isArray(productRow.restricted_shipping_states)
            ? productRow.restricted_shipping_states
            : []
        );
        setVariants(variantRows);
        setInitialVariantIds(variantRows.map((variant) => variant.id));
        setVariationImageEdits(() => {
          const next: Record<string, VariationImageEdit> = {};
          for (const variant of variantRows) {
            const option = variant.variation_1_value?.trim();
            if (!option || option in next) continue;
            next[option] = {
              preview: variant.variant_image_url || null,
            };
          }
          return next;
        });
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

  const variation1Options = useMemo(
    () =>
      Array.from(
        new Set(
          variants
            .map((variant) =>
              (
                variant.variation_1_value ||
                (!product?.variation_1_name ? variant.title : "") ||
                ""
              ).trim()
            )
            .filter(Boolean)
        )
      ),
    [variants, product?.variation_1_name]
  );

  const variation2Options = useMemo(
    () =>
      Array.from(
        new Set(
          variants
            .map((variant) => (variant.variation_2_value || "").trim())
            .filter(Boolean)
        )
      ),
    [variants]
  );

  function updateVariant(
    id: string,
    field:
      | "title"
      | "variation_1_value"
      | "variation_2_value"
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

  function setVariationName(axis: 1 | 2, value: string) {
    if (!product) return;

    if (axis === 1) {
      const hadName = Boolean(product.variation_1_name?.trim());

      setProduct({
        ...product,
        variation_1_name: value,
      });

      if (!hadName && value.trim()) {
        setVariants((current) =>
          current.map((variant, index) => ({
            ...variant,
            variation_1_value:
              variant.variation_1_value?.trim() ||
              variant.title?.trim() ||
              "OPTION " + String(index + 1),
          }))
        );
      }

      return;
    }

    setProduct({
      ...product,
      variation_2_name: value,
    });
  }

  function variationTemplate(source?: EditVariant): Omit<EditVariant, "id"> {
    const shipping =
      shippingMode === "same"
        ? sharedShipping
        : shippingFromVariant(source || variants[0]);

    return {
      sort_order: variants.length,
      title: "New variation",
      variation_1_value: null,
      variation_2_value: null,
      variant_image_url: null,
      sku: "",
      price: source?.price ?? 0,
      compare_at_price: source?.compare_at_price ?? null,
      stock_on_hand: 0,
      stock_reserved: 0,
      low_stock_threshold: source?.low_stock_threshold ?? 5,
      weight_kg: shipping.weight_kg,
      length_cm: shipping.length_cm,
      width_cm: shipping.width_cm,
      height_cm: shipping.height_cm,
    };
  }

  function renameVariationSetupOption(
    axis: 1 | 2,
    oldValue: string,
    value: string
  ) {
    const nextValue = value.trim();
    if (!nextValue || nextValue === oldValue) return;

    const existing =
      axis === 1 ? variation1Options : variation2Options;

    if (existing.some((option) => option === nextValue && option !== oldValue)) {
      setError("Variation option names must be unique.");
      return;
    }

    setVariants((current) =>
      current.map((variant) => {
        if (axis === 1) {
          const currentValue = (
            variant.variation_1_value ||
            (!product?.variation_1_name ? variant.title : "") ||
            ""
          ).trim();

          if (currentValue !== oldValue) return variant;

          return {
            ...variant,
            variation_1_value: product?.variation_1_name
              ? nextValue
              : variant.variation_1_value,
            title: product?.variation_1_name
              ? variant.title
              : nextValue,
          };
        }

        if ((variant.variation_2_value || "").trim() !== oldValue) {
          return variant;
        }

        return {
          ...variant,
          variation_2_value: nextValue,
        };
      })
    );

    if (axis === 1) {
      setVariationImageEdits((current) => {
        if (!current[oldValue] || current[nextValue]) return current;
        const next = { ...current };
        next[nextValue] = next[oldValue];
        delete next[oldValue];
        return next;
      });
    }

    setError("");
  }

  function addVariationSetupOption(axis: 1 | 2) {
    if (!product) return;

    if (axis === 1 && !product.variation_1_name?.trim()) {
      setError("Enter Variation 1 name first.");
      return;
    }

    if (axis === 2 && !product.variation_2_name?.trim()) {
      setError("Enter Variation 2 name first.");
      return;
    }

    const options = axis === 1 ? variation1Options : variation2Options;
    const nextValue = "OPTION " + String(options.length + 1);

    if (axis === 1) {
      const secondOptions =
        product.variation_2_name?.trim() && variation2Options.length
          ? variation2Options
          : [null];

      const additions = secondOptions.map((option2, index) => {
        const template = variationTemplate(variants[0]);
        return {
          id: "new-" + crypto.randomUUID(),
          ...template,
          sort_order: variants.length + index,
          title: [nextValue, option2].filter(Boolean).join(" / "),
          variation_1_value: nextValue,
          variation_2_value: option2,
        };
      });

      if (variants.length + additions.length > 50) {
        setError("A product can have up to 50 SKU variations.");
        return;
      }

      setVariants((current) => [...current, ...additions]);
      setError("");
      return;
    }

    if (variation1Options.length === 0) {
      setError("Add at least one Variation 1 option first.");
      return;
    }

    const additions = variation1Options.map((option1, index) => {
      const source = variants.find(
        (variant) =>
          (variant.variation_1_value || "").trim() === option1
      );
      const template = variationTemplate(source);

      return {
        id: "new-" + crypto.randomUUID(),
        ...template,
        sort_order: variants.length + index,
        title: option1 + " / " + nextValue,
        variation_1_value: option1,
        variation_2_value: nextValue,
      };
    });

    if (variants.length + additions.length > 50) {
      setError("A product can have up to 50 SKU variations.");
      return;
    }

    setVariants((current) => [...current, ...additions]);
    setError("");
  }

  function removeVariationSetupOption(axis: 1 | 2, value: string) {
    const removedIds = variants
      .filter((variant) => {
        if (axis === 1) {
          const option = (
            variant.variation_1_value ||
            (!product?.variation_1_name ? variant.title : "") ||
            ""
          ).trim();
          return option === value;
        }

        return (variant.variation_2_value || "").trim() === value;
      })
      .map((variant) => variant.id);

    setVariants((current) =>
      current.filter((variant) => !removedIds.includes(variant.id))
    );

    setFitments((current) =>
      current.filter(
        (fitment) =>
          !fitment.targetVariantKey ||
          !removedIds.includes(fitment.targetVariantKey)
      )
    );

    if (axis === 1) {
      setVariationImageEdits((current) => {
        const next = { ...current };
        delete next[value];
        return next;
      });
    }
  }

  function enableVariation2() {
    if (!product) return;

    if (!product.variation_1_name?.trim()) {
      setError("Set up Variation 1 before adding Variation 2.");
      return;
    }

    setProduct({
      ...product,
      variation_2_name: "Variation 2",
    });

    if (variation1Options.length > 0 && variation2Options.length === 0) {
      const defaultOption = "OPTION 1";
      setVariants((current) =>
        current.map((variant) => ({
          ...variant,
          variation_2_value: defaultOption,
          title:
            (variant.variation_1_value || variant.title || "Option") +
            " / " +
            defaultOption,
        }))
      );
    }

    setError("");
  }

  function disableVariation2() {
    if (!product) return;

    const kept = new Map<string, EditVariant>();

    for (const variant of variants) {
      const option1 = (
        variant.variation_1_value ||
        variant.title ||
        "Default"
      ).trim();

      if (!kept.has(option1)) {
        kept.set(option1, {
          ...variant,
          variation_2_value: null,
          title: option1,
        });
      }
    }

    const nextVariants = Array.from(kept.values()).map(
      (variant, index) => ({
        ...variant,
        sort_order: index,
      })
    );
    const keptIds = new Set(nextVariants.map((variant) => variant.id));

    setVariants(nextVariants);
    setFitments((current) =>
      current.filter(
        (fitment) =>
          !fitment.targetVariantKey ||
          keptIds.has(fitment.targetVariantKey)
      )
    );
    setProduct({
      ...product,
      variation_2_name: null,
    });
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

  function chooseVariationImage(
    option: string,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Variation images must be JPG, PNG or WEBP and below 5MB.");
      event.target.value = "";
      return;
    }

    setVariationImageEdits((current) => {
      const previous = current[option];
      if (previous?.file && previous.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(previous.preview);
      }
      return {
        ...current,
        [option]: {
          preview: URL.createObjectURL(file),
          file,
          remove: false,
        },
      };
    });

    setError("");
    event.target.value = "";
  }

  function removeVariationImage(option: string) {
    setVariationImageEdits((current) => {
      const previous = current[option];
      if (previous?.file && previous.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(previous.preview);
      }
      return {
        ...current,
        [option]: {
          preview: null,
          remove: true,
        },
      };
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

        if (
          product.variation_1_name &&
          !variant.variation_1_value?.trim()
        ) {
          throw new Error(
            "Every SKU needs a " + product.variation_1_name + " option."
          );
        }

        if (
          product.variation_2_name &&
          !variant.variation_2_value?.trim()
        ) {
          throw new Error(
            "Every SKU needs a " + product.variation_2_name + " option."
          );
        }
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

      const normalizedSkus = variants.map((variant) =>
        variant.sku.trim().toUpperCase()
      );
      const duplicateSku = normalizedSkus.find(
        (sku, index) => normalizedSkus.indexOf(sku) !== index
      );

      if (duplicateSku) {
        throw new Error(
          "SKU " + duplicateSku + " is used more than once in this product."
        );
      }

      const uniqueSkus = Array.from(new Set(normalizedSkus));
      const { data: existingSkuRows, error: skuLookupError } = await supabase
        .from("product_variants")
        .select("id, sku")
        .eq("seller_id", product.seller_id)
        .in("sku", uniqueSkus);

      if (skuLookupError) throw skuLookupError;

      const currentVariantIds = new Set(
        variants
          .filter((variant) => !variant.id.startsWith("new-"))
          .map((variant) => variant.id)
      );
      const conflictingSku = (existingSkuRows || []).find(
        (row) => !currentVariantIds.has(row.id)
      );

      if (conflictingSku) {
        throw new Error(
          "SKU " +
            conflictingSku.sku +
            " already exists. Please use a different SKU."
        );
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

      const variationImageUrls = new Map<string, string | null>();
      const oldVariationImageUrls = new Map<string, string>();

      for (const variant of variants) {
        const option = variant.variation_1_value?.trim();
        if (option && variant.variant_image_url && !oldVariationImageUrls.has(option)) {
          oldVariationImageUrls.set(option, variant.variant_image_url);
        }
      }

      for (const [option, edit] of Object.entries(variationImageEdits)) {
        if (edit.remove) {
          variationImageUrls.set(option, null);
          continue;
        }

        if (!edit.file) {
          variationImageUrls.set(option, edit.preview || null);
          continue;
        }

        const path =
          product.seller_id +
          "/variation-" +
          crypto.randomUUID() +
          "-" +
          safeFileName(edit.file.name);

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, edit.file, {
            cacheControl: "3600",
            upsert: false,
            contentType: edit.file.type,
          });

        if (uploadError) throw uploadError;
        newlyUploadedPaths.push(path);

        const { data: publicData } = supabase.storage
          .from("product-images")
          .getPublicUrl(path);

        variationImageUrls.set(option, publicData.publicUrl);
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
            product.variation_1_name?.trim() || null,
          variation_2_name:
            product.variation_2_name?.trim() || null,
          is_universal_fitment: isUniversalFitment,
          restricted_shipping_states: restrictedShippingStates,
          primary_image_url: finalImages[0].url,
          status,
          published_at:
            status === "active"
              ? product.published_at || new Date().toISOString()
              : product.published_at,
        })
        .eq("id", product.id);

      if (productError) throw productError;

      const variantIdMap = new Map<string, string>();

      for (const [variantIndex, variant] of variants.entries()) {
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

        const option1 = variant.variation_1_value?.trim() || null;
        const option2 = variant.variation_2_value?.trim() || null;
        const title =
          product.variation_1_name || product.variation_2_name
            ? [option1, option2].filter(Boolean).join(" / ") || "Default"
            : variant.title?.trim() || "Default";
        const variantImageUrl = option1
          ? variationImageUrls.has(option1)
            ? variationImageUrls.get(option1) ?? null
            : variant.variant_image_url ?? null
          : null;

        const payload = {
          sort_order: variantIndex,
          title,
          variation_1_value: option1,
          variation_2_value: option2,
          variant_image_url: variantImageUrl,
          sku: variant.sku.trim().toUpperCase(),
          price: Number(variant.price),
          compare_at_price: compareAt,
          stock_on_hand: Number(variant.stock_on_hand || 0),
          low_stock_threshold: Number(
            variant.low_stock_threshold || 0
          ),
          ...dimensions,
        };

        if (variant.id.startsWith("new-")) {
          const { data: insertedVariant, error: variantError } =
            await supabase
              .from("product_variants")
              .insert({
                product_id: product.id,
                seller_id: product.seller_id,
                ...payload,
                stock_reserved: 0,
                is_active: true,
              })
              .select("id")
              .single();

          if (variantError) throw variantError;
          variantIdMap.set(variant.id, insertedVariant.id);
        } else {
          const { error: variantError } = await supabase
            .from("product_variants")
            .update(payload)
            .eq("id", variant.id);

          if (variantError) throw variantError;
          variantIdMap.set(variant.id, variant.id);
        }
      }

      const replacedVariationPaths = Array.from(oldVariationImageUrls.entries())
        .filter(([option, oldUrl]) => {
          const nextUrl = variationImageUrls.get(option);
          return variationImageUrls.has(option) && nextUrl !== oldUrl;
        })
        .map(([, oldUrl]) => storagePathFromUrl(oldUrl))
        .filter(Boolean);

      if (replacedVariationPaths.length > 0) {
        await supabase.storage
          .from("product-images")
          .remove(replacedVariationPaths);
      }

      const { error: deleteFitmentError } = await supabase
        .from("product_vehicle_fitments")
        .delete()
        .eq("product_id", product.id);

      if (deleteFitmentError) throw deleteFitmentError;

      const currentPersistedVariantIds = new Set(
        variants
          .filter((variant) => !variant.id.startsWith("new-"))
          .map((variant) => variant.id)
      );
      const removedVariantIds = initialVariantIds.filter(
        (id) => !currentPersistedVariantIds.has(id)
      );

      if (removedVariantIds.length > 0) {
        const { error: removeVariantsError } = await supabase
          .from("product_variants")
          .delete()
          .in("id", removedVariantIds);

        if (removeVariantsError) throw removeVariantsError;
      }

      if (!isUniversalFitment && fitments.length > 0) {
        const vehicleCache = new Map(
          vehicleRows.map((row) => [
            [
              row.generation_key || "",
              row.variant || "ALL",
              row.transmission || "ALL",
            ].join("::"),
            row,
          ])
        );

        async function resolveVehicle(fitment: AdminFitmentDraft) {
          const cacheKey = [
            fitment.generationKey,
            fitment.variant,
            fitment.transmission,
          ].join("::");

          const cached = vehicleCache.get(cacheKey);
          if (cached) return cached;

          const { data: existing, error: lookupError } = await supabase
            .from("vehicles")
            .select(
              "id, generation_key, make, model, generation, variant, transmission, year_from, year_to"
            )
            .eq("generation_key", fitment.generationKey)
            .eq("variant", fitment.variant)
            .eq("transmission", fitment.transmission)
            .maybeSingle();

          if (lookupError) throw lookupError;

          if (existing) {
            const row = existing as VehicleRow;
            vehicleCache.set(cacheKey, row);
            return row;
          }

          const { data: inserted, error: insertVehicleError } =
            await supabase
              .from("vehicles")
              .insert({
                generation_key: fitment.generationKey,
                make: fitment.make,
                model: fitment.model,
                generation: fitment.generation,
                variant: fitment.variant,
                transmission: fitment.transmission,
                year_from: fitment.yearFrom,
                year_to: fitment.yearTo,
                is_active: true,
              })
              .select(
                "id, generation_key, make, model, generation, variant, transmission, year_from, year_to"
              )
              .single();

          if (insertVehicleError) throw insertVehicleError;

          const row = inserted as VehicleRow;
          vehicleCache.set(cacheKey, row);
          return row;
        }

        const rows = [];

        for (const fitment of fitments) {
          const vehicle = await resolveVehicle(fitment);

          rows.push({
            product_id: product.id,
            vehicle_id: vehicle.id,
            variant_id:
              fitment.targetVariantId ||
              (fitment.targetVariantKey
                ? variantIdMap.get(fitment.targetVariantKey) ||
                  (fitment.targetVariantKey.startsWith("new-")
                    ? null
                    : fitment.targetVariantKey)
                : null),
            year_from: fitment.yearFrom,
            year_to: fitment.yearTo,
            notes: null,
          });
        }

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
      const caughtMessage =
        caught instanceof Error ? caught.message : "";

      setError(
        caughtMessage.includes("product_variants_seller_id_sku_key") ||
        caughtMessage.toLowerCase().includes("duplicate key")
          ? "This SKU is already used by another product or variation. Please use a different SKU."
          : caughtMessage || "Unable to save product."
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
            <a href="/admin"><span>01</span>Dashboard</a>
            <a href="/admin/orders"><span>02</span>Orders</a>
            <a href="/admin/arrange-shipment"><span>03</span>Arrange Shipment</a>
            <a href="/admin/claims"><span>04</span>Claims</a>
            <a href="/admin/marketing"><span>05</span>Marketing Centre</a>
            <a href="/admin/products" className={styles.active}><span>06</span>Products</a>
            <a href="/admin/products/new"><span>07</span>Add Product</a>
            <a href="/admin/shipping"><span>08</span>Shipping</a>
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

                  </div>
                </section>

                <section id="variations" className={styles.productEditorCard}>
                  <div className={styles.productEditorCardHead}>
                    <div>
                      <span>03 · SALES INFORMATION</span>
                      <h2>Variations</h2>
                      <p>
                        Set up variation names and options first. SKU, price and
                        stock are entered in the table below.
                      </p>
                    </div>
                    <b>{variants.length} SKU</b>
                  </div>

                  <div className={styles.shopeeVariationSetup}>
                    <div className={styles.shopeeVariationSetupCard}>
                      <div className={styles.shopeeVariationSetupTitle}>
                        <strong>Variation 1</strong>
                      </div>

                      <label className={styles.adminField}>
                        <span>VARIATION NAME</span>
                        <input
                          name="variation_1_name"
                          value={product.variation_1_name || ""}
                          placeholder="Example: Grade / Viscosity / Position"
                          onChange={(event) =>
                            setVariationName(1, event.target.value)
                          }
                        />
                      </label>

                      <div className={styles.shopeeVariationOptionsLabel}>
                        <span>OPTIONS</span>
                        <button
                          type="button"
                          onClick={() => addVariationSetupOption(1)}
                        >
                          + ADD OPTION
                        </button>
                      </div>

                      <div className={styles.shopeeVariationOptionList}>
                        {variation1Options.map((option, index) => {
                          const edit = variationImageEdits[option];

                          return (
                            <div
                              className={styles.shopeeVariationOptionRow}
                              key={option + index}
                            >
                              <span>{String(index + 1).padStart(2, "0")}</span>
                              <input
                                defaultValue={option}
                                key={option}
                                onBlur={(event) =>
                                  renameVariationSetupOption(
                                    1,
                                    option,
                                    event.target.value
                                  )
                                }
                              />
                              <div className={styles.shopeeVariationOptionPhoto}>
                                {edit?.preview ? (
                                  <>
                                    <img src={edit.preview} alt={option} />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeVariationImage(option)
                                      }
                                    >
                                      REMOVE
                                    </button>
                                  </>
                                ) : (
                                  <label>
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp"
                                      onChange={(event) =>
                                        chooseVariationImage(option, event)
                                      }
                                    />
                                    + PHOTO
                                  </label>
                                )}
                              </div>
                              <button
                                type="button"
                                className={styles.shopeeVariationDelete}
                                onClick={() =>
                                  removeVariationSetupOption(1, option)
                                }
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {product.variation_2_name !== null ? (
                      <div className={styles.shopeeVariationSetupCard}>
                        <div className={styles.shopeeVariationSetupTitle}>
                          <strong>Variation 2</strong>
                          <button
                            type="button"
                            onClick={disableVariation2}
                          >
                            REMOVE
                          </button>
                        </div>

                        <label className={styles.adminField}>
                          <span>VARIATION NAME</span>
                          <input
                            name="variation_2_name"
                            value={product.variation_2_name || ""}
                            placeholder="Example: Size / Position"
                            onChange={(event) =>
                              setVariationName(2, event.target.value)
                            }
                          />
                        </label>

                        <div className={styles.shopeeVariationOptionsLabel}>
                          <span>OPTIONS</span>
                          <button
                            type="button"
                            onClick={() => addVariationSetupOption(2)}
                          >
                            + ADD OPTION
                          </button>
                        </div>

                        <div className={styles.shopeeVariationOptionList}>
                          {variation2Options.map((option, index) => (
                            <div
                              className={styles.shopeeVariationOptionRow}
                              key={option + index}
                            >
                              <span>{String(index + 1).padStart(2, "0")}</span>
                              <input
                                defaultValue={option}
                                key={option}
                                onBlur={(event) =>
                                  renameVariationSetupOption(
                                    2,
                                    option,
                                    event.target.value
                                  )
                                }
                              />
                              <button
                                type="button"
                                className={styles.shopeeVariationDelete}
                                onClick={() =>
                                  removeVariationSetupOption(2, option)
                                }
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.shopeeAddVariation2}
                        onClick={enableVariation2}
                      >
                        + ADD VARIATION 2
                      </button>
                    )}
                  </div>

                  <div className={styles.shopeeVariationMatrixTitle}>
                    <div>
                      <strong>SKU INFORMATION</strong>
                      <span>
                        Fill SKU, price and stock after your variation options
                        are ready.
                      </span>
                    </div>
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
                              <strong className={styles.shopeeVariationCombo}>
                                {[
                                  variant.variation_1_value ||
                                    variant.title ||
                                    "Default",
                                  variant.variation_2_value,
                                ]
                                  .filter(Boolean)
                                  .join(" / ")}
                              </strong>
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
                        Choose specific vehicles, or use Match All Cars for
                        universal products such as coolant and engine oil.
                      </p>
                    </div>
                  </div>

                  <div className={styles.fitmentModeGrid}>
                    <button
                      type="button"
                      className={!isUniversalFitment ? styles.active : ""}
                      onClick={() => setIsUniversalFitment(false)}
                    >
                      <strong>SELECT VEHICLES</strong>
                      <span>Use detailed make, model and variant fitment.</span>
                    </button>
                    <button
                      type="button"
                      className={isUniversalFitment ? styles.active : ""}
                      onClick={() => setIsUniversalFitment(true)}
                    >
                      <strong>MATCH ALL CARS</strong>
                      <span>Show this product as compatible with every vehicle.</span>
                    </button>
                  </div>

                  {isUniversalFitment ? (
                    <div className={styles.universalFitmentNotice}>
                      <strong>MATCH ALL CARS ENABLED</strong>
                      <span>
                        Buyers will see this product as compatible with any
                        vehicle selected in My Garage.
                      </span>
                    </div>
                  ) : (
                    <AdminFitmentBuilder
                      value={fitments}
                      onChange={setFitments}
                      variantOptions={variants.map((variant) => ({
                        key: variant.id,
                        dbId: variant.id.startsWith("new-")
                          ? undefined
                          : variant.id,
                        label: variantTitle(variant),
                        sku: variant.sku,
                      }))}
                    />
                  )}
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

                  <div className={styles.destinationRestrictionBox}>
                    <div>
                      <strong>DESTINATION RESTRICTIONS</strong>
                      <span>
                        Choose destinations where this product cannot be shipped.
                      </span>
                    </div>
                    <div className={styles.destinationRestrictionOptions}>
                      {["Sabah", "Sarawak", "W.P. Labuan"].map((state) => (
                        <label key={state}>
                          <input
                            type="checkbox"
                            checked={restrictedShippingStates.includes(state)}
                            onChange={(event) =>
                              setRestrictedShippingStates((current) =>
                                event.target.checked
                                  ? Array.from(new Set([...current, state]))
                                  : current.filter((item) => item !== state)
                              )
                            }
                          />
                          <span>DO NOT SHIP TO {state.toUpperCase()}</span>
                        </label>
                      ))}
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

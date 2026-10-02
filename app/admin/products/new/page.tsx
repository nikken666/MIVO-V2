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
  make: string;
  model: string;
  generation: string | null;
  variant: string | null;
  transmission: string | null;
  year_from: number | null;
  year_to: number | null;
};

type CopySourceImage = {
  url: string;
  altText: string | null;
  sortOrder: number;
};

type CopyDefaults = {
  name: string;
  categoryId: string;
  brandId: string;
  shortDescription: string;
  description: string;
  warrantyMonths: string;
  lowStockThreshold: string;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  simpleSku: string;
  simplePrice: string;
  simpleCompareAtPrice: string;
  simpleStock: string;
};

type VariationImageDraft = {
  file?: File;
  preview: string;
  sourceUrl?: string;
};

type ShippingValues = {
  weight_kg: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
};

type VariantDraft = {
  key: string;
  value1: string;
  value2: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  weight_kg: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function storagePathFromUrl(url: string) {
  const marker = "/storage/v1/object/public/product-images/";
  const index = url.indexOf(marker);
  if (index < 0) return "";
  return decodeURIComponent(url.slice(index + marker.length));
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
  const [useVariationImages, setUseVariationImages] = useState(false);
  const [variationImages, setVariationImages] = useState<Record<string, VariationImageDraft>>({});
  const [copyMode, setCopyMode] = useState(false);
  const [copyDefaults, setCopyDefaults] = useState<CopyDefaults | null>(null);
  const [sourceImages, setSourceImages] = useState<CopySourceImage[]>([]);
  const [shippingMode, setShippingMode] = useState<"same" | "different">("same");
  const [sharedShipping, setSharedShipping] = useState<ShippingValues>({
    weight_kg: "0",
    length_cm: "0",
    width_cm: "0",
    height_cm: "0",
  });

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

  const displayPreviews =
    files.length > 0
      ? previews
      : sourceImages
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((image) => image.url);

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
            .select("id, generation_key, make, model, generation, variant, transmission, year_from, year_to")
            .eq("is_active", true),
        ]);

        if (sellerError || brandError || categoryError || vehicleError) {
          throw sellerError || brandError || categoryError || vehicleError;
        }

        const vehicles = (vehicleData as VehicleDbRow[] | null) || [];

        setStore((sellerData as Store | null) || null);
        setBrands((brandData as Option[] | null) || []);
        setCategories((categoryData as CategoryNode[] | null) || []);
        setVehicleRows(vehicles);

        const params = new URLSearchParams(window.location.search);
        const copyFrom = params.get("copyFrom") || "";

        if (copyFrom) {
          const [
            sourceProductResult,
            sourceImagesResult,
            sourceVariantsResult,
            sourceFitmentsResult,
          ] = await Promise.all([
            supabase
              .from("products")
              .select(
                "id, category_id, brand_id, name, short_description, description, warranty_months, variation_1_name, variation_2_name"
              )
              .eq("id", copyFrom)
              .single(),
            supabase
              .from("product_images")
              .select("image_url, alt_text, sort_order")
              .eq("product_id", copyFrom)
              .order("sort_order"),
            supabase
              .from("product_variants")
              .select(
                "id, variation_1_value, variation_2_value, sku, price, compare_at_price, stock_on_hand, stock_reserved, low_stock_threshold, weight_kg, length_cm, width_cm, height_cm, variant_image_url"
              )
              .eq("product_id", copyFrom)
              .order("created_at"),
            supabase
              .from("product_vehicle_fitments")
              .select("vehicle_id, variant_id, year_from, year_to")
              .eq("product_id", copyFrom),
          ]);

          if (
            sourceProductResult.error ||
            sourceImagesResult.error ||
            sourceVariantsResult.error ||
            sourceFitmentsResult.error
          ) {
            throw (
              sourceProductResult.error ||
              sourceImagesResult.error ||
              sourceVariantsResult.error ||
              sourceFitmentsResult.error
            );
          }

          const sourceProduct = sourceProductResult.data;
          const sourceVariants =
            (sourceVariantsResult.data || []) as Array<{
              id: string;
              variation_1_value: string | null;
              variation_2_value: string | null;
              sku: string;
              price: number | string;
              compare_at_price: number | string | null;
              stock_on_hand: number;
              stock_reserved: number;
              low_stock_threshold: number;
              weight_kg: number | string | null;
              length_cm: number | string | null;
              width_cm: number | string | null;
              height_cm: number | string | null;
              variant_image_url: string | null;
            }>;
          const sourceImages =
            (sourceImagesResult.data || []) as Array<{
              image_url: string;
              alt_text: string | null;
              sort_order: number;
            }>;
          const sourceFitments =
            (sourceFitmentsResult.data || []) as Array<{
              vehicle_id: string;
              variant_id: string | null;
              year_from: number | null;
              year_to: number | null;
            }>;

          const firstVariant = sourceVariants[0];
          const copyToken = Date.now()
            .toString(36)
            .slice(-5)
            .toUpperCase();
          const copiedSku = (sku: string, index = 0) =>
            sku +
            "-COPY-" +
            copyToken +
            (sourceVariants.length > 1 ? "-" + String(index + 1) : "");

          setCopyMode(true);
          setSourceImages(
            sourceImages.map((image) => ({
              url: image.image_url,
              altText: image.alt_text,
              sortOrder: image.sort_order,
            }))
          );

          setCopyDefaults({
            name: sourceProduct.name || "",
            categoryId: sourceProduct.category_id || "",
            brandId: sourceProduct.brand_id || "",
            shortDescription: sourceProduct.short_description || "",
            description: sourceProduct.description || "",
            warrantyMonths: String(sourceProduct.warranty_months || 0),
            lowStockThreshold: String(firstVariant?.low_stock_threshold || 5),
            weightKg: String(firstVariant?.weight_kg || 0),
            lengthCm: String(firstVariant?.length_cm || 0),
            widthCm: String(firstVariant?.width_cm || 0),
            heightCm: String(firstVariant?.height_cm || 0),
            simpleSku: firstVariant ? copiedSku(firstVariant.sku) : "",
            simplePrice: firstVariant ? String(firstVariant.price) : "",
            simpleCompareAtPrice:
              firstVariant?.compare_at_price == null
                ? ""
                : String(firstVariant.compare_at_price),
            simpleStock: firstVariant
              ? String(
                  Math.max(
                    0,
                    Number(firstVariant.stock_on_hand || 0) -
                      Number(firstVariant.stock_reserved || 0)
                  )
                )
              : "0",
          });

          setSharedShipping({
            weight_kg: String(firstVariant?.weight_kg || 0),
            length_cm: String(firstVariant?.length_cm || 0),
            width_cm: String(firstVariant?.width_cm || 0),
            height_cm: String(firstVariant?.height_cm || 0),
          });

          const dimensionSignatures = new Set(
            sourceVariants.map((variant) =>
              [
                Number(variant.weight_kg || 0),
                Number(variant.length_cm || 0),
                Number(variant.width_cm || 0),
                Number(variant.height_cm || 0),
              ].join("|")
            )
          );

          setShippingMode(
            sourceVariants.length > 1 && dimensionSignatures.size > 1
              ? "different"
              : "same"
          );

          const hasSourceVariations =
            Boolean(sourceProduct.variation_1_name) ||
            sourceVariants.some((variant) =>
              Boolean(variant.variation_1_value)
            );

          if (hasSourceVariations) {
            const value1s = Array.from(
              new Set(
                sourceVariants
                  .map((variant) => variant.variation_1_value || "")
                  .filter(Boolean)
              )
            );
            const value2s = Array.from(
              new Set(
                sourceVariants
                  .map((variant) => variant.variation_2_value || "")
                  .filter(Boolean)
              )
            );

            setHasVariations(true);
            setVariation1Name(sourceProduct.variation_1_name || "Variation");
            setVariation1Text(value1s.join(", "));
            setUseVariation2(
              Boolean(sourceProduct.variation_2_name) &&
                value2s.length > 0
            );
            setVariation2Name(sourceProduct.variation_2_name || "");
            setVariation2Text(value2s.join(", "));

            const sourceRows = sourceVariants.map((variant, index) => ({
              key: combinationKey(
                variant.variation_1_value || "",
                variant.variation_2_value || ""
              ),
              value1: variant.variation_1_value || "",
              value2: variant.variation_2_value || "",
              sku: copiedSku(variant.sku, index),
              price: String(variant.price),
              compareAtPrice:
                variant.compare_at_price == null
                  ? ""
                  : String(variant.compare_at_price),
              stock: String(
                Math.max(
                  0,
                  Number(variant.stock_on_hand || 0) -
                    Number(variant.stock_reserved || 0)
                )
              ),
              weight_kg: String(variant.weight_kg || 0),
              length_cm: String(variant.length_cm || 0),
              width_cm: String(variant.width_cm || 0),
              height_cm: String(variant.height_cm || 0),
            }));

            setVariantRows(sourceRows);

            const copiedVariationImages: Record<
              string,
              VariationImageDraft
            > = {};

            for (const variant of sourceVariants) {
              const option = variant.variation_1_value || "";
              if (
                option &&
                variant.variant_image_url &&
                !copiedVariationImages[option]
              ) {
                copiedVariationImages[option] = {
                  preview: variant.variant_image_url,
                  sourceUrl: variant.variant_image_url,
                };
              }
            }

            if (Object.keys(copiedVariationImages).length > 0) {
              setUseVariationImages(true);
              setVariationImages(copiedVariationImages);
            }

            const oldVariantToDraftKey = new Map(
              sourceVariants.map((variant) => [
                variant.id,
                combinationKey(
                  variant.variation_1_value || "",
                  variant.variation_2_value || ""
                ),
              ])
            );

            const copiedFitments = sourceFitments
              .map<AdminFitmentDraft | null>((fitment) => {
                const vehicle = vehicles.find(
                  (item) => item.id === fitment.vehicle_id
                );
                if (!vehicle?.generation_key) return null;

                const yearFrom =
                  fitment.year_from ??
                  vehicle.year_from ??
                  new Date().getFullYear();
                const yearTo =
                  fitment.year_to ??
                  vehicle.year_to ??
                  new Date().getFullYear();
                const targetKey = fitment.variant_id
                  ? oldVariantToDraftKey.get(fitment.variant_id) || null
                  : null;

                return {
                  key: [
                    targetKey || "ALL-SKU",
                    vehicle.generation_key,
                    yearFrom,
                    yearTo,
                    vehicle.variant || "ALL",
                    vehicle.transmission || "ALL",
                  ].join("::"),
                  generationKey: vehicle.generation_key,
                  make: vehicle.make,
                  model: vehicle.model,
                  generation: vehicle.generation || vehicle.model,
                  yearFrom,
                  yearTo,
                  variant: vehicle.variant || "ALL",
                  transmission: vehicle.transmission || "ALL",
                  targetVariantKey: targetKey,
                  targetVariantId: null,
                  targetVariantLabel: null,
                };
              })
              .filter(
                (item): item is AdminFitmentDraft => item !== null
              );

            setFitments(copiedFitments);
          } else {
            const copiedFitments = sourceFitments
              .map<AdminFitmentDraft | null>((fitment) => {
                const vehicle = vehicles.find(
                  (item) => item.id === fitment.vehicle_id
                );
                if (!vehicle?.generation_key) return null;

                const yearFrom =
                  fitment.year_from ??
                  vehicle.year_from ??
                  new Date().getFullYear();
                const yearTo =
                  fitment.year_to ??
                  vehicle.year_to ??
                  new Date().getFullYear();

                return {
                  key: [
                    "ALL-SKU",
                    vehicle.generation_key,
                    yearFrom,
                    yearTo,
                    vehicle.variant || "ALL",
                    vehicle.transmission || "ALL",
                  ].join("::"),
                  generationKey: vehicle.generation_key,
                  make: vehicle.make,
                  model: vehicle.model,
                  generation: vehicle.generation || vehicle.model,
                  yearFrom,
                  yearTo,
                  variant: vehicle.variant || "ALL",
                  transmission: vehicle.transmission || "ALL",
                  targetVariantKey: null,
                  targetVariantId: null,
                  targetVariantLabel: null,
                };
              })
              .filter(
                (item): item is AdminFitmentDraft => item !== null
              );

            setFitments(copiedFitments);
          }
        }
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
              weight_kg: sharedShipping.weight_kg,
              length_cm: sharedShipping.length_cm,
              width_cm: sharedShipping.width_cm,
              height_cm: sharedShipping.height_cm,
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
    if (selected.length > 0) {
      setSourceImages([]);
    }
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

    setVariationImages((current) => {
      const previous = current[option];
      if (previous?.preview.startsWith("blob:")) {
        URL.revokeObjectURL(previous.preview);
      }

      return {
        ...current,
        [option]: {
          file,
          preview: URL.createObjectURL(file),
        },
      };
    });

    setError("");
    event.target.value = "";
  }

  function removeVariationImage(option: string) {
    setVariationImages((current) => {
      const target = current[option];
      if (target?.preview.startsWith("blob:")) {
        URL.revokeObjectURL(target.preview);
      }
      const next = { ...current };
      delete next[option];
      return next;
    });
  }

  function updateVariant(
    key: string,
    field:
      | "sku"
      | "price"
      | "compareAtPrice"
      | "stock"
      | "weight_kg"
      | "length_cm"
      | "width_cm"
      | "height_cm",
    value: string
  ) {
    setVariantRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, [field]: value } : row
      )
    );
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
      if (files.length === 0 && sourceImages.length === 0) {
        throw new Error("Upload at least one product image.");
      }

      const preparedVariants = prepareVariants(form);

      setProgress("Uploading product images...");

      const imageRows: Array<{
        image_url: string;
        alt_text: string;
        sort_order: number;
      }> = [];

      async function duplicateSourceImage(
        sourceUrl: string,
        prefix = "copy"
      ) {
        const sourcePath = storagePathFromUrl(sourceUrl);
        if (!sourcePath) return sourceUrl;

        const fileName = sourcePath.split("/").pop() || "image.jpg";
        const destinationPath =
          sellerId +
          "/" +
          prefix +
          "-" +
          crypto.randomUUID() +
          "-" +
          fileName;

        const { error: copyError } = await supabase.storage
          .from("product-images")
          .copy(sourcePath, destinationPath);

        if (copyError) throw copyError;
        uploadedPaths.push(destinationPath);

        const { data: publicData } = supabase.storage
          .from("product-images")
          .getPublicUrl(destinationPath);

        return publicData.publicUrl;
      }

      if (files.length > 0) {
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
      } else {
        for (const [index, image] of sourceImages
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .entries()) {
          imageRows.push({
            image_url: await duplicateSourceImage(
              image.url,
              "copy-product"
            ),
            alt_text: image.altText || name,
            sort_order: index,
          });
        }
      }

      const variationImageUrls = new Map<string, string>();

      if (hasVariations && useVariationImages) {
        setProgress("Uploading variation images...");

        for (const option of variation1Options) {
          const draft = variationImages[option];
          if (!draft) continue;

          if (draft.file) {
            const path =
              sellerId +
              "/variation-" +
              crypto.randomUUID() +
              "-" +
              safeFileName(draft.file.name);

            const { error: uploadError } = await supabase.storage
              .from("product-images")
              .upload(path, draft.file, {
                cacheControl: "3600",
                upsert: false,
                contentType: draft.file.type,
              });

            if (uploadError) throw uploadError;
            uploadedPaths.push(path);

            const { data: publicData } = supabase.storage
              .from("product-images")
              .getPublicUrl(path);

            variationImageUrls.set(option, publicData.publicUrl);
          } else if (draft.sourceUrl) {
            variationImageUrls.set(
              option,
              await duplicateSourceImage(
                draft.sourceUrl,
                "copy-variation"
              )
            );
          }
        }
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
        weight_kg: Number(sharedShipping.weight_kg || 0),
        length_cm: Number(sharedShipping.length_cm || 0),
        width_cm: Number(sharedShipping.width_cm || 0),
        height_cm: Number(sharedShipping.height_cm || 0),
      };

      const variantInsertRows = preparedVariants.map(
        ({ draftKey, ...variant }) => {
          const draftVariant = variantRows.find(
            (row) => row.key === draftKey
          );
          const measurements =
            hasVariations &&
            shippingMode === "different" &&
            draftVariant
              ? {
                  weight_kg: Number(draftVariant.weight_kg || 0),
                  length_cm: Number(draftVariant.length_cm || 0),
                  width_cm: Number(draftVariant.width_cm || 0),
                  height_cm: Number(draftVariant.height_cm || 0),
                }
              : sharedMeasurements;

          return {
            product_id: product.id,
            seller_id: sellerId,
            ...variant,
            variant_image_url:
              hasVariations &&
              useVariationImages &&
              variant.variation_1_value
                ? variationImageUrls.get(variant.variation_1_value) || null
                : null,
            stock_reserved: 0,
            low_stock_threshold: Number(
              form.get("low_stock_threshold") || 5
            ),
            ...measurements,
            is_active: true,
          };
        }
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
              (row.variant || "ALL") === fitment.variant &&
              (row.transmission || "ALL") === fitment.transmission
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
            <a href="/admin"><span>01</span>Dashboard</a>
            <a href="/admin/orders"><span>02</span>Orders</a>
            <a href="/admin/arrange-shipment"><span>03</span>Arrange Shipment</a>
            <a href="/admin/claims"><span>04</span>Claims</a>
            <a href="/admin/marketing"><span>05</span>Marketing Centre</a>
            <a href="/admin/products"><span>06</span>Products</a>
            <a href="/admin/products/new" className={styles.active}><span>07</span>Add Product</a>
            <a href="/admin/shipping"><span>08</span>Shipping</a>
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
              <h1>{copyMode ? "Copy Product" : "Add Product"}</h1>
              <p>
                {copyMode
                  ? "Copied product details are only temporary until you save."
                  : "Shopee-style listing editor with SKU variations and vehicle compatibility."}
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
              {copyMode ? (
                <p className={styles.adminNotice} style={{ marginBottom: 14 }}>
                  COPY MODE · Nothing is created or saved until you click SAVE PRODUCT.
                  Leaving this page will discard this copy.
                </p>
              ) : null}
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
                      <b>{displayPreviews.length}/8</b>
                    </div>

                    <div className={styles.imageUploadGrid}>
                      {displayPreviews.map((preview, index) => (
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

                      {displayPreviews.length < 8 ? (
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
                          defaultValue={copyDefaults?.name || ""}
                          placeholder="Example: NIKKEN JAPAN PERODUA BEZZA FRONT DRIVE SHAFT RH"
                        />
                      </label>

                      <CategoryPicker
                        categories={categories}
                        name="category_id"
                        required
                        initialSelectedId={copyDefaults?.categoryId || ""}
                      />

                      <label className={styles.adminField}>
                        <span>BRAND</span>
                        <select
                          name="brand_id"
                          defaultValue={copyDefaults?.brandId || ""}
                        >
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
                          defaultValue={copyDefaults?.shortDescription || ""}
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
                          defaultValue={copyDefaults?.description || ""}
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
                            defaultValue={copyDefaults?.simpleSku || ""}
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
                            defaultValue={copyDefaults?.simplePrice || ""}
                          />
                        </label>

                        <label className={styles.adminField}>
                          <span>ORIGINAL PRICE (RM)</span>
                          <input
                            name="compare_at_price"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={copyDefaults?.simpleCompareAtPrice || ""}
                          />
                        </label>

                        <label className={styles.adminField}>
                          <span>STOCK *</span>
                          <input
                            name="stock_on_hand"
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={copyDefaults?.simpleStock || "0"}
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
                            <strong>Variation Images</strong>
                            <span>
                              Optional. Add one image for each Variation 1 option, like Shopee.
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={useVariationImages}
                            onChange={(e) => {
                              setUseVariationImages(e.target.checked);
                              if (!e.target.checked) {
                                Object.values(variationImages).forEach((image) => {
                                  if (image.preview.startsWith("blob:")) {
                                    URL.revokeObjectURL(image.preview);
                                  }
                                });
                                setVariationImages({});
                              }
                            }}
                          />
                        </label>

                        {useVariationImages && variation1Options.length > 0 ? (
                          <div className={styles.variationImageGrid}>
                            {variation1Options.map((option) => {
                              const image = variationImages[option];
                              return (
                                <div className={styles.variationImageCard} key={option}>
                                  <strong>{option}</strong>
                                  {image ? (
                                    <div className={styles.variationImagePreview}>
                                      <img src={image.preview} alt={option} />
                                      <button
                                        type="button"
                                        onClick={() => removeVariationImage(option)}
                                      >
                                        REMOVE
                                      </button>
                                    </div>
                                  ) : (
                                    <label className={styles.variationImageUpload}>
                                      <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={(event) =>
                                          chooseVariationImage(option, event)
                                        }
                                      />
                                      <span>+ ADD PHOTO</span>
                                    </label>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}

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
                            <table
                              className={
                                styles.adminTable + " " + styles.newVariantTable
                              }
                            >
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
                          defaultValue={copyDefaults?.lowStockThreshold || "5"}
                        />
                      </label>

                      <label className={styles.adminField}>
                        <span>WARRANTY (MONTHS)</span>
                        <input
                          name="warranty_months"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={copyDefaults?.warrantyMonths || "0"}
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
                          defaultValue={copyDefaults?.weightKg || ""}
                        />
                      </label>

                      <label className={styles.adminField}>
                        <span>LENGTH (CM)</span>
                        <input
                          name="length_cm"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={copyDefaults?.lengthCm || ""}
                        />
                      </label>

                      <label className={styles.adminField}>
                        <span>WIDTH (CM)</span>
                        <input
                          name="width_cm"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={copyDefaults?.widthCm || ""}
                        />
                      </label>

                      <label className={styles.adminField}>
                        <span>HEIGHT (CM)</span>
                        <input
                          name="height_cm"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={copyDefaults?.heightCm || ""}
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
                        <select
                          name="status"
                          defaultValue={copyMode ? "draft" : "active"}
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
                      {busy
                        ? "SAVING PRODUCT..."
                        : copyMode
                          ? "SAVE COPIED PRODUCT"
                          : "SAVE PRODUCT"}
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

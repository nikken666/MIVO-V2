"use client";

import { useEffect, useState } from "react";
import ProductCard from "./ProductCard";
import { openVehiclePicker } from "./VehiclePickerButton";
import { useT } from "./LanguageProvider";
import type { Product } from "@/data/products";
import type { FitmentStatus } from "@/data/fitments";

type Saved = {
  vehicleId?: string;
  make?: string;
  model?: string;
  generation?: string;
  year?: string;
  variant?: string;
  transmission?: string;
};

type Item = { product: Product; fitmentStatus: FitmentStatus };

function readSaved(): Saved | null {
  try {
    const raw = window.localStorage.getItem("mivo:selectedVehicle");
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function vehicleParams(saved: Saved) {
  const params = new URLSearchParams();
  params.set("vehicle", saved.vehicleId || "");
  for (const key of ["make", "model", "generation", "year", "variant", "transmission"] as const) {
    if (saved[key]) params.set(key, String(saved[key]));
  }
  return params;
}

/**
 * "Recommended for your car": parts that fit the shopper's saved car.
 * Without a car it shows a small optional prompt (or nothing), never a warning.
 */
export default function CarRecommendations({
  title = "forCar",
  category = "",
  exclude = [],
  limit = 8,
  promptWhenNoCar = false,
}: {
  title?: "forCar" | "alsoFits" | "mayNeed";
  category?: string;
  exclude?: string[];
  limit?: number;
  promptWhenNoCar?: boolean;
}) {
  const t = useT();
  const [saved, setSaved] = useState<Saved | null | undefined>(undefined);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const excludeKey = exclude.filter(Boolean).sort().join(",");

  useEffect(() => {
    const sync = () => setSaved(readSaved());
    sync();
    window.addEventListener("mivo:vehicle-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("mivo:vehicle-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const vehicleKey = saved?.vehicleId ? vehicleParams(saved).toString() : "";

  useEffect(() => {
    if (!vehicleKey) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams(vehicleKey);
    if (category) params.set("category", category);
    if (excludeKey) params.set("exclude", excludeKey);
    params.set("limit", String(limit));
    fetch("/api/recommendations?" + params.toString())
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: Item[] }) => {
        if (!cancelled) setItems(data.items || []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleKey, category, excludeKey, limit]);

  if (saved === undefined) return null;

  if (!saved?.vehicleId) {
    if (!promptWhenNoCar) return null;
    return (
      <div className="carRecPrompt">
        <span aria-hidden>🚗</span>
        <p>{t("buy.rec.pickCar")}</p>
        <button type="button" className="carRecPromptButton" onClick={() => openVehiclePicker()}>
          {t("buy.rec.pickCarButton")}
        </button>
      </div>
    );
  }

  const car = saved.model || saved.make || "";

  // A2: shimmer cards while the parts for this car load.
  if (loading && !items.length) {
    return (
      <section className="carRec" aria-busy="true">
        <div className="carRecHead">
          <h2><span className="carRecTag" key={vehicleKey}>🚗 {car}</span></h2>
        </div>
        <div className="carRecRow">
          {Array.from({ length: Math.min(limit, 5) }).map((_, index) => (
            <div className="carRecItem catalogLoadingCard" key={index}>
              <div className="catalogLoadingImage skeletonBlock" />
              <div className="catalogLoadingLine skeletonBlock" />
              <div className="catalogLoadingLine short skeletonBlock" />
              <div className="catalogLoadingLine price skeletonBlock" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!items.length) return null;

  const heading =
    title === "alsoFits"
      ? t("buy.rec.alsoFits", { car })
      : title === "mayNeed"
        ? t("buy.rec.mayNeed", { car })
        : t("buy.rec.forCar", { car });

  return (
    <section className="carRec" aria-label={heading}>
      <div className="carRecHead">
        {/* A5: the car tag slides in, then the parts appear one after another */}
        <h2 className="carRecHeading" key={vehicleKey}>{heading}</h2>
        <a href={"/products?" + vehicleKey}>{t("buy.rec.viewAll", { car })}</a>
      </div>
      <div className="carRecRow">
        {items.map((item, index) => (
          <div
            className="carRecItem carRecItemIn"
            key={vehicleKey + item.product.slug}
            style={{ animationDelay: Math.min(index, 10) * 70 + "ms" }}
          >
            <ProductCard product={item.product} compact fitmentStatus={item.fitmentStatus} />
          </div>
        ))}
      </div>
    </section>
  );
}

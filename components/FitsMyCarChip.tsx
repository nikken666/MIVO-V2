"use client";

import { useEffect, useState } from "react";
import { openVehiclePicker } from "./VehiclePickerButton";
import { useT } from "./LanguageProvider";

type Saved = {
  vehicleId?: string;
  make?: string;
  model?: string;
  generation?: string;
  year?: string;
  variant?: string;
  transmission?: string;
};

function readSaved(): Saved | null {
  try {
    const raw = window.localStorage.getItem("mivo:selectedVehicle");
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

/**
 * "Fits my car": with a saved car, opens the catalogue filtered to it;
 * without one, opens the vehicle picker first.
 */
export default function FitsMyCarChip({ className = "shopChip" }: { className?: string }) {
  const t = useT();
  const [saved, setSaved] = useState<Saved | null>(null);

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

  const href = (() => {
    if (!saved?.vehicleId) return "";
    const params = new URLSearchParams();
    params.set("vehicle", saved.vehicleId);
    for (const key of ["make", "model", "generation", "year", "variant", "transmission"] as const) {
      if (saved[key]) params.set(key, String(saved[key]));
    }
    return "/products?" + params.toString();
  })();

  const label = saved?.model ? t("fit.fitsMy", { car: saved.model }) : t("fit.fitsMyCar");

  return href ? (
    <a href={href} className={className} role="listitem">
      {label}
    </a>
  ) : (
    <button type="button" className={className} role="listitem" onClick={() => openVehiclePicker()}>
      {label}
    </button>
  );
}

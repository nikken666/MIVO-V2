"use client";

import { useEffect } from "react";

type SavedVehicle = {
  vehicleId?: string;
  make?: string;
  model?: string;
  generation?: string;
  year?: string;
  variant?: string;
  transmission?: string;
};

export default function SavedVehicleProductsBootstrap({
  hasVehicle,
}: {
  hasVehicle: boolean;
}) {
  useEffect(() => {
    if (hasVehicle) return;

    try {
      const raw = window.localStorage.getItem("mivo:selectedVehicle");
      if (!raw) return;

      const saved = JSON.parse(raw) as SavedVehicle;
      if (!saved?.vehicleId || !saved.year || !saved.variant) return;

      const params = new URLSearchParams(window.location.search);
      params.set("vehicle", saved.vehicleId);
      if (saved.make) params.set("make", saved.make);
      if (saved.model) params.set("model", saved.model);
      if (saved.generation) params.set("generation", saved.generation);
      params.set("year", saved.year);
      params.set("variant", saved.variant);

      if (saved.transmission) {
        params.set("transmission", saved.transmission);
      }

      window.location.replace("/products?" + params.toString());
    } catch {}
  }, [hasVehicle]);

  return null;
}

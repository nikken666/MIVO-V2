"use client";

import { useState } from "react";
import ProductVehicleSelector from "@/components/ProductVehicleSelector";
import { useT } from "@/components/LanguageProvider";

export default function ProductsVehicleBanner({
  label,
}: {
  label: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="selectedVehicleBanner vehicleMatchBanner">
        <div>
          <span>{t("browse.vehicle.yours")}</span>
          <strong>{label}</strong>
          <small>
            {t("browse.vehicle.note")}
          </small>
        </div>

        <button
          type="button"
          className="vehicleQuickChangeButton"
          onClick={() => setOpen(true)}
        >
          {t("browse.changeVehicle")}
        </button>
      </div>

      <ProductVehicleSelector
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

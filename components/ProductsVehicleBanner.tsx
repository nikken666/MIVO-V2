"use client";

import { useState } from "react";
import ProductVehicleSelector from "@/components/ProductVehicleSelector";

export default function ProductsVehicleBanner({
  label,
}: {
  label: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="selectedVehicleBanner vehicleMatchBanner">
        <div>
          <span>YOUR MIVO VEHICLE</span>
          <strong>{label}</strong>
          <small>
            Confirmed matches are shown first. Products without verified fitment
            data remain clearly marked instead of being guessed.
          </small>
        </div>

        <button
          type="button"
          className="vehicleQuickChangeButton"
          onClick={() => setOpen(true)}
        >
          CHANGE VEHICLE
        </button>
      </div>

      <ProductVehicleSelector
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

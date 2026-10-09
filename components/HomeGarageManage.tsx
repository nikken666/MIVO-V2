"use client";

import { useState } from "react";
import ProductVehicleSelector from "@/components/ProductVehicleSelector";

export default function HomeGarageManage() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="memberGarageManage"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        MANAGE
      </button>
      <ProductVehicleSelector
        open={open}
        onClose={() => setOpen(false)}
        mode="garage"
      />
    </>
  );
}

"use client";

import { useState } from "react";
import ProductVehicleSelector from "@/components/ProductVehicleSelector";
import { useT } from "@/components/LanguageProvider";

export default function HomeGarageManage() {
  const t = useT();
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
        {t("buy.v.manage")}
      </button>
      <ProductVehicleSelector
        open={open}
        onClose={() => setOpen(false)}
        mode="garage"
      />
    </>
  );
}

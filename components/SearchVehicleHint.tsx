"use client";

import { openVehiclePicker } from "./VehiclePickerButton";
import { useT } from "./LanguageProvider";

/** On search results for a car name ("myvi"), offer to pick that car. */
export default function SearchVehicleHint({ car }: { car: string }) {
  const t = useT();
  return (
    <button type="button" className="searchVehicleHint" onClick={() => openVehiclePicker()}>
      <span aria-hidden="true">🚗</span>
      <span>{t("search.pickCar", { car })}</span>
      <b>{t("header.selectCar")} ›</b>
    </button>
  );
}

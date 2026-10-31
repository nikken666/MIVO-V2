"use client";

import { useCallback, useEffect, useState } from "react";
import ProductVehicleSelector from "./ProductVehicleSelector";

type StoredVehicle = {
  make?: string;
  model?: string;
  year?: string;
};

const CHANGE_EVENT = "mivo:vehicle-changed";
export const OPEN_VEHICLE_PICKER_EVENT = "mivo:open-vehicle-picker";

/** Ask the header's vehicle chip to open the selector (works on any page). */
export function openVehiclePicker() {
  window.dispatchEvent(new Event(OPEN_VEHICLE_PICKER_EVENT));
}

function readVehicle(): StoredVehicle | null {
  try {
    const raw = window.localStorage.getItem("mivo:selectedVehicle");
    return raw ? (JSON.parse(raw) as StoredVehicle) : null;
  } catch {
    return null;
  }
}

/**
 * Opens the step-by-step vehicle selector in a modal.
 * - "chip": compact pill inside the header search bar.
 * - "banner": large card on the homepage hero.
 * The chip also opens automatically for legacy "/?addVehicle=1" links.
 */
export default function VehiclePickerButton({
  variant = "chip",
  autoOpenFromUrl = false,
}: {
  variant?: "chip" | "banner";
  autoOpenFromUrl?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [vehicle, setVehicle] = useState<StoredVehicle | null>(null);

  useEffect(() => {
    setVehicle(readVehicle());
    const sync = () => setVehicle(readVehicle());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);

    // Only the header chip (autoOpenFromUrl) answers global open requests,
    // so a single modal ever opens.
    const openFromEvent = () => setOpen(true);
    if (autoOpenFromUrl) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("addVehicle") === "1") setOpen(true);
      window.addEventListener(OPEN_VEHICLE_PICKER_EVENT, openFromEvent);
    }

    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener(OPEN_VEHICLE_PICKER_EVENT, openFromEvent);
    };
  }, [autoOpenFromUrl]);

  const close = useCallback(() => {
    setOpen(false);
    setVehicle(readVehicle());
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const label = vehicle?.model
    ? [vehicle.model, vehicle.year].filter(Boolean).join(" ")
    : "";

  return (
    <>
      {variant === "chip" ? (
        <button
          type="button"
          className={"vehiclePickerChip" + (label ? " hasVehicle" : "")}
          onClick={() => setOpen(true)}
          aria-label={label ? "Change vehicle: " + label : "Select your car"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 16h14M6.5 16l1.6-5.2A2 2 0 0 1 10 9.4h4a2 2 0 0 1 1.9 1.4L17.5 16M4 16v2.5M20 16v2.5" />
            <circle cx="8" cy="16" r="1.4" />
            <circle cx="16" cy="16" r="1.4" />
          </svg>
          <span>{label || "Select car"}</span>
          <svg className="vehiclePickerCaret" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 10l5 5 5-5" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          className="shopSideBanner shopSideBannerVehicle"
          onClick={() => setOpen(true)}
        >
          <span className="shopSideBannerKicker">
            {label ? "Your car" : "Vehicle match"}
          </span>
          <strong>{label ? label : "Find parts that fit"}</strong>
          <small>
            {label
              ? "Change vehicle or add another"
              : "Pick your make, model and year"}
          </small>
          <span className="shopSideBannerCta">
            {label ? "Change" : "Select your car"} ›
          </span>
        </button>
      )}

      <ProductVehicleSelector open={open} onClose={close} mode="garage" />
    </>
  );
}

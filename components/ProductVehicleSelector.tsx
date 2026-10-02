"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  vehicleDatabase,
  vehicleLabel,
  yearsForVehicle,
  transmissionsForVehicle,
} from "@/data/vehicles";
import {
  loadAccountVehicles,
  saveAccountVehicle,
  type AccountVehicle,
} from "@/lib/customerData";

type Props = {
  open: boolean;
  onClose: () => void;
};

const TOTAL_STEPS = 6;

export default function ProductVehicleSelector({ open, onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [year, setYear] = useState("");
  const [variant, setVariant] = useState("");
  const [transmission, setTransmission] = useState("");
  const [savedVehicle, setSavedVehicle] = useState<AccountVehicle | null>(null);
  const [savedVehicles, setSavedVehicles] = useState<AccountVehicle[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open) return;

    let active = true;
    setLoadingSaved(true);

    async function loadSaved() {
      let local: AccountVehicle | null = null;

      try {
        const raw = window.localStorage.getItem("mivo:selectedVehicle");
        if (raw) local = JSON.parse(raw) as AccountVehicle;
      } catch {}

      if (active && local) {
        setSavedVehicle(local);
        setSavedVehicles([local]);
      }

      try {
        const garageVehicles = await loadAccountVehicles();
        if (!active) return;

        const merged = [...garageVehicles];

        if (
          local &&
          !merged.some(
            (item) =>
              item.vehicleId === local.vehicleId &&
              item.year === local.year &&
              item.variant === local.variant &&
              (item.transmission || "") === (local.transmission || "")
          )
        ) {
          merged.unshift(local);
        }

        setSavedVehicles(merged);

        const accountVehicle = garageVehicles[0] || local;
        if (accountVehicle) {
          setSavedVehicle(accountVehicle);
          try {
            window.localStorage.setItem(
              "mivo:selectedVehicle",
              JSON.stringify(accountVehicle)
            );
          } catch {}
        }
      } catch {
      } finally {
        if (active) setLoadingSaved(false);
      }
    }

    void loadSaved();

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKey);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      active = false;
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = oldOverflow;
    };
  }, [open, onClose]);

  const makeData = useMemo(
    () => vehicleDatabase.find((entry) => entry.make === make),
    [make]
  );

  const models = useMemo(
    () =>
      Array.from(
        new Set((makeData?.vehicles || []).map((vehicle) => vehicle.model))
      ),
    [makeData]
  );

  const generations = useMemo(
    () =>
      (makeData?.vehicles || []).filter((vehicle) => vehicle.model === model),
    [makeData, model]
  );

  const selectedVehicle = useMemo(
    () => generations.find((vehicle) => vehicle.id === vehicleId),
    [generations, vehicleId]
  );

  const years = selectedVehicle ? yearsForVehicle(selectedVehicle) : [];
  const transmissions = selectedVehicle
    ? transmissionsForVehicle(selectedVehicle)
    : [];

  const progress = Math.min(step, TOTAL_STEPS) / TOTAL_STEPS * 100;

  function reset() {
    setStep(1);
    setMake("");
    setModel("");
    setVehicleId("");
    setYear("");
    setVariant("");
    setTransmission("");
  }

  function goBack() {
    setStep((current) => Math.max(1, current - 1));
  }

  function chooseMake(value: string) {
    setMake(value);
    setModel("");
    setVehicleId("");
    setYear("");
    setVariant("");
    setTransmission("");
    setStep(2);
  }

  function chooseModel(value: string) {
    setModel(value);
    setVehicleId("");
    setYear("");
    setVariant("");
    setTransmission("");
    setStep(3);
  }

  function chooseGeneration(value: string) {
    setVehicleId(value);
    setYear("");
    setVariant("");
    setTransmission("");
    setStep(4);
  }

  function chooseYear(value: string) {
    setYear(value);
    setVariant("");
    setTransmission("");
    setStep(5);
  }

  function chooseVariant(value: string) {
    setVariant(value);
    setTransmission("");
    setStep(6);
  }

  function chooseTransmission(value: string) {
    setTransmission(value);
    setStep(7);
  }

  async function applyVehicle(vehicle: AccountVehicle) {
    setApplying(true);

    try {
      try {
        window.localStorage.setItem(
          "mivo:selectedVehicle",
          JSON.stringify(vehicle)
        );
      } catch {}

      try {
        const synced = await saveAccountVehicle(vehicle);
        if (synced) {
          vehicle = synced;
          setSavedVehicle(synced);
          setSavedVehicles((current) => {
            const rest = current.filter(
              (item) =>
                !(
                  item.vehicleId === synced.vehicleId &&
                  item.year === synced.year &&
                  item.variant === synced.variant &&
                  (item.transmission || "") === (synced.transmission || "")
                )
            );
            return [synced, ...rest];
          });
          try {
            window.localStorage.setItem(
              "mivo:selectedVehicle",
              JSON.stringify(synced)
            );
          } catch {}
        }
      } catch {}

      const params = new URLSearchParams(window.location.search);
      params.set("vehicle", vehicle.vehicleId);
      params.set("make", vehicle.make);
      params.set("model", vehicle.model || "");
      params.set("generation", vehicle.generation || "");
      params.set("year", vehicle.year);
      params.set("variant", vehicle.variant);
      params.set("transmission", vehicle.transmission || "");

      onClose();
      router.replace(
        window.location.pathname + "?" + params.toString(),
        { scroll: false }
      );
    } finally {
      setApplying(false);
    }
  }

  async function confirmSelection() {
    if (
      !make ||
      !selectedVehicle ||
      !year ||
      !variant ||
      !transmission
    ) {
      return;
    }

    const vehicle: AccountVehicle = {
      make,
      vehicleId: selectedVehicle.id,
      model: selectedVehicle.model,
      generation: selectedVehicle.generation || undefined,
      year,
      variant,
      transmission,
      label: vehicleLabel(
        make,
        selectedVehicle,
        year,
        variant,
        transmission
      ),
    };

    await applyVehicle(vehicle);
  }

  if (!open) return null;

  return (
    <div
      className="productVehicleModalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Select your vehicle"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="productVehicleModal">
        <header className="productVehicleModalHead">
          <div>
            <span>MIVO VEHICLE FITMENT</span>
            <h2>Select your vehicle</h2>
            <p>Stay on this product page while MIVO checks compatibility.</p>
          </div>

          <button
            type="button"
            className="productVehicleModalClose"
            onClick={onClose}
            aria-label="Close vehicle selector"
          >
            ×
          </button>
        </header>

        {step === 1 && savedVehicles.length > 0 ? (
          <div className="productVehicleGarage">
            <div className="productVehicleGarageHead">
              <span>MY GARAGE</span>
              <strong>Quick switch vehicle</strong>
            </div>
            <div className="productVehicleGarageList">
              {savedVehicles.map((garageVehicle, index) => (
                <button
                  type="button"
                  className={
                    "productVehicleGarageItem" +
                    (savedVehicle &&
                    garageVehicle.vehicleId === savedVehicle.vehicleId &&
                    garageVehicle.year === savedVehicle.year &&
                    garageVehicle.variant === savedVehicle.variant &&
                    (garageVehicle.transmission || "") ===
                      (savedVehicle.transmission || "")
                      ? " active"
                      : "")
                  }
                  key={
                    garageVehicle.id ||
                    [
                      garageVehicle.vehicleId,
                      garageVehicle.year,
                      garageVehicle.variant,
                      garageVehicle.transmission || "",
                    ].join("::")
                  }
                  onClick={() => void applyVehicle(garageVehicle)}
                  disabled={applying}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{garageVehicle.label}</strong>
                    <small>
                      {index === 0 ? "CURRENT / DEFAULT VEHICLE" : "SAVED VEHICLE"}
                    </small>
                  </div>
                  <b>{applying ? "..." : "USE"}</b>
                </button>
              ))}
            </div>
            <div className="productVehicleGarageDivider">
              <span>OR SELECT ANOTHER VEHICLE</span>
            </div>
          </div>
        ) : loadingSaved && step === 1 ? (
          <div className="productVehicleSaved loading">
            Checking My Garage...
          </div>
        ) : null}

        <div className="productVehicleProgress">
          <i style={{ width: progress + "%" }} />
        </div>

        <div className="productVehicleStepTop">
          <span>
            {step <= TOTAL_STEPS
              ? "STEP " +
                String(step).padStart(2, "0") +
                " / " +
                String(TOTAL_STEPS).padStart(2, "0")
              : "CONFIRM VEHICLE"}
          </span>

          {step > 1 && step <= TOTAL_STEPS ? (
            <button type="button" onClick={goBack}>
              ← BACK
            </button>
          ) : null}
        </div>

        <div className="productVehicleBody">
          {step === 1 ? (
            <>
              <h3>What brand is your car?</h3>
              <div className="productVehicleChoiceGrid">
                {vehicleDatabase.map((entry) => (
                  <button
                    type="button"
                    key={entry.make}
                    onClick={() => chooseMake(entry.make)}
                  >
                    <strong>{entry.make}</strong>
                    <span>→</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h3>Which {make} model?</h3>
              <div className="productVehicleChoiceGrid">
                {models.map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => chooseModel(item)}
                  >
                    <strong>{item}</strong>
                    <span>→</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h3>Which generation?</h3>
              <div className="productVehicleChoiceGrid">
                {generations.map((vehicle) => (
                  <button
                    type="button"
                    key={vehicle.id}
                    onClick={() => chooseGeneration(vehicle.id)}
                  >
                    <div>
                      <strong>{vehicle.generation || vehicle.model}</strong>
                      <small>
                        {vehicle.startYear}–{vehicle.endYear ?? "Present"}
                      </small>
                    </div>
                    <span>→</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === 4 && selectedVehicle ? (
            <>
              <h3>What year is your car?</h3>
              <div className="productVehicleYearGrid">
                {years.map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => chooseYear(String(item))}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === 5 && selectedVehicle ? (
            <>
              <h3>Which variant?</h3>
              <div className="productVehicleChoiceGrid">
                {selectedVehicle.variants.map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => chooseVariant(item)}
                  >
                    <strong>{item}</strong>
                    <span>→</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === 6 && selectedVehicle ? (
            <>
              <h3>Which transmission?</h3>
              <div className="productVehicleTransmissionGrid">
                {transmissions.map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => chooseTransmission(item)}
                  >
                    <span>{item === "AUTO" ? "A" : "M"}</span>
                    <strong>
                      {item === "AUTO" ? "AUTOMATIC" : "MANUAL"}
                    </strong>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === 7 && selectedVehicle ? (
            <div className="productVehicleConfirm">
              <span className="productVehicleConfirmIcon">✓</span>
              <h3>Use this vehicle?</h3>

              <div className="productVehicleSummary">
                <div><span>MAKE</span><strong>{make}</strong></div>
                <div><span>MODEL</span><strong>{selectedVehicle.model}</strong></div>
                <div><span>GENERATION</span><strong>{selectedVehicle.generation || "—"}</strong></div>
                <div><span>YEAR</span><strong>{year}</strong></div>
                <div><span>VARIANT</span><strong>{variant}</strong></div>
                <div><span>TRANSMISSION</span><strong>{transmission}</strong></div>
              </div>

              <button
                type="button"
                className="productVehicleApply"
                onClick={() => void confirmSelection()}
                disabled={applying}
              >
                {applying ? "CHECKING FITMENT..." : "USE VEHICLE & CHECK FITMENT"}
              </button>

              <button
                type="button"
                className="productVehicleRestart"
                onClick={reset}
                disabled={applying}
              >
                START AGAIN
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  vehicleDatabase,
  yearsForVehicle,
  transmissionsForVehicle,
} from "@/data/vehicles";
import styles from "@/app/admin/Admin.module.css";

export type AdminFitmentVariantOption = {
  key: string;
  label: string;
  sku?: string;
  dbId?: string | null;
};

export type AdminFitmentDraft = {
  key: string;
  generationKey: string;
  make: string;
  model: string;
  generation: string;
  yearFrom: number;
  yearTo: number;
  variant: string;
  transmission: string;
  targetVariantKey?: string | null;
  targetVariantId?: string | null;
  targetVariantLabel?: string | null;
};

export default function AdminFitmentBuilder({
  value,
  onChange,
  variantOptions = [],
}: {
  value: AdminFitmentDraft[];
  onChange: (next: AdminFitmentDraft[]) => void;
  variantOptions?: AdminFitmentVariantOption[];
}) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [generationKey, setGenerationKey] = useState("");
  const [variant, setVariant] = useState("ALL");
  const [transmission, setTransmission] = useState("ALL");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [targetVariantKey, setTargetVariantKey] = useState("ALL");

  const makeData = useMemo(
    () => vehicleDatabase.find((entry) => entry.make === make),
    [make]
  );

  const models = useMemo(
    () =>
      Array.from(
        new Set((makeData?.vehicles || []).map((item) => item.model))
      ),
    [makeData]
  );

  const generations = useMemo(
    () => (makeData?.vehicles || []).filter((item) => item.model === model),
    [makeData, model]
  );

  const generation = useMemo(
    () => generations.find((item) => item.id === generationKey),
    [generations, generationKey]
  );

  const years = generation
    ? yearsForVehicle(generation).slice().reverse()
    : [];
  const transmissions = generation
    ? transmissionsForVehicle(generation)
    : [];

  const targetOption = useMemo(
    () =>
      variantOptions.find((item) => item.key === targetVariantKey) ||
      null,
    [variantOptions, targetVariantKey]
  );

  function resetAfterMake(next: string) {
    setMake(next);
    setModel("");
    setGenerationKey("");
    setVariant("ALL");
    setTransmission("ALL");
    setYearFrom("");
    setYearTo("");
  }

  function resetAfterModel(next: string) {
    setModel(next);
    setGenerationKey("");
    setVariant("ALL");
    setTransmission("ALL");
    setYearFrom("");
    setYearTo("");
  }

  function chooseGeneration(next: string) {
    setGenerationKey(next);
    const found = generations.find((item) => item.id === next);
    setVariant("ALL");
    setTransmission("ALL");
    setYearFrom(found ? String(found.startYear) : "");
    setYearTo(
      found ? String(found.endYear ?? new Date().getFullYear()) : ""
    );
  }

  function addFitments() {
    if (!generation || !make || !model) return;

    const selectedVariants =
      variant === "ALL" ? generation.variants : [variant];
    const selectedTransmissions =
      transmission === "ALL" ? transmissions : [transmission];

    const from = Number(yearFrom || generation.startYear);
    const to = Number(
      yearTo || generation.endYear || new Date().getFullYear()
    );

    const targetKey =
      targetVariantKey === "ALL" ? null : targetVariantKey;

    const additions: AdminFitmentDraft[] = [];

    for (const selectedVariant of selectedVariants) {
      for (const selectedTransmission of selectedTransmissions) {
        const key = [
          targetKey || "ALL-SKU",
          generation.id,
          from,
          to,
          selectedVariant,
          selectedTransmission,
        ].join("::");

        additions.push({
          key,
          generationKey: generation.id,
          make,
          model,
          generation: generation.generation || generation.model,
          yearFrom: Math.min(from, to),
          yearTo: Math.max(from, to),
          variant: selectedVariant,
          transmission: selectedTransmission,
          targetVariantKey: targetKey,
          targetVariantId: targetOption?.dbId || null,
          targetVariantLabel:
            targetKey && targetOption
              ? [targetOption.label, targetOption.sku]
                  .filter(Boolean)
                  .join(" · ")
              : null,
        });
      }
    }

    const merged = new Map(value.map((item) => [item.key, item]));
    additions.forEach((item) => merged.set(item.key, item));
    onChange(Array.from(merged.values()));
  }

  function remove(key: string) {
    onChange(value.filter((item) => item.key !== key));
  }

  return (
    <div className={styles.fitmentBuilder}>
      <div className={styles.fitmentBuilderHead}>
        <div>
          <span>VEHICLE COMPATIBILITY</span>
          <strong>Which vehicle can use which SKU?</strong>
          <p>
            Apply a fitment to the whole product or target one specific
            variation / SKU.
          </p>
        </div>
        <b>{value.length} MATCHES</b>
      </div>

      <div className={styles.fitmentBuilderGrid}>
        {variantOptions.length > 0 ? (
          <label className={styles.adminField}>
            <span>APPLIES TO</span>
            <select
              value={targetVariantKey}
              onChange={(event) =>
                setTargetVariantKey(event.target.value)
              }
            >
              <option value="ALL">ALL SKU / WHOLE PRODUCT</option>
              {variantOptions.map((option) => (
                <option value={option.key} key={option.key}>
                  {option.label}
                  {option.sku ? " · " + option.sku : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className={styles.adminField}>
          <span>MAKE</span>
          <select
            value={make}
            onChange={(event) =>
              resetAfterMake(event.target.value)
            }
          >
            <option value="">Choose make</option>
            {vehicleDatabase.map((entry) => (
              <option key={entry.make} value={entry.make}>
                {entry.make}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.adminField}>
          <span>MODEL</span>
          <select
            value={model}
            disabled={!make}
            onChange={(event) =>
              resetAfterModel(event.target.value)
            }
          >
            <option value="">Choose model</option>
            {models.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.adminField}>
          <span>GENERATION</span>
          <select
            value={generationKey}
            disabled={!model}
            onChange={(event) =>
              chooseGeneration(event.target.value)
            }
          >
            <option value="">Choose generation</option>
            {generations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.generation || item.model} · {item.startYear}–
                {item.endYear ?? "Present"}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.adminField}>
          <span>VEHICLE VARIANT</span>
          <select
            value={variant}
            disabled={!generation}
            onChange={(event) =>
              setVariant(event.target.value)
            }
          >
            <option value="ALL">ALL VEHICLE VARIANTS</option>
            {(generation?.variants || []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.adminField}>
          <span>YEAR FROM</span>
          <select
            value={yearFrom}
            disabled={!generation}
            onChange={(event) =>
              setYearFrom(event.target.value)
            }
          >
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.adminField}>
          <span>YEAR TO</span>
          <select
            value={yearTo}
            disabled={!generation}
            onChange={(event) =>
              setYearTo(event.target.value)
            }
          >
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.adminField}>
          <span>TRANSMISSION</span>
          <select
            value={transmission}
            disabled={!generation}
            onChange={(event) =>
              setTransmission(event.target.value)
            }
          >
            <option value="ALL">ALL TRANSMISSIONS</option>
            {transmissions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={styles.fitmentAddButton}
          onClick={addFitments}
          disabled={!generation}
        >
          + ADD COMPATIBLE VEHICLE
        </button>
      </div>

      {value.length > 0 ? (
        <div className={styles.fitmentList}>
          {value.map((item) => (
            <div
              className={styles.fitmentListRow}
              key={item.key}
            >
              <div>
                <strong>
                  {item.targetVariantKey
                    ? item.targetVariantLabel || "SPECIFIC SKU"
                    : "ALL SKU / WHOLE PRODUCT"}
                </strong>
                <span>
                  {item.make} {item.model} · {item.generation} ·{" "}
                  {item.yearFrom}–{item.yearTo} · {item.variant} ·{" "}
                  {item.transmission}
                </span>
              </div>
              <button
                type="button"
                onClick={() => remove(item.key)}
              >
                REMOVE
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.fitmentEmpty}>
          No vehicle fitment added yet. The storefront will show
          FITMENT NOT VERIFIED until compatibility is assigned.
        </p>
      )}
    </div>
  );
}

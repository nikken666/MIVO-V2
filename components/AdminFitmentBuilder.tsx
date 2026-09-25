"use client";

import { useMemo, useState } from "react";
import {
  vehicleDatabase,
  yearsForVehicle,
  transmissionsForVehicle,
} from "@/data/vehicles";
import styles from "@/app/admin/Admin.module.css";

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
};

export default function AdminFitmentBuilder({
  value,
  onChange,
}: {
  value: AdminFitmentDraft[];
  onChange: (next: AdminFitmentDraft[]) => void;
}) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [generationKey, setGenerationKey] = useState("");
  const [variant, setVariant] = useState("ALL");
  const [transmission, setTransmission] = useState("ALL");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  const makeData = useMemo(
    () => vehicleDatabase.find((entry) => entry.make === make),
    [make]
  );

  const models = useMemo(
    () => Array.from(new Set((makeData?.vehicles || []).map((item) => item.model))),
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

  const years = generation ? yearsForVehicle(generation).slice().reverse() : [];
  const transmissions = generation ? transmissionsForVehicle(generation) : [];

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

    const additions: AdminFitmentDraft[] = [];

    for (const selectedVariant of selectedVariants) {
      for (const selectedTransmission of selectedTransmissions) {
        const key = [
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
          <strong>Which cars can use this product?</strong>
          <p>
            Add one vehicle or use ALL VARIANTS / ALL TRANSMISSIONS to apply the
            product to a whole generation.
          </p>
        </div>
        <b>{value.length} MATCHES</b>
      </div>

      <div className={styles.fitmentBuilderGrid}>
        <label className={styles.adminField}>
          <span>MAKE</span>
          <select value={make} onChange={(e) => resetAfterMake(e.target.value)}>
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
            onChange={(e) => resetAfterModel(e.target.value)}
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
            onChange={(e) => chooseGeneration(e.target.value)}
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
          <span>VARIANT</span>
          <select
            value={variant}
            disabled={!generation}
            onChange={(e) => setVariant(e.target.value)}
          >
            <option value="ALL">ALL VARIANTS</option>
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
            onChange={(e) => setYearFrom(e.target.value)}
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
            onChange={(e) => setYearTo(e.target.value)}
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
            onChange={(e) => setTransmission(e.target.value)}
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
            <div className={styles.fitmentListRow} key={item.key}>
              <div>
                <strong>
                  {item.make} {item.model} · {item.generation}
                </strong>
                <span>
                  {item.yearFrom}–{item.yearTo} · {item.variant} ·{" "}
                  {item.transmission}
                </span>
              </div>
              <button type="button" onClick={() => remove(item.key)}>
                REMOVE
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.fitmentEmpty}>
          No vehicle fitment added yet. The storefront will show FITMENT NOT
          VERIFIED until compatibility is assigned.
        </p>
      )}
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  popularVehicleIds,
  vehicleDatabase,
  vehicleLabel,
  yearsForVehicle,
} from "@/data/vehicles";

type SavedVehicle = {
  make: string;
  vehicleId: string;
  year: string;
  variant: string;
  label: string;
};

export default function VehicleFinder() {
  const router = useRouter();
  const [make, setMake] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [year, setYear] = useState("");
  const [variant, setVariant] = useState("");
  const [saved, setSaved] = useState<SavedVehicle | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("mivo:selectedVehicle");
      if (raw) setSaved(JSON.parse(raw));
    } catch {}
  }, []);

  const makeData = useMemo(
    () => vehicleDatabase.find((entry) => entry.make === make),
    [make]
  );

  const selectedVehicle = useMemo(
    () => makeData?.vehicles.find((entry) => entry.id === vehicleId),
    [makeData, vehicleId]
  );

  const years = selectedVehicle ? yearsForVehicle(selectedVehicle) : [];

  function resetBelow(level: "make" | "vehicle" | "year") {
    if (level === "make") {
      setVehicleId("");
      setYear("");
      setVariant("");
    }
    if (level === "vehicle") {
      setYear("");
      setVariant("");
    }
    if (level === "year") {
      setVariant("");
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!make || !selectedVehicle || !year || !variant) return;

    const label = vehicleLabel(make, selectedVehicle, year, variant);
    const selected: SavedVehicle = {
      make,
      vehicleId: selectedVehicle.id,
      year,
      variant,
      label,
    };

    try {
      window.localStorage.setItem("mivo:selectedVehicle", JSON.stringify(selected));
      setSaved(selected);
    } catch {}

    const params = new URLSearchParams({
      vehicle: selectedVehicle.id,
      make,
      model: selectedVehicle.model,
      year,
      variant,
    });

    router.push("/products?" + params.toString());
  }

  function selectPopular(id: string) {
    for (const makeEntry of vehicleDatabase) {
      const vehicle = makeEntry.vehicles.find((item) => item.id === id);
      if (!vehicle) continue;
      setMake(makeEntry.make);
      setVehicleId(vehicle.id);
      setYear(String(vehicle.endYear));
      setVariant(vehicle.variants[0] || "");
      return;
    }
  }

  const popular = popularVehicleIds.flatMap((id) => {
    for (const makeEntry of vehicleDatabase) {
      const vehicle = makeEntry.vehicles.find((item) => item.id === id);
      if (vehicle) return [{ make: makeEntry.make, vehicle }];
    }
    return [];
  });

  return (
    <div className="fitmentCard" id="fitment">
      <div className="fitmentCardTop">
        <div>
          <span className="microLabel">MIVO VEHICLE MATCH</span>
          <h2>Find parts that fit.</h2>
        </div>
        <span className="fitmentBadge">LIVE</span>
      </div>

      <p className="fitmentIntro">
        Select your exact vehicle. Each step updates from the vehicle database.
      </p>

      <form className="fitmentForm" onSubmit={submit}>
        <label>
          <span>Make</span>
          <select
            value={make}
            onChange={(event) => {
              setMake(event.target.value);
              resetBelow("make");
            }}
          >
            <option value="">Select make</option>
            {vehicleDatabase.map((entry) => (
              <option key={entry.make} value={entry.make}>{entry.make}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Model / Generation</span>
          <select
            value={vehicleId}
            disabled={!makeData}
            onChange={(event) => {
              setVehicleId(event.target.value);
              resetBelow("vehicle");
            }}
          >
            <option value="">{makeData ? "Select model / generation" : "Select make first"}</option>
            {makeData?.vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.model}{vehicle.generation ? " · " + vehicle.generation : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="fitmentSplit">
          <label>
            <span>Year</span>
            <select
              value={year}
              disabled={!selectedVehicle}
              onChange={(event) => {
                setYear(event.target.value);
                resetBelow("year");
              }}
            >
              <option value="">{selectedVehicle ? "Select year" : "Select model first"}</option>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label>
            <span>Engine / Variant</span>
            <select
              value={variant}
              disabled={!year}
              onChange={(event) => setVariant(event.target.value)}
            >
              <option value="">{year ? "Select engine / variant" : "Select year first"}</option>
              {selectedVehicle?.variants.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>

        <button
          type="submit"
          className="fitmentSubmit"
          disabled={!make || !vehicleId || !year || !variant}
        >
          SHOW PARTS FOR THIS VEHICLE <span>→</span>
        </button>
      </form>

      <div className="popularVehicles">
        <span>POPULAR</span>
        <div>
          {popular.map(({ make: popularMake, vehicle }) => (
            <button key={vehicle.id} type="button" onClick={() => selectPopular(vehicle.id)}>
              {popularMake + " " + vehicle.model + (vehicle.generation ? " " + vehicle.generation : "")}
            </button>
          ))}
        </div>
      </div>

      <div className="garagePrompt">
        <div className="garageIcon">+</div>
        <div>
          <strong>{saved ? saved.label : "My Garage"}</strong>
          <small>{saved ? "Saved on this device" : "Save a vehicle and make future shopping faster."}</small>
        </div>
        <a href="/garage">{saved ? "Manage" : "Open Garage"}</a>
      </div>
    </div>
  );
}

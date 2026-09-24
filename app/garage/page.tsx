"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { vehicleDatabase } from "@/data/vehicles";

type SavedVehicle = {
  make: string;
  vehicleId: string;
  year: string;
  variant: string;
  transmission?: string;
  label: string;
};

export default function GaragePage() {
  const [vehicle, setVehicle] = useState<SavedVehicle | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("mivo:selectedVehicle");
      if (raw) setVehicle(JSON.parse(raw));
    } catch {}
  }, []);

  function removeVehicle() {
    try {
      window.localStorage.removeItem("mivo:selectedVehicle");
    } catch {}
    setVehicle(null);
  }

  const details = vehicle
    ? vehicleDatabase
        .flatMap((entry) => entry.vehicles.map((item) => ({ make: entry.make, ...item })))
        .find((item) => item.id === vehicle.vehicleId)
    : null;

  const query = vehicle
    ? new URLSearchParams({
        vehicle: vehicle.vehicleId,
        make: vehicle.make,
        model: details?.model || "",
        year: vehicle.year,
        variant: vehicle.variant,
        transmission: vehicle.transmission || "",
      }).toString()
    : "";

  return (
    <main className="garagePage">
      <section className="garageHero">
        <div className="container">
          <span className="sectionEyebrow">MIVO GARAGE</span>
          <h1>Your vehicle.<br />Ready when you are.</h1>
          <p>Save your vehicle once and use it as the starting point for every parts search.</p>
        </div>
      </section>

      <section className="container garageContent">
        {vehicle ? (
          <div className="savedVehicleCard">
            <div className="savedVehicleTop">
              <div>
                <span className="vehicleStatus">ACTIVE VEHICLE</span>
                <h2>{vehicle.label}</h2>
              </div>
              <div className="vehicleBadge">✓ SAVED</div>
            </div>

            <div className="vehicleFacts">
              <div><small>MAKE</small><strong>{vehicle.make}</strong></div>
              <div><small>MODEL</small><strong>{details?.model || "—"}</strong></div>
              <div><small>GENERATION</small><strong>{details?.generation || "—"}</strong></div>
              <div><small>YEAR</small><strong>{vehicle.year}</strong></div>
              <div><small>ENGINE / VARIANT</small><strong>{vehicle.variant}</strong></div>
              <div><small>TRANSMISSION</small><strong>{vehicle.transmission || "—"}</strong></div>
            </div>

            <div className="savedVehicleActions">
              <Link className="btn btnDark" href={"/products?" + query}>SHOP PARTS FOR THIS VEHICLE <span>→</span></Link>
              <Link className="garageSecondary" href="/#fitment">CHANGE VEHICLE</Link>
              <button className="garageRemove" type="button" onClick={removeVehicle}>REMOVE</button>
            </div>
          </div>
        ) : (
          <div className="garageEmpty">
            <span className="garageEmptyMark">+</span>
            <h2>No vehicle saved yet.</h2>
            <p>Select your car on the MIVO homepage and it will appear here.</p>
            <Link className="btn btnDark" href="/#fitment">SELECT MY VEHICLE <span>→</span></Link>
          </div>
        )}

        <div className="garageBenefits">
          <article><span>01</span><h3>Faster shopping</h3><p>Return to a vehicle-specific shopping flow without entering the same details again.</p></article>
          <article><span>02</span><h3>Clearer fitment</h3><p>Your selected make, model, year and variant stay visible while you browse.</p></article>
          <article><span>03</span><h3>Built to expand</h3><p>The garage structure is ready for multiple vehicles and account sync later.</p></article>
        </div>
      </section>
    </main>
  );
}

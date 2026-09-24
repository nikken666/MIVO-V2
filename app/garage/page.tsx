"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { vehicleDatabase } from "@/data/vehicles";
import {
  loadAccountVehicle,
  removeAccountVehicle,
  saveAccountVehicle,
  type AccountVehicle,
} from "@/lib/customerData";

export default function GaragePage() {
  const [vehicle, setVehicle] = useState<AccountVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadVehicle() {
      let localVehicle: AccountVehicle | null = null;

      try {
        const raw = window.localStorage.getItem("mivo:selectedVehicle");
        if (raw) {
          localVehicle = JSON.parse(raw) as AccountVehicle;
          if (active) setVehicle(localVehicle);
        }
      } catch {}

      try {
        const accountVehicle = await loadAccountVehicle();

        if (accountVehicle) {
          if (!active) return;
          setVehicle(accountVehicle);
          window.localStorage.setItem(
            "mivo:selectedVehicle",
            JSON.stringify(accountVehicle)
          );
          return;
        }

        if (localVehicle) {
          const details = vehicleDatabase
            .flatMap((entry) =>
              entry.vehicles.map((item) => ({
                make: entry.make,
                ...item,
              }))
            )
            .find((item) => item.id === localVehicle?.vehicleId);

          if (details) {
            const synced = await saveAccountVehicle({
              ...localVehicle,
              model: localVehicle.model || details.model,
              generation:
                localVehicle.generation || details.generation || undefined,
            });

            if (synced && active) {
              setVehicle(synced);
              window.localStorage.setItem(
                "mivo:selectedVehicle",
                JSON.stringify(synced)
              );
            }
          }
        }
      } catch {
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadVehicle();

    return () => {
      active = false;
    };
  }, []);

  const details = useMemo(
    () =>
      vehicle
        ? vehicleDatabase
            .flatMap((entry) =>
              entry.vehicles.map((item) => ({
                make: entry.make,
                ...item,
              }))
            )
            .find((item) => item.id === vehicle.vehicleId)
        : null,
    [vehicle]
  );

  async function removeVehicle() {
    setRemoving(true);

    try {
      await removeAccountVehicle(vehicle?.id);
    } catch {}

    try {
      window.localStorage.removeItem("mivo:selectedVehicle");
    } catch {}

    setVehicle(null);
    setRemoving(false);
  }

  const query = vehicle
    ? new URLSearchParams({
        vehicle: vehicle.vehicleId,
        make: vehicle.make,
        model: vehicle.model || details?.model || "",
        generation:
          vehicle.generation || details?.generation || "",
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
          <h1>
            Your vehicle.
            <br />
            Ready when you are.
          </h1>
          <p>
            Save your vehicle once. When you are signed in, MIVO keeps it
            synced to your account across devices.
          </p>
        </div>
      </section>

      <section className="container garageContent">
        {loading && !vehicle ? (
          <div className="garageEmpty">
            <span className="garageEmptyMark">·</span>
            <h2>Loading your garage.</h2>
            <p>Checking your saved MIVO vehicle.</p>
          </div>
        ) : vehicle ? (
          <div className="savedVehicleCard">
            <div className="savedVehicleTop">
              <div>
                <span className="vehicleStatus">ACTIVE VEHICLE</span>
                <h2>{vehicle.label}</h2>
              </div>
              <div className="vehicleBadge">
                {vehicle.id ? "✓ ACCOUNT SYNCED" : "✓ SAVED"}
              </div>
            </div>

            <div className="vehicleFacts">
              <div>
                <small>MAKE</small>
                <strong>{vehicle.make}</strong>
              </div>
              <div>
                <small>MODEL</small>
                <strong>{vehicle.model || details?.model || "—"}</strong>
              </div>
              <div>
                <small>GENERATION</small>
                <strong>
                  {vehicle.generation || details?.generation || "—"}
                </strong>
              </div>
              <div>
                <small>YEAR</small>
                <strong>{vehicle.year}</strong>
              </div>
              <div>
                <small>ENGINE / VARIANT</small>
                <strong>{vehicle.variant}</strong>
              </div>
              <div>
                <small>TRANSMISSION</small>
                <strong>{vehicle.transmission || "—"}</strong>
              </div>
            </div>

            <div className="savedVehicleActions">
              <Link className="btn btnDark" href={"/products?" + query}>
                SHOP PARTS FOR THIS VEHICLE <span>→</span>
              </Link>
              <Link className="garageSecondary" href="/#fitment">
                CHANGE VEHICLE
              </Link>
              <button
                className="garageRemove"
                type="button"
                onClick={removeVehicle}
                disabled={removing}
              >
                {removing ? "REMOVING..." : "REMOVE"}
              </button>
            </div>
          </div>
        ) : (
          <div className="garageEmpty">
            <span className="garageEmptyMark">+</span>
            <h2>No vehicle saved yet.</h2>
            <p>
              Select your car on the MIVO homepage. If you are signed in,
              it will be saved to your account automatically.
            </p>
            <Link className="btn btnDark" href="/#fitment">
              SELECT MY VEHICLE <span>→</span>
            </Link>
          </div>
        )}

        <div className="garageBenefits">
          <article>
            <span>01</span>
            <h3>Faster shopping</h3>
            <p>
              Return to a vehicle-specific shopping flow without entering the
              same details again.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Account synced</h3>
            <p>
              Signed-in customers can access the saved vehicle again on another
              phone or computer.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Clearer fitment</h3>
            <p>
              Your selected make, model, year, variant and transmission stay
              available while you browse.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}

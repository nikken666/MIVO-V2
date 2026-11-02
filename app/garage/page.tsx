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
import { useT } from "@/components/LanguageProvider";

export default function GaragePage() {
  const t = useT();
  const [vehicle, setVehicle] = useState<AccountVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");

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
    setRemoveError("");

    try {
      const nextVehicle = await removeAccountVehicle(vehicle?.id);
      setVehicle(nextVehicle);
      try {
        if (nextVehicle) {
          window.localStorage.setItem(
            "mivo:selectedVehicle",
            JSON.stringify(nextVehicle)
          );
        } else {
          window.localStorage.removeItem("mivo:selectedVehicle");
        }
      } catch {}
    } catch (caught) {
      setRemoveError(
        caught instanceof Error ? caught.message : t("account.garage.removeError")
      );
    } finally {
      setRemoving(false);
    }
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
          <span className="sectionEyebrow">{t("account.garage.eyebrow")}</span>
          <h1>
            {t("account.garage.heroLine1")}
            <br />
            {t("account.garage.heroLine2")}
          </h1>
          <p>
            {t("account.garage.heroText")}
          </p>
        </div>
      </section>

      <section className="container garageContent">
        {loading && !vehicle ? (
          <div className="garageEmpty">
            <span className="garageEmptyMark">·</span>
            <h2>{t("account.garage.loadingTitle")}</h2>
            <p>{t("account.garage.loadingText")}</p>
          </div>
        ) : vehicle ? (
          <div className="savedVehicleCard">
            <div className="savedVehicleTop">
              <div>
                <span className="vehicleStatus">{t("account.garage.active")}</span>
                <h2>{vehicle.label}</h2>
              </div>
              <div className="vehicleBadge">
                {vehicle.id ? "✓ " + t("account.garage.synced") : "✓ " + t("account.garage.saved")}
              </div>
            </div>

            <div className="vehicleFacts">
              <div>
                <small>{t("account.garage.make")}</small>
                <strong>{vehicle.make}</strong>
              </div>
              <div>
                <small>{t("account.garage.model")}</small>
                <strong>{vehicle.model || details?.model || "—"}</strong>
              </div>
              <div>
                <small>{t("account.garage.generation")}</small>
                <strong>
                  {vehicle.generation || details?.generation || "—"}
                </strong>
              </div>
              <div>
                <small>{t("account.garage.year")}</small>
                <strong>{vehicle.year}</strong>
              </div>
              <div>
                <small>{t("account.garage.variant")}</small>
                <strong>{vehicle.variant}</strong>
              </div>
              <div>
                <small>{t("account.garage.transmission")}</small>
                <strong>{vehicle.transmission || "—"}</strong>
              </div>
            </div>

            <div className="savedVehicleActions">
              <Link className="btn btnDark" href={"/products?" + query}>
                {t("account.garage.shopParts")} <span>→</span>
              </Link>
              <Link
                className="garageSecondary"
                href="/?addVehicle=1#fitment"
              >
                + {t("account.garage.addAnother")}
              </Link>
              <button
                className="garageRemove"
                type="button"
                onClick={removeVehicle}
                disabled={removing}
              >
                {removing ? t("account.garage.removing") : t("account.garage.remove")}
              </button>
            </div>
            {removeError && <p role="alert">{removeError}</p>}
          </div>
        ) : (
          <div className="garageEmpty">
            <span className="garageEmptyMark">+</span>
            <h2>{t("account.garage.emptyTitle")}</h2>
            <p>
              {t("account.garage.emptyText")}
            </p>
            <Link className="btn btnDark" href="/#fitment">
              {t("account.garage.selectVehicle")} <span>→</span>
            </Link>
          </div>
        )}

        <div className="garageBenefits">
          <article>
            <span>01</span>
            <h3>{t("account.garage.benefit1Title")}</h3>
            <p>
              {t("account.garage.benefit1Text")}
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>{t("account.garage.benefit2Title")}</h3>
            <p>
              {t("account.garage.benefit2Text")}
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>{t("account.garage.benefit3Title")}</h3>
            <p>
              {t("account.garage.benefit3Text")}
            </p>

          </article>
        </div>
      </section>
    </main>
  );
}

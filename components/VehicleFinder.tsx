"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  vehicleDatabase,
  vehicleLabel,
  yearsForVehicle,
  transmissionsForVehicle,
} from "@/data/vehicles";
import {
  loadAccountVehicle,
  saveAccountVehicle,
  type AccountVehicle,
} from "@/lib/customerData";
import { useT } from "@/components/LanguageProvider";

const TOTAL_STEPS = 6;

export default function VehicleFinder() {
  const t = useT();
  const [step, setStep] = useState(1);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [year, setYear] = useState("");
  const [variant, setVariant] = useState("");
  const [transmission, setTransmission] = useState("");
  const [saved, setSaved] = useState<AccountVehicle | null>(null);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const finderRef = useRef<HTMLDivElement | null>(null);
  const quizTopRef = useRef<HTMLDivElement | null>(null);
  const previousStepRef = useRef(step);

  function scrollFinderToTop() {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(min-width: 851px)").matches) return;

    const run = () => {
      const target = quizTopRef.current || finderRef.current;
      if (!target) return;

      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      });
    };

    window.requestAnimationFrame(() => window.requestAnimationFrame(run));
    window.setTimeout(run, 90);
    window.setTimeout(run, 260);
  }

  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    scrollFinderToTop();
  }, [step]);

  useEffect(() => {
    let active = true;

    async function loadSavedVehicle() {
      let localSaved: AccountVehicle | null = null;

      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get("addVehicle") === "1") {
          setAddingVehicle(true);
        }
      } catch {}

      try {
        const raw = window.localStorage.getItem("mivo:selectedVehicle");
        if (raw) {
          localSaved = JSON.parse(raw) as AccountVehicle;
          if (active) setSaved(localSaved);
        }
      } catch {}

      try {
        const accountVehicle = await loadAccountVehicle();

        if (accountVehicle) {
          if (!active) return;
          setSaved(accountVehicle);
          window.localStorage.setItem(
            "mivo:selectedVehicle",
            JSON.stringify(accountVehicle)
          );
          return;
        }

        if (localSaved) {
          const details = vehicleDatabase
            .flatMap((entry) =>
              entry.vehicles.map((vehicle) => ({
                make: entry.make,
                ...vehicle,
              }))
            )
            .find((vehicle) => vehicle.id === localSaved?.vehicleId);

          if (details) {
            const synced = await saveAccountVehicle({
              ...localSaved,
              model: localSaved.model || details.model,
              generation:
                localSaved.generation || details.generation || undefined,
            });

            if (synced && active) {
              setSaved(synced);
              window.localStorage.setItem(
                "mivo:selectedVehicle",
                JSON.stringify(synced)
              );
            }
          }
        }
      } catch {}
      finally {
        if (active) setSavedLoaded(true);
      }
    }

    void loadSavedVehicle();

    return () => {
      active = false;
    };
  }, []);

  const makeData = useMemo(
    () => vehicleDatabase.find((entry) => entry.make === make),
    [make]
  );

  const models = useMemo(() => {
    const vehicles = makeData?.vehicles || [];
    const firstYearByModel = new Map<string, number>();

    for (const vehicle of vehicles) {
      const current = firstYearByModel.get(vehicle.model);
      if (current === undefined || vehicle.startYear < current) {
        firstYearByModel.set(vehicle.model, vehicle.startYear);
      }
    }

    const chronological = Array.from(firstYearByModel.entries())
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .map(([modelName]) => modelName);

    if (!makeData?.modelOrder?.length) return chronological;

    const ordered = makeData.modelOrder.filter((modelName) =>
      firstYearByModel.has(modelName)
    );
    const included = new Set(ordered);

    return [
      ...ordered,
      ...chronological.filter((modelName) => !included.has(modelName)),
    ];
  }, [makeData]);

  const generations = useMemo(
    () =>
      (makeData?.vehicles || [])
        .filter((vehicle) => vehicle.model === model)
        .sort((a, b) => a.startYear - b.startYear),
    [makeData, model]
  );

  const selectedVehicle = useMemo(
    () => generations.find((vehicle) => vehicle.id === vehicleId),
    [generations, vehicleId]
  );

  const years = selectedVehicle ? yearsForVehicle(selectedVehicle) : [];
  const transmissions = selectedVehicle ? transmissionsForVehicle(selectedVehicle) : [];

  const answerTrail = [
    make,
    model,
    selectedVehicle?.generation,
    year,
    variant,
    transmission,
  ].filter((answer): answer is string => Boolean(answer));

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

  function goBack() {
    if (step === 1) return;

    if (step === 2) {
      setMake("");
      setModel("");
      setVehicleId("");
      setYear("");
      setVariant("");
      setTransmission("");
    } else if (step === 3) {
      setModel("");
      setVehicleId("");
      setYear("");
      setVariant("");
      setTransmission("");
    } else if (step === 4) {
      setVehicleId("");
      setYear("");
      setVariant("");
      setTransmission("");
    } else if (step === 5) {
      setYear("");
      setVariant("");
      setTransmission("");
    } else if (step === 6) {
      setVariant("");
      setTransmission("");
    } else if (step === 7) {
      setTransmission("");
    }

    setStep((current) => Math.max(1, current - 1));
  }

  function restart() {
    setStep(1);
    setMake("");
    setModel("");
    setVehicleId("");
    setYear("");
    setVariant("");
    setTransmission("");
  }

  async function confirmVehicle() {
    if (!make || !selectedVehicle || !year || !variant || !transmission) return;

    setIsNavigating(true);

    const label = vehicleLabel(
      make,
      selectedVehicle,
      year,
      variant,
      transmission
    );

    const selected: AccountVehicle = {
      make,
      vehicleId: selectedVehicle.id,
      model: selectedVehicle.model,
      generation: selectedVehicle.generation || undefined,
      year,
      variant,
      transmission,
      label,
    };

    try {
      window.localStorage.setItem(
        "mivo:selectedVehicle",
        JSON.stringify(selected)
      );
      setSaved(selected);
    } catch {}

    try {
      const synced = await saveAccountVehicle(selected);
      if (synced) {
        setSaved(synced);
        window.localStorage.setItem(
          "mivo:selectedVehicle",
          JSON.stringify(synced)
        );
      }
    } catch {}

    const params = new URLSearchParams({
      vehicle: selectedVehicle.id,
      make,
      model: selectedVehicle.model,
      generation: selectedVehicle.generation || "",
      year,
      variant,
      transmission,
    });

    window.location.assign("/products?" + params.toString());
  }

  const progress = step <= TOTAL_STEPS ? (step / TOTAL_STEPS) * 100 : 100;

  const savedVehicleQuery = saved
    ? new URLSearchParams({
        vehicle: saved.vehicleId,
        make: saved.make,
        model: saved.model || "",
        generation: saved.generation || "",
        year: saved.year,
        variant: saved.variant,
        transmission: saved.transmission || "",
      }).toString()
    : "";

  if (!savedLoaded) {
    return (
      <div className="fitmentCard quizFitment savedVehicleHomeCard" id="fitment">
        <div className="savedVehicleHomeLoading">
          <span className="microLabel">{t("buy.vf.garage")}</span>
          <strong>{t("buy.vf.loading")}</strong>
        </div>
      </div>
    );
  }

  if (saved && !addingVehicle) {
    return (
      <div className="fitmentCard quizFitment savedVehicleHomeCard" id="fitment">
        <div className="savedVehicleAmbient" aria-hidden="true">M</div>

        <div className="savedVehicleHomeTop">
          <div>
            <span className="savedVehicleEyebrow">{t("buy.vf.activeEyebrow")}</span>
            <h2>
              <span>{saved.make}</span>
              {saved.model || t("buy.vf.vehicle")}
            </h2>
            <p>
              {[saved.generation, saved.year].filter(Boolean).join(" · ")}
            </p>
          </div>
          <span className="savedVehicleStatus">{t("buy.vf.active")}</span>
        </div>

        <div className="savedVehicleSpecLine">
          <div>
            <small>{t("buy.v.variant")}</small>
            <strong>{saved.variant}</strong>
          </div>
          <i />
          <div>
            <small>{t("buy.v.transmission")}</small>
            <strong>{saved.transmission === "AUTO" ? t("buy.v.automatic") : saved.transmission === "MANUAL" ? t("buy.v.manual") : saved.transmission || "—"}</strong>
          </div>
          <i />
          <div>
            <small>{t("buy.vf.fitment")}</small>
            <strong>{t("buy.vf.ready")}</strong>
          </div>
        </div>

        <a
          className="savedVehiclePrimary"
          href={"/products?" + savedVehicleQuery}
        >
          <span>
            <small>{t("buy.vf.shopForVehicle")}</small>
            {t("buy.vf.compatibleParts")}
          </span>
          <b>→</b>
        </a>

        <div className="savedVehicleHomeFooter">
          <button
            type="button"
            onClick={() => {
              restart();
              setAddingVehicle(true);
            }}
          >
            {t("header.addCar")}
          </button>
          <span>
            {saved.id ? t("buy.pd.accountSynced") : t("buy.vf.savedOnDevice")}
          </span>
          <a href="/garage">{t("buy.vf.manageGarage")}</a>
        </div>
      </div>
    );
  }

  return (
    <div ref={finderRef} className="fitmentCard quizFitment" id="fitment">
      <div ref={quizTopRef} className="quizTop">
        <div>
          <span className="microLabel">
            {saved ? t("buy.vf.addAnother") : t("buy.vf.vehicleMatch")}
          </span>
          <h2>{t("buy.vf.tellUs")}</h2>
        </div>
        {saved ? (
          <button
            type="button"
            className="vehicleFinderCancel"
            onClick={() => {
              restart();
              setAddingVehicle(false);
            }}
          >
            {t("buy.vf.cancel")}
          </button>
        ) : (
          <span className="fitmentBadge">{t("buy.vf.live")}</span>
        )}
      </div>

      <div className="quizProgress" aria-hidden="true">
        <i style={{ width: progress + "%" }} />
      </div>

      {step <= TOTAL_STEPS ? (
        <div className="quizStepMeta">
          <span>{t("buy.vf.question", { n: String(step).padStart(2, "0"), total: String(TOTAL_STEPS).padStart(2, "0") })}</span>
          {step > 1 ? (
            <button type="button" onClick={goBack}>{t("buy.v.back")}</button>
          ) : (
            <span />
          )}
        </div>
      ) : null}

      {answerTrail.length > 0 && step <= TOTAL_STEPS ? (
        <div className="quizTrail">
          {answerTrail.map((answer, index) => (
            <span key={answer + index}>{answer}</span>
          ))}
        </div>
      ) : null}

      <div className="quizBody">
        {step === 1 ? (
          <>
            <span className="quizKicker">{t("buy.vf.letsStart")}</span>
            <h3>{t("buy.v.whatBrand")}</h3>
            <p>{t("buy.vf.tapBrand")}</p>
            <div className="quizAnswers quizAnswers--makes">
              {vehicleDatabase.map((entry) => (
                <button
                  type="button"
                  className="quizAnswer"
                  key={entry.make}
                  onClick={() => chooseMake(entry.make)}
                >
                  <strong>{entry.make}</strong>
                  <span>{t("buy.vf.choose", { make: entry.make })}</span>
                  <b>→</b>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <span className="quizKicker">{t("buy.vf.yourMake", { make })}</span>
            <h3>{t("buy.vf.whichModel")}</h3>
            <p>{t("buy.vf.whichModelHint")}</p>
            <div className="quizAnswers quizAnswers--models">
              {models.map((item) => (
                <button
                  type="button"
                  className="quizAnswer"
                  key={item}
                  onClick={() => chooseModel(item)}
                >
                  <strong>{item}</strong>
                  <span>{make}</span>
                  <b>→</b>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <span className="quizKicker">{make.toUpperCase()} · {model.toUpperCase()}</span>
            <h3>{t("buy.vf.whichGeneration")}</h3>
            <p>{t("buy.vf.generationHint")}</p>
            <div className="quizAnswers quizAnswers--generations">
              {generations.map((vehicle) => (
                <button
                  type="button"
                  className="quizAnswer quizAnswer--generation"
                  key={vehicle.id}
                  onClick={() => chooseGeneration(vehicle.id)}
                >
                  <div>
                    <strong>{vehicle.generation || vehicle.model}</strong>
                    <span>{vehicle.startYear}–{vehicle.endYear ?? t("buy.v.present")}</span>
                  </div>
                  <b>→</b>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 4 && selectedVehicle ? (
          <>
            <span className="quizKicker">{selectedVehicle.generation || selectedVehicle.model}</span>
            <h3>{t("buy.v.whatYear")}</h3>
            <p>{t("buy.vf.yearHint")}</p>
            <div className="quizAnswers quizAnswers--years">
              {years.map((item) => (
                <button
                  type="button"
                  className="quizYear"
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
            <span className="quizKicker">{year} · {selectedVehicle.model}</span>
            <h3>{t("buy.vf.whichVariant")}</h3>
            <p>{t("buy.vf.variantHint")}</p>
            <div className="quizAnswers quizAnswers--variants">
              {selectedVehicle.variants.map((item) => (
                <button
                  type="button"
                  className="quizAnswer"
                  key={item}
                  onClick={() => chooseVariant(item)}
                >
                  <strong>{item}</strong>
                  <b>→</b>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 6 && selectedVehicle ? (
          <>
            <span className="quizKicker">{variant}</span>
            <h3>{t("buy.vf.autoOrManual")}</h3>
            <p>{t("buy.vf.transmissionHint")}</p>
            <div className="quizTransmission">
              {transmissions.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => chooseTransmission(item)}
                >
                  <span>{item === "AUTO" ? "A" : "M"}</span>
                  <strong>{item === "AUTO" ? t("buy.v.automatic") : t("buy.v.manual")}</strong>
                  <small>{item === "AUTO" ? t("buy.vf.automaticTransmission") : t("buy.vf.manualTransmission")}</small>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 7 && selectedVehicle ? (
          <div className="quizConfirm">
            <span className="quizConfirmIcon">✓</span>
            <span className="quizKicker">{t("buy.vf.yourVehicle")}</span>
            <h3>{t("buy.vf.isThisYourCar")}</h3>

            <div className="quizVehicleSummary">
              <div><small>{t("buy.v.make")}</small><strong>{make}</strong></div>
              <div><small>{t("buy.v.model")}</small><strong>{selectedVehicle.model}</strong></div>
              <div><small>{t("buy.v.generation")}</small><strong>{selectedVehicle.generation || "—"}</strong></div>
              <div><small>{t("buy.v.year")}</small><strong>{year}</strong></div>
              <div><small>{t("buy.v.variant")}</small><strong>{variant}</strong></div>
              <div><small>{t("buy.v.transmission")}</small><strong>{transmission === "AUTO" ? t("buy.v.automatic") : transmission === "MANUAL" ? t("buy.v.manual") : transmission}</strong></div>
            </div>

            <button
              type="button"
              className="fitmentSubmit quizConfirmButton"
              onClick={confirmVehicle}
              disabled={isNavigating}
            >
              {isNavigating ? t("buy.vf.finding") : t("buy.vf.yesFind")} <span>→</span>
            </button>
            <button type="button" className="quizRestart" onClick={restart}>
              {t("buy.vf.noRestart")}
            </button>
          </div>
        ) : null}
      </div>

      <div className="garagePrompt quizGaragePrompt">
        <div className="garageIcon">+</div>
        <div>
          <strong>{saved ? saved.label : t("buy.vf.alreadySaved")}</strong>
          <small>
            {saved
              ? saved.id
                ? t("buy.vf.syncedAccount")
                : t("buy.vf.savedOnDevice")
              : t("buy.vf.openGarageHint")}
          </small>
        </div>
        <a href="/garage">{saved ? t("buy.v.manage") : t("buy.vf.openGarage")}</a>
      </div>
    </div>
  );
}

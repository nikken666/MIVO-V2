"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  vehicleDatabase,
  vehicleLabel,
  yearsForVehicle,
  transmissionsForVehicle,
} from "@/data/vehicles";

type SavedVehicle = {
  make: string;
  vehicleId: string;
  year: string;
  variant: string;
  transmission: string;
  label: string;
};

const TOTAL_STEPS = 6;

export default function VehicleFinder() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [year, setYear] = useState("");
  const [variant, setVariant] = useState("");
  const [transmission, setTransmission] = useState("");
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

  const models = useMemo(
    () => Array.from(new Set((makeData?.vehicles || []).map((vehicle) => vehicle.model))),
    [makeData]
  );

  const generations = useMemo(
    () => (makeData?.vehicles || []).filter((vehicle) => vehicle.model === model),
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

  function confirmVehicle() {
    if (!make || !selectedVehicle || !year || !variant || !transmission) return;

    const label = vehicleLabel(make, selectedVehicle, year, variant, transmission);
    const selected: SavedVehicle = {
      make,
      vehicleId: selectedVehicle.id,
      year,
      variant,
      transmission,
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
      generation: selectedVehicle.generation || "",
      year,
      variant,
      transmission,
    });

    router.push("/products?" + params.toString());
  }

  const progress = step <= TOTAL_STEPS ? (step / TOTAL_STEPS) * 100 : 100;

  return (
    <div className="fitmentCard quizFitment" id="fitment">
      <div className="quizTop">
        <div>
          <span className="microLabel">MIVO VEHICLE MATCH</span>
          <h2>Tell us about your car.</h2>
        </div>
        <span className="fitmentBadge">LIVE</span>
      </div>

      <div className="quizProgress" aria-hidden="true">
        <i style={{ width: progress + "%" }} />
      </div>

      {step <= TOTAL_STEPS ? (
        <div className="quizStepMeta">
          <span>QUESTION {String(step).padStart(2, "0")} / {String(TOTAL_STEPS).padStart(2, "0")}</span>
          {step > 1 ? (
            <button type="button" onClick={goBack}>← BACK</button>
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
            <span className="quizKicker">LET'S START</span>
            <h3>What brand is your car?</h3>
            <p>Tap the brand you drive.</p>
            <div className="quizAnswers quizAnswers--makes">
              {vehicleDatabase.map((entry) => (
                <button
                  type="button"
                  className="quizAnswer"
                  key={entry.make}
                  onClick={() => chooseMake(entry.make)}
                >
                  <strong>{entry.make}</strong>
                  <span>Choose {entry.make}</span>
                  <b>→</b>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <span className="quizKicker">YOUR {make.toUpperCase()}</span>
            <h3>Which model do you drive?</h3>
            <p>Choose the model name first. We'll ask for the exact generation next.</p>
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
            <h3>Which generation is yours?</h3>
            <p>The year range is shown here so you can identify the correct generation.</p>
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
                    <span>{vehicle.startYear}–{vehicle.endYear ?? "Present"}</span>
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
            <h3>What year is your car?</h3>
            <p>Only years available for this generation are shown.</p>
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
            <h3>Which variant is your car?</h3>
            <p>Choose the engine / trim that matches your vehicle.</p>
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
            <h3>Automatic or manual?</h3>
            <p>Transmission matters for some drivetrain and gearbox-related parts.</p>
            <div className="quizTransmission">
              {transmissions.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => chooseTransmission(item)}
                >
                  <span>{item === "AUTO" ? "A" : "M"}</span>
                  <strong>{item === "AUTO" ? "AUTOMATIC" : "MANUAL"}</strong>
                  <small>{item === "AUTO" ? "Automatic transmission" : "Manual transmission"}</small>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 7 && selectedVehicle ? (
          <div className="quizConfirm">
            <span className="quizConfirmIcon">✓</span>
            <span className="quizKicker">YOUR VEHICLE</span>
            <h3>Is this your car?</h3>

            <div className="quizVehicleSummary">
              <div><small>MAKE</small><strong>{make}</strong></div>
              <div><small>MODEL</small><strong>{selectedVehicle.model}</strong></div>
              <div><small>GENERATION</small><strong>{selectedVehicle.generation || "—"}</strong></div>
              <div><small>YEAR</small><strong>{year}</strong></div>
              <div><small>VARIANT</small><strong>{variant}</strong></div>
              <div><small>TRANSMISSION</small><strong>{transmission}</strong></div>
            </div>

            <button type="button" className="fitmentSubmit quizConfirmButton" onClick={confirmVehicle}>
              YES, FIND MY PARTS <span>→</span>
            </button>
            <button type="button" className="quizRestart" onClick={restart}>
              NO, START AGAIN
            </button>
          </div>
        ) : null}
      </div>

      <div className="garagePrompt quizGaragePrompt">
        <div className="garageIcon">+</div>
        <div>
          <strong>{saved ? saved.label : "Already saved a car?"}</strong>
          <small>{saved ? "Saved on this device" : "Open My Garage and continue shopping."}</small>
        </div>
        <a href="/garage">{saved ? "Manage" : "Open Garage"}</a>
      </div>
    </div>
  );
}

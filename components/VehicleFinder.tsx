"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function VehicleFinder() {
  const router = useRouter();
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [variant, setVariant] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (brand) params.set("brand", brand);
    if (model) params.set("model", model);
    if (year) params.set("year", year);
    if (variant) params.set("variant", variant);
    router.push(`/products?${params.toString()}`);
  }

  return (
    <section className="vehicleSection">
      <form className="container vehiclePanel" onSubmit={submit}>
        <div className="vehicleIntro"><span className="vehicleIcon">🚘</span><div><strong>SELECT YOUR VEHICLE</strong><small>Find the right parts for your car</small></div></div>
        <label className="selector"><span>Select Brand</span><select value={brand} onChange={(e) => setBrand(e.target.value)}><option value="">Choose Brand</option><option>Perodua</option><option>Proton</option><option>Toyota</option><option>Honda</option></select></label>
        <label className="selector"><span>Select Model</span><select value={model} onChange={(e) => setModel(e.target.value)}><option value="">Choose Model</option><option>Myvi</option><option>Axia</option><option>Bezza</option><option>Alza</option></select></label>
        <label className="selector"><span>Select Year</span><select value={year} onChange={(e) => setYear(e.target.value)}><option value="">Choose Year</option><option>2026</option><option>2025</option><option>2024</option></select></label>
        <label className="selector"><span>Select Variant</span><select value={variant} onChange={(e) => setVariant(e.target.value)}><option value="">Choose Variant</option><option>1.3</option><option>1.5</option><option>Auto</option></select></label>
        <button className="redButton" type="submit">Find Parts</button>
      </form>
    </section>
  );
}

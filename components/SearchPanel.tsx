"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchPanel() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    router.push(`/products?q=${encodeURIComponent(query.trim())}`);
  }
  return (
    <section className="container searchPanel">
      <form className="searchInputWrap" onSubmit={submit}><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by part name, OEM, SKU, or brand..." /><button className="redButton searchButton" type="submit">Search</button></form>
      <button className="toolButton" onClick={() => router.push("/garage?tab=vin")}>⌘ VIN Search <b>New</b></button>
      <button className="toolButton" onClick={() => router.push("/garage?tab=plate")}>▣ Plate Number Search <b>New</b></button>
      <button className="toolButton" onClick={() => router.push("/garage")}>🚘 My Garage</button>
    </section>
  );
}

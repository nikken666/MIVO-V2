"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/LanguageProvider";

export default function SearchPanel() {
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    router.push(`/products?q=${encodeURIComponent(query.trim())}`);
  }
  return (
    <section className="container searchPanel">
      <form className="searchInputWrap" onSubmit={submit}><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("browse.searchPanel.placeholder")} /><button className="redButton searchButton" type="submit">{t("browse.search")}</button></form>
      <button className="toolButton" onClick={() => router.push("/garage?tab=vin")}>⌘ {t("browse.searchPanel.vin")} <b>{t("browse.searchPanel.new")}</b></button>
      <button className="toolButton" onClick={() => router.push("/garage?tab=plate")}>▣ {t("browse.searchPanel.plate")} <b>{t("browse.searchPanel.new")}</b></button>
      <button className="toolButton" onClick={() => router.push("/garage")}>🚘 {t("browse.searchPanel.garage")}</button>
    </section>
  );
}

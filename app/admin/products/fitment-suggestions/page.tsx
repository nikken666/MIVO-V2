"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { suggestFitment, type FitmentSuggestion, type Generation } from "@/lib/fitmentSuggest";
import styles from "../../Admin.module.css";
import ui from "../../store-health/StoreHealth.module.css";
import AdminSidebar from "@/components/admin/AdminSidebar";

type ProductRow = { id: string; name: string; status: string; seller_id: string; is_universal_fitment: boolean };
type VehicleRow = { id: string; make: string; model: string; generation: string; generation_key: string; year_from: number; year_to: number | null };
type Row = { product: ProductRow; suggestions: FitmentSuggestion[] };

const BATCH = 1000;
const label: Record<FitmentSuggestion["confidence"], string> = { high: "High", medium: "Medium", low: "Low" };

export default function FitmentSuggestionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [vehiclesByGen, setVehiclesByGen] = useState<Map<string, VehicleRow[]>>(new Map());
  const [shops, setShops] = useState<Array<{ id: string; shop_name: string }>>([]);
  const [shopFilter, setShopFilter] = useState("");
  const [confFilter, setConfFilter] = useState<"all" | "high" | "medium" | "low" | "none">("all");
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [busy, setBusy] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const client = createClient();
        const { data: { user } } = await client.auth.getUser();
        if (!user) {
          window.location.assign("/login?next=/admin/products/fitment-suggestions");
          return;
        }
        const { data: isAdmin } = await client.rpc("is_admin");
        if (!isAdmin) {
          window.location.assign("/admin");
          return;
        }

        async function pages<T>(table: string, columns: string, filter?: (q: any) => any): Promise<T[]> {
          const out: T[] = [];
          for (let from = 0; ; from += BATCH) {
            let query = client.from(table).select(columns).order("id").range(from, from + BATCH - 1);
            if (filter) query = filter(query);
            const { data, error: pageError } = await query;
            if (pageError) throw pageError;
            out.push(...((data || []) as T[]));
            if (!data || data.length < BATCH) break;
          }
          return out;
        }

        const [vehicles, products, fitted, shopRes] = await Promise.all([
          pages<VehicleRow>("vehicles", "id, make, model, generation, generation_key, year_from, year_to", (q) => q.eq("is_active", true)),
          pages<ProductRow>("products", "id, name, status, seller_id, is_universal_fitment"),
          pages<{ product_id: string }>("product_vehicle_fitments", "product_id"),
          client.from("sellers").select("id, shop_name").order("shop_name"),
        ]);
        setShops((shopRes.data || []) as Array<{ id: string; shop_name: string }>);

        const byGen = new Map<string, VehicleRow[]>();
        for (const v of vehicles) byGen.set(v.generation_key, [...(byGen.get(v.generation_key) || []), v]);
        setVehiclesByGen(byGen);

        const generations: Generation[] = [...byGen.values()].map((list) => ({
          key: list[0].generation_key,
          make: list[0].make,
          model: list[0].model,
          generation: list[0].generation,
          yearFrom: Math.min(...list.map((v) => v.year_from)),
          yearTo: list.some((v) => v.year_to === null) ? null : Math.max(...list.map((v) => v.year_to as number)),
        }));

        const fittedIds = new Set(fitted.map((f) => f.product_id));
        const todo = products
          .filter((p) => !p.is_universal_fitment && !fittedIds.has(p.id))
          .map((product) => ({ product, suggestions: suggestFitment(product.name, generations) }));

        // Pre-tick high and medium suggestions; low ("model only") stays for review.
        const initial: Record<string, Set<string>> = {};
        for (const row of todo) {
          initial[row.product.id] = new Set(
            row.suggestions.filter((s) => s.confidence !== "low").map((s) => s.generationKey)
          );
        }
        setSelected(initial);
        setRows(todo);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load products.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const best = (row: Row) =>
    row.suggestions.some((s) => s.confidence === "high")
      ? "high"
      : row.suggestions.some((s) => s.confidence === "medium")
        ? "medium"
        : row.suggestions.length
          ? "low"
          : "none";

  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!shopFilter || row.product.seller_id === shopFilter) &&
          (confFilter === "all" || best(row) === confFilter)
      ),
    [rows, shopFilter, confFilter]
  );

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0, none: 0 };
    for (const row of rows) c[best(row)]++;
    return c;
  }, [rows]);

  function toggle(productId: string, key: string) {
    setSelected((current) => {
      const next = new Set(current[productId] || []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...current, [productId]: next };
    });
  }

  async function save(row: Row): Promise<boolean> {
    const keys = selected[row.product.id] || new Set<string>();
    const chosen = row.suggestions.filter((s) => keys.has(s.generationKey));
    if (!chosen.length) return false;
    const fitments = chosen.flatMap((s) =>
      (vehiclesByGen.get(s.generationKey) || []).map((vehicle) => ({
        product_id: row.product.id,
        variant_id: null,
        vehicle_id: vehicle.id,
        year_from: s.yearFrom,
        year_to: s.yearTo,
      }))
    );
    const { error: insertError } = await createClient().from("product_vehicle_fitments").insert(fitments);
    if (insertError) throw insertError;
    return true;
  }

  async function approve(row: Row) {
    setBusy(row.product.id);
    setError("");
    try {
      if (await save(row)) {
        setRows((current) => current.filter((r) => r.product.id !== row.product.id));
        setMessage("Fitment saved for " + row.product.name);
      } else {
        setError("Tick at least one vehicle generation first.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save fitment.");
    } finally {
      setBusy("");
    }
  }

  async function markUniversal(row: Row) {
    setBusy(row.product.id);
    setError("");
    try {
      const { error: updateError } = await createClient()
        .from("products")
        .update({ is_universal_fitment: true })
        .eq("id", row.product.id);
      if (updateError) throw updateError;
      setRows((current) => current.filter((r) => r.product.id !== row.product.id));
      setMessage(row.product.name + " marked as fitting all vehicles.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update product.");
    } finally {
      setBusy("");
    }
  }

  async function approveAllHigh() {
    const targets = visible.filter((row) => best(row) === "high" && (selected[row.product.id]?.size || 0) > 0);
    if (!targets.length) return;
    setBusy("bulk");
    setError("");
    let saved = 0;
    const done = new Set<string>();
    for (const row of targets) {
      try {
        if (await save(row)) {
          saved++;
          done.add(row.product.id);
        }
      } catch (caught) {
        setError((caught instanceof Error ? caught.message : "Save failed") + " — " + row.product.name);
      }
    }
    setRows((current) => current.filter((r) => !done.has(r.product.id)));
    setMessage("Saved fitment for " + saved + " products.");
    setBusy("");
  }

  const highReady = visible.filter((row) => best(row) === "high" && (selected[row.product.id]?.size || 0) > 0).length;

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>MIVO store control · Vehicle fitment</span>
              <h1>Fitment suggestions</h1>
              <p>Vehicles read from each product title. Check, untick anything wrong, then save. Nothing is saved without your approval.</p>
            </div>
            <a className={styles.adminAction} href="/admin/store-health">Store health</a>
          </header>

          <section className={styles.adminPanel}>
            <div className={ui.cards}>
              {(["high", "medium", "low", "none"] as const).map((c) => (
                <button type="button" key={c} className={ui.card + (confFilter === c ? " " + ui.selected : "")} onClick={() => setConfFilter(confFilter === c ? "all" : c)}>
                  <small>{c === "none" ? "No vehicle found" : label[c] + " confidence"}</small>
                  <strong>{loading ? "—" : counts[c]}</strong>
                  <span>{c === "high" ? "Chassis code / Gen match" : c === "medium" ? "Year range match" : c === "low" ? "Model only — review" : "Universal or manual"}</span>
                </button>
              ))}
            </div>

            <div className={ui.toolbar} style={{ alignItems: "end", flexWrap: "wrap" }}>
              <label className={styles.adminField}><span>Shop</span>
                <select value={shopFilter} onChange={(e) => setShopFilter(e.target.value)}>
                  <option value="">All shops</option>
                  {shops.map((s) => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                </select>
              </label>
              <button type="button" className={styles.adminAction} disabled={busy !== "" || !highReady} onClick={() => void approveAllHigh()}>
                {busy === "bulk" ? "Saving…" : "SAVE ALL HIGH-CONFIDENCE (" + highReady + ")"}
              </button>
            </div>

            {error ? <p role="alert" className={ui.timestamp}>{error}</p> : null}
            {message ? <p className={ui.timestamp}>{message}</p> : null}

            {loading ? (
              <p>Reading product titles…</p>
            ) : !visible.length ? (
              <p className={ui.timestamp}>Nothing to review here. Every product has fitment or is universal.</p>
            ) : (
              <div className={styles.fitList}>
                {visible.slice(0, 200).map((row) => {
                  const ticked = selected[row.product.id] || new Set<string>();
                  return (
                    <article key={row.product.id} className={styles.fitCard}>
                      <header>
                        <strong>{row.product.name}</strong>
                        <span className={styles.fitBadge + " " + styles["fit_" + best(row)]}>
                          {best(row) === "none" ? "No vehicle found" : label[best(row) as "high"]}
                        </span>
                      </header>
                      {row.suggestions.length ? (
                        <div className={styles.fitChips}>
                          {row.suggestions.map((s) => (
                            <label key={s.generationKey} className={styles.fitChip + (ticked.has(s.generationKey) ? " " + styles.fitChipOn : "")}>
                              <input type="checkbox" checked={ticked.has(s.generationKey)} onChange={() => toggle(row.product.id, s.generationKey)} />
                              <b>{s.make} {s.model}</b> {s.generation}
                              <small>{s.yearFrom}–{s.yearTo ?? "now"} · {s.reason}</small>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className={ui.timestamp}>No car model in the title. If it fits every car (oil, coolant…), mark it universal; otherwise add fitment on the product page.</p>
                      )}
                      <footer className={styles.fitActions}>
                        {row.suggestions.length ? (
                          <button type="button" className={styles.fitPrimary} disabled={busy !== "" || !ticked.size} onClick={() => void approve(row)}>
                            {busy === row.product.id ? "Saving…" : "Save " + ticked.size + " generation" + (ticked.size === 1 ? "" : "s")}
                          </button>
                        ) : null}
                        <button type="button" disabled={busy !== ""} onClick={() => void markUniversal(row)}>Fits all vehicles</button>
                        <a href={"/admin/products/" + row.product.id + "/edit#fitment"}>Edit manually</a>
                      </footer>
                    </article>
                  );
                })}
                {visible.length > 200 ? <p className={ui.timestamp}>Showing 200 of {visible.length}. Save some to see more.</p> : null}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

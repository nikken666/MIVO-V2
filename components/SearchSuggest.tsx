"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatPrice } from "@/data/products";
import { useT } from "./LanguageProvider";
import { openVehiclePicker } from "./VehiclePickerButton";

type Suggestion = {
  products: Array<{ name: string; slug: string; image: string | null; price: number; shop: string | null }>;
  terms: string[];
  vehicle: { make: string; model: string | null } | null;
};

const RECENT_KEY = "mivo:recentSearches";

function readRecent(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

export function rememberSearch(q: string) {
  const value = q.trim();
  if (!value) return;
  try {
    const next = [value, ...readRecent().filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, 8);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

const popular = ["Brake pad", "Absorber", "Engine oil", "Drive shaft", "Coolant", "Spark plug"];

/** Search box with live suggestions, recent searches and popular terms. */
export default function SearchSuggest({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const t = useT();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Suggestion | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();

  // Show the current query on the results page; clear it elsewhere.
  useEffect(() => {
    setValue(pathname === "/products" ? new URLSearchParams(window.location.search).get("q") || "" : "");
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setData(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/search/suggest?q=" + encodeURIComponent(q), { signal: controller.signal })
        .then((r) => r.json())
        .then((json: Suggestion) => setData(json))
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  useEffect(() => {
    function onDown(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function go(q: string) {
    rememberSearch(q);
    setOpen(false);
    router.push("/products?q=" + encodeURIComponent(q));
  }

  const q = value.trim();
  const rows: Array<{ kind: "query" | "term" | "recent" | "product"; label: string; href?: string }> = [];
  if (q.length >= 2) {
    (data?.terms || []).forEach((term) => rows.push({ kind: "term", label: term }));
    (data?.products || []).forEach((p) => rows.push({ kind: "product", label: p.name, href: "/products/" + p.slug }));
  } else {
    recent.forEach((item) => rows.push({ kind: "recent", label: item }));
  }

  function choose(index: number) {
    const row = rows[index];
    if (!row) return;
    if (row.href) {
      setOpen(false);
      rememberSearch(q);
      router.push(row.href);
    } else go(row.label);
  }

  return (
    <div className="searchSuggestBox" ref={boxRef}>
      <input
        ref={inputRef}
        name="q"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        aria-label={t("header.search")}
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder={t("header.searchPlaceholder")}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => {
          setRecent(readRecent());
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((h) => Math.min(rows.length - 1, h + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(-1, h - 1));
          } else if (e.key === "Enter") {
            if (highlight >= 0) {
              e.preventDefault();
              choose(highlight);
            } else {
              rememberSearch(value);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {open && (rows.length || q.length < 2 || data?.vehicle) ? (
        <div className="searchSuggestPanel" role="listbox">
          {data?.vehicle && q.length >= 2 ? (
            <button
              type="button"
              className="searchSuggestVehicle"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                openVehiclePicker();
              }}
            >
              <span>🚗</span>
              {t("search.pickCar", { car: data.vehicle.model || data.vehicle.make })}
            </button>
          ) : null}

          {q.length < 2 ? (
            <>
              {recent.length ? (
                <div className="searchSuggestHead">
                  <span>{t("search.recent")}</span>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      try {
                        window.localStorage.removeItem(RECENT_KEY);
                      } catch {}
                      setRecent([]);
                    }}
                  >
                    {t("search.clear")}
                  </button>
                </div>
              ) : null}
              {rows.map((row, i) => (
                <button
                  type="button"
                  key={"r" + row.label}
                  className={"searchSuggestRow" + (i === highlight ? " active" : "")}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(i)}
                >
                  <span className="searchSuggestIcon">↺</span>
                  {row.label}
                </button>
              ))}
              <div className="searchSuggestHead">
                <span>{t("search.popular")}</span>
              </div>
              <div className="searchSuggestChips">
                {popular.map((term) => (
                  <button type="button" key={term} onMouseDown={(e) => e.preventDefault()} onClick={() => go(term)}>
                    {term}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {rows.map((row, i) => {
                const product = row.kind === "product" ? data?.products.find((p) => p.name === row.label) : null;
                return (
                  <button
                    type="button"
                    key={row.kind + row.label}
                    className={"searchSuggestRow" + (product ? " product" : "") + (i === highlight ? " active" : "")}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(i)}
                  >
                    {product ? (
                      <>
                        <span className="searchSuggestThumb">{product.image ? <img src={product.image} alt="" /> : null}</span>
                        <span className="searchSuggestText">
                          <strong>{product.name}</strong>
                          <small>
                            {formatPrice(product.price)}
                            {product.shop ? " · " + product.shop : ""}
                          </small>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="searchSuggestIcon">⌕</span>
                        {row.label}
                      </>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                className="searchSuggestAll"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(q)}
              >
                {t("search.seeAll", { q })}
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

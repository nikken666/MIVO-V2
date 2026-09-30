"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

type Brand = {
  name: string;
  category: string;
  logo: string;
  slug: string;
  about: string;
};

export default function BrandDirectory({ brands }: { brands: Brand[] }) {
  const params = useSearchParams();
  const openBrand = (params.get("open") || "").toLowerCase();
  const refs = useRef<Record<string, HTMLDetailsElement | null>>({});

  useEffect(() => {
    if (!openBrand) return;
    const target = refs.current[openBrand];
    if (!target) return;
    target.open = true;
    requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [openBrand]);

  return (
    <div className="brandDirectory">
      {brands.map((brand) => (
        <details
          id={brand.slug}
          ref={(node) => { refs.current[brand.slug] = node; }}
          className="brandDirectoryCard brandExpandableCard"
          key={brand.name}
        >
          <summary>
            <span className="brandLogo" aria-label={brand.name}>
              <img src={brand.logo} alt={brand.name + " logo"} />
            </span>
          </summary>
          <div className="brandInlineDetails">
            <span>ABOUT {brand.name}</span>
            <h2>What does {brand.name} do?</h2>
            <p>{brand.about}</p>
            <strong>{brand.category}</strong>
            <a href={"/products?q=" + encodeURIComponent(brand.name)}>Explore {brand.name} products</a>
          </div>
        </details>
      ))}
    </div>
  );
}

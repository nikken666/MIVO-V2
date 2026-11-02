"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { openVehiclePicker } from "./VehiclePickerButton";
import { useT } from "./LanguageProvider";
import type { Key } from "@/lib/i18n";

type Slide = {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  image?: string | null;
  mobileImage?: string | null;
  tone: "blue" | "violet" | "night";
  // Built-in slides hold phrase keys instead of text.
  builtIn?: boolean;
};

// Shown when no admin campaign is live. Only real features — no invented offers.
const defaultSlides: Slide[] = [
  {
    id: "fitment",
    badge: "browse.banner.fitBadge",
    title: "browse.banner.fitTitle",
    subtitle: "browse.banner.fitSub",
    cta: "browse.banner.fitCta",
    href: "/?addVehicle=1",
    tone: "blue",
    builtIn: true,
  },
  {
    id: "brands",
    badge: "browse.banner.brandsBadge",
    title: "browse.banner.brandsTitle",
    subtitle: "browse.banner.brandsSub",
    cta: "browse.banner.brandsCta",
    href: "/products?view=brands",
    tone: "violet",
    builtIn: true,
  },
  {
    id: "warranty",
    badge: "browse.banner.warrantyBadge",
    title: "browse.banner.warrantyTitle",
    subtitle: "browse.banner.warrantySub",
    cta: "browse.banner.warrantyCta",
    href: "/orders",
    tone: "night",
    builtIn: true,
  },
];

const tones: Slide["tone"][] = ["blue", "violet", "night"];

export default function HomeBannerCarousel() {
  const t = useT();
  const text = (slide: Slide, field: "badge" | "title" | "subtitle" | "cta") =>
    slide.builtIn ? t(slide[field] as Key) : slide[field];
  const [slides, setSlides] = useState<Slide[]>(defaultSlides);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const now = new Date().toISOString();
        const { data } = await createClient()
          .from("promotion_campaigns")
          .select(
            "id, title, subtitle, badge, cta_label, landing_path, desktop_image_url, mobile_image_url"
          )
          .eq("is_active", true)
          .lte("starts_at", now)
          .gte("ends_at", now)
          .order("sort_order", { ascending: true })
          .limit(5);

        if (!active || !data?.length) return;

        const campaignSlides: Slide[] = data.map((row, i) => ({
          id: String(row.id),
          badge: row.badge || "",
          title: row.title,
          subtitle: row.subtitle || "",
          cta: row.cta_label || "",
          href: row.landing_path || "/products",
          image: row.desktop_image_url,
          mobileImage: row.mobile_image_url,
          tone: tones[i % tones.length],
        }));

        // Campaigns first, then the evergreen slides.
        setSlides([...campaignSlides, ...defaultSlides].slice(0, 6));
      } catch {}
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % slides.length),
      5500
    );
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  const go = (next: number) =>
    setIndex((next + slides.length) % slides.length);

  return (
    <div
      className="shopCarousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <div
        className="shopCarouselTrack"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide, i) => (
          <Link
            href={slide.href}
            key={slide.id}
            className={"shopSlide tone-" + slide.tone + (slide.image ? " hasImage" : "")}
            aria-hidden={i !== index}
            tabIndex={i === index ? 0 : -1}
            onClick={
              slide.href === "/?addVehicle=1"
                ? (event) => {
                    event.preventDefault();
                    openVehiclePicker();
                  }
                : undefined
            }
          >
            {slide.image ? (
              <picture className="shopSlideMedia">
                {slide.mobileImage ? (
                  <source media="(max-width: 680px)" srcSet={slide.mobileImage} />
                ) : null}
                <img src={slide.image} alt={text(slide, "title")} />
              </picture>
            ) : (
              <>
                <span className="shopSlideGlow" aria-hidden="true" />
                <div className="shopSlideCopy">
                  <span className="shopSlideBadge">{text(slide, "badge") || t("browse.banner.promotion")}</span>
                  <h2>
                    {text(slide, "title").split("\n").map((line, n) => (
                      <span key={n}>{line}</span>
                    ))}
                  </h2>
                  {slide.subtitle ? <p>{text(slide, "subtitle")}</p> : null}
                  <span className="shopSlideCta">{text(slide, "cta") || t("browse.shopNow")} ›</span>
                </div>
              </>
            )}
          </Link>
        ))}
      </div>

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            className="shopCarouselArrow prev"
            onClick={() => go(index - 1)}
            aria-label={t("browse.banner.prev")}
          >
            ‹
          </button>
          <button
            type="button"
            className="shopCarouselArrow next"
            onClick={() => go(index + 1)}
            aria-label={t("browse.banner.next")}
          >
            ›
          </button>
          <div className="shopCarouselDots">
            {slides.map((slide, i) => (
              <button
                type="button"
                key={slide.id}
                className={i === index ? "active" : ""}
                onClick={() => go(i)}
                aria-label={t("browse.banner.show", { n: i + 1 })}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

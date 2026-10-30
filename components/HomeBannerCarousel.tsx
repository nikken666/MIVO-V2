"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { openVehiclePicker } from "./VehiclePickerButton";

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
};

// Shown when no admin campaign is live. Only real features — no invented offers.
const defaultSlides: Slide[] = [
  {
    id: "fitment",
    badge: "Vehicle match",
    title: "Parts that fit your car.\nNo guesswork.",
    subtitle: "Pick your make, model and year — we show what fits first.",
    cta: "Find my parts",
    href: "/?addVehicle=1",
    tone: "blue",
  },
  {
    id: "brands",
    badge: "Trusted brands",
    title: "KYB, NIKKEN and GSP.\nIn one place.",
    subtitle: "Suspension, steering and drivetrain parts from names you know.",
    cta: "Explore brands",
    href: "/products?view=brands",
    tone: "violet",
  },
  {
    id: "warranty",
    badge: "After-sales",
    title: "Warranty claims,\nhandled online.",
    subtitle: "Track every order and claim warranty from your account.",
    cta: "Track my orders",
    href: "/orders",
    tone: "night",
  },
];

const tones: Slide["tone"][] = ["blue", "violet", "night"];

export default function HomeBannerCarousel() {
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
          badge: row.badge || "Promotion",
          title: row.title,
          subtitle: row.subtitle || "",
          cta: row.cta_label || "Shop now",
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
                <img src={slide.image} alt={slide.title} />
              </picture>
            ) : (
              <>
                <span className="shopSlideGlow" aria-hidden="true" />
                <div className="shopSlideCopy">
                  <span className="shopSlideBadge">{slide.badge}</span>
                  <h2>
                    {slide.title.split("\n").map((line, n) => (
                      <span key={n}>{line}</span>
                    ))}
                  </h2>
                  {slide.subtitle ? <p>{slide.subtitle}</p> : null}
                  <span className="shopSlideCta">{slide.cta} ›</span>
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
            aria-label="Previous banner"
          >
            ‹
          </button>
          <button
            type="button"
            className="shopCarouselArrow next"
            onClick={() => go(index + 1)}
            aria-label="Next banner"
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
                aria-label={"Show banner " + (i + 1)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

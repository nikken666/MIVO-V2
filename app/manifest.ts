import type { MetadataRoute } from "next";

// Makes MIVO installable ("Add to Home screen") and is what the Android app
// (Trusted Web Activity) is built from.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MIVO — Alat ganti kereta",
    short_name: "MIVO",
    description:
      "Alat ganti kereta yang padan dengan kenderaan anda, daripada kedai dipercayai di seluruh Malaysia.",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0071e3",
    lang: "ms-MY",
    categories: ["shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

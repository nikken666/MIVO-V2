"use client";

import { useEffect } from "react";

/**
 * Keeps the phone bottom bars (pay / buy / cart / chat) on the bottom of the screen.
 *
 * iOS Safari can leave the page offset after the on-screen keyboard closes:
 * visualViewport.offsetTop stays above 0, and every position:fixed bar floats
 * that far up the screen (WebKit bug 297779). While that offset is stuck we
 * publish it as --vv-shift and the bars move back down by it (see globals.css).
 * Normally the offset is 0, so nothing changes.
 *
 * While the keyboard is open, <html> gets .kbOpen so the bars step aside
 * instead of covering the field being typed in.
 */
export default function ViewportFix() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;

    // Height of the box position:fixed elements are laid out in.
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:fixed;top:0;bottom:0;left:0;width:0;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);

    const isTextField = (el: Element | null) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable || el.tagName === "TEXTAREA") return true;
      if (el.tagName !== "INPUT") return false;
      return !/^(checkbox|radio|button|submit|reset|range|color|file|image|hidden)$/i.test(
        (el as HTMLInputElement).type
      );
    };

    let frame = 0;
    let lastShift = "";
    let lastKeyboard: boolean | null = null;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const layoutHeight = probe.offsetHeight || window.innerHeight;
        const zoomed = Math.abs(vv.scale - 1) > 0.01;
        const keyboard = isTextField(document.activeElement) && vv.height < layoutHeight - 120;
        const stuck = keyboard || zoomed ? 0 : Math.max(0, Math.round(vv.offsetTop));
        const shift = stuck > 1 ? stuck + "px" : "0px";
        if (shift !== lastShift) {
          root.style.setProperty("--vv-shift", shift);
          lastShift = shift;
        }
        if (keyboard !== lastKeyboard) {
          root.classList.toggle("kbOpen", keyboard);
          lastKeyboard = keyboard;
        }
      });
    };
    // The keyboard animates in and out, so check again once it has settled.
    const timers: number[] = [];
    const syncSoon = () => {
      sync();
      timers.push(window.setTimeout(sync, 150), window.setTimeout(sync, 500), window.setTimeout(sync, 1000));
      if (timers.length > 30) timers.splice(0, timers.length - 30);
    };

    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("orientationchange", syncSoon);
    document.addEventListener("focusin", syncSoon);
    document.addEventListener("focusout", syncSoon);
    sync();

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((id) => window.clearTimeout(id));
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", syncSoon);
      document.removeEventListener("focusin", syncSoon);
      document.removeEventListener("focusout", syncSoon);
      probe.remove();
      root.style.removeProperty("--vv-shift");
      root.classList.remove("kbOpen");
    };
  }, []);

  return null;
}

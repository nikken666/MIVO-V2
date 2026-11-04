// A1: a small copy of the product photo flies into the header cart.
// Purely visual; the cart itself is updated by MarketplaceProvider.

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function visibleTarget(selector: string): HTMLElement | null {
  const targets = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return targets.find((el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0) || null;
}

export function flyToCart(source: Element | null | undefined) {
  if (typeof document === "undefined" || reducedMotion()) return;
  const cart = visibleTarget("[data-cart-target]");
  const from = source instanceof HTMLElement ? source : null;
  if (!cart || !from) return;

  const a = from.getBoundingClientRect();
  const b = cart.getBoundingClientRect();
  if (!a.width || !a.height) return;

  const size = Math.min(84, Math.max(44, Math.min(a.width, a.height) * 0.5));
  const ghost = document.createElement("div");
  ghost.className = "flyToCartGhost";
  const img = from instanceof HTMLImageElement ? from : from.querySelector("img");
  if (img?.currentSrc || img?.src) {
    ghost.style.backgroundImage = 'url("' + (img.currentSrc || img.src).replace(/"/g, "%22") + '")';
  }
  ghost.style.width = size + "px";
  ghost.style.height = size + "px";
  ghost.style.left = a.left + a.width / 2 - size / 2 + "px";
  ghost.style.top = a.top + a.height / 2 - size / 2 + "px";
  document.body.appendChild(ghost);

  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const animation = ghost.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 70}px) scale(.75)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(.18)`, opacity: 0.4 },
    ],
    { duration: 700, easing: "cubic-bezier(.5,0,.75,.4)" }
  );
  const done = () => {
    ghost.remove();
    cart.classList.remove("cartBump");
    void cart.offsetWidth;
    cart.classList.add("cartBump");
  };
  animation.onfinish = done;
  animation.oncancel = () => ghost.remove();
}

// A4: the Claim button pops and a ticket flies to "Me" (where My vouchers lives).
export function celebrateClaim(button: Element | null | undefined) {
  if (typeof document === "undefined" || !(button instanceof HTMLElement)) return;
  button.classList.remove("claimPop");
  void button.offsetWidth;
  button.classList.add("claimPop");
  if (reducedMotion()) return;

  const target = visibleTarget("[data-voucher-target]") || visibleTarget("[data-cart-target]");
  if (!target) return;
  const a = button.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const ticket = document.createElement("div");
  ticket.className = "flyVoucherGhost";
  ticket.textContent = "%";
  ticket.style.left = a.left + a.width / 2 - 18 + "px";
  ticket.style.top = a.top + a.height / 2 - 12 + "px";
  document.body.appendChild(ticket);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const animation = ticket.animate(
    [
      { transform: "translate(0,0) scale(.6) rotate(0deg)", opacity: 0 },
      { transform: "translate(0,-26px) scale(1.15) rotate(-8deg)", opacity: 1, offset: 0.25 },
      { transform: `translate(${dx}px, ${dy}px) scale(.35) rotate(12deg)`, opacity: 0.3 },
    ],
    { duration: 900, delay: 120, easing: "cubic-bezier(.45,0,.6,1)", fill: "backwards" }
  );
  animation.onfinish = () => {
    ticket.remove();
    target.classList.remove("cartBump");
    void target.offsetWidth;
    target.classList.add("cartBump");
  };
  animation.oncancel = () => ticket.remove();
}

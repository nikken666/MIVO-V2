"use client";

import Link from "next/link";
import { Fragment, useEffect } from "react";
import { formatPrice } from "@/data/products";
import { useMarketplace } from "@/components/MarketplaceProvider";
import CartVoucherStrip from "@/components/CartVoucherStrip";
import ShopBadge, { shopHref } from "@/components/ShopBadge";
import { useT } from "@/components/LanguageProvider";

export default function CartPage() {
  const t = useT();
  const {
    cart, cartCount, cartReady, selectedCartLineIds,
    clearBuyNow,
    toggleCartLineSelection, selectAllCartLines,
    removeFromCart, updateQuantity, clearCart,
  } = useMarketplace();

  useEffect(() => {
    // Navigating into Cart exits a previous Buy Now session.
    clearBuyNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedIds = new Set(selectedCartLineIds);
  const selectedCart = cart.filter((line) => selectedIds.has(line.lineId));
  const allSelected = cart.length > 0 && cart.every((line) => selectedIds.has(line.lineId));
  const selectedQuantity = selectedCart.reduce((sum, line) => sum + line.quantity, 0);
  const selectedSubtotal = selectedCart.reduce((sum, line) => {
    const price = line.variant?.price ?? line.product.price;
    return sum + price * line.quantity;
  }, 0);

  if (!cartReady) {
    return (
      <main className="cartPage">
        <div className="container"><div className="cartEmpty">
          <span>{t("buy.cart.eyebrow")}</span><h1>{t("buy.cart.loading")}</h1>
        </div></div>
      </main>
    );
  }

  if (!cart.length) {
    return (
      <main className="cartPage">
        <div className="container"><div className="cartEmpty">
          <span>{t("buy.cart.eyebrow")}</span><h1>{t("buy.cart.empty")}</h1>
          <p>{t("buy.cart.emptyHint")}</p>
          <Link href="/products" className="cartPrimaryButton">{t("buy.cart.shopParts")}</Link>
        </div></div>
      </main>
    );
  }

  const allCheckbox = (label: string) => (
    <label className="cartSelectLabel">
      <input type="checkbox" className="cartCheckInput" checked={allSelected}
        onChange={(event) => selectAllCartLines(event.target.checked)}
        aria-label={label} />
      <span>{label}</span>
    </label>
  );

  const checkoutAction = (className: string, mobile = false) =>
    selectedQuantity ? (
      <Link href="/checkout" className={className}>
        {mobile ? <>{t("buy.cart.checkout", { n: selectedQuantity })}</> : (
          <span><small>{t("buy.cart.selectedOnly")}</small>{t("buy.cart.checkout", { n: selectedQuantity })}</span>
        )}
      </Link>
    ) : (
      <button type="button" className={className} disabled>
        {mobile ? t("buy.cart.selectItems") : <span><small>{t("buy.cart.chooseItems")}</small>{t("buy.cart.selectItems")}</span>}
      </button>
    );

  return (
    <main className="cartPage cartPageSelectable">
      <div className="container">
        <div className="cartPageHeader">
          <div>
            <span className="cartEyebrow">{t("buy.cart.eyebrow")}</span>
            <h1>{t("buy.cart.title")}</h1>
            <p>{t("buy.cart.countLine", { n: cartCount, selected: selectedQuantity })}</p>
          </div>
          <button type="button" className="cartClearButton" onClick={clearCart}>{t("buy.cart.clear")}</button>
        </div>

        <div className="modernCartLayout">
          <section className="modernCartLines">
            <div className="cartSelectionToolbar">
              <strong>{t("buy.cart.products")}</strong><span>{t("buy.cart.chooseParts")}</span>
              {allCheckbox(t("buy.cart.selectAll"))}
            </div>
            <CartVoucherStrip />

            {[...cart]
              .sort((a, b) => (a.product.seller || "").localeCompare(b.product.seller || ""))
              .map((line, lineIndex, lines) => {
              // Lines are grouped visually by shop, Shopee-style; every shop
              // ships from the same MIVO warehouse.
              const shopName = line.product.seller || "MIVO";
              const newShop =
                lineIndex === 0 ||
                (lines[lineIndex - 1].product.seller || "MIVO") !== shopName;
              const price = line.variant?.price ?? line.product.price;
              const lineTotal = price * line.quantity;
              const checked = selectedIds.has(line.lineId);
              const maxStock = typeof line.variant?.stock === "number"
                ? line.variant.stock
                : typeof line.product.stock === "number" ? line.product.stock : undefined;

              return (
                <Fragment key={line.lineId}>
                {newShop ? (
                  <div className="cartStoreBar">
                    <Link href={shopHref(line.product)} className="cartStoreLink">
                      <span className="cartStoreDot">{shopName.slice(0, 1)}</span>
                      <div>
                        <strong>{shopName} <ShopBadge tier={line.product.sellerTier} /></strong>
                        <small>{t("buy.pd.shipsFromWarehouse")}</small>
                      </div>
                    </Link>
                    <span>{t("shop.visit")} ›</span>
                  </div>
                ) : null}
                <article className={"modernCartLine cartLineSelectable" + (checked ? "" : " cartLineUnselected")}>
                  <label className="cartCheckOnly" title={t("buy.cart.selectItem", { name: line.product.name })}>
                    <input type="checkbox" className="cartCheckInput" checked={checked}
                      onChange={() => toggleCartLineSelection(line.lineId)}
                      aria-label={t("buy.cart.selectItem", { name: line.product.name })} />
                  </label>
                  <Link href={"/products/" + line.product.slug} className="modernCartImage">
                    {line.product.imageUrl ? (
                      <img src={line.product.imageUrl} alt={line.product.name} />
                    ) : <span>{line.product.icon}</span>}
                  </Link>
                  <div className="modernCartInfo">
                    <span className="modernCartBrand">{line.product.brand}</span>
                    <Link href={"/products/" + line.product.slug}><h3>{line.product.name}</h3></Link>
                    {line.variant ? (
                      <div className="cartVariantMeta">
                        {line.product.variation1Name && line.variant.variation1Value ? (
                          <span>{line.product.variation1Name}: {line.variant.variation1Value}</span>
                        ) : null}
                        {line.product.variation2Name && line.variant.variation2Value ? (
                          <span>{line.product.variation2Name}: {line.variant.variation2Value}</span>
                        ) : null}
                      </div>
                    ) : null}
                    <strong className="modernCartUnitPrice">{formatPrice(price)}</strong>
                  </div>
                  <div className="modernCartControls">
                    <span>{t("buy.pd.quantity")}</span>
                    <div className="quantityStepper cartQuantityStepper">
                      <button type="button" disabled={line.quantity <= 1}
                        onClick={() => updateQuantity(line.lineId, line.quantity - 1)}
                        aria-label={t("buy.cart.decrease")}>−</button>
                      <strong>{line.quantity}</strong>
                      <button type="button" disabled={typeof maxStock === "number" && line.quantity >= maxStock}
                        onClick={() => updateQuantity(line.lineId, line.quantity + 1)}
                        aria-label={t("buy.cart.increase")}>+</button>
                    </div>
                    <button type="button" className="modernRemoveButton"
                      onClick={() => removeFromCart(line.lineId)}>{t("buy.cart.remove")}</button>
                  </div>
                  <div className="modernCartLineTotal">
                    <span>{t("buy.cart.itemTotal")}</span><strong>{formatPrice(lineTotal)}</strong>
                  </div>
                </article>
                </Fragment>
              );
            })}

            <div className="cartBulkToolbar">
              {allCheckbox(t("buy.cart.selectAll"))}
              <span>{t("buy.cart.selectedOf", { n: selectedQuantity, total: cartCount })}</span>
              <button type="button" disabled={!selectedCart.length}
                onClick={() => selectedCart.forEach((line) => removeFromCart(line.lineId))}>{t("buy.cart.removeSelected")}</button>
            </div>
            <div className="cartContinueRow">
              <Link href="/products">{t("buy.cart.continue")}</Link>
              <span>{t("buy.cart.secureLine")}</span>
            </div>
          </section>

          <aside className="modernOrderSummary">
            <div className="summaryHeading">
              <span>{t("buy.cart.orderSummary")}</span><strong>{t("buy.cart.nSelected", { n: selectedQuantity })}</strong>
            </div>
            <div className="summaryRows">
              <div><span>{t("buy.cart.selectedItems")}</span><strong>{selectedQuantity} / {cartCount}</strong></div>
              <div><span>{t("buy.cart.subtotal")}</span><strong>{formatPrice(selectedSubtotal)}</strong></div>
              <div><span>{t("buy.cart.shipping")}</span><strong>{t("buy.cart.calcAtCheckout")}</strong></div>
            </div>
            <div className="summaryDivider" />
            <div className="modernSummaryTotal">
              <div><span>{t("buy.cart.selectedTotal")}</span><small>{t("buy.cart.beforeShipping")}</small></div>
              <strong>{formatPrice(selectedSubtotal)}</strong>
            </div>
            {checkoutAction("cartCheckoutButton")}
            <p className="cartOnlySelectedNote">
              {t("buy.cart.onlyChecked")}
            </p>
            <div className="checkoutTrust">
              <span>{t("buy.cart.securePayment")}</span><span>{t("buy.cart.orderTracking")}</span><span>{t("buy.cart.fitmentSupport")}</span>
            </div>
          </aside>
        </div>
      </div>
      <div className="mobileCheckoutBar cartMobileSelectionBar">
        {allCheckbox(t("buy.cart.all"))}
        <div className="cartMobileSelectedTotal">
          <span>{t("buy.cart.selectedTotal")}</span><strong>{formatPrice(selectedSubtotal)}</strong>
          <small>{t("buy.cart.nSelected", { n: selectedQuantity })}</small>
        </div>
        {checkoutAction("cartMobileCheckoutAction", true)}
      </div>
    </main>
  );
}

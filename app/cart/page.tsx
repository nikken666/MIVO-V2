"use client";

import Link from "next/link";
import { formatPrice } from "@/data/products";
import { useMarketplace } from "@/components/MarketplaceProvider";
import CartVoucherStrip from "@/components/CartVoucherStrip";

export default function CartPage() {
  const {
    cart, cartCount, cartReady, selectedCartLineIds,
    toggleCartLineSelection, selectAllCartLines,
    removeFromCart, updateQuantity, clearCart,
  } = useMarketplace();

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
          <span>MIVO CART</span><h1>Loading your cart...</h1>
        </div></div>
      </main>
    );
  }

  if (!cart.length) {
    return (
      <main className="cartPage">
        <div className="container"><div className="cartEmpty">
          <span>MIVO CART</span><h1>Your cart is empty.</h1>
          <p>Find the right parts for your vehicle and add them here.</p>
          <Link href="/products" className="cartPrimaryButton">SHOP PARTS</Link>
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
        {mobile ? <>CHECKOUT ({selectedQuantity})</> : (
          <span><small>SELECTED PRODUCTS ONLY</small>CHECKOUT ({selectedQuantity})</span>
        )}
      </Link>
    ) : (
      <button type="button" className={className} disabled>
        {mobile ? "SELECT ITEMS" : <span><small>CHOOSE ITEMS TO BUY</small>SELECT ITEMS</span>}
      </button>
    );

  return (
    <main className="cartPage cartPageSelectable">
      <div className="container">
        <div className="cartPageHeader">
          <div>
            <span className="cartEyebrow">MIVO CART</span>
            <h1>Shopping Cart</h1>
            <p>{cartCount} item{cartCount === 1 ? "" : "s"} in cart · {selectedQuantity} selected</p>
          </div>
          <button type="button" className="cartClearButton" onClick={clearCart}>CLEAR CART</button>
        </div>

        <div className="modernCartLayout">
          <section className="modernCartLines">
            <div className="cartSelectionToolbar">
              <strong>PRODUCTS</strong><span>Choose the parts you want to check out</span>
              {allCheckbox("SELECT ALL")}
            </div>
            <div className="cartStoreBar">
              <div>
                <label className="cartCheckOnly" title="Select all MIVO Direct Store items">
                  <input type="checkbox" className="cartCheckInput" checked={allSelected}
                    onChange={(event) => selectAllCartLines(event.target.checked)}
                    aria-label="Select all MIVO Direct Store items" />
                </label>
                <span className="cartStoreDot">M</span>
                <div><strong>MIVO DIRECT STORE</strong><small>Official MIVO fulfilment</small></div>
              </div>
              <span>IN STOCK</span>
            </div>

            <CartVoucherStrip />

            {cart.map((line) => {
              const price = line.variant?.price ?? line.product.price;
              const lineTotal = price * line.quantity;
              const checked = selectedIds.has(line.lineId);
              const maxStock = typeof line.variant?.stock === "number"
                ? line.variant.stock
                : typeof line.product.stock === "number" ? line.product.stock : undefined;

              return (
                <article className={"modernCartLine cartLineSelectable" + (checked ? "" : " cartLineUnselected")} key={line.lineId}>
                  <label className="cartCheckOnly" title={"Select " + line.product.name}>
                    <input type="checkbox" className="cartCheckInput" checked={checked}
                      onChange={() => toggleCartLineSelection(line.lineId)}
                      aria-label={"Select " + line.product.name} />
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
                    <span>QUANTITY</span>
                    <div className="quantityStepper cartQuantityStepper">
                      <button type="button" disabled={line.quantity <= 1}
                        onClick={() => updateQuantity(line.lineId, line.quantity - 1)}
                        aria-label="Decrease quantity">−</button>
                      <strong>{line.quantity}</strong>
                      <button type="button" disabled={typeof maxStock === "number" && line.quantity >= maxStock}
                        onClick={() => updateQuantity(line.lineId, line.quantity + 1)}
                        aria-label="Increase quantity">+</button>
                    </div>
                    <button type="button" className="modernRemoveButton"
                      onClick={() => removeFromCart(line.lineId)}>REMOVE</button>
                  </div>
                  <div className="modernCartLineTotal">
                    <span>ITEM TOTAL</span><strong>{formatPrice(lineTotal)}</strong>
                  </div>
                </article>
              );
            })}

            <div className="cartBulkToolbar">
              {allCheckbox("SELECT ALL")}
              <span>{selectedQuantity} of {cartCount} items selected</span>
              <button type="button" disabled={!selectedCart.length}
                onClick={() => selectedCart.forEach((line) => removeFromCart(line.lineId))}>REMOVE SELECTED</button>
            </div>
            <div className="cartContinueRow">
              <Link href="/products">← CONTINUE SHOPPING</Link>
              <span>Secure checkout · Malaysia delivery</span>
            </div>
          </section>

          <aside className="modernOrderSummary">
            <div className="summaryHeading">
              <span>ORDER SUMMARY</span><strong>{selectedQuantity} SELECTED</strong>
            </div>
            <div className="summaryRows">
              <div><span>Selected items</span><strong>{selectedQuantity} / {cartCount}</strong></div>
              <div><span>Subtotal</span><strong>{formatPrice(selectedSubtotal)}</strong></div>
              <div><span>Shipping</span><strong>Calculated at checkout</strong></div>
            </div>
            <div className="summaryDivider" />
            <div className="modernSummaryTotal">
              <div><span>SELECTED TOTAL</span><small>Before shipping</small></div>
              <strong>{formatPrice(selectedSubtotal)}</strong>
            </div>
            {checkoutAction("cartCheckoutButton")}
            <p className="cartOnlySelectedNote">
              Only checked items will be ordered. Unchecked items stay in your cart.
            </p>
            <div className="checkoutTrust">
              <span>Secure payment</span><span>Order tracking</span><span>Vehicle-fitment support</span>
            </div>
          </aside>
        </div>
      </div>
      <div className="mobileCheckoutBar cartMobileSelectionBar">
        {allCheckbox("ALL")}
        <div className="cartMobileSelectedTotal">
          <span>SELECTED TOTAL</span><strong>{formatPrice(selectedSubtotal)}</strong>
          <small>{selectedQuantity} selected</small>
        </div>
        {checkoutAction("cartMobileCheckoutAction", true)}
      </div>
    </main>
  );
}

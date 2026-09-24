"use client";

import Link from "next/link";
import { formatPrice } from "@/data/products";
import { useMarketplace } from "@/components/MarketplaceProvider";

export default function CartPage() {
  const {
    cart,
    cartCount,
    removeFromCart,
    updateQuantity,
    clearCart,
  } = useMarketplace();

  const subtotal = cart.reduce((sum, line) => {
    const price = line.variant?.price ?? line.product.price;
    return sum + price * line.quantity;
  }, 0);

  if (!cart.length) {
    return (
      <main className="cartPage">
        <div className="container">
          <div className="cartEmpty">
            <div className="cartEmptyMark">+</div>
            <span>MIVO CART</span>
            <h1>Your cart is empty.</h1>
            <p>Find the right parts for your vehicle and add them here.</p>
            <Link href="/products" className="cartPrimaryButton">
              SHOP PARTS →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="cartPage">
      <div className="container">
        <div className="cartPageHeader">
          <div>
            <span className="cartEyebrow">MIVO CART</span>
            <h1>Your Cart</h1>
            <p>
              {cartCount} item{cartCount === 1 ? "" : "s"} ready for checkout
            </p>
          </div>

          <button
            type="button"
            className="cartClearButton"
            onClick={clearCart}
          >
            CLEAR CART
          </button>
        </div>

        <div className="modernCartLayout">
          <section className="modernCartLines">
            <div className="cartStoreBar">
              <div>
                <span className="cartStoreDot">M</span>
                <div>
                  <strong>MIVO DIRECT STORE</strong>
                  <small>Official MIVO fulfilment</small>
                </div>
              </div>
              <span>IN STOCK</span>
            </div>

            {cart.map((line) => {
              const price = line.variant?.price ?? line.product.price;
              const lineTotal = price * line.quantity;
              const maxStock =
                typeof line.variant?.stock === "number"
                  ? line.variant.stock
                  : typeof line.product.stock === "number"
                    ? line.product.stock
                    : undefined;

              return (
                <article className="modernCartLine" key={line.lineId}>
                  <Link
                    href={"/products/" + line.product.slug}
                    className="modernCartImage"
                  >
                    {line.product.imageUrl ? (
                      <img
                        src={line.product.imageUrl}
                        alt={line.product.name}
                      />
                    ) : (
                      <span>{line.product.icon}</span>
                    )}
                  </Link>

                  <div className="modernCartInfo">
                    <span className="modernCartBrand">
                      {line.product.brand}
                    </span>

                    <Link href={"/products/" + line.product.slug}>
                      <h3>{line.product.name}</h3>
                    </Link>

                    {line.variant ? (
                      <div className="cartVariantMeta">
                        {line.product.variation1Name &&
                        line.variant.variation1Value ? (
                          <span>
                            {line.product.variation1Name}:{" "}
                            {line.variant.variation1Value}
                          </span>
                        ) : null}

                        {line.product.variation2Name &&
                        line.variant.variation2Value ? (
                          <span>
                            {line.product.variation2Name}:{" "}
                            {line.variant.variation2Value}
                          </span>
                        ) : null}

                        <span>SKU: {line.variant.sku}</span>
                      </div>
                    ) : null}

                    <strong className="modernCartUnitPrice">
                      {formatPrice(price)}
                    </strong>
                  </div>

                  <div className="modernCartControls">
                    <span>QUANTITY</span>

                    <div className="quantityStepper cartQuantityStepper">
                      <button
                        type="button"
                        disabled={line.quantity <= 1}
                        onClick={() =>
                          updateQuantity(
                            line.lineId,
                            line.quantity - 1
                          )
                        }
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <strong>{line.quantity}</strong>
                      <button
                        type="button"
                        disabled={
                          typeof maxStock === "number" &&
                          line.quantity >= maxStock
                        }
                        onClick={() =>
                          updateQuantity(
                            line.lineId,
                            line.quantity + 1
                          )
                        }
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      className="modernRemoveButton"
                      onClick={() => removeFromCart(line.lineId)}
                    >
                      REMOVE
                    </button>
                  </div>

                  <div className="modernCartLineTotal">
                    <span>ITEM TOTAL</span>
                    <strong>{formatPrice(lineTotal)}</strong>
                  </div>
                </article>
              );
            })}

            <div className="cartContinueRow">
              <Link href="/products">← CONTINUE SHOPPING</Link>
              <span>Secure checkout · Malaysia delivery</span>
            </div>
          </section>

          <aside className="modernOrderSummary">
            <div className="summaryHeading">
              <span>ORDER SUMMARY</span>
              <strong>{cartCount} ITEMS</strong>
            </div>

            <div className="summaryRows">
              <div>
                <span>Subtotal</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
              <div>
                <span>Shipping</span>
                <strong>Calculated at checkout</strong>
              </div>
            </div>

            <div className="summaryDivider" />

            <div className="modernSummaryTotal">
              <div>
                <span>TOTAL</span>
                <small>Before shipping</small>
              </div>
              <strong>{formatPrice(subtotal)}</strong>
            </div>

            <Link href="/checkout" className="cartCheckoutButton">
              <span>
                <small>SECURE CHECKOUT</small>
                CHECKOUT NOW
              </span>
              <b>→</b>
            </Link>

            <div className="checkoutTrust">
              <span>✓ Secure payment</span>
              <span>✓ Order tracking</span>
              <span>✓ Vehicle-fitment support</span>
            </div>
          </aside>
        </div>
      </div>

      <div className="mobileCheckoutBar">
        <div>
          <span>TOTAL</span>
          <strong>{formatPrice(subtotal)}</strong>
        </div>
        <Link href="/checkout">
          CHECKOUT <b>→</b>
        </Link>
      </div>
    </main>
  );
}

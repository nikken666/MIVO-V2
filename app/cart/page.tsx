"use client";

import Link from "next/link";
import { formatPrice } from "@/data/products";
import { useMarketplace } from "@/components/MarketplaceProvider";

export default function CartPage() {
  const {
    cart,
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
      <main className="container pageShell">
        <div className="emptyState">
          <span>🛒</span>
          <h1>Your cart is empty</h1>
          <p>Add products to begin checkout.</p>
          <Link href="/products" className="redButton inlineButton">
            Browse Products
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container pageShell">
      <div className="pageHeading">
        <div>
          <h1>Shopping Cart</h1>
          <p>{cart.length} product lines</p>
        </div>

        <button className="textButton" onClick={clearCart}>
          Clear cart
        </button>
      </div>

      <div className="cartLayout">
        <section className="cartLines">
          {cart.map((line) => {
            const price =
              line.variant?.price ?? line.product.price;

            return (
              <article className="cartLine" key={line.lineId}>
                <div className="cartIcon">
                  {line.product.imageUrl ? (
                    <img
                      src={line.product.imageUrl}
                      alt={line.product.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                  ) : (
                    line.product.icon
                  )}
                </div>

                <div>
                  <Link href={`/products/${line.product.slug}`}>
                    <h3>{line.product.name}</h3>
                  </Link>

                  <span>{line.product.brand}</span>

                  {line.variant && (
                    <small style={{ display: "block", marginTop: 6 }}>
                      {line.product.variation1Name &&
                        line.variant.variation1Value && (
                          <>
                            {line.product.variation1Name}:{" "}
                            {line.variant.variation1Value}
                            <br />
                          </>
                        )}

                      {line.product.variation2Name &&
                        line.variant.variation2Value && (
                          <>
                            {line.product.variation2Name}:{" "}
                            {line.variant.variation2Value}
                            <br />
                          </>
                        )}

                      SKU: {line.variant.sku}
                    </small>
                  )}

                  <strong>{formatPrice(price)}</strong>
                </div>

                <input
                  aria-label="Quantity"
                  type="number"
                  min="1"
                  max={line.variant?.stock || undefined}
                  value={line.quantity}
                  onChange={(event) =>
                    updateQuantity(
                      line.lineId,
                      Number(event.target.value)
                    )
                  }
                />

                <button
                  className="removeButton"
                  onClick={() => removeFromCart(line.lineId)}
                >
                  Remove
                </button>
              </article>
            );
          })}
        </section>

        <aside className="orderSummary">
          <h2>Order Summary</h2>

          <div>
            <span>Subtotal</span>
            <strong>{formatPrice(subtotal)}</strong>
          </div>

          <div>
            <span>Shipping</span>
            <strong>Calculated later</strong>
          </div>

          <hr />

          <div className="summaryTotal">
            <span>Total</span>
            <strong>{formatPrice(subtotal)}</strong>
          </div>

          <Link
            href="/login?next=/cart"
            className="redButton checkoutButton"
          >
            Proceed to Checkout
          </Link>
        </aside>
      </div>
    </main>
  );
}

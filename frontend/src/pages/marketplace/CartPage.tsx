import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Elements } from "@stripe/react-stripe-js";
import {
  CheckCircle2,
  Lock,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCartStore } from "@/store/cart.store";
import { useAuthStore } from "@/store/auth.store";
import { useCartCheckout } from "@/hooks/useOrders";
import { stripePromise } from "@/lib/stripe";
import { BookingPaymentForm } from "@/components/booking/BookingPaymentForm";
import type { DeliveryMethod } from "@/types";

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigate = useNavigate();

  const checkout = useCartCheckout();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("pickup");
  const [shippingAddress, setShippingAddress] = useState("");

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleCheckout = () => {
    if (deliveryMethod === "delivery" && !shippingAddress.trim()) return;
    checkout.mutate(
      {
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
        delivery: {
          deliveryMethod,
          shippingAddress:
            deliveryMethod === "delivery" ? shippingAddress : undefined,
        },
      },
      { onSuccess: (result) => setClientSecret(result.clientSecret) },
    );
  };

  /* ── Post-payment confirmation ──────────────────────────────── */
  if (confirmed) {
    return (
      <main className="page-narrow py-20">
        <div className="surface mx-auto max-w-lg p-10 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-jade-50 text-jade-500">
            <CheckCircle2 className="size-7" />
          </span>
          <h1 className="mt-6 font-display text-2xl font-semibold">
            Payment authorized
          </h1>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Your card has been authorized and the artisans have been notified.
            You'll be charged once each order is fulfilled — if an artisan
            can't fulfill theirs, that hold is released and you're not charged
            for it.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button onClick={() => navigate("/profile-client")}>
              View my orders
            </Button>
            <Button variant="outline" onClick={() => navigate("/categories")}>
              Keep browsing
            </Button>
          </div>
        </div>
      </main>
    );
  }

  /* ── Empty cart ─────────────────────────────────────────────── */
  if (items.length === 0) {
    return (
      <main className="page-narrow py-20">
        <div className="surface mx-auto max-w-lg p-12 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <ShoppingBag className="size-7" />
          </span>
          <h1 className="mt-6 font-display text-2xl font-semibold">
            Your cart is empty
          </h1>
          <p className="mt-2 text-muted-foreground">
            Browse the marketplace and add something you like.
          </p>
          <Button asChild variant="gradient" className="mt-7">
            <Link to="/products">Browse products</Link>
          </Button>
        </div>
      </main>
    );
  }

  /* ── Cart ───────────────────────────────────────────────────── */
  return (
    <main className="page-shell py-12">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-semibold">Your cart</h1>
        <p className="mt-2 text-muted-foreground">
          {items.length} item{items.length === 1 ? "" : "s"} · paid to one
          artisan per order
        </p>
      </div>

      {clientSecret ? (
        <div className="surface mx-auto max-w-lg p-7">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <Lock className="size-4 text-muted-foreground" />
            Authorize ${total.toFixed(2)}
          </h2>
          <div className="mt-5">
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <BookingPaymentForm
                onSuccess={() => {
                  clear();
                  setConfirmed(true);
                }}
                onCancel={() => setClientSecret(null)}
              />
            </Elements>
          </div>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
          {/* ── Line items ──────────────────────────────────────── */}
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={`${item.productId}:${item.variantId ?? ""}`}
                className="surface flex flex-wrap items-center justify-between gap-4 p-5"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                    <Package className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.title}</p>
                    {item.variantLabel && (
                      <p className="truncate text-xs text-muted-foreground">
                        {item.variantLabel}
                      </p>
                    )}
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Store className="size-3" />
                      {item.shopName} · ${item.price.toFixed(2)} each
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 rounded-xl border border-border p-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Decrease quantity"
                      onClick={() =>
                        setQuantity(
                          item.productId,
                          item.variantId,
                          item.quantity - 1,
                        )
                      }
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-7 text-center text-sm font-semibold tabular-nums">
                      {item.quantity}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Increase quantity"
                      onClick={() =>
                        setQuantity(
                          item.productId,
                          item.variantId,
                          item.quantity + 1,
                        )
                      }
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>

                  <p className="w-20 text-right font-semibold tabular-nums">
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${item.title}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeItem(item.productId, item.variantId)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}

            <button
              type="button"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
              onClick={clear}
            >
              Clear cart
            </button>
          </div>

          {/* ── Summary ─────────────────────────────────────────── */}
          <aside className="surface space-y-5 p-6 lg:sticky lg:top-24">
            <div>
              <p className="field-label">Delivery</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: "pickup", label: "Pickup", icon: Store },
                    { value: "delivery", label: "Delivery", icon: Truck },
                  ] as const
                ).map(({ value, label, icon: Icon }) => {
                  const active = deliveryMethod === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDeliveryMethod(value)}
                      aria-pressed={active}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "border-primary bg-brand-50 text-brand-700"
                          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <Icon className="size-4" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {deliveryMethod === "delivery" && (
              <div>
                <label htmlFor="shipping-address" className="field-label">
                  Shipping address
                </label>
                <Textarea
                  id="shipping-address"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Street, city, postcode"
                  rows={3}
                  required
                />
              </div>
            )}

            <div className="space-y-2 border-t border-border/70 pt-5">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-display text-xl font-semibold">
                <span>Total</span>
                <span className="tabular-nums">${total.toFixed(2)}</span>
              </div>
            </div>

            {checkout.isError && (
              <p className="alert-error">
                Couldn't start checkout. Please try again.
              </p>
            )}

            {isAuthenticated ? (
              <Button
                variant="gradient"
                size="lg"
                className="w-full"
                disabled={checkout.isPending}
                onClick={handleCheckout}
              >
                {checkout.isPending ? "Starting…" : "Proceed to payment"}
              </Button>
            ) : (
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link to="/login">Log in to check out</Link>
              </Button>
            )}

            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3" />
              Charged only once your order is fulfilled
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}

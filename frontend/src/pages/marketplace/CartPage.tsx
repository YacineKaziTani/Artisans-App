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
import { LoginLink } from "@/components/LoginLink";
import { getErrorMessage } from "@/lib/errors";
import { Textarea } from "@/components/ui/textarea";
import { useCartStore } from "@/store/cart.store";
import { useAuthStore } from "@/store/auth.store";
import { useAbandonCheckout, useCartCheckout } from "@/hooks/useOrders";
import { stripePromise } from "@/lib/stripe";
import { BookingPaymentForm } from "@/components/booking/BookingPaymentForm";
import type { DeliveryMethod } from "@/types";
import { useShop } from "@/hooks/useShops";
import { deliveryFeeFor, formatMoney } from "@/lib/pricing";
import { track } from "@/lib/analytics";

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigate = useNavigate();

  const checkout = useCartCheckout();
  const abandonCheckout = useAbandonCheckout();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("pickup");
  const [shippingAddress, setShippingAddress] = useState("");

  // Summed in cents so the total matches what the API charges.
  const subtotal = items.reduce((sum, i) => sum + Math.round(i.price * 100) * i.quantity, 0) / 100;

  // A cart is always from one shop; its settings decide pickup/delivery
  // and the fee (charged once per checkout, as the API does).
  const { data: shop } = useShop(items[0]?.shopId);
  const pickupOk = shop?.pickupEnabled !== false;
  const deliveryOk = shop?.deliveryEnabled !== false;
  const method: DeliveryMethod =
    deliveryMethod === "pickup" && !pickupOk ? "delivery" : deliveryMethod === "delivery" && !deliveryOk ? "pickup" : deliveryMethod;
  const deliveryFee = deliveryFeeFor(shop, subtotal, method);
  const total = subtotal + deliveryFee;

  const handleCheckout = () => {
    if (method === "delivery" && !shippingAddress.trim()) return;
    checkout.mutate(
      {
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
        delivery: {
          deliveryMethod: method,
          shippingAddress:
            method === "delivery" ? shippingAddress : undefined,
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
            Your card is on hold — nothing is charged yet. The artisan has been
            emailed your order, and a confirmation is on its way to your inbox.
            You'll be charged for each item once it's fulfilled — anything the
            artisan can't fulfill is released and you're not charged for it.
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
            Authorize {formatMoney(total)}
          </h2>
          <div className="mt-5">
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <BookingPaymentForm
                onSuccess={() => {
                  clear();
                  track("Payment authorized", { kind: "cart" });
                  setConfirmed(true);
                }}
                onCancel={() => {
                  // Backing out of payment: the checkout already reserved
                  // this stock, so release it before the user can retry —
                  // otherwise every cancel-and-retry reserved it again.
                  const orderIds = checkout.data?.orders.map((o) => o.id);
                  if (orderIds?.length) abandonCheckout.mutate(orderIds);
                  checkout.reset();
                  setClientSecret(null);
                }}
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
                  const active = method === value;
                  const offered = value === "pickup" ? pickupOk : deliveryOk;
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={!offered}
                      title={offered ? undefined : `This shop doesn't offer ${value}`}
                      onClick={() => setDeliveryMethod(value)}
                      aria-pressed={active}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
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
              {deliveryOk && shop?.deliveryArea && (
                <p className="mt-2 text-xs text-muted-foreground">Delivers to: {shop.deliveryArea}</p>
              )}
            </div>

            {method === "delivery" && (
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
                <span className="tabular-nums">{formatMoney(subtotal)}</span>
              </div>
              {method === "delivery" && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Delivery</span>
                  <span className="tabular-nums">{deliveryFee > 0 ? formatMoney(deliveryFee) : "Free"}</span>
                </div>
              )}
              <div className="flex justify-between font-display text-xl font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(total)}</span>
              </div>
            </div>

            {checkout.isError && (
              <p className="alert-error">
                {/* e.g. "Only 2 left of that variant", "This product is no longer available" */}
                {getErrorMessage(checkout.error, "Couldn't start checkout. Please try again.")}
              </p>
            )}

            {isAuthenticated ? (
              <Button
                variant="gradient"
                size="lg"
                className="w-full"
                disabled={checkout.isPending || abandonCheckout.isPending}
                onClick={handleCheckout}
              >
                {checkout.isPending || abandonCheckout.isPending
                  ? "Starting…"
                  : "Proceed to payment"}
              </Button>
            ) : (
              <Button asChild variant="outline" size="lg" className="w-full">
                <LoginLink>Log in to check out</LoginLink>
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

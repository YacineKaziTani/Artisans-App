import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Elements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/cart.store";
import { useAuthStore } from "@/store/auth.store";
import { useCartCheckout } from "@/hooks/useOrders";
import { stripePromise } from "@/lib/stripe";
import { BookingPaymentForm } from "@/components/booking/BookingPaymentForm";

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

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleCheckout = () => {
    checkout.mutate(
      items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      { onSuccess: (result) => setClientSecret(result.clientSecret) },
    );
  };

  if (confirmed) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg mx-auto text-center bg-white/90 border-2 border-orange-200 rounded-xl p-10 space-y-4">
          <div className="text-5xl">✅</div>
          <h1 className="text-2xl font-bold text-orange-900">Order Confirmed</h1>
          <p className="text-amber-900">
            Your payment went through — the artisans have been notified.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => navigate("/profile-client")}>
              View My Orders
            </Button>
            <Button variant="outline" onClick={() => navigate("/categories")}>
              Keep Browsing
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-3xl font-bold text-orange-900 mb-4">Your Cart</h1>
          <p className="text-amber-900 mb-6">Your cart is empty.</p>
          <Link to="/categories">
            <Button>Browse Artisans</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-orange-900 mb-8">Your Cart</h1>

        {!clientSecret && (
          <>
            <div className="space-y-4 mb-8">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="bg-white/90 border-2 border-orange-100 rounded-xl p-5 flex items-center justify-between flex-wrap gap-4"
                >
                  <div>
                    <p className="font-semibold text-orange-900">{item.title}</p>
                    <p className="text-sm text-amber-700">{item.shopName}</p>
                    <p className="text-sm text-amber-800 mt-1">
                      ${item.price.toFixed(2)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="w-8 h-8 rounded border border-orange-300 text-orange-700"
                        onClick={() =>
                          setQuantity(item.productId, item.quantity - 1)
                        }
                      >
                        −
                      </button>
                      <span className="w-6 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        className="w-8 h-8 rounded border border-orange-300 text-orange-700"
                        onClick={() =>
                          setQuantity(item.productId, item.quantity + 1)
                        }
                      >
                        +
                      </button>
                    </div>
                    <p className="font-semibold text-orange-900 w-20 text-right">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                    <button
                      type="button"
                      className="text-red-600 text-sm hover:underline"
                      onClick={() => removeItem(item.productId)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white/90 border-2 border-orange-200 rounded-xl p-6 space-y-4">
              <div className="flex justify-between text-xl font-bold text-orange-900">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>

              {checkout.isError && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
                  Couldn't start checkout. Please try again.
                </div>
              )}

              {isAuthenticated ? (
                <Button
                  className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
                  size="lg"
                  disabled={checkout.isPending}
                  onClick={handleCheckout}
                >
                  {checkout.isPending ? "Starting..." : "Proceed to Payment"}
                </Button>
              ) : (
                <Link to="/login" className="block">
                  <Button className="w-full" size="lg" variant="outline">
                    Login to Checkout
                  </Button>
                </Link>
              )}
              <button
                type="button"
                className="text-sm text-amber-700 hover:underline block mx-auto"
                onClick={clear}
              >
                Clear cart
              </button>
            </div>
          </>
        )}

        {clientSecret && (
          <div className="bg-white/90 border-2 border-orange-200 rounded-xl p-6">
            <h2 className="text-xl font-bold text-orange-900 mb-4">
              Pay ${total.toFixed(2)}
            </h2>
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
        )}
      </div>
    </main>
  );
}

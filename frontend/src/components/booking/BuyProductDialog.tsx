import { useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateOrder } from "@/hooks/useOrders";
import { stripePromise } from "@/lib/stripe";
import { BookingPaymentForm } from "@/components/booking/BookingPaymentForm";
import type { Product } from "@/types";

export function BuyProductDialog({
  product,
  open,
  onOpenChange,
}: {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const createOrder = useCreateOrder();

  const reset = () => {
    setQuantity(1);
    setClientSecret(null);
    setConfirmed(false);
    createOrder.reset();
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleRequestOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity < 1) return;
    createOrder.mutate(
      { productId: product.id, quantity },
      { onSuccess: (result) => setClientSecret(result.clientSecret) },
    );
  };

  const total = Number(product.basePrice) * quantity;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {confirmed ? (
          <div className="text-center py-6 space-y-3">
            <div className="text-5xl">✅</div>
            <DialogTitle>Order Confirmed</DialogTitle>
            <DialogDescription>
              Your payment went through and the artisan has been notified.
            </DialogDescription>
            <Button onClick={() => handleClose(false)} className="mt-2">
              Done
            </Button>
          </div>
        ) : clientSecret ? (
          <>
            <DialogHeader>
              <DialogTitle>Pay for {product.title}</DialogTitle>
              <DialogDescription>
                {quantity} × ${Number(product.basePrice).toFixed(2)} = $
                {total.toFixed(2)}
              </DialogDescription>
            </DialogHeader>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <BookingPaymentForm
                onSuccess={() => setConfirmed(true)}
                onCancel={() => handleClose(false)}
              />
            </Elements>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Buy {product.title}</DialogTitle>
              <DialogDescription>
                ${Number(product.basePrice).toFixed(2)} each
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRequestOrder} className="space-y-4">
              {createOrder.isError && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
                  Couldn't start the order. Please try again.
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                />
              </div>
              <p className="text-sm text-gray-600">
                Total: <span className="font-semibold">${total.toFixed(2)}</span>
              </p>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
                disabled={createOrder.isPending}
              >
                {createOrder.isPending ? "Starting..." : "Continue to Payment"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

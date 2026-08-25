import { useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useCreateOrder } from "@/hooks/useOrders";
import { stripePromise } from "@/lib/stripe";
import { BookingPaymentForm } from "@/components/booking/BookingPaymentForm";
import type { DeliveryMethod, Product, ProductVariant } from "@/types";

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
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("pickup");
  const [shippingAddress, setShippingAddress] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const createOrder = useCreateOrder();
  const options = useMemo(() => product.variantOptions ?? [], [product.variantOptions]);
  const hasVariants = options.length > 0;

  const selectedVariant: ProductVariant | undefined = useMemo(() => {
    if (!hasVariants) return undefined;
    if (options.some((o) => !selectedValues[o.id])) return undefined;
    const wanted = new Set(Object.values(selectedValues));
    return (product.variants ?? []).find((v) => {
      const vIds = new Set(v.values.map((val) => val.id));
      return vIds.size === wanted.size && [...wanted].every((id) => vIds.has(id));
    });
  }, [hasVariants, options, selectedValues, product.variants]);

  const unitPrice = selectedVariant
    ? selectedVariant.priceOverride !== undefined && selectedVariant.priceOverride !== null
      ? Number(selectedVariant.priceOverride)
      : Number(product.basePrice) +
        selectedVariant.values.reduce((sum, v) => sum + Number(v.priceModifier), 0)
    : Number(product.basePrice);

  const outOfStock = hasVariants && selectedVariant && selectedVariant.stockQuantity < 1;
  const needsSelection = hasVariants && !selectedVariant;

  const reset = () => {
    setQuantity(1);
    setSelectedValues({});
    setDeliveryMethod("pickup");
    setShippingAddress("");
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
    if (needsSelection || outOfStock) return;
    if (deliveryMethod === "delivery" && !shippingAddress.trim()) return;
    createOrder.mutate(
      {
        productId: product.id,
        variantId: selectedVariant?.id,
        quantity,
        deliveryMethod,
        shippingAddress: deliveryMethod === "delivery" ? shippingAddress : undefined,
      },
      { onSuccess: (result) => setClientSecret(result.clientSecret) },
    );
  };

  const total = unitPrice * quantity;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {confirmed ? (
          <div className="text-center py-6 space-y-3">
            <div className="text-5xl">✅</div>
            <DialogTitle>Payment Authorized</DialogTitle>
            <DialogDescription>
              Your card has been authorized and the artisan has been
              notified. You'll be charged once they fulfill the order — if
              they can't, the hold is released and you're never charged.
            </DialogDescription>
            <Button onClick={() => handleClose(false)} className="mt-2">
              Done
            </Button>
          </div>
        ) : clientSecret ? (
          <>
            <DialogHeader>
              <DialogTitle>Authorize Payment for {product.title}</DialogTitle>
              <DialogDescription>
                {quantity} × ${unitPrice.toFixed(2)} = $
                {total.toFixed(2)} — charged only once the artisan fulfills it.
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
              {hasVariants && (
                <div className="space-y-2">
                  <Label>Options</Label>
                  <div className="flex flex-wrap gap-2">
                    {options.map((option) => (
                      <select
                        key={option.id}
                        value={selectedValues[option.id] ?? ""}
                        onChange={(e) =>
                          setSelectedValues((prev) => ({ ...prev, [option.id]: e.target.value }))
                        }
                        className="h-9 text-sm border border-gray-300 rounded-md px-2"
                      >
                        <option value="">{option.name}...</option>
                        {(option.values ?? []).map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.value}
                          </option>
                        ))}
                      </select>
                    ))}
                  </div>
                  {needsSelection && (
                    <p className="text-xs text-gray-500">Select an option for each attribute.</p>
                  )}
                  {outOfStock && (
                    <p className="text-xs text-red-600">That combination is out of stock.</p>
                  )}
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
              <div className="space-y-2">
                <Label>Delivery</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod("pickup")}
                    className={`flex-1 text-sm py-2 rounded-md border ${
                      deliveryMethod === "pickup"
                        ? "border-orange-600 bg-orange-50 text-orange-800"
                        : "border-gray-300 text-gray-600"
                    }`}
                  >
                    Pickup
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod("delivery")}
                    className={`flex-1 text-sm py-2 rounded-md border ${
                      deliveryMethod === "delivery"
                        ? "border-orange-600 bg-orange-50 text-orange-800"
                        : "border-gray-300 text-gray-600"
                    }`}
                  >
                    Delivery
                  </button>
                </div>
              </div>
              {deliveryMethod === "delivery" && (
                <div className="space-y-2">
                  <Label htmlFor="shippingAddress">Shipping Address</Label>
                  <Textarea
                    id="shippingAddress"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="Street, city, postal code"
                    rows={2}
                    required
                  />
                </div>
              )}
              <p className="text-sm text-gray-600">
                Total: <span className="font-semibold">${total.toFixed(2)}</span>
              </p>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
                disabled={createOrder.isPending || needsSelection || outOfStock}
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

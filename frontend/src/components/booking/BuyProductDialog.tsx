import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
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
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>(
    {},
  );
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>("pickup");
  const [shippingAddress, setShippingAddress] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const createOrder = useCreateOrder();
  const options = useMemo(
    () => product.variantOptions ?? [],
    [product.variantOptions],
  );
  const hasVariants = options.length > 0;

  const selectedVariant: ProductVariant | undefined = useMemo(() => {
    if (!hasVariants) return undefined;
    if (options.some((o) => !selectedValues[o.id])) return undefined;
    const wanted = new Set(Object.values(selectedValues));
    return (product.variants ?? []).find((v) => {
      const vIds = new Set(v.values.map((val) => val.id));
      return (
        vIds.size === wanted.size && [...wanted].every((id) => vIds.has(id))
      );
    });
  }, [hasVariants, options, selectedValues, product.variants]);

  const unitPrice = selectedVariant
    ? selectedVariant.priceOverride !== undefined &&
      selectedVariant.priceOverride !== null
      ? Number(selectedVariant.priceOverride)
      : Number(product.basePrice) +
        selectedVariant.values.reduce(
          (sum, v) => sum + Number(v.priceModifier),
          0,
        )
    : Number(product.basePrice);

  const outOfStock = Boolean(
    hasVariants && selectedVariant && selectedVariant.stockQuantity < 1,
  );
  const needsSelection = hasVariants && !selectedVariant;
  const stockLimit = selectedVariant?.stockQuantity;
  const exceedsStock = stockLimit !== undefined && quantity > stockLimit;

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
    if (needsSelection || outOfStock || exceedsStock) return;
    if (deliveryMethod === "delivery" && !shippingAddress.trim()) return;
    createOrder.mutate(
      {
        productId: product.id,
        variantId: selectedVariant?.id,
        quantity,
        deliveryMethod,
        shippingAddress:
          deliveryMethod === "delivery" ? shippingAddress : undefined,
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
              Your card has been authorized and the artisan has been notified.
              You'll be charged once they fulfill the order — if they can't, the
              hold is released and you're never charged.
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
                {quantity} × ${unitPrice.toFixed(2)} = ${total.toFixed(2)} —
                charged only once the artisan fulfills it.
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
                <div className="p-3 bg-destructive/10 border border-destructive/25 rounded-lg text-destructive text-sm">
                  {(isAxiosError(createOrder.error) &&
                    createOrder.error.response?.data?.message) ||
                    "Couldn't start the order. Please try again."}
                </div>
              )}
              {hasVariants && (
                <div className="space-y-2">
                  <Label>Choose an option</Label>
                  {(product.variants ?? []).length === 0 ? (
                    <p className="text-sm text-destructive">
                      This seller hasn't added any purchasable combinations yet.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {(product.variants ?? []).map((variant) => {
                        const label = variant.values
                          .map((v) => `${v.option?.name}: ${v.value}`)
                          .join(", ");
                        const price =
                          variant.priceOverride !== undefined &&
                          variant.priceOverride !== null
                            ? Number(variant.priceOverride)
                            : Number(product.basePrice) +
                              variant.values.reduce(
                                (sum, v) => sum + Number(v.priceModifier),
                                0,
                              );
                        const isSelected = selectedVariant?.id === variant.id;
                        const isOut = variant.stockQuantity < 1;

                        return (
                          <button
                            key={variant.id}
                            type="button"
                            disabled={isOut}
                            onClick={() => {
                              const next: Record<string, string> = {};
                              variant.values.forEach((v) => {
                                if (v.option) next[v.option.id] = v.id;
                              });
                              setSelectedValues(next);
                              setQuantity((q) =>
                                Math.min(Math.max(1, q), variant.stockQuantity),
                              );
                            }}
                            className={`w-full flex items-center justify-between gap-2 text-sm rounded-md border px-3 py-2 text-left ${
                              isOut
                                ? "border-border bg-muted text-muted-foreground/70 cursor-not-allowed"
                                : isSelected
                                  ? "border-primary bg-brand-50 text-foreground"
                                  : "border-border hover:border-primary/40"
                            }`}
                          >
                            <span>{label}</span>
                            <span className="flex items-center gap-2 flex-shrink-0">
                              <span>${price.toFixed(2)}</span>
                              <span className={isOut ? "" : "text-jade-600"}>
                                {isOut
                                  ? "Out of stock"
                                  : `${variant.stockQuantity} in stock`}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {needsSelection && (product.variants ?? []).length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Pick one of the options above.
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={stockLimit}
                  value={quantity}
                  onChange={(e) => {
                    const next = Math.max(1, Number(e.target.value));
                    setQuantity(
                      stockLimit === undefined
                        ? next
                        : Math.min(next, stockLimit),
                    );
                  }}
                />
                {stockLimit !== undefined && stockLimit > 0 && (
                  <p className="text-xs text-muted-foreground">{stockLimit} in stock</p>
                )}
                {exceedsStock && (
                  <p className="text-xs text-destructive">
                    Only {stockLimit} left of this option.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Delivery</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod("pickup")}
                    className={`flex-1 text-sm py-2 rounded-md border ${
                      deliveryMethod === "pickup"
                        ? "border-primary bg-brand-50 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    Pickup
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod("delivery")}
                    className={`flex-1 text-sm py-2 rounded-md border ${
                      deliveryMethod === "delivery"
                        ? "border-primary bg-brand-50 text-primary"
                        : "border-border text-muted-foreground"
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
              <p className="text-sm text-muted-foreground">
                Total:{" "}
                <span className="font-semibold">${total.toFixed(2)}</span>
              </p>
              <Button
                type="submit"
                className="w-full btn-gradient text-white"
                disabled={
                  createOrder.isPending ||
                  needsSelection ||
                  outOfStock ||
                  exceedsStock
                }
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

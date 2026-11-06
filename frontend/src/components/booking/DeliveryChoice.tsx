import { Label } from "@/components/ui/label";
import { deliveryFeeFor, formatMoney } from "@/lib/pricing";
import type { DeliveryMethod, Shop } from "@/types";

type DeliverySettings = Pick<
  Shop,
  "pickupEnabled" | "deliveryEnabled" | "deliveryFee" | "freeDeliveryOver" | "deliveryArea"
>;

/**
 * Pickup / delivery picker for a shop's settings: methods it doesn't offer
 * are disabled, and the delivery fee (or that it's free) is spelled out.
 */
export function DeliveryChoice({
  shop,
  value,
  onChange,
  itemsSubtotal,
}: {
  shop: DeliverySettings | null | undefined;
  value: DeliveryMethod;
  onChange: (method: DeliveryMethod) => void;
  itemsSubtotal: number;
}) {
  const pickupOk = shop?.pickupEnabled !== false;
  const deliveryOk = shop?.deliveryEnabled !== false;
  const fee = deliveryFeeFor(shop, itemsSubtotal, "delivery");
  const threshold = shop?.freeDeliveryOver != null && shop.freeDeliveryOver !== "" ? Number(shop.freeDeliveryOver) : null;

  const option = (method: DeliveryMethod, label: string, enabled: boolean) => (
    <button
      type="button"
      disabled={!enabled}
      aria-pressed={value === method}
      onClick={() => onChange(method)}
      className={`flex-1 rounded-md border py-2 text-sm ${
        value === method
          ? "border-primary bg-brand-50 text-primary"
          : enabled
            ? "border-border text-muted-foreground"
            : "cursor-not-allowed border-border text-muted-foreground/50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-2">
      <Label>Delivery</Label>
      <div className="flex gap-2">
        {option("pickup", pickupOk ? "Pickup" : "No pickup", pickupOk)}
        {option("delivery", deliveryOk ? (fee > 0 ? `Delivery · ${formatMoney(fee)}` : "Delivery · free") : "No delivery", deliveryOk)}
      </div>
      {deliveryOk && (
        <p className="text-xs text-muted-foreground">
          {shop?.deliveryArea ? `Delivers to: ${shop.deliveryArea}. ` : ""}
          {threshold !== null && Number(shop?.deliveryFee ?? 0) > 0
            ? fee === 0
              ? `Free delivery on orders over ${formatMoney(threshold)}.`
              : `Free delivery from ${formatMoney(threshold)}.`
            : ""}
        </p>
      )}
    </div>
  );
}

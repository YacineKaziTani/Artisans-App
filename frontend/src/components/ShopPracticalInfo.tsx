import { Clock, Truck } from "lucide-react";
import { describeDay, hasOpeningHours, WEEKDAYS, zoneLabel } from "@/lib/schedule";
import { formatMoney } from "@/lib/pricing";
import type { Shop } from "@/types";

/** Opening hours and pickup/delivery terms, for the public shop page. */
export function ShopPracticalInfo({ shop, showHours, showDelivery }: { shop: Shop; showHours: boolean; showDelivery: boolean }) {
  const hours = shop.openingHours;
  const pickup = shop.pickupEnabled !== false;
  const delivery = shop.deliveryEnabled !== false;
  const fee = Number(shop.deliveryFee ?? 0);
  const freeOver = shop.freeDeliveryOver != null && shop.freeDeliveryOver !== "" ? Number(shop.freeDeliveryOver) : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {showHours && (
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium text-foreground">Opening hours</p>
            {hasOpeningHours(hours) ? (
              <>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-sm text-muted-foreground">
                  {WEEKDAYS.map((d) => (
                    <div key={d.key} className="contents">
                      <dt>{d.short}</dt>
                      <dd className="tabular-nums">{describeDay(hours, d.key)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-1 text-xs text-muted-foreground">{zoneLabel(shop.timezone || "UTC")} time</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">By appointment — request a time and the artisan confirms.</p>
            )}
          </div>
        </div>
      )}
      {showDelivery && (
        <div className="flex items-start gap-3">
          <Truck className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Getting your order</p>
            {pickup && <p>Pickup available{shop.city ? ` in ${shop.city}` : ""}.</p>}
            {delivery && (
              <p>
                Delivery {fee > 0 ? formatMoney(fee) : "free"}
                {fee > 0 && freeOver !== null ? `, free from ${formatMoney(freeOver)}` : ""}
                {shop.deliveryArea ? ` · ${shop.deliveryArea}` : ""}.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateShopDelivery } from "@/hooks/useShops";
import { getErrorMessage } from "@/lib/errors";
import type { Shop } from "@/types";
import { toast } from "@/lib/toast";

const asInput = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === "" ? "" : String(Number(value));

/** How clients can get their order, and what delivery costs. */
export function ShopDeliveryCard({ shop }: { shop: Shop }) {
  const save = useUpdateShopDelivery();
  const [pickupEnabled, setPickupEnabled] = useState(shop.pickupEnabled ?? true);
  const [deliveryEnabled, setDeliveryEnabled] = useState(shop.deliveryEnabled ?? true);
  const [deliveryFee, setDeliveryFee] = useState(asInput(shop.deliveryFee ?? 0));
  const [freeOver, setFreeOver] = useState(asInput(shop.freeDeliveryOver));
  const [deliveryArea, setDeliveryArea] = useState(shop.deliveryArea ?? "");
  const neither = !pickupEnabled && !deliveryEnabled;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (neither) return;
    save.mutate({
      pickupEnabled,
      deliveryEnabled,
      deliveryFee: deliveryEnabled && deliveryFee !== "" ? Number(deliveryFee) : 0,
      freeDeliveryOver: deliveryEnabled && freeOver !== "" ? Number(freeOver) : null,
      deliveryArea: deliveryEnabled ? deliveryArea.trim() : "",
    }, { onSuccess: () => toast.success("Delivery options saved") });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pickup & delivery</CardTitle>
        <CardDescription>
          How clients receive their orders. A cart from your shop pays the delivery fee once.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {save.isError && (
            <p className="alert-error">{getErrorMessage(save.error, "Couldn't save delivery options.")}</p>
          )}

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={pickupEnabled} onChange={(e) => setPickupEnabled(e.target.checked)} />
              Clients can pick up
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={deliveryEnabled} onChange={(e) => setDeliveryEnabled(e.target.checked)} />
              I deliver
            </label>
          </div>
          {neither && <p className="text-sm text-destructive">Offer at least one of pickup or delivery.</p>}

          {deliveryEnabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="delivery-fee" className="field-label">Delivery fee ($)</label>
                <Input
                  id="delivery-fee"
                  type="number"
                  min="0"
                  max="1000"
                  step="0.01"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  placeholder="0 = free"
                />
              </div>
              <div>
                <label htmlFor="free-over" className="field-label">Free delivery from ($)</label>
                <Input
                  id="free-over"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={freeOver}
                  onChange={(e) => setFreeOver(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="delivery-area" className="field-label">Where you deliver</label>
                <Input
                  id="delivery-area"
                  value={deliveryArea}
                  maxLength={300}
                  onChange={(e) => setDeliveryArea(e.target.value)}
                  placeholder="e.g. Paris and the inner suburbs"
                />
                <p className="mt-1 text-xs text-muted-foreground">Shown to clients before they choose delivery.</p>
              </div>
            </div>
          )}

          <Button type="submit" disabled={save.isPending || neither}>
            {save.isPending ? "Saving…" : "Save delivery options"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

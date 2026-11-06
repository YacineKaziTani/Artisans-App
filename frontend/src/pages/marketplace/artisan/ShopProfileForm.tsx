import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCloseMyShop, useReopenMyShop, useUpdateMyShop } from "@/hooks/useShops";
import { useConfirm } from "@/hooks/useConfirm";
import { getErrorMessage } from "@/lib/errors";
import { isImageTooLarge } from "@/lib/uploads";
import type { Shop } from "@/types";
import { ShopFields, type ShopFieldValues } from "./ShopFields";
import { StripeConnectBanner } from "./StripeConnectBanner";
import { VerificationBanner } from "./VerificationBanner";

const valuesFor = (shop: Shop): ShopFieldValues => ({
  shopName: shop.shopName,
  categoryId: shop.category?.id ?? "",
  description: shop.description ?? "",
  phone: shop.phone ?? "",
  city: shop.city ?? "",
  address: shop.address ?? "",
  logo: null,
});

export function ShopProfileForm({ shop }: { shop: Shop }) {
  const updateShop = useUpdateMyShop();
  const closeShop = useCloseMyShop();
  const reopenShop = useReopenMyShop();
  const confirm = useConfirm();
  const [values, setValues] = useState<ShopFieldValues>(() => valuesFor(shop));
  const logoTooLarge = isImageTooLarge(values.logo);
  const statusError = closeShop.error ?? reopenShop.error;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (logoTooLarge) return;
    // Empty strings are sent on purpose: they clear the field.
    updateShop.mutate(
      {
        shopName: values.shopName.trim(),
        categoryId: values.categoryId || undefined,
        description: values.description.trim(),
        phone: values.phone.trim(),
        address: values.address.trim(),
        city: values.city.trim(),
        logo: values.logo,
      },
      { onSuccess: () => setValues((v) => ({ ...v, logo: null })) },
    );
  };

  const handleClose = async () => {
    const ok = await confirm({
      title: "Close your shop?",
      description:
        "It's hidden from the marketplace and can't take new bookings or orders. Existing ones aren't affected, and you can reopen it any time.",
      confirmLabel: "Close shop",
      destructive: true,
    });
    if (ok) closeShop.mutate();
  };

  return (
    <div className="space-y-6">
      {shop.status === "closed" && (
        <div className="p-4 bg-muted border border-border rounded-lg flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-foreground/80">
            Your shop is closed and hidden from public listings.
          </p>
          <Button size="sm" disabled={reopenShop.isPending} onClick={() => reopenShop.mutate()}>
            {reopenShop.isPending ? "Reopening..." : "Reopen Shop"}
          </Button>
        </div>
      )}
      {shop.status === "suspended" && (
        <div className="p-4 bg-destructive/10 border border-destructive/25 rounded-lg text-sm text-destructive">
          Your shop was suspended by an admin and is hidden from public
          listings. Contact support if you believe this is a mistake.
        </div>
      )}
      {shop.status === "pending" && (
        <div className="p-4 bg-yellow-100 border border-yellow-300 rounded-lg text-sm text-yellow-800">
          Your shop is pending admin approval and isn't publicly visible yet.
        </div>
      )}
      {Boolean(statusError) && <p className="alert-error">{getErrorMessage(statusError)}</p>}

      <StripeConnectBanner shop={shop} />
      <VerificationBanner shop={shop} />

      <Card>
        <CardHeader>
          <CardTitle>Shop Information</CardTitle>
          <CardDescription>Update your shop details and contact information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            {updateShop.isError && (
              <div className="alert-error">
                {getErrorMessage(updateShop.error, "Couldn't save your changes. Please try again.")}
              </div>
            )}
            {updateShop.isSuccess && (
              <div className="p-3 bg-jade-50 border border-jade-500/25 rounded-lg text-jade-600 text-sm">
                Shop updated.
              </div>
            )}

            <ShopFields values={values} onChange={setValues} currentLogoUrl={shop.logoUrl} />

            <Button
              type="submit"
              className="w-full"
              disabled={updateShop.isPending || logoTooLarge}
            >
              {updateShop.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {shop.status === "active" && (
        <Card>
          <CardContent className="pt-6 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-medium text-foreground">Close Shop</p>
              <p className="text-sm text-muted-foreground">
                Temporarily hide your shop from public listings. You can reopen it any time.
              </p>
            </div>
            <Button variant="destructive" disabled={closeShop.isPending} onClick={handleClose}>
              {closeShop.isPending ? "Closing..." : "Close Shop"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdminShopPreview } from "@/hooks/useShops";
import { getErrorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/pricing";
import { img } from "@/lib/images";

/**
 * What a shop actually looks like before an admin approves it. Pending
 * shops are hidden from the public shop page, so there was no way to see
 * their services, products and photos from the admin side.
 */
export function ShopPreviewDialog({
  shopId,
  onClose,
}: {
  shopId: string | null;
  onClose: () => void;
}) {
  const { data: shop, isLoading, isError, error } = useAdminShopPreview(shopId);

  return (
    <Dialog open={Boolean(shopId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        {isLoading && (
          <div className="space-y-3">
            <DialogTitle className="sr-only">Loading shop</DialogTitle>
            <div className="skeleton h-8 w-1/2" />
            <div className="skeleton h-20" />
            <div className="skeleton h-32" />
          </div>
        )}

        {isError && (
          <>
            <DialogTitle>Couldn't load this shop</DialogTitle>
            <p className="alert-error">{getErrorMessage(error)}</p>
          </>
        )}

        {shop && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                {shop.logoUrl && (
                  <img {...img(shop.logoUrl, 48)} alt="" className="size-12 rounded-xl border border-border object-cover" />
                )}
                <div className="min-w-0">
                  <DialogTitle>{shop.shopName}</DialogTitle>
                  <DialogDescription>
                    {[shop.category?.name, shop.city, shop.status].filter(Boolean).join(" · ")}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="inline text-muted-foreground">Owner: </dt>
                <dd className="inline">
                  {shop.owner ? `${shop.owner.name} (${shop.owner.email})` : "—"}
                </dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground">Phone: </dt>
                <dd className="inline">{shop.phone || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="inline text-muted-foreground">Address: </dt>
                <dd className="inline">{[shop.address, shop.city].filter(Boolean).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground">Payouts: </dt>
                <dd className="inline">{shop.acceptsPayments ? "Set up" : "Not set up yet"}</dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground">Created: </dt>
                <dd className="inline">
                  {shop.createdAt ? new Date(shop.createdAt).toLocaleDateString() : "—"}
                </dd>
              </div>
            </dl>

            {shop.description && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">
                {shop.description}
              </p>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold">
                Services ({shop.services?.length ?? 0})
              </h3>
              {(shop.services ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">None yet.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                  {shop.services!.map((service) => (
                    <li key={service.id} className="flex justify-between gap-3 px-3 py-2">
                      <span className="min-w-0">
                        <span className="font-medium">{service.name}</span>
                        {service.description && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {service.description}
                          </span>
                        )}
                      </span>
                      <span className="flex-shrink-0">{formatMoney(service.price)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">
                Products ({shop.productCount})
                {shop.productCount > (shop.products?.length ?? 0) && (
                  <span className="font-normal text-muted-foreground">
                    {" "}— newest {shop.products?.length}
                  </span>
                )}
              </h3>
              {(shop.products ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">None yet.</p>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {shop.products!.map((product) => (
                    <li key={product.id} className="overflow-hidden rounded-lg border border-border text-sm">
                      {product.imageUrl ? (
                        <img {...img(product.imageUrl, 200)} alt="" className="h-24 w-full object-cover" />
                      ) : (
                        <div className="flex h-24 items-center justify-center bg-brand-50 text-brand-500">
                          <Package className="size-6" />
                        </div>
                      )}
                      <div className="p-2">
                        <p className="truncate font-medium">{product.title}</p>
                        <p className="text-xs text-muted-foreground">{formatMoney(product.basePrice)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {(shop.photos ?? []).length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold">Photos ({shop.photos!.length})</h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {shop.photos!.map((photo) => (
                    <img
                      key={photo.id}
                      {...img(photo.url, 200)}
                      alt={photo.caption ?? ""}
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

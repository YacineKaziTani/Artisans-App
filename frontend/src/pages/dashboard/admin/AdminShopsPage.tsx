import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdminShops, useUpdateShopStatusAdmin } from "@/hooks/useAdminShops";
import { useResolveVerification } from "@/hooks/useShops";
import type { Shop } from "@/types";

const STATUS_STYLES: Record<Shop["status"], string> = {
  active: "bg-jade-50 text-jade-600 border-jade-500/25",
  suspended: "bg-destructive/10 text-destructive border-destructive/25",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  closed: "bg-muted text-foreground/80 border-border",
};

export default function AdminShopsPage() {
  const { data, isLoading, isError } = useAdminShops();
  const updateStatus = useUpdateShopStatusAdmin();
  const resolveVerification = useResolveVerification();
  const shops = data?.data ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Shops</h1>
        <p className="text-muted-foreground">Approve new shops and moderate existing ones</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Shops</CardTitle>
          <CardDescription>{data?.meta.total ?? 0} total</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <p className="text-destructive bg-destructive/10 border border-destructive/25 rounded-lg p-4 text-sm">
              Couldn't load shops.
            </p>
          )}

          {!isLoading && !isError && shops.length === 0 && (
            <p className="text-muted-foreground text-sm">No shops yet.</p>
          )}

          {!isLoading &&
            !isError &&
            shops.map((shop) => {
              const isUpdating =
                updateStatus.isPending && updateStatus.variables?.id === shop.id;
              const isResolvingVerification =
                resolveVerification.isPending &&
                resolveVerification.variables?.id === shop.id;

              return (
                <div
                  key={shop.id}
                  className="flex items-center justify-between border border-border rounded-lg p-3 flex-wrap gap-2"
                >
                  <div>
                    <p className="font-medium text-foreground">{shop.shopName}</p>
                    <p className="text-sm text-muted-foreground">
                      {shop.category?.name} · {shop.city ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full border ${STATUS_STYLES[shop.status]}`}
                    >
                      {shop.status}
                    </span>
                    {shop.verificationStatus === "verified" && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full border bg-sky-100 text-sky-800 border-sky-200">
                        ✓ verified
                      </span>
                    )}
                    {shop.verificationStatus === "pending" && (
                      <>
                        <span className="text-xs font-semibold px-2 py-1 rounded-full border bg-muted text-foreground/80 border-border">
                          verification pending
                        </span>
                        <Button
                          size="sm"
                          disabled={isResolvingVerification}
                          onClick={() =>
                            resolveVerification.mutate({ id: shop.id, status: "verified" })
                          }
                        >
                          Approve Verification
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isResolvingVerification}
                          onClick={() =>
                            resolveVerification.mutate({
                              id: shop.id,
                              status: "rejected",
                              note: "Did not meet verification criteria",
                            })
                          }
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {shop.status !== "active" && (
                      <Button
                        size="sm"
                        disabled={isUpdating}
                        onClick={() =>
                          updateStatus.mutate({ id: shop.id, status: "active" })
                        }
                      >
                        Approve
                      </Button>
                    )}
                    {shop.status !== "suspended" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isUpdating}
                        onClick={() =>
                          updateStatus.mutate({ id: shop.id, status: "suspended" })
                        }
                      >
                        Suspend
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
}

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdminShops, useUpdateShopStatusAdmin } from "@/hooks/useAdminShops";
import type { Shop } from "@/types";

const STATUS_STYLES: Record<Shop["status"], string> = {
  active: "bg-green-100 text-green-800 border-green-300",
  suspended: "bg-red-100 text-red-800 border-red-300",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  closed: "bg-gray-100 text-gray-700 border-gray-300",
};

export default function AdminShopsPage() {
  const { data, isLoading, isError } = useAdminShops();
  const updateStatus = useUpdateShopStatusAdmin();
  const shops = data?.data ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Shops</h1>
        <p className="text-gray-600">Approve new shops and moderate existing ones</p>
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
                <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
              Couldn't load shops.
            </p>
          )}

          {!isLoading && !isError && shops.length === 0 && (
            <p className="text-gray-600 text-sm">No shops yet.</p>
          )}

          {!isLoading &&
            !isError &&
            shops.map((shop) => {
              const isUpdating =
                updateStatus.isPending && updateStatus.variables?.id === shop.id;

              return (
                <div
                  key={shop.id}
                  className="flex items-center justify-between border border-gray-200 rounded-lg p-3 flex-wrap gap-2"
                >
                  <div>
                    <p className="font-medium text-gray-900">{shop.shopName}</p>
                    <p className="text-sm text-gray-500">
                      {shop.category?.name} · {shop.city ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full border ${STATUS_STYLES[shop.status]}`}
                    >
                      {shop.status}
                    </span>
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

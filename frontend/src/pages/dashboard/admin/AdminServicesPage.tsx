import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { serviceApi } from "@/api/service.api";
import { useDeleteService } from "@/hooks/useServices";

export default function AdminServicesPage() {
  const { data: services, isLoading, isError } = useQuery({
    queryKey: ["admin", "services"],
    queryFn: serviceApi.listAll,
  });
  const deleteService = useDeleteService();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Services</h1>
        <p className="text-gray-600">Moderate services listed across all shops</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Services</CardTitle>
          <CardDescription>{services?.length ?? 0} total</CardDescription>
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
              Couldn't load services.
            </p>
          )}

          {!isLoading && !isError && (services ?? []).length === 0 && (
            <p className="text-gray-600 text-sm">No services yet.</p>
          )}

          {!isLoading &&
            !isError &&
            (services ?? []).map((service) => {
              const isDeleting =
                deleteService.isPending && deleteService.variables === service.id;
              return (
                <div
                  key={service.id}
                  className="flex items-center justify-between border border-gray-200 rounded-lg p-3 flex-wrap gap-2"
                >
                  <div>
                    <p className="font-medium text-gray-900">{service.name}</p>
                    <p className="text-sm text-gray-500">
                      {service.shop?.shopName} · ${Number(service.price).toFixed(2)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isDeleting}
                    onClick={() => deleteService.mutate(service.id)}
                  >
                    {isDeleting ? "…" : "Remove"}
                  </Button>
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
}

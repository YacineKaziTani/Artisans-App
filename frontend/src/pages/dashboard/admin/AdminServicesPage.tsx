import { Wrench } from "lucide-react";
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
import { useConfirm } from "@/hooks/useConfirm";
import { getErrorMessage } from "@/lib/errors";
import type { Service } from "@/types";
import { PageHeader } from "@/components/PageHeader";

export default function AdminServicesPage() {
  const { data: services, isLoading, isError } = useQuery({
    queryKey: ["admin", "services"],
    queryFn: serviceApi.listAll,
  });
  const deleteService = useDeleteService();
  const confirm = useConfirm();

  const handleRemove = async (service: Service) => {
    const ok = await confirm({
      title: `Remove “${service.name}”?`,
      description:
        "It disappears from the shop and can't be booked. If it has bookings it's archived, so their history stays intact.",
      confirmLabel: "Remove service",
      destructive: true,
    });
    if (ok) deleteService.mutate(service.id);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Services" description="Moderate services listed across all shops" icon={Wrench} />

      <Card>
        <CardHeader>
          <CardTitle>All Services</CardTitle>
          <CardDescription>{services?.length ?? 0} total</CardDescription>
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
            <p className="alert-error">
              Couldn't load services.
            </p>
          )}

          {deleteService.isError && (
            <p className="alert-error">
              {getErrorMessage(deleteService.error, "Couldn't remove that service.")}
            </p>
          )}

          {!isLoading && !isError && (services ?? []).length === 0 && (
            <p className="text-muted-foreground text-sm">No services yet.</p>
          )}

          {!isLoading &&
            !isError &&
            (services ?? []).map((service) => {
              const isDeleting =
                deleteService.isPending && deleteService.variables === service.id;
              return (
                <div
                  key={service.id}
                  className="flex items-center justify-between border border-border rounded-lg p-3 flex-wrap gap-2"
                >
                  <div>
                    <p className="font-medium text-foreground">{service.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {service.shop?.shopName} · ${Number(service.price).toFixed(2)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isDeleting}
                    onClick={() => handleRemove(service)}
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

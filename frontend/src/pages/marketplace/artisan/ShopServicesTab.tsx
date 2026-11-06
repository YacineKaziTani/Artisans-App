import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateService, useDeleteService, useUpdateService } from "@/hooks/useServices";
import { useConfirm } from "@/hooks/useConfirm";
import { getErrorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/pricing";
import type { Service } from "@/types";

interface ServiceDraft {
  name: string;
  description: string;
  price: string;
  duration: string;
  durationMinutes: string;
}

const EMPTY: ServiceDraft = {
  name: "",
  description: "",
  price: "",
  duration: "",
  durationMinutes: "",
};

const draftFor = (service: Service): ServiceDraft => ({
  name: service.name,
  description: service.description ?? "",
  price: String(service.price),
  duration: service.duration ?? "",
  durationMinutes: service.durationMinutes ? String(service.durationMinutes) : "",
});

const fieldLabel = "block text-sm font-medium text-foreground/80 mb-2";

/** Name / description / price / duration fields, for both adding and editing. */
function ServiceFields({
  draft,
  onChange,
  idPrefix,
}: {
  draft: ServiceDraft;
  onChange: (next: ServiceDraft) => void;
  idPrefix: string;
}) {
  const set = (key: keyof ServiceDraft, value: string) => onChange({ ...draft, [key]: value });
  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-name`} className={fieldLabel}>
          Service Name
        </label>
        <Input
          id={`${idPrefix}-name`}
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g., Custom Furniture"
          maxLength={120}
          required
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-description`} className={fieldLabel}>
          Description
        </label>
        <Textarea
          id={`${idPrefix}-description`}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Describe this service"
          maxLength={2000}
          rows={3}
        />
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label htmlFor={`${idPrefix}-price`} className={fieldLabel}>
            Price ($)
          </label>
          <Input
            id={`${idPrefix}-price`}
            type="number"
            min="0.5"
            step="0.01"
            value={draft.price}
            onChange={(e) => set("price", e.target.value)}
            placeholder="0"
            required
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-duration`} className={fieldLabel}>
            Duration (shown to clients)
          </label>
          <Input
            id={`${idPrefix}-duration`}
            value={draft.duration}
            onChange={(e) => set("duration", e.target.value)}
            placeholder="e.g., 2-4 weeks"
            maxLength={60}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-minutes`} className={fieldLabel}>
            Appointment length (min)
          </label>
          <Input
            id={`${idPrefix}-minutes`}
            type="number"
            min="5"
            max="1440"
            step="5"
            value={draft.durationMinutes}
            onChange={(e) => set("durationMinutes", e.target.value)}
            placeholder="e.g., 60"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Set an appointment length for services that take your time, and clients
        won't be able to book overlapping slots.
      </p>
    </>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const updateService = useUpdateService();
  const deleteService = useDeleteService();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ServiceDraft>(() => draftFor(service));
  const error = updateService.error ?? deleteService.error;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    updateService.mutate(
      {
        id: service.id,
        payload: {
          name: draft.name.trim(),
          description: draft.description.trim(),
          price: Number(draft.price),
          duration: draft.duration.trim(),
          // Empty clears it — bookings then only clash at the same start time.
          durationMinutes: draft.durationMinutes ? Number(draft.durationMinutes) : null,
        },
      },
      { onSuccess: () => setEditing(false) },
    );
  };

  const toggleAvailability = async () => {
    if (service.isAvailable) {
      const ok = await confirm({
        title: `Pause “${service.name}”?`,
        description:
          "It's hidden from your shop and can't be booked. Existing bookings aren't affected. You can resume it any time.",
        confirmLabel: "Pause bookings",
      });
      if (!ok) return;
    }
    updateService.mutate({ id: service.id, payload: { isAvailable: !service.isAvailable } });
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete “${service.name}”?`,
      description:
        "It's removed from your shop. If it has bookings it's archived instead, so their history stays intact.",
      confirmLabel: "Delete service",
      destructive: true,
    });
    if (ok) deleteService.mutate(service.id);
  };

  if (editing) {
    return (
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={save} className="space-y-4">
            {Boolean(error) && <p className="alert-error">{getErrorMessage(error)}</p>}
            <ServiceFields draft={draft} onChange={setDraft} idPrefix={`edit-${service.id}`} />
            <div className="flex gap-2">
              <Button type="submit" disabled={updateService.isPending}>
                {updateService.isPending ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(draftFor(service));
                  updateService.reset();
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={service.isAvailable ? undefined : "opacity-75"}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{service.name}</CardTitle>
          {!service.isAvailable && (
            <span className="text-xs font-semibold px-2 py-1 rounded-full border bg-muted text-foreground/80 border-border">
              paused
            </span>
          )}
        </div>
        {service.description && <CardDescription>{service.description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {Boolean(error) && <p className="alert-error">{getErrorMessage(error)}</p>}
        <div className="flex justify-between items-center gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Price</p>
            <p className="text-2xl font-bold text-foreground">{formatMoney(service.price)}</p>
          </div>
          {(service.duration || service.durationMinutes) && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="font-semibold text-foreground">
                {service.duration}
                {service.durationMinutes ? (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {service.durationMinutes} min per appointment
                  </span>
                ) : null}
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDraft(draftFor(service)); // start from the saved values
              setEditing(true);
            }}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={updateService.isPending}
            onClick={toggleAvailability}
          >
            {service.isAvailable ? "Pause bookings" : "Resume bookings"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="ml-auto"
            disabled={deleteService.isPending}
            onClick={remove}
          >
            {deleteService.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ShopServicesTab({ services }: { services: Service[] }) {
  const createService = useCreateService();
  const [draft, setDraft] = useState<ServiceDraft>(EMPTY);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.price) return;
    createService.mutate(
      {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        price: Number(draft.price),
        duration: draft.duration.trim() || undefined,
        durationMinutes: draft.durationMinutes ? Number(draft.durationMinutes) : undefined,
      },
      { onSuccess: () => setDraft(EMPTY) },
    );
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Add New Service</CardTitle>
          <CardDescription>Create a new service for your shop</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            {createService.isError && (
              <div className="alert-error">
                {getErrorMessage(createService.error, "Couldn't add the service. Please try again.")}
              </div>
            )}
            <ServiceFields draft={draft} onChange={setDraft} idPrefix="new-service" />
            <Button type="submit" className="w-full" disabled={createService.isPending}>
              {createService.isPending ? "Adding..." : "Add Service"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-2xl font-bold text-foreground mb-6">Your Services</h3>
        {services.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">No services added yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

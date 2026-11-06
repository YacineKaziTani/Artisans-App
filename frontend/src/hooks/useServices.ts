import { useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceApi, type UpdateServicePayload } from "@/api/service.api";
import { shopKeys } from "@/hooks/useShops";

function useInvalidateServices() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: shopKeys.mine() });
    qc.invalidateQueries({ queryKey: ["admin", "services"] });
  };
}

export function useCreateService() {
  const invalidate = useInvalidateServices();
  return useMutation({
    mutationFn: serviceApi.create,
    onSuccess: invalidate,
  });
}

/** Edit a service — including toggling `isAvailable` to pause bookings. */
export function useUpdateService() {
  const invalidate = useInvalidateServices();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateServicePayload }) =>
      serviceApi.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteService() {
  const invalidate = useInvalidateServices();
  return useMutation({
    mutationFn: (id: string) => serviceApi.remove(id),
    onSuccess: invalidate,
  });
}

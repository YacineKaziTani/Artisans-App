import { useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceApi } from "@/api/service.api";
import { shopKeys } from "@/hooks/useShops";

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: serviceApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopKeys.mine() });
    },
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => serviceApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopKeys.mine() });
      qc.invalidateQueries({ queryKey: ["admin", "services"] });
    },
  });
}

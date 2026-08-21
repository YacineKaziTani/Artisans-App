import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productApi } from "@/api/product.api";

export const productKeys = {
  mine: ["products", "mine"] as const,
};

export function useMyProducts() {
  return useQuery({
    queryKey: productKeys.mine,
    queryFn: productApi.mine,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FormData) => productApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.mine }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.mine }),
  });
}

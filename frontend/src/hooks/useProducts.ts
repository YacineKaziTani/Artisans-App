import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productApi, type ListProductsParams } from "@/api/product.api";

export const productKeys = {
  mine: ["products", "mine"] as const,
  list: (params: ListProductsParams) => ["products", "list", params] as const,
};

export function useProducts(params: ListProductsParams) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => productApi.listAll(params),
  });
}

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

export function useAddProductImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      productApi.addImage(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.mine }),
  });
}

export function useRemoveProductImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) => productApi.removeImage(imageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.mine }),
  });
}

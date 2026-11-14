import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  productApi,
  type ListProductsParams,
  type ProductUpdatePayload,
} from "@/api/product.api";

export const productKeys = {
  mine: ["products", "mine"] as const,
  list: (params: ListProductsParams) => ["products", "list", params] as const,
};

/** One page of the public catalogue (`{ data, meta }`). */
export function useProducts(params: ListProductsParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => productApi.listAll(params),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["products", "detail", id ?? ""],
    queryFn: () => productApi.getById(id!),
    enabled: Boolean(id),
  });
}

export function useTrendingProducts(limit = 8) {
  return useQuery({
    queryKey: ["products", "trending", limit],
    queryFn: () => productApi.trending(limit),
    staleTime: 5 * 60_000,
  });
}

export function useSimilarProducts(id: string | undefined, limit = 8) {
  return useQuery({
    queryKey: ["products", "similar", id ?? "", limit],
    queryFn: () => productApi.similar(id!, limit),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
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

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: ProductUpdatePayload;
    }) => productApi.update(id, payload),
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

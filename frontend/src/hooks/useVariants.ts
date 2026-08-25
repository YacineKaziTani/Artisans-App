import { useMutation, useQueryClient } from "@tanstack/react-query";
import { variantApi } from "@/api/variant.api";
import { productKeys } from "@/hooks/useProducts";

export function useCreateVariantOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, name }: { productId: string; name: string }) =>
      variantApi.createOption(productId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.mine }),
  });
}

export function useRemoveVariantOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => variantApi.removeOption(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.mine }),
  });
}

export function useCreateVariantValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      optionId,
      value,
      priceModifier,
    }: {
      optionId: string;
      value: string;
      priceModifier?: number;
    }) => variantApi.createValue(optionId, value, priceModifier),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.mine }),
  });
}

export function useRemoveVariantValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => variantApi.removeValue(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.mine }),
  });
}

export function useCreateProductVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId,
      payload,
    }: {
      productId: string;
      payload: { valueIds: string[]; sku?: string; stockQuantity: number; priceOverride?: number };
    }) => variantApi.createVariant(productId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.mine }),
  });
}

export function useUpdateProductVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<{ sku: string; stockQuantity: number; priceOverride: number }>;
    }) => variantApi.updateVariant(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.mine }),
  });
}

export function useRemoveProductVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => variantApi.removeVariant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.mine }),
  });
}

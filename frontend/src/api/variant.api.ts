import { api } from "@/lib/axios";
import type { ProductVariant, VariantOption, VariantValue } from "@/types";

export const variantApi = {
  createOption: (productId: string, name: string) =>
    api
      .post<VariantOption>(`/products/${productId}/variant-options`, { name })
      .then((r) => r.data),

  removeOption: (id: string) =>
    api.delete(`/products/variant-options/${id}`).then((r) => r.data),

  createValue: (optionId: string, value: string, priceModifier?: number) =>
    api
      .post<VariantValue>(`/products/variant-options/${optionId}/values`, {
        value,
        priceModifier,
      })
      .then((r) => r.data),

  removeValue: (id: string) =>
    api.delete(`/products/variant-values/${id}`).then((r) => r.data),

  createVariant: (
    productId: string,
    payload: { valueIds: string[]; sku?: string; stockQuantity: number; priceOverride?: number },
  ) =>
    api.post<ProductVariant>(`/products/${productId}/variants`, payload).then((r) => r.data),

  updateVariant: (
    id: string,
    payload: Partial<{ sku: string; stockQuantity: number; priceOverride: number }>,
  ) => api.patch<ProductVariant>(`/products/variants/${id}`, payload).then((r) => r.data),

  removeVariant: (id: string) =>
    api.delete(`/products/variants/${id}`).then((r) => r.data),
};

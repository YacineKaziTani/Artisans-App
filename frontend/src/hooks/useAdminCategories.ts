import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { categoryApi, type CategoryPayload } from "@/api/category.api";

export const adminCategoryKeys = {
  all: ["admin", "categories"] as const,
};

export function useAdminCategories() {
  return useQuery({
    queryKey: adminCategoryKeys.all,
    queryFn: categoryApi.listAllAdmin,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CategoryPayload) => categoryApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminCategoryKeys.all }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CategoryPayload> }) =>
      categoryApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminCategoryKeys.all }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoryApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminCategoryKeys.all }),
  });
}

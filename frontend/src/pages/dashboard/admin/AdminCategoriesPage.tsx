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
import { Label } from "@/components/ui/label";
import {
  useAdminCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "@/hooks/useAdminCategories";
import type { Category } from "@/types";

export default function AdminCategoriesPage() {
  const { data: categories, isLoading, isError } = useAdminCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createCategory.mutate(
      { name, description: description || undefined },
      { onSuccess: () => { setName(""); setDescription(""); } },
    );
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Categories</h1>
        <p className="text-gray-600">Manage marketplace categories</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Category</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            {createCategory.isError && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
                Couldn't create the category. Please try again.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Woodworking"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description (optional)</Label>
              <Input
                id="cat-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description"
              />
            </div>
            <Button type="submit" disabled={createCategory.isPending}>
              {createCategory.isPending ? "Adding..." : "Add Category"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Categories</CardTitle>
          <CardDescription>{categories?.length ?? 0} total</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          )}
          {isError && (
            <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
              Couldn't load categories.
            </p>
          )}
          {!isLoading && !isError && (categories ?? []).length === 0 && (
            <p className="text-gray-600 text-sm">No categories yet.</p>
          )}
          {!isLoading &&
            !isError &&
            (categories ?? []).map((category: Category) => (
              <CategoryRow
                key={category.id}
                category={category}
                onDelete={() => deleteCategory.mutate(category.id)}
                deleting={
                  deleteCategory.isPending &&
                  deleteCategory.variables === category.id
                }
              />
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function CategoryRow({
  category,
  onDelete,
  deleting,
}: {
  category: Category;
  onDelete: () => void;
  deleting: boolean;
}) {
  const updateCategory = useUpdateCategory();

  return (
    <div className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
      <div>
        <p className="font-medium text-gray-900">{category.name}</p>
        {category.description && (
          <p className="text-sm text-gray-500">{category.description}</p>
        )}
        {!category.isActive && (
          <span className="text-xs text-gray-500">Inactive</span>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={updateCategory.isPending}
          onClick={() =>
            updateCategory.mutate({
              id: category.id,
              payload: { isActive: !category.isActive },
            })
          }
        >
          {category.isActive ? "Deactivate" : "Activate"}
        </Button>
        <Button size="sm" variant="destructive" disabled={deleting} onClick={onDelete}>
          {deleting ? "…" : "Delete"}
        </Button>
      </div>
    </div>
  );
}

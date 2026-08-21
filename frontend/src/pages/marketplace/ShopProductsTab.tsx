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
import { useCreateProduct, useDeleteProduct, useMyProducts } from "@/hooks/useProducts";

export function ShopProductsTab() {
  const { data: products, isLoading, isError } = useMyProducts();
  const createProduct = useCreateProduct();
  const deleteProduct = useDeleteProduct();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !basePrice) return;

    const form = new FormData();
    form.append("title", title);
    if (description) form.append("description", description);
    form.append("basePrice", basePrice);
    if (file) form.append("image", file);

    createProduct.mutate(form, {
      onSuccess: () => {
        setTitle("");
        setDescription("");
        setBasePrice("");
        setFile(null);
      },
    });
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Add New Product</CardTitle>
          <CardDescription>Add a physical item your shop sells</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {createProduct.isError && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
                Couldn't add the product. Please try again.
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Handmade Oak Chair"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this product"
                rows={3}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price ($)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image (optional)
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="text-sm"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={createProduct.isPending}
            >
              {createProduct.isPending ? "Adding..." : "Add Product"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-6">Your Products</h3>

        {isLoading && (
          <div className="grid md:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
            Couldn't load your products right now.
          </p>
        )}

        {!isLoading && !isError && (products ?? []).length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-600">No products added yet</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && (products ?? []).length > 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            {products!.map((product) => (
              <Card key={product.id}>
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="w-full h-40 object-cover rounded-t-xl"
                  />
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{product.title}</CardTitle>
                  {product.description && (
                    <CardDescription>{product.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-2xl font-bold text-gray-900">
                    ${Number(product.basePrice).toFixed(2)}
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    disabled={
                      deleteProduct.isPending &&
                      deleteProduct.variables === product.id
                    }
                    onClick={() => deleteProduct.mutate(product.id)}
                  >
                    {deleteProduct.isPending &&
                    deleteProduct.variables === product.id
                      ? "Deleting..."
                      : "Delete"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

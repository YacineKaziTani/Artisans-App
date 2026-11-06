import { useState } from "react";
import { IMAGE_ACCEPT, IMAGE_TOO_LARGE_MESSAGE, isImageTooLarge } from "@/lib/uploads";
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
import {
  useCreateProduct,
  useDeleteProduct,
  useMyProducts,
} from "@/hooks/useProducts";
import { useConfirm } from "@/hooks/useConfirm";
import { getErrorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/pricing";
import type { Product } from "@/types";
import { ProductEditForm } from "./ProductEditForm";
import { ProductImagesManager } from "./ProductImagesManager";
import { ProductVariantsManager } from "./ProductVariantsManager";

function stockLabel(product: Product) {
  if (product.variantOptions?.length) return "Stock set per option";
  if (product.stockQuantity == null) return "Made to order";
  if (product.stockQuantity === 0) return "Out of stock";
  return `${product.stockQuantity} in stock`;
}

function AddProductForm() {
  const createProduct = useCreateProduct();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [stock, setStock] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const tooLarge = isImageTooLarge(file);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !basePrice || tooLarge) return;

    const form = new FormData();
    form.append("title", title.trim());
    if (description.trim()) form.append("description", description.trim());
    form.append("basePrice", basePrice);
    // Blank = made to order (stock not tracked).
    if (stock.trim() !== "") form.append("stockQuantity", stock.trim());
    if (file) form.append("image", file);

    createProduct.mutate(form, {
      onSuccess: () => {
        setTitle("");
        setDescription("");
        setBasePrice("");
        setStock("");
        setFile(null);
        setFileInputKey((k) => k + 1); // clears the file input
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Product</CardTitle>
        <CardDescription>Add a physical item your shop sells</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {createProduct.isError && (
            <div className="p-3 bg-destructive/10 border border-destructive/25 rounded-lg text-destructive text-sm">
              {getErrorMessage(
                createProduct.error,
                "Couldn't add the product. Please try again.",
              )}
            </div>
          )}

          <div>
            <label htmlFor="product-title" className="block text-sm font-medium text-foreground/80 mb-2">
              Title
            </label>
            <Input
              id="product-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Handmade Oak Chair"
              maxLength={150}
              required
            />
          </div>

          <div>
            <label htmlFor="product-description" className="block text-sm font-medium text-foreground/80 mb-2">
              Description
            </label>
            <Textarea
              id="product-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this product"
              maxLength={5000}
              rows={3}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="product-price" className="block text-sm font-medium text-foreground/80 mb-2">
                Price ($)
              </label>
              <Input
                id="product-price"
                type="number"
                min="0"
                step="0.01"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="0"
                required
              />
            </div>
            <div>
              <label htmlFor="product-stock" className="block text-sm font-medium text-foreground/80 mb-2">
                In stock
              </label>
              <Input
                id="product-stock"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="Made to order"
                aria-describedby="product-stock-hint"
              />
              <p id="product-stock-hint" className="mt-1 text-xs text-muted-foreground">
                Leave blank if you make it to order. If you add options later, stock is set per option.
              </p>
            </div>
            <div>
              <label htmlFor="product-image" className="block text-sm font-medium text-foreground/80 mb-2">
                Image (optional, up to 5 MB)
              </label>
              <input
                key={fileInputKey}
                id="product-image"
                type="file"
                accept={IMAGE_ACCEPT}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
              {tooLarge && (
                <p className="mt-1 text-xs text-destructive">{IMAGE_TOO_LARGE_MESSAGE}</p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={createProduct.isPending || tooLarge}
          >
            {createProduct.isPending ? "Adding..." : "Add Product"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ShopProductsTab() {
  const { data: products, isLoading, isError } = useMyProducts();
  const deleteProduct = useDeleteProduct();
  const confirm = useConfirm();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleDelete = async (product: Product) => {
    const ok = await confirm({
      title: `Delete “${product.title}”?`,
      description:
        "It's removed from your shop. If it has ever been ordered it's archived instead, so clients' order history still shows it.",
      confirmLabel: "Delete product",
      destructive: true,
    });
    if (ok) deleteProduct.mutate(product.id);
  };

  return (
    <div className="space-y-8">
      <AddProductForm />

      <div>
        <h3 className="text-2xl font-bold text-foreground mb-6">Your Products</h3>

        {deleteProduct.isError && (
          <p className="alert-error mb-4">
            {getErrorMessage(deleteProduct.error, "Couldn't delete that product.")}
          </p>
        )}

        {isLoading && (
          <div className="grid md:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-destructive bg-destructive/10 border border-destructive/25 rounded-lg p-4 text-sm">
            Couldn't load your products right now.
          </p>
        )}

        {!isLoading && !isError && (products ?? []).length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">No products added yet</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && (products ?? []).length > 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            {products!.map((product) => {
              const isDeleting =
                deleteProduct.isPending && deleteProduct.variables === product.id;
              return (
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
                    {editingId === product.id ? (
                      <ProductEditForm
                        product={product}
                        onDone={() => setEditingId(null)}
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-2xl font-bold text-foreground">
                            {formatMoney(product.basePrice)}
                          </p>
                          <p
                            className={`text-xs ${
                              product.stockQuantity === 0 && !product.variantOptions?.length
                                ? "text-destructive"
                                : "text-muted-foreground"
                            }`}
                          >
                            {stockLabel(product)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(product.id)}
                        >
                          Edit
                        </Button>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Gallery
                      </p>
                      <ProductImagesManager product={product} />
                    </div>
                    <ProductVariantsManager product={product} />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      disabled={isDeleting}
                      onClick={() => handleDelete(product)}
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

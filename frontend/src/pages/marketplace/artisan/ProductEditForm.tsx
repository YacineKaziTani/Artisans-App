import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateProduct } from "@/hooks/useProducts";
import { getErrorMessage } from "@/lib/errors";
import type { Product } from "@/types";

/**
 * Inline editor for a product's title, description, base price and — for
 * products sold without options — its stock (blank = made to order).
 */
export function ProductEditForm({
  product,
  onDone,
}: {
  product: Product;
  onDone: () => void;
}) {
  const updateProduct = useUpdateProduct();
  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description ?? "");
  const [basePrice, setBasePrice] = useState(String(product.basePrice));
  const [stock, setStock] = useState(
    product.stockQuantity == null ? "" : String(product.stockQuantity),
  );
  const hasVariants = Boolean(product.variantOptions?.length);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || basePrice === "") return;
    updateProduct.mutate(
      {
        id: product.id,
        payload: {
          title: title.trim(),
          description: description.trim(),
          basePrice: Number(basePrice),
          // Options carry their own stock, so leave the product's alone.
          ...(hasVariants
            ? {}
            : { stockQuantity: stock.trim() === "" ? null : Number(stock) }),
        },
      },
      { onSuccess: onDone },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-2 bg-muted rounded-md p-3">
      {updateProduct.isError && (
        <p className="text-xs text-destructive">
          {getErrorMessage(
            updateProduct.error,
            "Couldn't save those changes. Please try again.",
          )}
        </p>
      )}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        aria-label="Title"
        maxLength={150}
        className="h-8 text-sm"
      />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        aria-label="Description"
        maxLength={5000}
        rows={2}
        className="text-sm"
      />
      <Input
        type="number"
        min="0"
        step="0.01"
        value={basePrice}
        onChange={(e) => setBasePrice(e.target.value)}
        placeholder="Price"
        aria-label="Price"
        className="h-8 text-sm"
      />
      {!hasVariants && (
        <Input
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          placeholder="Stock (blank = made to order)"
          aria-label="Stock (leave blank if made to order)"
          className="h-8 text-sm"
        />
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={updateProduct.isPending}>
          {updateProduct.isPending ? "Saving..." : "Save"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

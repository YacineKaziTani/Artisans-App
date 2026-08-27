import { useRef, useState } from "react";
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
  useAddProductImage,
  useCreateProduct,
  useDeleteProduct,
  useMyProducts,
  useRemoveProductImage,
} from "@/hooks/useProducts";
import {
  useCreateProductVariant,
  useCreateVariantOption,
  useCreateVariantValue,
  useRemoveProductVariant,
  useRemoveVariantOption,
  useRemoveVariantValue,
  useUpdateProductVariant,
} from "@/hooks/useVariants";
import type { Product } from "@/types";

function ProductImagesManager({ product }: { product: Product }) {
  const addImage = useAddProductImage();
  const removeImage = useRemoveProductImage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto">
        {(product.images ?? []).map((image) => (
          <div key={image.id} className="relative flex-shrink-0">
            <img
              src={image.url}
              alt=""
              className="w-16 h-16 object-cover rounded-md border border-gray-200"
            />
            <button
              type="button"
              className="absolute -top-1 -right-1 bg-white rounded-full w-5 h-5 text-xs border border-gray-300 shadow-sm"
              disabled={removeImage.isPending}
              onClick={() => removeImage.mutate(image.id)}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={addImage.isPending}
          className="w-16 h-16 flex-shrink-0 rounded-md border-2 border-dashed border-gray-300 text-gray-400 text-2xl flex items-center justify-center hover:border-gray-400"
        >
          {addImage.isPending ? "…" : "+"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) addImage.mutate({ id: product.id, file });
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function AddValueRow({ optionId }: { optionId: string }) {
  const [value, setValue] = useState("");
  const [priceModifier, setPriceModifier] = useState("");
  const createValue = useCreateVariantValue();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    createValue.mutate(
      {
        optionId,
        value: value.trim(),
        priceModifier: priceModifier ? Number(priceModifier) : undefined,
      },
      { onSuccess: () => { setValue(""); setPriceModifier(""); } },
    );
  };

  return (
    <div>
      <form onSubmit={submit} className="flex gap-1 mt-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. M"
          className="h-8 text-xs"
        />
        <Input
          type="number"
          step="0.01"
          value={priceModifier}
          onChange={(e) => setPriceModifier(e.target.value)}
          placeholder="+$"
          className="h-8 text-xs w-16"
        />
        <Button type="submit" size="sm" className="h-8" disabled={createValue.isPending}>
          {createValue.isPending ? "…" : "Add"}
        </Button>
      </form>
      {createValue.isError && (
        <p className="text-xs text-red-600 mt-1">
          Couldn't add that value. Please try again.
        </p>
      )}
    </div>
  );
}

function ProductVariantsManager({ product }: { product: Product }) {
  const createOption = useCreateVariantOption();
  const removeOption = useRemoveVariantOption();
  const removeValue = useRemoveVariantValue();
  const createVariant = useCreateProductVariant();
  const updateVariant = useUpdateProductVariant();
  const removeVariant = useRemoveProductVariant();

  const [newOptionName, setNewOptionName] = useState("");
  const options = product.variantOptions ?? [];
  const variants = product.variants ?? [];

  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const [newSku, setNewSku] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newPriceOverride, setNewPriceOverride] = useState("");

  const canBuildVariant =
    options.length > 0 && options.every((o) => selectedValues[o.id]);
  const optionsWithNoValues = options.filter((o) => (o.values ?? []).length === 0);

  const handleAddOption = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOptionName.trim()) return;
    createOption.mutate(
      { productId: product.id, name: newOptionName.trim() },
      { onSuccess: () => setNewOptionName("") },
    );
  };

  const handleAddVariant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canBuildVariant) return;
    createVariant.mutate(
      {
        productId: product.id,
        payload: {
          valueIds: Object.values(selectedValues),
          sku: newSku || undefined,
          stockQuantity: newStock ? Number(newStock) : 0,
          priceOverride: newPriceOverride ? Number(newPriceOverride) : undefined,
        },
      },
      {
        onSuccess: () => {
          setSelectedValues({});
          setNewSku("");
          setNewStock("");
          setNewPriceOverride("");
        },
      },
    );
  };

  const previewLabel = options
    .filter((o) => selectedValues[o.id])
    .map((o) => `${o.name}: ${o.values?.find((v) => v.id === selectedValues[o.id])?.value}`)
    .join(", ");

  return (
    <div className="space-y-4 border-t border-gray-100 pt-4">
      <p className="text-xs font-medium text-gray-500">
        Variants — e.g. Size + Color, each combination with its own stock
      </p>

      {/* Step 1: options (the attributes, e.g. Size, Color) */}
      <div className="space-y-3">
        {options.map((option) => {
          const hasNoValues = (option.values ?? []).length === 0;
          return (
            <div key={option.id} className="bg-gray-50 rounded-md p-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">{option.name}</span>
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => removeOption.mutate(option.id)}
                >
                  Remove option
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {(option.values ?? []).map((v) => (
                  <span
                    key={v.id}
                    className="text-xs bg-white border border-gray-200 rounded px-2 py-1 flex items-center gap-1"
                  >
                    {v.value}
                    {Number(v.priceModifier) !== 0 && (
                      <span className="text-gray-400">
                        ({Number(v.priceModifier) > 0 ? "+" : ""}
                        {Number(v.priceModifier)})
                      </span>
                    )}
                    <button
                      type="button"
                      className="text-gray-400 hover:text-red-600"
                      onClick={() => removeValue.mutate(v.id)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {hasNoValues && (
                <p className="text-xs text-amber-700 mt-1">
                  No values yet — add at least one (e.g. "Red") before this option can be used in a SKU.
                </p>
              )}
              <AddValueRow optionId={option.id} />
            </div>
          );
        })}
      </div>

      <div>
        <form onSubmit={handleAddOption} className="flex gap-2">
          <Input
            value={newOptionName}
            onChange={(e) => setNewOptionName(e.target.value)}
            placeholder="New option, e.g. Size or Color"
            className="h-9 text-sm"
          />
          <Button type="submit" size="sm" disabled={createOption.isPending}>
            {createOption.isPending ? "Adding..." : "Add Option"}
          </Button>
        </form>
        {createOption.isError && (
          <p className="text-xs text-red-600 mt-1">Couldn't add that option. Please try again.</p>
        )}
      </div>

      {/* Existing SKUs/variants */}
      {variants.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">SKUs</p>
          {variants.map((variant) => (
            <div
              key={variant.id}
              className="flex items-center justify-between gap-2 text-sm border border-gray-200 rounded-md p-2"
            >
              <div>
                <p className="font-medium text-gray-800">
                  {variant.values.map((v) => `${v.option?.name}: ${v.value}`).join(", ")}
                </p>
                <p className="text-xs text-gray-500">
                  {variant.priceOverride !== undefined && variant.priceOverride !== null
                    ? `$${Number(variant.priceOverride).toFixed(2)}`
                    : "uses base price + modifiers"}
                  {variant.sku && ` · SKU: ${variant.sku}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  value={variant.stockQuantity}
                  onChange={(e) =>
                    updateVariant.mutate({
                      id: variant.id,
                      payload: { stockQuantity: Number(e.target.value) },
                    })
                  }
                  className="h-8 w-16 text-xs"
                />
                <span className="text-xs text-gray-400">in stock</span>
                <button
                  type="button"
                  className="text-red-600 hover:underline text-xs"
                  onClick={() => removeVariant.mutate(variant.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Step 2: build a specific combination (e.g. Size=M + Color=Red) with its own stock */}
      {options.length > 0 && (
        <form onSubmit={handleAddVariant} className="space-y-2 bg-gray-50 rounded-md p-3">
          <p className="text-xs font-medium text-gray-500">
            Add a SKU — pick one value for every option below, then set its stock
          </p>
          {optionsWithNoValues.length > 0 && (
            <p className="text-xs text-amber-700">
              {optionsWithNoValues.map((o) => o.name).join(", ")} still{" "}
              {optionsWithNoValues.length === 1 ? "has" : "have"} no values — add one above first.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <select
                key={option.id}
                value={selectedValues[option.id] ?? ""}
                onChange={(e) =>
                  setSelectedValues((prev) => ({ ...prev, [option.id]: e.target.value }))
                }
                disabled={(option.values ?? []).length === 0}
                className="h-8 text-xs border border-gray-300 rounded-md px-2 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">{option.name}...</option>
                {(option.values ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.value}
                  </option>
                ))}
              </select>
            ))}
          </div>
          {previewLabel && (
            <p className="text-xs text-gray-600">Creating: {previewLabel}</p>
          )}
          <div className="flex gap-2">
            <Input
              value={newSku}
              onChange={(e) => setNewSku(e.target.value)}
              placeholder="SKU (optional)"
              className="h-8 text-xs"
            />
            <Input
              type="number"
              min="0"
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              placeholder="Stock"
              className="h-8 text-xs w-20"
            />
            <Input
              type="number"
              step="0.01"
              value={newPriceOverride}
              onChange={(e) => setNewPriceOverride(e.target.value)}
              placeholder="Fixed price (optional)"
              className="h-8 text-xs"
            />
          </div>
          {createVariant.isError && (
            <p className="text-xs text-red-600">
              Couldn't create that SKU — it may already exist, or one of the values may no longer be valid.
            </p>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={!canBuildVariant || createVariant.isPending}
          >
            {createVariant.isPending ? "Adding..." : "Add SKU"}
          </Button>
        </form>
      )}
    </div>
  );
}

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
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Gallery</p>
                    <ProductImagesManager product={product} />
                  </div>
                  <ProductVariantsManager product={product} />
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

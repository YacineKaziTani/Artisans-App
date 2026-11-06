import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCreateProductVariant,
  useCreateVariantOption,
  useCreateVariantValue,
  useRemoveProductVariant,
  useRemoveVariantOption,
  useRemoveVariantValue,
  useUpdateProductVariant,
} from "@/hooks/useVariants";
import { useConfirm } from "@/hooks/useConfirm";
import { getErrorMessage } from "@/lib/errors";
import { variantLabel, variantUnitPrice } from "@/lib/pricing";
import type { Product, ProductVariant, VariantOption, VariantValue } from "@/types";
import { StockInput } from "./StockInput";

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
      {
        onSuccess: () => {
          setValue("");
          setPriceModifier("");
        },
      },
    );
  };

  return (
    <div>
      <form onSubmit={submit} className="flex gap-1 mt-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. M"
          aria-label="New value"
          maxLength={50}
          className="h-8 text-xs"
        />
        <Input
          type="number"
          step="0.01"
          value={priceModifier}
          onChange={(e) => setPriceModifier(e.target.value)}
          placeholder="+$"
          aria-label="Price adjustment"
          className="h-8 text-xs w-24"
        />
        <Button
          type="submit"
          size="sm"
          className="h-8"
          disabled={createValue.isPending}
        >
          {createValue.isPending ? "…" : "Add"}
        </Button>
      </form>
      {createValue.isError && (
        <p className="text-xs text-destructive mt-1">
          {getErrorMessage(createValue.error, "Couldn't add that value.")}
        </p>
      )}
    </div>
  );
}

export function ProductVariantsManager({ product }: { product: Product }) {
  const createOption = useCreateVariantOption();
  const removeOption = useRemoveVariantOption();
  const removeValue = useRemoveVariantValue();
  const createVariant = useCreateProductVariant();
  const updateVariant = useUpdateProductVariant();
  const removeVariant = useRemoveProductVariant();
  const confirm = useConfirm();

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
  const actionError =
    removeOption.error ?? removeValue.error ?? removeVariant.error ?? updateVariant.error;

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

  const confirmRemoveOption = async (option: VariantOption) => {
    const ok = await confirm({
      title: `Remove the “${option.name}” option?`,
      description:
        "Its values are removed too, and any SKU using them loses that part of its combination.",
      confirmLabel: "Remove option",
      destructive: true,
    });
    if (ok) removeOption.mutate(option.id);
  };

  const confirmRemoveValue = async (value: VariantValue) => {
    const ok = await confirm({
      title: `Remove “${value.value}”?`,
      description: "SKUs that use this value lose it from their combination.",
      confirmLabel: "Remove value",
      destructive: true,
    });
    if (ok) removeValue.mutate(value.id);
  };

  const confirmRemoveVariant = async (variant: ProductVariant) => {
    const ok = await confirm({
      title: `Delete the ${variantLabel(variant) || "selected"} SKU?`,
      description: "Clients won't be able to buy this combination any more.",
      confirmLabel: "Delete SKU",
      destructive: true,
    });
    if (ok) removeVariant.mutate(variant.id);
  };

  const previewLabel = options
    .filter((o) => selectedValues[o.id])
    .map(
      (o) => `${o.name}: ${o.values?.find((v) => v.id === selectedValues[o.id])?.value}`,
    )
    .join(", ");

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <p className="text-xs font-medium text-muted-foreground">
        Variants — e.g. Size + Color, each combination with its own stock
      </p>

      {Boolean(actionError) && (
        <p className="text-xs text-destructive">{getErrorMessage(actionError)}</p>
      )}

      {/* Step 1: options (the attributes, e.g. Size, Color) */}
      <div className="space-y-3">
        {options.map((option) => {
          const hasNoValues = (option.values ?? []).length === 0;
          return (
            <div key={option.id} className="bg-muted rounded-md p-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {option.name}
                </span>
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  onClick={() => confirmRemoveOption(option)}
                >
                  Remove option
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {(option.values ?? []).map((v) => (
                  <span
                    key={v.id}
                    className="text-xs bg-card border border-border rounded px-2 py-1 flex items-center gap-1"
                  >
                    {v.value}
                    {Number(v.priceModifier) !== 0 && (
                      <span className="text-muted-foreground/70">
                        ({Number(v.priceModifier) > 0 ? "+" : ""}
                        {Number(v.priceModifier)})
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove ${v.value}`}
                      className="text-muted-foreground/70 hover:text-destructive"
                      onClick={() => confirmRemoveValue(v)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {hasNoValues && (
                <p className="text-xs text-muted-foreground mt-1">
                  No values yet — add at least one (e.g. "Red") before this option
                  can be used in a SKU.
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
            placeholder="New option, e.g. Size or Material"
            aria-label="New option name"
            maxLength={50}
            className="h-9 text-sm"
          />
          <Button type="submit" size="sm" disabled={createOption.isPending}>
            {createOption.isPending ? "Adding..." : "Add Option"}
          </Button>
        </form>
        {createOption.isError && (
          <p className="text-xs text-destructive mt-1">
            {getErrorMessage(createOption.error, "Couldn't add that option.")}
          </p>
        )}
      </div>

      {/* Existing SKUs/variants */}
      {variants.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">SKUs</p>
          {variants.map((variant) => (
            <div
              key={variant.id}
              className="flex items-center justify-between gap-2 text-sm border border-border rounded-md p-2"
            >
              <div>
                <p className="font-medium text-foreground">{variantLabel(variant)}</p>
                <p className="text-xs text-muted-foreground">
                  ${variantUnitPrice(product, variant).toFixed(2)}
                  {variant.priceOverride == null && " (base price + adjustments)"}
                  {variant.sku && ` · SKU: ${variant.sku}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StockInput
                  key={variant.stockQuantity}
                  value={variant.stockQuantity}
                  label={`Stock for ${variantLabel(variant)}`}
                  disabled={
                    updateVariant.isPending && updateVariant.variables?.id === variant.id
                  }
                  onSave={(stockQuantity) =>
                    updateVariant.mutate({ id: variant.id, payload: { stockQuantity } })
                  }
                />
                <span className="text-xs text-muted-foreground/70">in stock</span>
                <button
                  type="button"
                  className="text-destructive hover:underline text-xs"
                  onClick={() => confirmRemoveVariant(variant)}
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
        <form onSubmit={handleAddVariant} className="space-y-2 bg-muted rounded-md p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Add a SKU — pick one value for every option below, then set its stock
          </p>
          {optionsWithNoValues.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {optionsWithNoValues.map((o) => o.name).join(", ")} still{" "}
              {optionsWithNoValues.length === 1 ? "has" : "have"} no values — add
              one above first.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <select
                key={option.id}
                aria-label={option.name}
                value={selectedValues[option.id] ?? ""}
                onChange={(e) =>
                  setSelectedValues((prev) => ({ ...prev, [option.id]: e.target.value }))
                }
                disabled={(option.values ?? []).length === 0}
                className="h-8 text-xs border border-border rounded-md px-2 disabled:bg-muted disabled:text-muted-foreground/70"
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
            <p className="text-xs text-muted-foreground">Creating: {previewLabel}</p>
          )}
          <div className="flex gap-2">
            <Input
              value={newSku}
              onChange={(e) => setNewSku(e.target.value)}
              placeholder="SKU (optional)"
              aria-label="SKU"
              maxLength={64}
              className="h-8 text-xs"
            />
            <Input
              type="number"
              min="0"
              step="1"
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              placeholder="Stock"
              aria-label="Stock"
              className="h-8 text-xs w-20"
            />
            <Input
              type="number"
              step="0.01"
              min="0.5"
              value={newPriceOverride}
              onChange={(e) => setNewPriceOverride(e.target.value)}
              placeholder="Fixed price (optional)"
              aria-label="Fixed price"
              className="h-8 text-xs"
            />
          </div>
          {createVariant.isError && (
            <p className="text-xs text-destructive">
              {getErrorMessage(createVariant.error, "Couldn't create that SKU.")}
            </p>
          )}
          <Button type="submit" size="sm" disabled={!canBuildVariant || createVariant.isPending}>
            {createVariant.isPending ? "Adding..." : "Add SKU"}
          </Button>
        </form>
      )}
    </div>
  );
}

import { MAX_IMAGE_BYTES } from "@/lib/uploads";
import { useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCategories } from "@/hooks/useCategories";
import { img } from "@/lib/images";

export interface ShopFieldValues {
  shopName: string;
  categoryId: string;
  description: string;
  phone: string;
  city: string;
  address: string;
  logo: File | null;
}


const fieldLabel = "block text-sm font-medium text-foreground/80 mb-2";
const selectClass =
  "border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-[var(--shadow-xs)] outline-none";

/** Shared by "create your shop" and "edit shop details". */
export function ShopFields({
  values,
  onChange,
  currentLogoUrl,
}: {
  values: ShopFieldValues;
  onChange: (next: ShopFieldValues) => void;
  currentLogoUrl?: string | null;
}) {
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const set = <K extends keyof ShopFieldValues>(key: K, value: ShopFieldValues[K]) =>
    onChange({ ...values, [key]: value });

  // Preview of a newly picked logo; the object URL is freed when the file
  // changes or the form unmounts.
  const logoPreview = useMemo(
    () => (values.logo ? URL.createObjectURL(values.logo) : null),
    [values.logo],
  );
  useEffect(
    () => () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    },
    [logoPreview],
  );
  const shownLogo = logoPreview ?? currentLogoUrl ?? null;
  const logoTooLarge = Boolean(values.logo && values.logo.size > MAX_IMAGE_BYTES);

  return (
    <>
      <div>
        <label htmlFor="shop-name" className={fieldLabel}>
          Shop Name
        </label>
        <Input
          id="shop-name"
          value={values.shopName}
          onChange={(e) => set("shopName", e.target.value)}
          placeholder="Your shop name"
          maxLength={120}
          required
        />
      </div>

      <div>
        <label htmlFor="shop-category" className={fieldLabel}>
          Category
        </label>
        <select
          id="shop-category"
          value={values.categoryId}
          onChange={(e) => set("categoryId", e.target.value)}
          disabled={categoriesLoading}
          required
          className={selectClass}
        >
          <option value="">Select a category</option>
          {(categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className={fieldLabel}>Logo (optional)</span>
        <div className="flex items-center gap-4">
          {shownLogo ? (
            <img
              {...img(shownLogo, 64)}
              alt="Shop logo"
              className="size-16 rounded-xl border border-border object-cover"
            />
          ) : (
            <span className="flex size-16 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
              No logo
            </span>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            aria-label="Shop logo"
            onChange={(e) => set("logo", e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>
        {logoTooLarge && (
          <p className="mt-1 text-xs text-destructive">
            That image is over 5 MB — please choose a smaller one.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="shop-description" className={fieldLabel}>
          Description
        </label>
        <Textarea
          id="shop-description"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Describe your shop and expertise"
          maxLength={2000}
          rows={4}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="shop-phone" className={fieldLabel}>
            Phone
          </label>
          <Input
            id="shop-phone"
            type="tel"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+1 (555) 000-0000"
            maxLength={30}
          />
        </div>
        <div>
          <label htmlFor="shop-city" className={fieldLabel}>
            City
          </label>
          <Input
            id="shop-city"
            value={values.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder="Your city"
            maxLength={100}
          />
        </div>
      </div>

      <div>
        <label htmlFor="shop-address" className={fieldLabel}>
          Address
        </label>
        <Input
          id="shop-address"
          value={values.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="Your shop address"
          maxLength={200}
        />
      </div>
    </>
  );
}

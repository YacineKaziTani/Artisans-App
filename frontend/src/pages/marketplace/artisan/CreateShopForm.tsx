import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCreateShop } from "@/hooks/useShops";
import { getErrorMessage } from "@/lib/errors";
import { ShopFields, type ShopFieldValues } from "./ShopFields";
import { MAX_IMAGE_BYTES } from "@/lib/uploads";

const EMPTY: ShopFieldValues = {
  shopName: "",
  categoryId: "",
  description: "",
  phone: "",
  city: "",
  address: "",
  logo: null,
};

export function CreateShopForm() {
  const createShop = useCreateShop();
  const [values, setValues] = useState<ShopFieldValues>(EMPTY);
  const logoTooLarge = Boolean(values.logo && values.logo.size > MAX_IMAGE_BYTES);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.shopName.trim() || !values.categoryId || logoTooLarge) return;
    createShop.mutate({
      shopName: values.shopName.trim(),
      categoryId: values.categoryId,
      description: values.description.trim() || undefined,
      phone: values.phone.trim() || undefined,
      address: values.address.trim() || undefined,
      city: values.city.trim() || undefined,
      logo: values.logo,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shop Details</CardTitle>
        <CardDescription>
          Your shop will need approval from an admin before it appears publicly
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {createShop.isError && (
            <div className="alert-error">
              {getErrorMessage(createShop.error, "Couldn't create your shop. Please try again.")}
            </div>
          )}

          <ShopFields values={values} onChange={setValues} />

          <Button
            type="submit"
            className="w-full"
            disabled={
              createShop.isPending || !values.shopName.trim() || !values.categoryId || logoTooLarge
            }
          >
            {createShop.isPending ? "Creating..." : "Create Shop"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

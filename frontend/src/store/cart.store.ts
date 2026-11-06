import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product, ProductVariant } from "@/types";
import { variantLabel, variantUnitPrice } from "@/lib/pricing";

export interface CartItem {
  productId: string;
  variantId?: string;
  variantLabel?: string;
  title: string;
  price: number;
  shopId: string;
  shopName: string;
  quantity: number;
}

function lineKey(productId: string, variantId?: string) {
  return `${productId}:${variantId ?? ""}`;
}

interface CartState {
  items: CartItem[];
  addItem: (
    product: Product,
    variant?: ProductVariant,
    quantity?: number,
  ) => boolean;
  removeItem: (productId: string, variantId?: string) => void;
  setQuantity: (
    productId: string,
    variantId: string | undefined,
    quantity: number,
  ) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, variant, quantity = 1) => {
        const shopId = product.shop?.id ?? "";
        const currentShopId = get().items[0]?.shopId;
        if (currentShopId && currentShopId !== shopId) return false;

        const key = lineKey(product.id, variant?.id);
        const existing = get().items.find(
          (i) => lineKey(i.productId, i.variantId) === key,
        );
        if (existing) {
          set({
            items: get().items.map((i) =>
              lineKey(i.productId, i.variantId) === key
                ? { ...i, quantity: i.quantity + quantity }
                : i,
            ),
          });
          return true;
        }

        const price = variantUnitPrice(product, variant);
        const label = variant ? variantLabel(variant) : undefined;

        set({
          items: [
            ...get().items,
            {
              productId: product.id,
              variantId: variant?.id,
              variantLabel: label,
              title: product.title,
              price,
              shopId,
              shopName: product.shop?.shopName ?? "",
              quantity,
            },
          ],
        });
        return true;
      },

      removeItem: (productId, variantId) => {
        const key = lineKey(productId, variantId);
        set({
          items: get().items.filter(
            (i) => lineKey(i.productId, i.variantId) !== key,
          ),
        });
      },

      setQuantity: (productId, variantId, quantity) => {
        if (quantity < 1) {
          get().removeItem(productId, variantId);
          return;
        }
        const key = lineKey(productId, variantId);
        set({
          items: get().items.map((i) =>
            lineKey(i.productId, i.variantId) === key ? { ...i, quantity } : i,
          ),
        });
      },

      clear: () => set({ items: [] }),
    }),
    { name: "cart-storage" },
  ),
);

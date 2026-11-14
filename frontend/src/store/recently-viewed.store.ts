import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/types";

const MAX_ITEMS = 12;

interface RecentlyViewedState {
  /** Newest first. Just enough of each product to draw its card again. */
  items: Product[];
  record: (product: Product) => void;
  clear: () => void;
}

/** "Recently viewed": kept on this device only, never sent to the server. */
export const useRecentlyViewed = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      items: [],
      record: (product) => {
        const entry: Product = {
          id: product.id,
          title: product.title,
          imageUrl: product.imageUrl,
          basePrice: product.basePrice,
          compareAtPrice: product.compareAtPrice,
          shop: product.shop
            ? ({ id: product.shop.id, shopName: product.shop.shopName } as Product["shop"])
            : undefined,
        };
        set({ items: [entry, ...get().items.filter((i) => i.id !== product.id)].slice(0, MAX_ITEMS) });
      },
      clear: () => set({ items: [] }),
    }),
    { name: "recently-viewed" },
  ),
);

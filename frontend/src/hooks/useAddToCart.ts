import { useCartStore } from "@/store/cart.store";
import { toast } from "@/lib/toast";
import { track } from "@/lib/analytics";
import type { Product, ProductVariant } from "@/types";

/**
 * Adds to the cart and confirms with a toast ("View cart" link). Returns
 * whether the item went in.
 */
export function useAddToCart() {
  const addItem = useCartStore((s) => s.addItem);
  return (product: Product, variant?: ProductVariant, quantity = 1) => {
    const added = addItem(product, variant, quantity);
    if (added) {
      track("Add to cart");
      toast.success("Added to your cart", {
        description: product.title,
        action: { label: "View cart", href: "/cart" },
      });
    } else {
      toast.error("Your cart has items from another shop", {
        description: "Each checkout pays one artisan — check out or clear your cart first.",
        action: { label: "Open cart", href: "/cart" },
      });
    }
    return added;
  };
}

import { createContext, useContext } from "react";

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button, for deletes, refunds and other one-way actions. */
  destructive?: boolean;
}

export type Confirm = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<Confirm | null>(null);

/**
 * `const ok = await confirm({ title, description, destructive: true })` —
 * an "Are you sure?" step in front of destructive actions. Rendered by
 * <ConfirmProvider> at the app root.
 */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}

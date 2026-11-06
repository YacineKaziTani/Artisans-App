import { useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * A stock count that saves when you leave the field or press Enter (Escape
 * reverts). It used to save on every keystroke — typing "120" sent 1, 12
 * and 120 as three requests that could land out of order, and clearing the
 * field to retype saved 0.
 *
 * Render it with `key={value}` so it resets when the saved value changes.
 */
export function StockInput({
  value,
  onSave,
  disabled,
  label = "Stock",
}: {
  value: number;
  onSave: (next: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [draft, setDraft] = useState(String(value));

  const commit = () => {
    const next = Number(draft);
    if (draft.trim() === "" || !Number.isInteger(next) || next < 0) {
      setDraft(String(value)); // not a valid count — put the saved one back
      return;
    }
    if (next !== value) onSave(next);
  };

  return (
    <Input
      type="number"
      inputMode="numeric"
      min="0"
      step="1"
      aria-label={label}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur(); // commits via onBlur
        } else if (e.key === "Escape") {
          setDraft(String(value));
        }
      }}
      className="h-8 w-20 text-xs"
    />
  );
}

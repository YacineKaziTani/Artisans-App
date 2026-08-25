import { useState } from "react";
import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";

export function BookingPaymentForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const { error: confirmError, paymentIntent } =
      await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });

    setSubmitting(false);

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed. Please try again.");
      return;
    }

    // With manual capture, a successful authorization lands the
    // PaymentIntent in "requires_capture" — the card is held but not yet
    // charged. It only becomes "succeeded" once the artisan later captures
    // it, so both statuses here mean "the authorization went through."
    if (
      paymentIntent?.status === "requires_capture" ||
      paymentIntent?.status === "succeeded" ||
      paymentIntent?.status === "processing"
    ) {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}
      <p className="text-xs text-gray-500">
        Your card will be authorized now but not charged until the artisan
        confirms. If they can't fulfill it, you won't be charged at all.
      </p>
      <div className="flex gap-2">
        <Button
          type="submit"
          className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
          disabled={!stripe || submitting}
        >
          {submitting ? "Processing..." : "Authorize Payment"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

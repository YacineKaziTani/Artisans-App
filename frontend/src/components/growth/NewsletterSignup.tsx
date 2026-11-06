import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { newsletterApi } from "@/api/newsletter.api";
import { getErrorMessage } from "@/lib/errors";
import { track } from "@/lib/analytics";

/** Footer sign-up. Double opt-in: the address must click an emailed link. */
export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const subscribe = useMutation({
    mutationFn: newsletterApi.subscribe,
    onSuccess: () => track("Newsletter signup"),
  });

  if (subscribe.isSuccess) {
    return <p className="text-sm text-muted-foreground">{subscribe.data.message}</p>;
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        subscribe.mutate(email.trim());
      }}
      className="space-y-2"
    >
      <label htmlFor="newsletter-email" className="text-sm font-semibold">
        New makers, in your inbox
      </label>
      <div className="flex gap-2">
        <Input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="h-10"
        />
        <Button type="submit" size="sm" className="h-10" disabled={subscribe.isPending}>
          {subscribe.isPending ? "…" : "Subscribe"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Occasional emails. Unsubscribe in one click.</p>
      {subscribe.isError && (
        <p className="text-xs text-destructive">{getErrorMessage(subscribe.error, "Couldn't subscribe you.")}</p>
      )}
    </form>
  );
}

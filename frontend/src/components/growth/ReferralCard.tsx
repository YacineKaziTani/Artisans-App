import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { userApi } from "@/api/user.api";

/** "Invite friends": the user's invite link and how many joined with it. */
export function ReferralCard({ audience = "friends" }: { audience?: "friends" | "artisans" }) {
  const { data } = useQuery({ queryKey: ["users", "mine", "referrals"], queryFn: userApi.referrals });
  const [copied, setCopied] = useState(false);
  if (!data) return null;

  const link =
    audience === "artisans"
      ? `${window.location.origin}/register?type=artisan&ref=${data.code}`
      : `${window.location.origin}/register?ref=${data.code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your invite link:", link);
    }
  };

  return (
    <section className="surface p-6" aria-labelledby="referral-title">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Gift className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="referral-title" className="font-display text-lg font-semibold">
            {audience === "artisans" ? "Invite other makers" : "Invite friends"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {audience === "artisans"
              ? "Know someone who makes beautiful things? Send them your link."
              : "Share Artisan Market with people who love handmade."}
            {data.joined > 0 &&
              ` ${data.joined} ${data.joined === 1 ? "person has" : "people have"} joined with your link.`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 max-w-full truncate rounded-md bg-muted px-2.5 py-1.5 text-xs">{link}</code>
            <Button type="button" size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

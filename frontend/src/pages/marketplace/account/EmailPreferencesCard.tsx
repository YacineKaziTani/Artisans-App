import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUpdateMyProfile } from "@/hooks/useProfile";
import { getErrorMessage } from "@/lib/errors";
import type { User } from "@/types";

/** Activity emails on/off. The bell in the header shows them either way. */
export function EmailPreferencesCard({ profile }: { profile: User }) {
  const update = useUpdateMyProfile();
  const enabled = profile.emailNotifications !== false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email notifications</CardTitle>
        <CardDescription>
          Updates about your orders, bookings, reviews and disputes. You'll always see them in the
          notifications bell, and we always email security messages like password resets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={enabled}
            disabled={update.isPending}
            onChange={(e) => update.mutate({ emailNotifications: e.target.checked })}
            className="size-4"
          />
          Email me about activity on my account
        </label>
        {update.isError && (
          <p className="text-sm text-destructive">{getErrorMessage(update.error, "Couldn't save that setting.")}</p>
        )}
      </CardContent>
    </Card>
  );
}

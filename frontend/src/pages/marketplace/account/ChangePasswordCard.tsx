import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChangePassword } from "@/hooks/useProfile";
import { getErrorMessage } from "@/lib/errors";

/**
 * The API has always supported changing your password (and signing out
 * every other session when you do) — there just wasn't a screen for it.
 */
export function ChangePasswordCard() {
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mismatch || newPassword.length < 8) return;
    changePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          Changing it signs you out on every device, including this one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          {changePassword.isError && (
            <p className="alert-error">
              {getErrorMessage(changePassword.error, "Couldn't change your password.")}
            </p>
          )}
          <div>
            <label htmlFor="current-password" className="field-label">
              Current password
            </label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="new-password" className="field-label">
              New password
            </label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          <div>
            <label htmlFor="confirm-new-password" className="field-label">
              Confirm new password
            </label>
            <Input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            {mismatch && (
              <p className="mt-1 text-xs text-destructive">Passwords don't match.</p>
            )}
          </div>
          <Button type="submit" disabled={changePassword.isPending || mismatch}>
            {changePassword.isPending ? "Changing…" : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

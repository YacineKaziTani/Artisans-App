import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/axios";
import { getErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/store/auth.store";

/** Download everything we hold about you, or delete your account. */
export function YourDataCard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");

  const download = useMutation({
    mutationFn: () => api.get<Blob>("/users/mine/export", { responseType: "blob" }).then((r) => r.data),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `artisan-market-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete("/users/mine", { data: { password } }).then((r) => r.data),
    onSuccess: () => {
      logout();
      qc.clear();
      navigate("/", { replace: true });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your data</CardTitle>
        <CardDescription>
          Download a copy of everything we hold about your account, or delete it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => download.mutate()} disabled={download.isPending}>
            <Download className="size-4" /> {download.isPending ? "Preparing…" : "Download my data"}
          </Button>
          {download.isError && <p className="mt-2 text-sm text-destructive">{getErrorMessage(download.error)}</p>}
        </div>

        <div className="border-t border-border pt-4">
          {!confirming ? (
            <Button type="button" variant="destructive" size="sm" onClick={() => setConfirming(true)}>
              Delete my account
            </Button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                remove.mutate();
              }}
              className="max-w-md space-y-3"
            >
              <p className="text-sm text-muted-foreground">
                This erases your name, email, phone and photo, closes your shop if you have one, and signs you out
                everywhere. Orders and reviews stay visible to the other side, without your name. It can't be undone.
              </p>
              {remove.isError && <p className="alert-error">{getErrorMessage(remove.error, "Couldn't delete your account.")}</p>}
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                aria-label="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="flex gap-2">
                <Button type="submit" variant="destructive" size="sm" disabled={remove.isPending}>
                  {remove.isPending ? "Deleting…" : "Delete permanently"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setConfirming(false);
                    remove.reset();
                  }}
                >
                  Keep my account
                </Button>
              </div>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

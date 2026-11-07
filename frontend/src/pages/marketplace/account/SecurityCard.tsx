import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useLogoutAll,
  useTwoFactorDisable,
  useTwoFactorEnable,
  useTwoFactorSetup,
} from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/useConfirm";
import { getErrorMessage } from "@/lib/errors";
import type { User } from "@/types";

/** Turn two-step login on: show the key, check a code, show recovery codes once. */
function EnableTwoFactor() {
  const setup = useTwoFactorSetup();
  const enable = useTwoFactorEnable();
  const [code, setCode] = useState("");

  if (enable.isSuccess) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-medium text-jade-600">
          <ShieldCheck className="size-4" aria-hidden="true" /> Two-step login is on.
        </p>
        <p className="text-sm text-muted-foreground">
          Save these recovery codes somewhere safe (a password manager, or printed). Each works once if you lose your
          phone. They won't be shown again.
        </p>
        <ul className="grid max-w-sm grid-cols-2 gap-1 rounded-lg bg-muted p-3 font-mono text-sm">
          {enable.data.recoveryCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => navigator.clipboard?.writeText(enable.data.recoveryCodes.join("\n"))}
        >
          Copy codes
        </Button>
      </div>
    );
  }

  if (!setup.data) {
    return (
      <div className="space-y-2">
        {setup.isError && <p className="alert-error">{getErrorMessage(setup.error)}</p>}
        <Button type="button" size="sm" onClick={() => setup.mutate()} disabled={setup.isPending}>
          {setup.isPending ? "Preparing…" : "Turn on two-step login"}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        enable.mutate(code.trim());
      }}
      className="space-y-3"
    >
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
        <li>
          Open an authenticator app (Google Authenticator, 1Password, Authy…) and add an account.{" "}
          <a href={setup.data.otpauthUrl} className="font-medium text-primary hover:underline">
            On this phone? Tap here.
          </a>
        </li>
        <li>
          Or type this key in:{" "}
          <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
            {setup.data.secret.replace(/(.{4})/g, "$1 ").trim()}
          </code>
        </li>
        <li>Enter the 6-digit code it shows.</li>
      </ol>
      {enable.isError && <p className="alert-error">{getErrorMessage(enable.error, "That code didn't work.")}</p>}
      <div className="flex max-w-xs gap-2">
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          maxLength={6}
          aria-label="Code from your authenticator app"
          required
        />
        <Button type="submit" disabled={enable.isPending}>
          {enable.isPending ? "…" : "Confirm"}
        </Button>
      </div>
    </form>
  );
}

function DisableTwoFactor() {
  const disable = useTwoFactorDisable();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-jade-600">
          <ShieldCheck className="size-4" aria-hidden="true" /> Two-step login is on.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          Turn off
        </Button>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        disable.mutate({ password, code: code.trim() });
      }}
      className="max-w-sm space-y-3"
    >
      <p className="text-sm text-muted-foreground">Confirm with your password and a code (or a recovery code).</p>
      {disable.isError && <p className="alert-error">{getErrorMessage(disable.error)}</p>}
      <Input type="password" autoComplete="current-password" placeholder="Password" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <Input inputMode="numeric" placeholder="Code" aria-label="Authenticator or recovery code" value={code} onChange={(e) => setCode(e.target.value)} required />
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" size="sm" disabled={disable.isPending}>
          {disable.isPending ? "…" : "Turn off two-step login"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Two-step login and "sign out everywhere". */
export function SecurityCard({ profile }: { profile: User }) {
  const logoutAll = useLogoutAll();
  const confirm = useConfirm();

  return (
    <Card id="security">
      <CardHeader>
        <CardTitle>Security</CardTitle>
        <CardDescription>
          Two-step login asks for a code from your phone each time you sign in — strongly recommended for shop owners and
          admins.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {profile.twoFactorEnabled ? <DisableTwoFactor /> : <EnableTwoFactor />}

        <div className="border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Signed in somewhere you shouldn't be, or on a shared computer?
          </p>
          {logoutAll.isError && <p className="alert-error mt-2">{getErrorMessage(logoutAll.error)}</p>}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            disabled={logoutAll.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: "Sign out of all devices?",
                description: "Every browser and phone signed in to this account — including this one — will need to log in again.",
                confirmLabel: "Sign out everywhere",
              });
              if (ok) logoutAll.mutate();
            }}
          >
            Sign out of all devices
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

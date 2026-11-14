import { useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/Pagination";
import {
  useAdminUsers,
  useDeleteUserByAdmin,
  useUpdateUserByAdmin,
} from "@/hooks/useAdminUsers";
import { useConfirm } from "@/hooks/useConfirm";
import { useAuthStore } from "@/store/auth.store";
import { getErrorMessage } from "@/lib/errors";
import type { User } from "@/types";
import { PageHeader } from "@/components/PageHeader";

const ROLE_STYLES: Record<User["role"], string> = {
  client: "bg-muted text-foreground/80 border-border",
  artisan: "bg-brand-100 text-primary border-border",
  super_admin: "bg-brand-100 text-brand-700 border-brand-200",
};

const ROLE_LABELS: Record<User["role"], string> = {
  client: "Client",
  artisan: "Artisan",
  super_admin: "Admin",
};

const ROLE_FILTERS: { value: User["role"] | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "client", label: "Clients" },
  { value: "artisan", label: "Artisans" },
  { value: "super_admin", label: "Admins" },
];

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<User["role"] | undefined>(undefined);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Debounce typing so every keystroke isn't a request.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isError, isFetching } = useAdminUsers({
    page,
    role,
    search: search || undefined,
  });
  const users = data?.data ?? [];
  const updateUser = useUpdateUserByAdmin();
  const deleteUser = useDeleteUserByAdmin();
  const currentUser = useAuthStore((s) => s.user);
  const confirm = useConfirm();

  const actionError = updateUser.error ?? deleteUser.error;

  const toggleSuspended = async (user: User) => {
    const suspending = user.isActive !== false;
    const ok = await confirm({
      title: suspending ? `Suspend ${user.name}?` : `Reactivate ${user.name}?`,
      description: suspending
        ? "They'll be signed out everywhere and won't be able to log in until reactivated."
        : "They'll be able to log in again.",
      confirmLabel: suspending ? "Suspend" : "Reactivate",
      destructive: suspending,
    });
    if (ok) {
      updateUser.mutate({ id: user.id, payload: { isActive: !suspending } });
    }
  };

  const changeRole = async (user: User, next: User["role"]) => {
    if (next === user.role) return;
    const ok = await confirm({
      title: `Make ${user.name} ${ROLE_LABELS[next].toLowerCase()}?`,
      description:
        next === "super_admin"
          ? "Admins can manage every user, shop, order and refund."
          : `Their role changes from ${ROLE_LABELS[user.role].toLowerCase()} to ${ROLE_LABELS[next].toLowerCase()}.`,
      confirmLabel: "Change role",
      destructive: next === "super_admin" || user.role === "super_admin",
    });
    if (ok) updateUser.mutate({ id: user.id, payload: { role: next } });
  };

  const remove = async (user: User) => {
    const ok = await confirm({
      title: `Delete ${user.name}'s account?`,
      description:
        "Their personal details are erased and they can no longer sign in. Their orders, bookings and messages stay (shown as “Deleted user”), and their shop is closed. This can't be undone.",
      confirmLabel: "Delete account",
      destructive: true,
    });
    if (ok) deleteUser.mutate(user.id);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Users" description="Manage accounts and permissions" icon={Users} />

      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle>All Users</CardTitle>
            <CardDescription>{data?.meta.total ?? 0} total</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, email or phone"
                aria-label="Search users"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {ROLE_FILTERS.map((filter) => (
                <button
                  key={filter.label}
                  type="button"
                  aria-pressed={role === filter.value}
                  onClick={() => {
                    setRole(filter.value);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                    role === filter.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground/80 border-border"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {Boolean(actionError) && (
            <p className="alert-error">{getErrorMessage(actionError)}</p>
          )}

          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <p className="alert-error">
              Couldn't load users.
            </p>
          )}

          {!isLoading && !isError && users.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No users match these filters.
            </p>
          )}

          {!isLoading &&
            !isError &&
            users.map((user) => {
              const isSelf = user.id === currentUser?.id;
              const isUpdating =
                updateUser.isPending && updateUser.variables?.id === user.id;
              const isDeleting =
                deleteUser.isPending && deleteUser.variables === user.id;

              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between border border-border rounded-lg p-3 flex-wrap gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {user.name}{" "}
                      {isSelf && <span className="text-xs text-muted-foreground/70">(you)</span>}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {user.email}
                      {user.phone ? ` · ${user.phone}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isSelf ? (
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full border ${ROLE_STYLES[user.role]}`}
                      >
                        {ROLE_LABELS[user.role]}
                      </span>
                    ) : (
                      <select
                        aria-label={`Role for ${user.name}`}
                        value={user.role}
                        disabled={isUpdating}
                        onChange={(e) => changeRole(user, e.target.value as User["role"])}
                        className={`text-xs font-semibold px-2 py-1 rounded-full border ${ROLE_STYLES[user.role]}`}
                      >
                        {(Object.keys(ROLE_LABELS) as User["role"][]).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    )}
                    {user.isActive === false && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full border bg-destructive/10 text-destructive border-destructive/25">
                        suspended
                      </span>
                    )}
                    {!isSelf && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdating}
                          onClick={() => toggleSuspended(user)}
                        >
                          {user.isActive === false ? "Reactivate" : "Suspend"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isDeleting}
                          onClick={() => remove(user)}
                        >
                          {isDeleting ? "…" : "Delete"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

          <Pagination meta={data?.meta} onPageChange={setPage} disabled={isFetching} />
        </CardContent>
      </Card>
    </div>
  );
}

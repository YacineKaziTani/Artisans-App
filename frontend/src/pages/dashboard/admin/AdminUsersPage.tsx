import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useAdminUsers,
  useDeleteUserByAdmin,
  useUpdateUserByAdmin,
} from "@/hooks/useAdminUsers";
import { useAuthStore } from "@/store/auth.store";
import type { User } from "@/types";

const ROLE_STYLES: Record<User["role"], string> = {
  client: "bg-gray-100 text-gray-700 border-gray-300",
  artisan: "bg-orange-100 text-orange-800 border-orange-300",
  super_admin: "bg-purple-100 text-purple-800 border-purple-300",
};

export default function AdminUsersPage() {
  const { data: users, isLoading, isError } = useAdminUsers();
  const updateUser = useUpdateUserByAdmin();
  const deleteUser = useDeleteUserByAdmin();
  const currentUser = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-600">Manage accounts and permissions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>{users?.length ?? 0} total</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
              Couldn't load users.
            </p>
          )}

          {!isLoading &&
            !isError &&
            (users ?? []).map((user) => {
              const isSelf = user.id === currentUser?.id;
              const isUpdating =
                updateUser.isPending && updateUser.variables?.id === user.id;
              const isDeleting =
                deleteUser.isPending && deleteUser.variables === user.id;

              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between border border-gray-200 rounded-lg p-3 flex-wrap gap-2"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {user.name}{" "}
                      {isSelf && <span className="text-xs text-gray-400">(you)</span>}
                    </p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full border ${ROLE_STYLES[user.role]}`}
                    >
                      {user.role}
                    </span>
                    {user.isActive === false && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full border bg-red-100 text-red-800 border-red-300">
                        suspended
                      </span>
                    )}
                    {!isSelf && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdating}
                          onClick={() =>
                            updateUser.mutate({
                              id: user.id,
                              payload: { isActive: user.isActive === false },
                            })
                          }
                        >
                          {user.isActive === false ? "Reactivate" : "Suspend"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isDeleting}
                          onClick={() => deleteUser.mutate(user.id)}
                        >
                          {isDeleting ? "…" : "Delete"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
}

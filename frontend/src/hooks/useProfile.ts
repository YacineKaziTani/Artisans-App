import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { userApi } from "@/api/user.api";
import { useAuthStore } from "@/store/auth.store";
import { authKeys } from "@/hooks/useAuth";
import { disconnectSocket } from "@/lib/socket";
import type { User } from "@/types";

export const userKeys = {
  mine: ["users", "mine"] as const,
};

export function useMyProfile() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: userKeys.mine,
    queryFn: userApi.getMine,
    enabled: isAuthenticated,
  });
}

/** Keeps the profile page and the signed-in user (navbar name/avatar) in step. */
function useProfileSaved() {
  const qc = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  return (user: User) => {
    qc.setQueryData(userKeys.mine, user);
    setAuth(user);
    qc.invalidateQueries({ queryKey: authKeys.me });
  };
}

export function useUpdateMyProfile() {
  const onSaved = useProfileSaved();
  return useMutation({
    mutationFn: userApi.updateMine,
    onSuccess: onSaved,
  });
}

export function useUploadAvatar() {
  const onSaved = useProfileSaved();
  return useMutation({
    mutationFn: (file: File) => userApi.uploadAvatar(file),
    onSuccess: onSaved,
  });
}

/**
 * The API ends every session when the password changes (including this
 * one), so sign out locally and send the user to log in with it.
 */
export function useChangePassword() {
  const qc = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  return useMutation({
    mutationFn: userApi.changePassword,
    onSuccess: () => {
      logout();
      disconnectSocket();
      qc.clear();
      navigate("/login", {
        replace: true,
        state: { notice: "Password changed — please log in with your new password." },
      });
    },
  });
}

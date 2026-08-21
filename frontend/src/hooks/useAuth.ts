import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { authApi } from "@/api/auth.api";
import { useAuthStore } from "@/store/auth.store";
import type { LoginPayload, RegisterPayload } from "@/types";
import { useEffect } from "react";

export const authKeys = {
  me: ["auth", "me"] as const,
};

export function useMe() {
  const { setAuth, isAuthenticated, logout } = useAuthStore();

  const query = useQuery({
    queryKey: authKeys.me,
    queryFn: authApi.me,
    retry: false,
    staleTime: Infinity,
    enabled: isAuthenticated,
    // Allow checking the session even if local storage is empty
    // This allows auto-login via cookies.
  });

  useEffect(() => {
    if (query.data) setAuth(query.data);
    if (query.isError) logout(); // If session check fails, clear local state
  }, [query.data, query.isError, setAuth, logout]);

  return query;
}

export function useLogin() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: ({ user }) => {
      setAuth(user);
      qc.setQueryData(authKeys.me, user);
      navigate("/dashboard");
    },
  });
}

export function useRegister() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: ({ user }) => {
      setAuth(user);
      qc.setQueryData(authKeys.me, user); // Prime the cache like login does
      navigate("/dashboard");
    },
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      logout();
      qc.clear();
      navigate("/login");
    },
  });
}

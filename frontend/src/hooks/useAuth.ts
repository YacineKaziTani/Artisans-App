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
  const { setAuth, isAuthenticated } = useAuthStore();

  const query = useQuery({
    queryKey: authKeys.me,
    queryFn: authApi.me,
    retry: false,
    staleTime: Infinity,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (query.data) setAuth(query.data);
  }, [query.data, setAuth]);

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

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: ({ user }) => {
      setAuth(user);
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

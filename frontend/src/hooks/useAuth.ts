import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router";
import { homePathFor, returnPathFrom } from "@/lib/redirects";
import { authApi } from "@/api/auth.api";
import { useAuthStore } from "@/store/auth.store";
import type { LoginPayload, RegisterPayload, User } from "@/types";
import { useEffect } from "react";
import { track } from "@/lib/analytics";

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
  });

  useEffect(() => {
    if (query.data) setAuth(query.data);
    if (query.isError) logout();
  }, [query.data, query.isError, setAuth, logout]);

  return query;
}

/**
 * Signs in, then returns to the page that sent the user to /login (the
 * cart, a shop, a protected page) — or their role's home if none. It used
 * to always go to /dashboard, which bounced clients to "/" and lost the
 * checkout they were in the middle of.
 */
/** Stores the session and goes back to where the user was headed. */
function useFinishLogin() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  return (user: User) => {
    setAuth(user);
    qc.setQueryData(authKeys.me, user);
    navigate(returnPathFrom(location.state) ?? homePathFor(user), { replace: true });
  };
}

export function useLogin() {
  const finish = useFinishLogin();
  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    // With two-step login on, there's no user yet — the page asks for the code.
    onSuccess: ({ user }) => {
      if (user) finish(user);
    },
  });
}

/** The authenticator-code step of a two-step login. */
export function useLoginSecondStep() {
  const finish = useFinishLogin();
  return useMutation({
    mutationFn: authApi.loginSecondStep,
    onSuccess: ({ user }) => finish(user),
  });
}

/** Ends every session of the account, including this one. */
export function useLogoutAll() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.logoutAll,
    onSuccess: () => {
      logout();
      qc.clear();
      navigate("/login", { state: { notice: "You've been signed out on all your devices." } });
    },
  });
}

export function useTwoFactorSetup() {
  return useMutation({ mutationFn: authApi.twoFactorSetup });
}

export function useTwoFactorEnable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.twoFactorEnable,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.me });
      qc.invalidateQueries({ queryKey: ["users", "mine"] });
    },
  });
}

export function useTwoFactorDisable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.twoFactorDisable,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.me });
      qc.invalidateQueries({ queryKey: ["users", "mine"] });
    },
  });
}

export function useRegister() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: ({ user }, payload) => {
      track("Sign up", { role: user.role, invited: Boolean(payload.ref) });
      setAuth(user);
      qc.setQueryData(authKeys.me, user);
      // A new artisan's first job is creating their shop.
      const fallback = user.role === "artisan" ? "/profile-artisan" : "/";
      navigate(returnPathFrom(location.state) ?? fallback, { replace: true });
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

/**
 * Confirms the email from the link's token. A query, not a mutation, so
 * React's development double-mount sends it once — the token is single-use.
 */
export function useVerifyEmail(token: string | null) {
  const qc = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["auth", "verify-email", token ?? ""],
    queryFn: async () => {
      const result = await authApi.verifyEmail(token!);
      // Signed in here too? Refresh the session so the banner goes away.
      if (isAuthenticated) await qc.invalidateQueries({ queryKey: authKeys.me });
      return result;
    },
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useResendVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: (result) => {
      // Confirmed in another tab or device meanwhile — pick that up.
      if (result.alreadyVerified) qc.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}

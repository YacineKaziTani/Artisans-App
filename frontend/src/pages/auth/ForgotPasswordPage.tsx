import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/api/auth.api";
import { useMutation } from "@tanstack/react-query";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const { mutate, isPending, isSuccess, isError } = useMutation({
    mutationFn: () => authApi.forgotPassword(email),
  });

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 px-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border-2 border-orange-200 p-8">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-700 to-amber-600 bg-clip-text text-transparent mb-2">
          Forgot Password
        </h1>
        <p className="text-amber-900 mb-6 text-sm">
          Enter your email and we'll send you a link to reset your password.
        </p>

        {isSuccess ? (
          <div className="p-4 bg-green-100 border border-green-300 rounded-lg text-green-800 text-sm">
            If that email exists, a reset link has been sent. Check your inbox.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutate();
            }}
            className="space-y-4"
          >
            {isError && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
                Something went wrong. Please try again.
              </div>
            )}
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
              disabled={isPending}
            >
              {isPending ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
        )}

        <Link
          to="/login"
          className="block text-center text-sm text-orange-700 hover:underline mt-6"
        >
          Back to Login
        </Link>
      </div>
    </main>
  );
}

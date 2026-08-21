import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/api/auth.api";
import { useMutation } from "@tanstack/react-query";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatch, setMismatch] = useState(false);

  const { mutate, isPending, isError, isSuccess } = useMutation({
    mutationFn: () => authApi.resetPassword({ email, token, newPassword }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    mutate();
  };

  const missingLinkParams = !email || !token;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 px-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border-2 border-orange-200 p-8">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-700 to-amber-600 bg-clip-text text-transparent mb-6">
          Reset Password
        </h1>

        {missingLinkParams && (
          <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
            This reset link is invalid. Please request a new one.
          </p>
        )}

        {!missingLinkParams && isSuccess && (
          <div className="space-y-4">
            <div className="p-4 bg-green-100 border border-green-300 rounded-lg text-green-800 text-sm">
              Your password has been reset.
            </div>
            <Button className="w-full" onClick={() => navigate("/login")}>
              Go to Login
            </Button>
          </div>
        )}

        {!missingLinkParams && !isSuccess && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isError && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
                That link may have expired. Please request a new one.
              </div>
            )}
            {mismatch && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
                Passwords don't match.
              </div>
            )}
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              minLength={8}
              required
            />
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              minLength={8}
              required
            />
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
              disabled={isPending}
            >
              {isPending ? "Resetting..." : "Reset Password"}
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

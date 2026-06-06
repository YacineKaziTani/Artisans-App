import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useLogin } from "@/hooks/useAuth";
import axios from "axios";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { mutate: login, isPending, error } = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 px-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border-2 border-orange-200 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-700 to-amber-600 bg-clip-text text-transparent text-center">
            Welcome Back
          </h1>
          <p className="text-amber-900 text-center text-sm mt-2">
            Sign in to your artisan marketplace account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-100 border-2 border-red-400 rounded-lg text-red-800 text-sm font-medium">
              {(axios.isAxiosError(error) && error.response?.data?.message) ||
                "Login failed"}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-orange-900 mb-2"
            >
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-orange-900 mb-2"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-semibold py-2 mt-6"
          >
            {isPending ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="pt-6 text-center border-t border-orange-200">
          <p className="text-amber-900 text-sm">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-orange-700 hover:text-orange-800 font-bold underline"
            >
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

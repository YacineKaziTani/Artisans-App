import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRegister } from "@/hooks/useAuth";
import axios from "axios";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [userType, setUserType] = useState<"client" | "artisan">("client");

  const { mutate: register, isPending, error } = useRegister();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register({ name, email, password, phone, role: userType });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-orange-50 via-amber-50 to-orange-100 px-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border-2 border-orange-200 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-linear-to-r from-orange-700 to-amber-600 bg-clip-text text-transparent text-center">
            Join Artisan Hub
          </h1>
          <p className="text-amber-900 text-center text-sm mt-2">
            Create your account and get started today
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
              htmlFor="name"
              className="block text-sm font-semibold text-orange-900 mb-2"
            >
              Full Name
            </label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="John Doe"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-orange-900 mb-2"
            >
              Email
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
              htmlFor="phone"
              className="block text-sm font-semibold text-orange-900 mb-2"
            >
              Phone Number
            </label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="+1 234 567 8900"
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

          <div>
            <label className="block text-sm font-semibold text-orange-900 mb-3">
              I am a...
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="client"
                  checked={userType === "client"}
                  onChange={(e) =>
                    setUserType(e.target.value as "client" | "artisan")
                  }
                  className="w-4 h-4 accent-orange-600"
                />
                <span className="text-sm font-medium text-amber-900">
                  Client
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="artisan"
                  checked={userType === "artisan"}
                  onChange={(e) =>
                    setUserType(e.target.value as "client" | "artisan")
                  }
                  className="w-4 h-4 accent-orange-600"
                />
                <span className="text-sm font-medium text-amber-900">
                  Artisan
                </span>
              </label>
            </div>
          </div>

          <Button type="submit" disabled={isPending} className="w-full mt-6">
            {isPending ? "Creating account..." : "Register"}
          </Button>
        </form>

        <div className="pt-6 text-center border-t border-orange-200">
          <p className="text-amber-900 text-sm">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-orange-700 hover:text-orange-800 font-bold underline"
            >
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

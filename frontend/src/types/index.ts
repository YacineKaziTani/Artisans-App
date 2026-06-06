// ── Auth ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  name: string;
  phone: string;
  role: "client" | "artisan";
}

// ── API Helpers ───────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  message: string;
  statusCode: number;
}

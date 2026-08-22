// ── Auth ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "client" | "artisan";
  phone?: string;
  avatarUrl?: string;
  isActive?: boolean;
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
  acceptTerms: boolean;
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

// ── Marketplace ──────────────────────────────────────────────────────────────
export interface Category {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  isActive: boolean;
}

export interface Photo {
  id: string;
  url: string;
  caption?: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  price: string | number;
  duration?: string;
  isAvailable: boolean;
  shop?: Shop;
}

export interface Shop {
  id: string;
  shopName: string;
  description?: string;
  address?: string;
  city?: string;
  logoUrl?: string;
  phone?: string;
  status: "active" | "suspended" | "pending" | "closed";
  averageRating: number;
  verificationStatus?: "none" | "pending" | "verified" | "rejected";
  verificationNote?: string;
  category?: Category;
  owner?: User;
  services?: Service[];
  products?: Product[];
  photos?: Photo[];
  createdAt?: string;
}

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type PaymentStatus = "unpaid" | "paid" | "refunded" | "failed";

export interface Booking {
  id: string;
  scheduledAt: string;
  notes?: string;
  status: BookingStatus;
  totalAmount: string | number;
  paymentStatus: PaymentStatus;
  stripePaymentIntentId?: string;
  shop?: Shop;
  service?: Service;
  client?: User;
  createdAt: string;
}

export interface Product {
  id: string;
  title: string;
  description?: string;
  basePrice: string | number;
  imageUrl?: string;
  shop?: Shop;
  createdAt?: string;
}

export interface Review {
  id: string;
  rating: number;
  comment?: string;
  author?: User;
  createdAt: string;
}

export type OrderStatus = "pending" | "fulfilled" | "cancelled";
export type OrderPaymentStatus = "unpaid" | "paid" | "refunded" | "failed";

export interface Order {
  id: string;
  quantity: number;
  totalAmount: string | number;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  shop?: Shop;
  product?: Product;
  client?: User;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  sender?: User;
  readAt?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  client?: User;
  shop?: Shop;
  createdAt: string;
  updatedAt: string;
  unreadCount?: number;
}

export type ReportTargetType = "shop" | "product" | "service" | "review";
export type ReportStatus = "pending" | "dismissed" | "actioned";

export interface Report {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel?: string;
  reason: string;
  status: ReportStatus;
  adminNote?: string;
  reporter?: User;
  createdAt: string;
}

export type DisputeTargetType = "booking" | "order";
export type DisputeStatus =
  | "open"
  | "resolved_refunded"
  | "resolved_denied"
  | "resolved_other";

export interface Dispute {
  id: string;
  targetType: DisputeTargetType;
  targetId: string;
  reason: string;
  status: DisputeStatus;
  resolutionNote?: string;
  raisedBy?: User;
  createdAt: string;
}

export interface PaginatedMeta {
  total: number;
  page: number;
  lastPage: number;
}

export interface PaginatedShops {
  data: Shop[];
  meta: PaginatedMeta;
}

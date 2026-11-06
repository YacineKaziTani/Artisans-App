// ── Auth ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "client" | "artisan";
  phone?: string;
  avatarUrl?: string;
  isActive?: boolean;
  /** Sent for your own account (and to admins). Undefined on older cached sessions. */
  emailVerified?: boolean;
  /** Activity emails on/off (in-app notifications always). */
  emailNotifications?: boolean;
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
  /** Invite code from a referral link. */
  ref?: string;
}

// ── API Helpers ───────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PageMeta {
  total: number;
  page: number;
  lastPage: number;
}

/** The `{ data, meta }` shape every paginated endpoint returns. */
export interface Page<T> {
  data: T[];
  meta: PageMeta;
}

/** Common query params for paginated lists. */
export interface PageParams {
  page?: number;
  limit?: number;
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
  /** Appointment length; bookings that overlap it are refused. */
  durationMinutes?: number | null;
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
  /** Only sent to the shop's owner and admins. */
  verificationNote?: string | null;
  stripeOnboardingComplete?: boolean;
  /** Computed by the API: whether the shop can take bookings/orders. */
  acceptsPayments?: boolean;
  /** IANA zone the shop's hours and appointment times are in. */
  timezone?: string;
  /** Null/empty = no fixed hours: clients request any time. */
  openingHours?: OpeningHours | null;
  pickupEnabled?: boolean;
  deliveryEnabled?: boolean;
  deliveryFee?: string | number;
  freeDeliveryOver?: string | number | null;
  deliveryArea?: string | null;
  category?: Category;
  owner?: User;
  services?: Service[];
  products?: Product[];
  photos?: Photo[];
  createdAt?: string;
}

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export interface TimeRange {
  open: string;
  close: string;
}
export type OpeningHours = Partial<Record<Weekday, TimeRange[]>>;

/** GET /services/:id/availability */
export interface ServiceAvailability {
  date: string;
  timezone: string;
  hasOpeningHours: boolean;
  durationMinutes?: number;
  /** ISO start times. */
  slots: string[];
}

/** GET /shops/mine/earnings */
export interface ShopEarnings {
  commissionPercent: number;
  totals: {
    paidGross: number;
    paidNet: number;
    thisMonthGross: number;
    thisMonthNet: number;
    onHold: number;
    refunded: number;
  };
  data: {
    kind: "order" | "booking";
    id: string;
    date: string;
    title: string;
    status: string;
    paymentStatus: string;
    amount: number;
    deliveryFee: number;
    net: number | null;
  }[];
  meta: { total: number; page: number; lastPage: number };
}

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type PaymentStatus = "unpaid" | "authorized" | "paid" | "partially_refunded" | "refunded" | "failed";

export interface Booking {
  id: string;
  scheduledAt: string;
  endsAt?: string | null;
  notes?: string;
  status: BookingStatus;
  totalAmount: string | number;
  paymentStatus: PaymentStatus;
  stripePaymentIntentId?: string;
  shop?: Shop;
  service?: Service;
  client?: User;
  createdAt: string;
  /** Only on the client's own bookings: whether they may cancel it themselves. */
  canCancel?: boolean;
  cancelBlockedReason?: string | null;
}

export interface Product {
  id: string;
  title: string;
  description?: string;
  basePrice: string | number;
  /** For products sold without variants: units left, or null if not tracked. */
  stockQuantity?: number | null;
  imageUrl?: string;
  images?: ProductImage[];
  variantOptions?: VariantOption[];
  variants?: ProductVariant[];
  shop?: Shop;
  createdAt?: string;
}

export interface ProductImage {
  id: string;
  url: string;
}

export interface VariantOption {
  id: string;
  name: string;
  values?: VariantValue[];
}

export interface VariantValue {
  id: string;
  value: string;
  priceModifier: string | number;
  option?: VariantOption;
}

export interface ProductVariant {
  id: string;
  sku?: string;
  stockQuantity: number;
  priceOverride?: string | number;
  values: VariantValue[];
}

export interface Review {
  id: string;
  rating: number;
  comment?: string;
  author?: User;
  /** The product the review is about, if the client tagged one. */
  product?: { id: string; title: string } | null;
  photos?: { url: string; publicId: string }[] | null;
  /** The artisan's public reply. */
  reply?: string | null;
  repliedAt?: string | null;
  createdAt: string;
}

export interface ReviewEligibility {
  canReview: boolean;
  reason: "own_shop" | "already_reviewed" | "no_completed_purchase" | null;
  message: string | null;
  /** Products the client received from this shop — what a review can be about. */
  products?: { id: string; title: string }[];
}

export type OrderStatus = "pending" | "fulfilled" | "cancelled";
export type OrderPaymentStatus =
  | "unpaid"
  | "authorized"
  | "paid"
  | "partially_refunded"
  | "refunded"
  | "failed";
export type DeliveryMethod = "pickup" | "delivery";

export interface Order {
  id: string;
  quantity: number;
  totalAmount: string | number;
  /** Included in totalAmount. In a cart it sits on one line only. */
  deliveryFee?: string | number;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  deliveryMethod?: DeliveryMethod;
  shippingAddress?: string;
  trackingInfo?: string;
  /** Set when the order is one line of a multi-item cart checkout. */
  checkoutGroupId?: string | null;
  shop?: Shop;
  product?: Product;
  variant?: ProductVariant;
  variantLabel?: string;
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

/** Admin-only summary of the order/booking a dispute is about. */
export interface DisputeTarget {
  id: string;
  title: string;
  status: string;
  paymentStatus: PaymentStatus;
  totalAmount: string | number;
  createdAt: string;
  scheduledAt?: string;
  deliveryMethod?: DeliveryMethod;
  partOfCart?: boolean;
  shop: { id: string; shopName: string; owner: User | null };
  client: User | null;
}

export interface Dispute {
  id: string;
  targetType: DisputeTargetType;
  targetId: string;
  reason: string;
  status: DisputeStatus;
  resolutionNote?: string;
  raisedBy?: User;
  createdAt: string;
  /** Present in the admin list. */
  target?: DisputeTarget | null;
}

/** GET /shops/mine/stats — the artisan dashboard numbers. */
export interface ShopStats {
  ordersToFulfil: number;
  bookingsToConfirm: number;
  upcomingBookings: number;
  last30Days: { revenue: number; paidOrders: number; paidBookings: number };
  averageRating: number;
  reviewCount: number;
  productCount: number;
  serviceCount: number;
  status: Shop["status"];
  acceptsPayments: boolean;
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

export type FavoriteTargetType = "shop" | "product";

export interface MyFavorites {
  shops: Shop[];
  products: Product[];
}

/** An in-app notification (the bell). */
export interface AppNotification {
  id: string;
  title: string;
  body?: string | null;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMyProfile, useUpdateMyProfile } from "@/hooks/useProfile";
import { useMyBookings, useCancelMyBooking } from "@/hooks/useBookings";
import { useMyOrders, useCancelMyOrder } from "@/hooks/useOrders";
import { DisputeDialog } from "@/components/DisputeDialog";
import type { User, BookingStatus, OrderStatus } from "@/types";

const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  fulfilled: "bg-jade-50 text-jade-600 border-jade-500/25",
  cancelled: "bg-destructive/10 text-destructive border-destructive/25",
};

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  confirmed: "bg-jade-50 text-jade-600 border-jade-500/25",
  cancelled: "bg-destructive/10 text-destructive border-destructive/25",
  completed: "bg-sky-100 text-sky-800 border-sky-200",
};

function ProfileEditForm({
  profile,
  onDone,
}: {
  profile: User;
  onDone: () => void;
}) {
  const updateProfile = useUpdateMyProfile();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? "");

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({ name, phone }, { onSuccess: onDone });
  };

  return (
    <CardContent className="space-y-4">
      <form onSubmit={handleSaveProfile} className="space-y-4">
        {updateProfile.isError && (
          <div className="p-3 bg-destructive/10 border border-destructive/25 rounded-lg text-destructive text-sm">
            Couldn't save your changes. Please try again.
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1">
            Full Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1">
            Phone
          </label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Your phone number"
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? "Saving..." : "Save Changes"}
          </Button>
          <Button type="button" onClick={onDone} variant="outline" className="flex-1">
            Cancel
          </Button>
        </div>
      </form>
    </CardContent>
  );
}

export default function ClientProfilePage() {
  const { data: profile, isLoading } = useMyProfile();
  const [editMode, setEditMode] = useState(false);

  return (
    <div className="page-shell py-12">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader className="flex justify-between items-start">
            <div>
              <CardTitle>My Profile</CardTitle>
              <CardDescription>Manage your account information</CardDescription>
            </div>
            {!editMode && !isLoading && (
              <Button onClick={() => setEditMode(true)} variant="outline">
                Edit
              </Button>
            )}
          </CardHeader>

          {isLoading && (
            <CardContent>
              <div className="h-24 rounded-lg bg-muted animate-pulse" />
            </CardContent>
          )}

          {!isLoading && editMode && profile && (
            <ProfileEditForm
              key={profile.id}
              profile={profile}
              onDone={() => setEditMode(false)}
            />
          )}

          {!isLoading && !editMode && profile && (
            <CardContent>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Full Name</p>
                  <p className="font-medium">{profile.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{profile.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{profile.phone || "—"}</p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <MyBookingsCard />
        <MyOrdersCard />
      </div>
    </div>
  );
}

function MyBookingsCard() {
  const { data: bookings, isLoading, isError } = useMyBookings();
  const cancelBooking = useCancelMyBooking();
  const [disputingBookingId, setDisputingBookingId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Bookings</CardTitle>
        <CardDescription>Services you've booked with artisans</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-destructive bg-destructive/10 border border-destructive/25 rounded-lg p-4 text-sm">
            Couldn't load your bookings right now.
          </p>
        )}

        {!isLoading && !isError && (bookings ?? []).length === 0 && (
          <p className="text-muted-foreground text-sm">
            You haven't booked any services yet.
          </p>
        )}

        {!isLoading && !isError && (bookings ?? []).length > 0 && (
          <div className="space-y-3">
            {bookings!.map((booking) => {
              const cancellable =
                booking.status === "pending" || booking.status === "confirmed";
              const isCancelling =
                cancelBooking.isPending && cancelBooking.variables === booking.id;

              return (
                <div
                  key={booking.id}
                  className="border border-border rounded-lg p-4 flex justify-between items-start flex-wrap gap-2"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {booking.service?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {booking.shop?.shopName} ·{" "}
                      {new Date(booking.scheduledAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full border ${STATUS_STYLES[booking.status]}`}
                    >
                      {booking.status}
                    </span>
                    {cancellable && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isCancelling}
                        onClick={() => cancelBooking.mutate(booking.id)}
                      >
                        {isCancelling ? "…" : "Cancel"}
                      </Button>
                    )}
                    {booking.paymentStatus === "paid" && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                        onClick={() => setDisputingBookingId(booking.id)}
                      >
                        Dispute
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {disputingBookingId && (
        <DisputeDialog
          targetType="booking"
          targetId={disputingBookingId}
          open={Boolean(disputingBookingId)}
          onOpenChange={(open) => {
            if (!open) setDisputingBookingId(null);
          }}
        />
      )}
    </Card>
  );
}

function MyOrdersCard() {
  const { data: orders, isLoading, isError } = useMyOrders();
  const cancelOrder = useCancelMyOrder();
  const [disputingOrderId, setDisputingOrderId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Orders</CardTitle>
        <CardDescription>Products you've ordered from artisans</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-destructive bg-destructive/10 border border-destructive/25 rounded-lg p-4 text-sm">
            Couldn't load your orders right now.
          </p>
        )}

        {!isLoading && !isError && (orders ?? []).length === 0 && (
          <p className="text-muted-foreground text-sm">
            You haven't ordered any products yet.
          </p>
        )}

        {!isLoading && !isError && (orders ?? []).length > 0 && (
          <div className="space-y-3">
            {orders!.map((order) => {
              const cancellable = order.status === "pending";
              const isCancelling =
                cancelOrder.isPending && cancelOrder.variables === order.id;

              return (
                <div
                  key={order.id}
                  className="border border-border rounded-lg p-4 flex justify-between items-start flex-wrap gap-2"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {order.product?.title} × {order.quantity}
                    </p>
                    {order.variantLabel && (
                      <p className="text-xs text-muted-foreground">{order.variantLabel}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {order.shop?.shopName} · $
                      {Number(order.totalAmount).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {order.deliveryMethod === "delivery" ? "🚚 Delivery" : "🏬 Pickup"}
                    </p>
                    {order.trackingInfo && (
                      <p className="text-xs text-muted-foreground">Tracking: {order.trackingInfo}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full border ${ORDER_STATUS_STYLES[order.status]}`}
                    >
                      {order.status}
                    </span>
                    {cancellable && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isCancelling}
                        onClick={() => cancelOrder.mutate(order.id)}
                      >
                        {isCancelling ? "…" : "Cancel"}
                      </Button>
                    )}
                    {order.paymentStatus === "paid" && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                        onClick={() => setDisputingOrderId(order.id)}
                      >
                        Dispute
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {disputingOrderId && (
        <DisputeDialog
          targetType="order"
          targetId={disputingOrderId}
          open={Boolean(disputingOrderId)}
          onOpenChange={(open) => {
            if (!open) setDisputingOrderId(null);
          }}
        />
      )}
    </Card>
  );
}


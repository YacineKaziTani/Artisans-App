import { Store, Truck } from "lucide-react";
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
import { useMyOrders, useCancelMyOrder, useConfirmReceived } from "@/hooks/useOrders";
import { DisputeDialog } from "@/components/DisputeDialog";
import { useConfirm } from "@/hooks/useConfirm";
import { Pagination } from "@/components/Pagination";
import { getErrorMessage } from "@/lib/errors";
import { AvatarPicker } from "./account/AvatarPicker";
import { ChangePasswordCard } from "./account/ChangePasswordCard";
import { EmailPreferencesCard } from "./account/EmailPreferencesCard";
import { SecurityCard } from "./account/SecurityCard";
import { YourDataCard } from "./account/YourDataCard";
import { MyDisputesCard } from "./account/MyDisputesCard";
import { ReferralCard } from "@/components/growth/ReferralCard";
import type { User } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";



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
          <div className="alert-error">
            {getErrorMessage(
              updateProfile.error,
              "Couldn't save your changes. Please try again.",
            )}
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
            <CardContent className="space-y-6">
              <AvatarPicker profile={profile} />
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

        <ChangePasswordCard />
        {profile && <EmailPreferencesCard profile={profile} />}
        {profile && <SecurityCard profile={profile} />}
        <MyBookingsCard />
        <MyOrdersCard />
        <MyDisputesCard />
        <ReferralCard />
        <YourDataCard />
      </div>
    </div>
  );
}

function MyBookingsCard() {
  const [page, setPage] = useState(1);
  const { data: bookingsPage, isLoading, isError, isFetching } = useMyBookings({ page });
  const bookings = bookingsPage?.data;
  const cancelBooking = useCancelMyBooking();
  const confirm = useConfirm();
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
          <p className="alert-error">
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
              // The server decides (free-cancellation window); it also says why not.
              const cancellable = Boolean(booking.canCancel);
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
                    {booking.cancelBlockedReason && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-md">
                        {booking.cancelBlockedReason}
                      </p>
                    )}
                    {cancelBooking.isError &&
                      cancelBooking.variables === booking.id && (
                        <p className="text-xs text-destructive mt-1">
                          {getErrorMessage(cancelBooking.error)}
                        </p>
                      )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={booking.status} />
                    {cancellable && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isCancelling}
                        onClick={async () => {
                          const paid = booking.paymentStatus === "paid";
                          const ok = await confirm({
                            title: "Cancel this booking?",
                            description: paid
                              ? "You'll get a full refund to your card."
                              : "The hold on your card will be released.",
                            confirmLabel: "Cancel booking",
                            cancelLabel: "Keep it",
                            destructive: true,
                          });
                          if (ok) cancelBooking.mutate(booking.id);
                        }}
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

        <Pagination
          meta={bookingsPage?.meta}
          onPageChange={setPage}
          disabled={isFetching}
        />
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
  const [page, setPage] = useState(1);
  const { data: ordersPage, isLoading, isError, isFetching } = useMyOrders({ page });
  const orders = ordersPage?.data;
  const cancelOrder = useCancelMyOrder();
  const confirmReceived = useConfirmReceived();
  const confirm = useConfirm();
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
          <p className="alert-error">
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
              // A checkout that was never paid for is released automatically;
              // say so rather than showing it as a normal pending order.
              const unpaid =
                order.status === "pending" &&
                (order.paymentStatus === "unpaid" || order.paymentStatus === "failed");

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
                      {order.deliveryMethod === "delivery" ? (
                          <span className="inline-flex items-center gap-1"><Truck className="size-3.5" aria-hidden="true" /> Delivery</span>
                        ) : (
                          <span className="inline-flex items-center gap-1"><Store className="size-3.5" aria-hidden="true" /> Pickup</span>
                        )}
                    </p>
                    {order.trackingInfo && (
                      <p className="text-xs text-muted-foreground">Tracking: {order.trackingInfo}</p>
                    )}
                    {order.deliveryMethod === "delivery" && order.status === "fulfilled" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {order.deliveredAt
                          ? `Delivered ${new Date(order.deliveredAt).toLocaleDateString()}`
                          : "Shipped — let the artisan know when it arrives."}
                      </p>
                    )}
                    {unpaid && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Payment wasn't completed — this checkout is released
                        automatically, and you haven't been charged.
                      </p>
                    )}
                    {cancelOrder.isError && cancelOrder.variables === order.id && (
                      <p className="text-xs text-destructive mt-1">
                        {getErrorMessage(cancelOrder.error)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {unpaid ? (
                      <StatusBadge status="unpaid" label="payment not completed" />
                    ) : (
                      <StatusBadge status={order.status} />
                    )}
                    {order.deliveryMethod === "delivery" && order.status === "fulfilled" && !order.deliveredAt && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={confirmReceived.isPending && confirmReceived.variables === order.id}
                        onClick={() => confirmReceived.mutate(order.id)}
                      >
                        Confirm received
                      </Button>
                    )}
                    {cancellable && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isCancelling}
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Cancel this order?",
                            description:
                              order.paymentStatus === "paid"
                                ? "You'll get a full refund to your card."
                                : "You won't be charged for it.",
                            confirmLabel: "Cancel order",
                            cancelLabel: "Keep it",
                            destructive: true,
                          });
                          if (ok) cancelOrder.mutate(order.id);
                        }}
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

        <Pagination
          meta={ordersPage?.meta}
          onPageChange={setPage}
          disabled={isFetching}
        />
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


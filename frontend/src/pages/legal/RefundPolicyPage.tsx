export default function RefundPolicyPage() {
  return (
    <main className="page-narrow py-16">
      <div className="surface p-8 sm:p-12">
        <h1 className="font-display text-4xl font-semibold">Refund Policy</h1>
        <p className="mt-2 mb-10 text-sm text-muted-foreground">Last updated: [date]</p>

        <div className="alert-note mb-10">
          <strong>Template notice:</strong> this is placeholder content and
          not legal advice. Refund/consumer-protection rules vary by
          jurisdiction — have a qualified lawyer review this before going
          live with real payments.
        </div>

        <div className="space-y-8 leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">
              Cancelling a booking or order
            </h2>
            <p>
              Clients can cancel a pending or confirmed booking, or a pending
              product order, from their account. If the booking or order was
              already paid, cancelling triggers an automatic full refund to
              the original payment method.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">
              Once a service is completed or a product is fulfilled
            </h2>
            <p>
              Bookings marked "completed" and orders marked "fulfilled" can no
              longer be cancelled through self-service. If something went
              wrong with a completed service or fulfilled order, open a
              dispute from your account and our team will review it.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">
              Disputes
            </h2>
            <p>
              If a Client and Artisan can't resolve an issue directly, either
              party can open a dispute. An admin reviews the details and
              decides whether a refund is warranted. Approved refunds are
              issued to the original payment method and typically appear
              within 5–10 business days, depending on your bank.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">
              Artisan-suspended or closed shops
            </h2>
            <p>
              If a shop is suspended or closed after you've already paid for a
              pending booking or order, contact support — this is treated the
              same as a dispute and reviewed for a refund.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-gray-200 p-8 sm:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Refund Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: [date]</p>

        <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-900 mb-8">
          <strong>Template notice:</strong> this is placeholder content and
          not legal advice. Refund/consumer-protection rules vary by
          jurisdiction — have a qualified lawyer review this before going
          live with real payments.
        </div>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
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

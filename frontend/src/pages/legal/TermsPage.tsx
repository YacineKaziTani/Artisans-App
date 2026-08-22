export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-gray-200 p-8 sm:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: [date]</p>

        <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-900 mb-8">
          <strong>Template notice:</strong> this is placeholder content
          intended to establish the structure of a real Terms of Service. It
          is not legal advice and should not be used as-is. Have a qualified
          lawyer review and adapt this for your jurisdiction, business
          structure, and applicable law before going live with real users or
          payments.
        </div>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">1. What this marketplace is</h2>
            <p>
              This platform connects independent artisans ("Artisans") who
              offer services and products with customers ("Clients") who wish
              to book or purchase them. The platform facilitates discovery,
              communication, and payment — it does not itself provide the
              underlying services or manufacture the products listed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">2. Accounts</h2>
            <p>
              You must provide accurate information when creating an account
              and are responsible for keeping your credentials secure. You
              must be legally able to enter into contracts to use this
              platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">3. Bookings, orders, and payments</h2>
            <p>
              Payments for bookings and product orders are processed by our
              payment provider. Prices, availability, and fulfillment are set
              by individual Artisans, not by the platform. Cancellation and
              refund terms are described in our{" "}
              <a href="/refund-policy" className="text-orange-700 hover:underline">
                Refund Policy
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">4. Conduct</h2>
            <p>
              You agree not to use the platform for fraudulent, abusive, or
              illegal activity, and not to circumvent the platform's payment
              or communication systems in ways that violate these terms.
              Content and accounts that violate this may be removed,
              suspended, or reported to relevant authorities.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">5. Disputes</h2>
            <p>
              If a booking or order doesn't go as expected, Clients and
              Artisans are encouraged to resolve it directly through the
              platform's messaging system first. If that doesn't work, either
              party may open a dispute for platform review.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">6. Limitation of liability</h2>
            <p>
              The platform is provided "as is." To the extent permitted by
              law, the platform is not liable for the quality, safety, or
              legality of services or products offered by Artisans, or for
              disputes between Artisans and Clients beyond the resolution
              process described above.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">7. Changes to these terms</h2>
            <p>
              We may update these terms from time to time. Continued use of
              the platform after changes take effect constitutes acceptance
              of the updated terms.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

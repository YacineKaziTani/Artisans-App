export default function TermsPage() {
  return (
    <main className="page-narrow py-16">
      <div className="surface p-8 sm:p-12">
        <h1 className="font-display text-4xl font-semibold">Terms of Service</h1>
        <p className="mt-2 mb-10 text-sm text-muted-foreground">Last updated: [date]</p>

        <div className="alert-note mb-10">
          <strong>Template notice:</strong> this is placeholder content
          intended to establish the structure of a real Terms of Service. It
          is not legal advice and should not be used as-is. Have a qualified
          lawyer review and adapt this for your jurisdiction, business
          structure, and applicable law before going live with real users or
          payments.
        </div>

        <div className="space-y-8 leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">1. What this marketplace is</h2>
            <p>
              This platform connects independent artisans ("Artisans") who
              offer services and products with customers ("Clients") who wish
              to book or purchase them. The platform facilitates discovery,
              communication, and payment — it does not itself provide the
              underlying services or manufacture the products listed.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">2. Accounts</h2>
            <p>
              You must provide accurate information when creating an account
              and are responsible for keeping your credentials secure. You
              must be legally able to enter into contracts to use this
              platform.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">3. Bookings, orders, and payments</h2>
            <p>
              Payments for bookings and product orders are processed by our
              payment provider. Prices, availability, and fulfillment are set
              by individual Artisans, not by the platform. Cancellation and
              refund terms are described in our{" "}
              <a href="/refund-policy" className="font-medium text-primary hover:underline">
                Refund Policy
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">4. Conduct</h2>
            <p>
              You agree not to use the platform for fraudulent, abusive, or
              illegal activity, and not to circumvent the platform's payment
              or communication systems in ways that violate these terms.
              Content and accounts that violate this may be removed,
              suspended, or reported to relevant authorities.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">5. Disputes</h2>
            <p>
              If a booking or order doesn't go as expected, Clients and
              Artisans are encouraged to resolve it directly through the
              platform's messaging system first. If that doesn't work, either
              party may open a dispute for platform review.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">6. Limitation of liability</h2>
            <p>
              The platform is provided "as is." To the extent permitted by
              law, the platform is not liable for the quality, safety, or
              legality of services or products offered by Artisans, or for
              disputes between Artisans and Clients beyond the resolution
              process described above.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">7. Changes to these terms</h2>
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

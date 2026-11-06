import { PageMeta } from "@/components/PageMeta";
export default function PrivacyPage() {
  return (
    <main className="page-narrow py-16">
      <PageMeta title="Privacy Policy" />
      <div className="surface p-8 sm:p-12">
        <h1 className="font-display text-4xl font-semibold">Privacy Policy</h1>
        <p className="mt-2 mb-10 text-sm text-muted-foreground">Last updated: [date]</p>

        <div className="alert-note mb-10">
          <strong>Template notice:</strong> this is placeholder content and
          not legal advice. Depending on where your users are located, you
          may have specific legal obligations (e.g. GDPR in the EU, CCPA in
          California). Have a qualified lawyer review this before going live.
        </div>

        <div className="space-y-8 leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">
              1. Information we collect
            </h2>
            <p>
              Account details you provide (name, email, phone), shop and
              listing information Artisans provide, booking and order
              records, messages sent through the platform, and payment
              information processed by our payment provider (we don't store
              full card numbers ourselves).
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">
              2. How we use it
            </h2>
            <p>
              To operate the marketplace: matching Clients with Artisans,
              processing payments, enabling messaging, sending transactional
              emails (booking confirmations, password resets), and platform
              safety (fraud prevention, content moderation, dispute
              resolution).
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">
              3. Who we share it with
            </h2>
            <p>
              Our payment processor (to complete transactions), our email and
              image-hosting providers (to send emails and store photos), and
              the other party to a booking/order/conversation (e.g. an
              Artisan sees a Client's name and message when they book a
              service). We don't sell personal data to third parties.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">
              4. Your choices
            </h2>
            <p>
              You can update your profile information at any time, close your
              shop if you're an Artisan, and request password resets. Contact
              us if you'd like your account data removed, subject to what we
              need to retain for legal/financial record-keeping (e.g.
              completed transaction history).
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">
              5. Security
            </h2>
            <p>
              Passwords are hashed, not stored in plain text. Payment details
              are handled directly by our payment processor and never touch
              our servers in raw form.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

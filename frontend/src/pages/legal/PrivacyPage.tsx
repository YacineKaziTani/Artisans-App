export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-gray-200 p-8 sm:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: [date]</p>

        <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-900 mb-8">
          <strong>Template notice:</strong> this is placeholder content and
          not legal advice. Depending on where your users are located, you
          may have specific legal obligations (e.g. GDPR in the EU, CCPA in
          California). Have a qualified lawyer review this before going live.
        </div>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
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

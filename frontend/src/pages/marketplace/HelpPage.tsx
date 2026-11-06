import { useState } from "react";
import { Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/axios";
import { getErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/store/auth.store";
import { PageMeta } from "@/components/PageMeta";

interface Faq {
  q: string;
  a: React.ReactNode;
}

const BUYER_FAQS: Faq[] = [
  {
    q: "When is my card charged?",
    a: "At checkout your card is only put on hold — nothing is charged. You're charged when the artisan fulfils your order or confirms your booking. If they can't, the hold is released and you never pay.",
  },
  {
    q: "How long does a card hold last?",
    a: "About 7 days. If the artisan hasn't acted by then, the hold expires on its own and you're not charged.",
  },
  {
    q: "Can I cancel?",
    a: (
      <>
        Orders can be cancelled until they're fulfilled, and pending bookings at any time, from{" "}
        <Link to="/profile-client" className="text-primary hover:underline">your account</Link>. A confirmed booking can be
        cancelled for a full refund until the cut-off shown on the booking.
      </>
    ),
  },
  {
    q: "What does delivery cost?",
    a: "Each artisan sets their own delivery fee, where they deliver, and sometimes free delivery above an amount. You see the exact fee before you pay, and a cart pays it once.",
  },
  {
    q: "Why can I only check out one shop at a time?",
    a: "Each payment goes to a single artisan. Check out one shop's items, then the next.",
  },
  {
    q: "Something went wrong with my order or booking",
    a: (
      <>
        Message the artisan first — most problems are solved that way. If not, open a dispute from the order or booking in{" "}
        <Link to="/profile-client" className="text-primary hover:underline">your account</Link>; our team reviews it and emails
        you both with the outcome.
      </>
    ),
  },
  {
    q: "Why do I need to confirm my email?",
    a: "So artisans know orders and messages come from a real person, and so we can reach you about your purchases. Use the link we emailed you, or send a new one from the banner at the top of the page.",
  },
];

const ARTISAN_FAQS: Faq[] = [
  {
    q: "How do I start selling?",
    a: (
      <>
        Create an account as an artisan, then set up your shop: details and logo, your first products or services, photos,
        and payouts with Stripe. Your dashboard has a checklist. Our team approves new shops before they appear publicly.
      </>
    ),
  },
  {
    q: "How and when do I get paid?",
    a: "When you fulfil an order or confirm a booking, the client's card is charged and the money goes to your Stripe account, minus the platform commission. Stripe then pays out to your bank on its usual schedule. Your Earnings tab shows every sale and links to your Stripe dashboard.",
  },
  {
    q: "How do bookings work?",
    a: "Set your opening hours and time zone on the Services tab and clients pick from your free time slots. Without hours, clients request any time and you confirm or decline each request.",
  },
  {
    q: "How do I set delivery options?",
    a: "On the Products tab: choose pickup, delivery or both, your delivery fee, an optional free-delivery threshold and where you deliver.",
  },
  {
    q: "Can I reply to reviews?",
    a: "Yes — open your shop page and use “Reply publicly” under any review. The client is notified.",
  },
];

function FaqList({ title, faqs }: { title: string; faqs: Faq[] }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
        {faqs.map((faq) => (
          <details key={faq.q} className="group px-5 py-4">
            <summary className="cursor-pointer list-none font-medium marker:hidden">
              <span className="flex items-center justify-between gap-4">
                {faq.q}
                <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </span>
            </summary>
            <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

const TOPICS = [
  { value: "order", label: "An order" },
  { value: "booking", label: "A booking" },
  { value: "selling", label: "Selling on Artisan Market" },
  { value: "account", label: "My account" },
  { value: "other", label: "Something else" },
];

function ContactForm() {
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [topic, setTopic] = useState("order");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // spam trap, hidden from people
  const send = useMutation({
    mutationFn: () =>
      api.post<{ message: string }>("/support/contact", { name, email, topic, message, website }).then((r) => r.data),
  });

  if (send.isSuccess) {
    return (
      <div className="surface flex gap-4 p-5">
        <CheckCircle2 className="size-6 shrink-0 text-jade-500" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-muted-foreground">{send.data.message}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send.mutate();
      }}
      className="surface space-y-4 p-6"
    >
      {send.isError && <p className="alert-error">{getErrorMessage(send.error, "Your message couldn't be sent.")}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="field-label">Your name</label>
          <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
        </div>
        <div>
          <label htmlFor="contact-email" className="field-label">Email (we reply here)</label>
          <Input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
      </div>
      <div>
        <label htmlFor="contact-topic" className="field-label">It's about</label>
        <select
          id="contact-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-72"
        >
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="contact-message" className="field-label">Message</label>
        <Textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          minLength={10}
          maxLength={5000}
          placeholder="Include an order number or shop name if it's about one."
          required
        />
      </div>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <Button type="submit" disabled={send.isPending}>
        {send.isPending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}

export default function HelpPage() {
  return (
    <main className="page-shell max-w-3xl space-y-12 py-12">
      <PageMeta title="Help & contact" description="Answers about payments, delivery, bookings and selling on Artisan Market — and how to reach us." />
      <header>
        <span className="eyebrow">Help center</span>
        <h1 className="mt-3 font-display text-4xl font-semibold">How can we help?</h1>
        <p className="mt-2 text-muted-foreground">
          Answers to common questions — and a way to reach us if yours isn't here.
        </p>
      </header>

      <FaqList title="Buying & booking" faqs={BUYER_FAQS} />
      <FaqList title="Selling" faqs={ARTISAN_FAQS} />

      <section className="space-y-4" id="contact">
        <h2 className="font-display text-2xl font-semibold">Contact us</h2>
        <p className="text-sm text-muted-foreground">
          We usually reply within one working day. See also our{" "}
          <Link to="/refund-policy" className="text-primary hover:underline">refund policy</Link>.
        </p>
        <ContactForm />
      </section>
    </main>
  );
}

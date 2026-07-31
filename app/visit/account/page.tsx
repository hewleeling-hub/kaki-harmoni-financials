import type { Metadata } from "next";
import { PageHeader } from "@/components/visit/layout/PageHeader";
import { Card, Button, SectionHeading } from "@/components/visit/ui/primitives";
import { PromotionCard } from "@/components/visit/ui/cards";
import { Lotti } from "@/components/visit/ui/Lotti";
import {
  CalendarIcon,
  MessageIcon,
  GiftIcon,
  InfoIcon,
} from "@/components/visit/ui/icons";
import { businessConfig, promotions, whatsappLink } from "@/config/business";

export const metadata: Metadata = {
  title: "My Account",
  description:
    "Your Kaki Harmoni account — bookings, passes and promotions. Book a relaxing session anytime.",
};

export default function AccountPage() {
  return (
    <>
      <PageHeader
        title="My Account"
        subtitle="Your bookings, passes and little extras — all in one calm place."
        lotti="sitting"
      />

      {/* Upcoming — empty state (bookings are handled on WhatsApp for now) */}
      <section className="mt-8">
        <SectionHeading title="Upcoming visits" />
        <Card className="mt-4 flex flex-col items-center gap-3 bg-cream/60 py-10 text-center">
          <div className="w-24">
            <Lotti variant="sitting" className="h-auto w-full" />
          </div>
          <p className="max-w-sm text-[16px] leading-relaxed text-muted">
            You don&apos;t have any upcoming visits saved here yet. Bookings are
            confirmed on WhatsApp — book a session and we&apos;ll take care of the
            rest.
          </p>
          <div className="mt-1 flex flex-col gap-3 sm:flex-row">
            <Button href="/visit/book" icon={<CalendarIcon size={20} />}>
              Book a Session
            </Button>
            <Button
              href={whatsappLink("Hi Kaki Harmoni, I'd like to check my booking.")}
              variant="secondary"
              icon={<MessageIcon size={20} />}
            >
              WhatsApp Us
            </Button>
          </div>
        </Card>
      </section>

      {/* Promotions */}
      <section className="mt-12">
        <SectionHeading eyebrow="For you" title="Promotions" />
        <div className="mt-4 space-y-4">
          {promotions.map((promo) => (
            <PromotionCard key={promo.id} promo={promo} />
          ))}
        </div>
      </section>

      {/* Passes */}
      <section className="mt-12">
        <SectionHeading eyebrow="Save more" title="Session passes" />
        <Card className="mt-4 flex items-start gap-3 bg-ivory">
          <span className="mt-0.5 text-olive">
            <GiftIcon size={24} />
          </span>
          <div className="flex-1">
            <p className="text-[16px] leading-relaxed text-brown">
              Buy a 5 or 10-session pass and save on every visit. Ask our team in
              store or on WhatsApp to set one up.
            </p>
            <Button href="/visit/sessions#promotions" variant="secondary" className="mt-4">
              View Passes
            </Button>
          </div>
        </Card>
      </section>

      {/* Contact / help */}
      <section className="mt-12">
        <SectionHeading title="Need a hand?" />
        <Card className="mt-4 flex items-start gap-3 bg-cream/60">
          <span className="mt-0.5 text-olive">
            <InfoIcon size={24} />
          </span>
          <div>
            <p className="text-[16px] leading-relaxed text-brown">
              For bookings, passes or any questions, message us on WhatsApp at{" "}
              <span className="font-semibold text-olive-dark">
                {businessConfig.phone}
              </span>{" "}
              — we&apos;re happy to help.
            </p>
            <Button
              href={whatsappLink("Hi Kaki Harmoni, I have a question.")}
              className="mt-4"
              icon={<MessageIcon size={20} />}
            >
              WhatsApp Us
            </Button>
          </div>
        </Card>
      </section>

      <p className="mt-10 text-center text-[13px] text-muted">
        Accounts &amp; saved booking history are coming soon.
      </p>
    </>
  );
}

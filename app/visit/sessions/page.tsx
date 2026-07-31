import type { Metadata } from "next";
import { PageHeader } from "@/components/visit/layout/PageHeader";
import { SectionHeading, Button, Card } from "@/components/visit/ui/primitives";
import {
  PricingCard,
  SessionPassCard,
  PromotionCard,
} from "@/components/visit/ui/cards";
import { StickyBookCta } from "@/components/visit/ui/StickyBookCta";
import { CalendarIcon } from "@/components/visit/ui/icons";
import {
  businessConfig,
  promotions,
  sessionOptions,
} from "@/config/business";

export const metadata: Metadata = {
  title: "Sessions & Prices",
  description:
    "View Kaki Harmoni session options and prices — Single, Early Bird and Resident sessions, same-day offers and multi-session passes.",
};

export default function SessionsPage() {
  return (
    <>
      <PageHeader
        title="Sessions & Prices"
        subtitle="Choose the option that suits your day."
        lotti="waving"
      >
        <Button
          href="/visit/book"
          size="lg"
          icon={<CalendarIcon size={22} />}
          className="hidden sm:inline-flex"
        >
          Book a Session
        </Button>
      </PageHeader>

      {/* Session prices */}
      <section className="mt-8">
        <div className="grid gap-5 sm:grid-cols-3">
          {sessionOptions.map((option, i) => (
            <PricingCard key={option.id} option={option} featured={i === 1} />
          ))}
        </div>

        {/* Same-day second session */}
        <div className="mt-5">
          <Card className="flex flex-col items-start gap-3 bg-[linear-gradient(150deg,#FBEFD6_0%,#F3E3C4_100%)] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-[20px] text-olive-dark">
                Same-Day Second Session
              </h3>
              <p className="mt-1 text-[16px] text-brown">
                Enjoy a second session on the same day at half price.
              </p>
            </div>
            <span
              className="text-3xl font-bold text-[#7a5410]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              50% off
            </span>
          </Card>
          <p className="mt-2 px-1 text-[14px] text-muted">
            Terms: one discounted second session per person, per day. Available
            in-store during opening hours.
          </p>
        </div>
      </section>

      {/* Passes */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Session passes"
          title="Relax more, enjoy more"
          subtitle="Save with a multi-session pass — perfect for regular visits."
        />
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {businessConfig.passes.map((pass) => (
            <SessionPassCard
              key={pass.id}
              name={pass.name}
              price={pass.price}
              validity={pass.validity}
              savings={pass.savings}
            />
          ))}
        </div>
        <p className="mt-3 px-1 text-[14px] text-muted">
          More passes coming soon. Ask our team about options that suit you.
        </p>
      </section>

      {/* Promotions */}
      <section id="promotions" className="mt-12 scroll-mt-24">
        <SectionHeading eyebrow="Promotions" title="Little extras to enjoy" />
        <div className="mt-6 space-y-4">
          {promotions.map((promo) => (
            <PromotionCard key={promo.id} promo={promo} />
          ))}
        </div>
      </section>

      {/* Desktop booking CTA after pricing */}
      <section className="mt-12 hidden justify-center lg:flex">
        <Button href="/visit/book" size="lg" icon={<CalendarIcon size={22} />}>
          Book a Session
        </Button>
      </section>

      <StickyBookCta />
    </>
  );
}

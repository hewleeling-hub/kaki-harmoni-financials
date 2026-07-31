import type { Metadata } from "next";
import { PageHeader } from "@/components/visit/layout/PageHeader";
import { SectionHeading, Card, Button } from "@/components/visit/ui/primitives";
import { StepCard } from "@/components/visit/ui/cards";
import { FAQAccordion } from "@/components/visit/ui/FAQAccordion";
import {
  CheckIcon,
  CalendarIcon,
  UsersIcon,
  CoffeeIcon,
  HeartIcon,
  MessageIcon,
} from "@/components/visit/ui/icons";
import { faqs, goodToKnow, visitSteps } from "@/config/business";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "Your simple, relaxing visit to Kaki Harmoni from start to finish — check in, choose a drink, enjoy a warm 15-minute leg soak, and reconnect.",
};

const STEP_ICONS = {
  users: UsersIcon,
  coffee: CoffeeIcon,
  heart: HeartIcon,
  message: MessageIcon,
} as const;

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        title="How It Works"
        subtitle="Your simple, relaxing visit from start to finish."
        lotti="sitting"
      />

      {/* Four-step journey */}
      <section className="mt-8 space-y-4">
        {visitSteps.map((step, i) => {
          const Icon = STEP_ICONS[step.icon as keyof typeof STEP_ICONS];
          return (
            <StepCard
              key={step.number}
              number={step.number}
              title={step.title}
              description={step.long}
              icon={<Icon size={28} />}
              align={i % 2 === 1 ? "right" : "left"}
            />
          );
        })}
      </section>

      {/* Good to know */}
      <section className="mt-12">
        <SectionHeading title="Good to know before you visit" />
        <Card className="mt-5 bg-cream/60">
          <ul className="grid gap-3 sm:grid-cols-2">
            {goodToKnow.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[16px] text-brown">
                <CheckIcon size={20} className="mt-0.5 shrink-0 text-success" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* FAQ */}
      <section className="mt-12">
        <SectionHeading title="Frequently asked questions" />
        <div className="mt-5">
          <FAQAccordion items={faqs} />
        </div>
      </section>

      {/* CTA */}
      <section className="mt-12 flex flex-col items-center gap-3 rounded-[24px] border border-line bg-beige/50 p-8 text-center">
        <h2 className="text-[26px] text-olive-dark">Ready when you are</h2>
        <p className="max-w-md text-[17px] text-brown">
          Book a session or simply walk in during opening hours.
        </p>
        <Button href="/visit/book" size="lg" icon={<CalendarIcon size={22} />}>
          Book a Session
        </Button>
      </section>
    </>
  );
}

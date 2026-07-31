import { Button, SectionHeading } from "@/components/visit/ui/primitives";
import { PricingCard, PromotionCard } from "@/components/visit/ui/cards";
import { ArrowRightIcon } from "@/components/visit/ui/icons";
import { promotions, sessionOptions } from "@/config/business";

export function PricingPreview() {
  return (
    <section className="py-10">
      <SectionHeading
        center
        eyebrow="Sessions & prices"
        title="Choose the option that suits your day"
      />
      <div className="mx-auto mt-8 grid max-w-4xl gap-5 sm:grid-cols-3">
        {sessionOptions.map((option, i) => (
          <PricingCard key={option.id} option={option} featured={i === 1} />
        ))}
      </div>
      <div className="mx-auto mt-5 max-w-4xl">
        <PromotionCard promo={promotions[0]} />
      </div>
      <div className="mt-8 flex justify-center">
        <Button
          href="/visit/sessions"
          variant="secondary"
          iconRight={<ArrowRightIcon size={20} />}
        >
          View Sessions & Prices
        </Button>
      </div>
    </section>
  );
}

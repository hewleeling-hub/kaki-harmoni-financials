import type { ReactNode } from "react";
import { Badge, Button, Card } from "./primitives";
import { ArrowRightIcon, CheckIcon } from "./icons";
import type { Promotion, SessionOption } from "@/config/business";

/* --------------------------- PricingCard --------------------------- */

export function PricingCard({
  option,
  ctaHref = "/visit/book",
  ctaLabel = "Book This Session",
  featured,
}: {
  option: SessionOption;
  ctaHref?: string;
  ctaLabel?: string;
  featured?: boolean;
}) {
  return (
    <Card
      className={`flex flex-col ${
        featured ? "ring-2 ring-olive/60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[20px] text-olive-dark">{option.name}</h3>
        {option.badge && <Badge tone="gold">{option.badge}</Badge>}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-olive" style={{ fontFamily: "var(--font-heading)" }}>
          RM{option.price}
        </span>
        <span className="text-sm text-muted">{option.unit}</span>
      </div>
      <p className="mt-3 flex-1 text-[16px] leading-relaxed text-muted">
        {option.description}
      </p>
      <Button href={`${ctaHref}?session=${option.id}`} full className="mt-5" iconRight={<ArrowRightIcon size={20} />}>
        {ctaLabel}
      </Button>
    </Card>
  );
}

/* -------------------------- SessionPassCard ------------------------ */

export function SessionPassCard({
  name,
  price,
  validity,
  savings,
}: {
  name: string;
  price: number;
  validity: string;
  savings: number;
}) {
  return (
    <Card className="flex flex-col bg-[linear-gradient(160deg,#FFFDF8_0%,#F3EAD8_100%)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[20px] text-olive-dark">{name}</h3>
        <Badge tone="sage">Save RM{savings}</Badge>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-olive" style={{ fontFamily: "var(--font-heading)" }}>
          RM{price}
        </span>
      </div>
      <p className="mt-2 flex items-center gap-2 text-[15px] text-muted">
        <CheckIcon size={18} className="text-success" />
        {validity}
      </p>
      <Button
        href={`/visit/book?pass=${encodeURIComponent(name)}`}
        variant="secondary"
        full
        className="mt-5"
      >
        Choose This Pass
      </Button>
    </Card>
  );
}

/* ----------------------------- StepCard ---------------------------- */

export function StepCard({
  number,
  title,
  description,
  icon,
  align = "left",
}: {
  number: number;
  title: string;
  description: string;
  icon?: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-[22px] border border-line bg-beige/40 p-6 shadow-[var(--shadow-warm)] sm:flex-row sm:items-center ${
        align === "right" ? "sm:flex-row-reverse sm:text-right" : ""
      }`}
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-olive text-ivory">
        {icon ?? <span className="text-2xl font-bold">{number}</span>}
      </div>
      <div>
        <div className="flex items-center gap-2" style={align === "right" ? { justifyContent: "flex-end" } : undefined}>
          <span className="text-sm font-bold uppercase tracking-wide text-olive">
            Step {number}
          </span>
        </div>
        <h3 className="mt-1 text-[20px] text-olive-dark">{title}</h3>
        <p className="mt-1 text-[16px] leading-relaxed text-muted">{description}</p>
      </div>
    </div>
  );
}

/* -------------------------- PromotionCard -------------------------- */

export function PromotionCard({ promo }: { promo: Promotion }) {
  return (
    <div className="rounded-[22px] border border-gold/40 bg-[linear-gradient(150deg,#FBEFD6_0%,#F3E3C4_100%)] p-6 shadow-[var(--shadow-warm)]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-3xl font-bold text-[#7a5410]" style={{ fontFamily: "var(--font-heading)" }}>
          {promo.highlight}
        </span>
        <h3 className="text-[20px] text-olive-dark">{promo.title}</h3>
      </div>
      <p className="mt-2 text-[16px] leading-relaxed text-brown">{promo.description}</p>
      {promo.terms && (
        <p className="mt-3 text-[14px] text-muted">{promo.terms}</p>
      )}
    </div>
  );
}

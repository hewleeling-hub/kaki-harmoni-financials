import { Button, SectionHeading } from "@/components/visit/ui/primitives";
import {
  ArrowRightIcon,
  UsersIcon,
  CoffeeIcon,
  HeartIcon,
  MessageIcon,
} from "@/components/visit/ui/icons";
import { visitSteps } from "@/config/business";

const STEP_ICONS = {
  users: UsersIcon,
  coffee: CoffeeIcon,
  heart: HeartIcon,
  message: MessageIcon,
} as const;

export function HowItWorksPreview() {
  return (
    <section className="py-10">
      <SectionHeading
        center
        eyebrow="Your relaxing visit"
        title="Four simple steps to unwind"
      />
      <ol className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visitSteps.map((step) => {
          const Icon = STEP_ICONS[step.icon as keyof typeof STEP_ICONS];
          return (
            <li
              key={step.number}
              className="rounded-[22px] border border-line bg-ivory p-5 text-center shadow-[var(--shadow-warm)]"
            >
              <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage/50 text-olive-dark">
                <Icon size={26} />
                <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-olive text-xs font-bold text-ivory">
                  {step.number}
                </span>
              </div>
              <h3 className="mt-3 text-[18px] text-olive-dark">{step.title}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">{step.short}</p>
            </li>
          );
        })}
      </ol>
      <div className="mt-8 flex justify-center">
        <Button
          href="/visit/how-it-works"
          variant="secondary"
          iconRight={<ArrowRightIcon size={20} />}
        >
          See How It Works
        </Button>
      </div>
    </section>
  );
}

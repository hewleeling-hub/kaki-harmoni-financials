import { Card } from "@/components/visit/ui/primitives";
import { ClockIcon, HeartIcon, CoffeeIcon } from "@/components/visit/ui/icons";

const BENEFITS = [
  {
    icon: ClockIcon,
    title: "15-Minute Session",
    text: "A simple break that fits into your day.",
  },
  {
    icon: HeartIcon,
    title: "Comfortable & Gentle",
    text: "Sit back and enjoy a warm, relaxing soak.",
  },
  {
    icon: CoffeeIcon,
    title: "Coffee & Conversation",
    text: "Relax alone or reconnect with someone you care about.",
  },
];

export function BenefitStrip() {
  return (
    <section className="grid gap-4 py-6 sm:grid-cols-3 sm:gap-5">
      {BENEFITS.map(({ icon: Icon, title, text }) => (
        <Card key={title} className="bg-cream/60 text-center sm:text-left">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-olive/12 text-olive">
            <Icon size={26} />
          </span>
          <h3 className="mt-4 text-[18px] text-olive-dark">{title}</h3>
          <p className="mt-1.5 text-[16px] leading-relaxed text-muted">{text}</p>
        </Card>
      ))}
    </section>
  );
}

import { Button } from "@/components/visit/ui/primitives";
import { CalendarIcon, MapPinIcon } from "@/components/visit/ui/icons";
import { Lotti } from "@/components/visit/ui/Lotti";
import { businessConfig } from "@/config/business";

export function Hero() {
  return (
    <section className="fade-up grid items-center gap-8 py-8 sm:py-10 lg:grid-cols-2 lg:gap-12 lg:py-16">
      {/* Copy */}
      <div className="order-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-olive">
          {businessConfig.tagline}
        </p>
        <h1 className="mt-4 text-[34px] leading-[1.1] text-olive-dark sm:text-[44px] lg:text-[52px]">
          Slow down.
          <br />
          Soak. Smile.
          <br />
          <span className="text-olive">Reconnect.</span>
        </h1>
        <p className="mt-5 max-w-md text-[18px] leading-relaxed text-muted">
          A cosy space for a warm leg soak, good coffee and great company.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button href="/visit/book" size="lg" icon={<CalendarIcon size={22} />}>
            Book a Session
          </Button>
          <Button
            href="/visit/find-us"
            variant="secondary"
            size="lg"
            icon={<MapPinIcon size={22} />}
          >
            Find Us
          </Button>
        </div>
      </div>

      {/* Illustration */}
      <div className="order-2 flex justify-center">
        <div className="relative w-full max-w-md">
          <div className="rounded-[28px] bg-[radial-gradient(circle_at_60%_35%,#EFD6BD_0%,#F7F0E3_70%)] p-4 shadow-[var(--shadow-warm)]">
            <Lotti variant="sitting" className="h-auto w-full" />
          </div>
          {/* handwritten-style message near Lotti */}
          <div className="absolute -bottom-4 left-2 max-w-[220px] rotate-[-3deg] rounded-[18px] rounded-bl-sm border border-line bg-ivory px-4 py-2 shadow-[var(--shadow-warm)] sm:left-6">
            <p
              className="text-[16px] italic leading-snug text-brown"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Hi, I&apos;m Lotti! Let&apos;s relax together.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

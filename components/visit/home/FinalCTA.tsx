import { Button } from "@/components/visit/ui/primitives";
import { CalendarIcon, MessageIcon } from "@/components/visit/ui/icons";
import { Lotti } from "@/components/visit/ui/Lotti";
import { whatsappLink } from "@/config/business";

export function FinalCTA() {
  return (
    <section className="py-10">
      <div className="relative overflow-hidden rounded-[24px] border border-line bg-beige p-8 shadow-[var(--shadow-warm)] sm:p-10">
        <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
          <div>
            <h2 className="text-[28px] text-olive-dark sm:text-[32px]">
              Ready for a little break?
            </h2>
            <p className="mt-3 max-w-lg text-[18px] leading-relaxed text-brown">
              Book your session and take 15 minutes to relax, refresh and
              reconnect.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button href="/visit/book" size="lg" icon={<CalendarIcon size={22} />}>
                Book a Session
              </Button>
              <Button
                href={whatsappLink("Hi Kaki Harmoni, I'd like to ask about a session.")}
                variant="secondary"
                size="lg"
                icon={<MessageIcon size={22} />}
              >
                WhatsApp Us
              </Button>
            </div>
          </div>
          <div className="hidden w-40 justify-self-end sm:block">
            <Lotti variant="waving" className="h-auto w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}

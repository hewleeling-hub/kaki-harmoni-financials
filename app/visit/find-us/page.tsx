import type { Metadata } from "next";
import { PageHeader } from "@/components/visit/layout/PageHeader";
import { Card, Button, SectionHeading } from "@/components/visit/ui/primitives";
import { OpenStatus } from "@/components/visit/ui/OpenStatus";
import {
  MapPinIcon,
  NavigationIcon,
  MessageIcon,
  PhoneIcon,
  ClockIcon,
  InfoIcon,
} from "@/components/visit/ui/icons";
import {
  businessConfig,
  directionsLink,
  mapEmbedSrc,
  telLink,
  whatsappLink,
} from "@/config/business";

export const metadata: Metadata = {
  title: "Visit Kaki Harmoni | Location & Opening Hours",
  description:
    "Find Kaki Harmoni in Kuala Lumpur. Get directions, opening hours and contact details for a warm leg soak, a quiet break and a friendly cup of coffee.",
};

const VISIT_INFO = [
  { label: "Parking", value: "Parking details to be confirmed — please check on arrival." },
  { label: "Entrance", value: "Located at the condominium clubhouse. Entrance details to be confirmed." },
  { label: "Accessibility", value: "Accessibility details to be confirmed. Let our team know if you need assistance." },
  { label: "Booking", value: "Booking is not required — walk in anytime, or book ahead to be sure of a chair." },
];

export default function FindUsPage() {
  const { address, openingHours, phone } = businessConfig;

  return (
    <>
      <PageHeader
        title="Find Us"
        subtitle="Come by for a warm soak, a quiet break and a friendly cup of coffee."
        lotti="sitting"
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Location + actions */}
        <Card className="flex flex-col">
          <div className="flex items-start gap-3">
            <span className="mt-1 text-olive">
              <MapPinIcon size={26} />
            </span>
            <div>
              <h2 className="text-[22px] text-olive-dark">{address.name}</h2>
              <address className="mt-1 not-italic text-[16px] leading-relaxed text-muted">
                {address.lines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Button href={directionsLink} icon={<NavigationIcon size={20} />} full>
              Get Directions
            </Button>
            <Button
              href={whatsappLink("Hi Kaki Harmoni, I'd like to visit — could you share directions?")}
              variant="secondary"
              icon={<MessageIcon size={20} />}
              full
            >
              WhatsApp Us
            </Button>
            <Button href={telLink} variant="secondary" icon={<PhoneIcon size={20} />} full>
              Call
            </Button>
          </div>
          <p className="mt-3 text-[14px] text-muted">{phone}</p>
        </Card>

        {/* Opening hours */}
        <Card className="flex flex-col bg-cream/60">
          <div className="flex items-center gap-3">
            <span className="text-olive">
              <ClockIcon size={26} />
            </span>
            <h2 className="text-[22px] text-olive-dark">Opening hours</h2>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-[16px] border border-line bg-ivory px-4 py-3">
            <div>
              <p className="text-[17px] font-semibold text-olive-dark">
                {openingHours.label}
              </p>
              <p className="text-[16px] text-muted">{openingHours.display}</p>
            </div>
            <OpenStatus />
          </div>
          <p className="mt-3 text-[14px] text-muted">
            Times shown for Malaysia (Kuala Lumpur).
          </p>
        </Card>
      </div>

      {/* Map */}
      <section className="mt-6">
        <div className="overflow-hidden rounded-[24px] border border-line shadow-[var(--shadow-warm)]">
          <iframe
            title={`Map showing ${address.name}`}
            src={mapEmbedSrc}
            className="h-[320px] w-full sm:h-[380px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>

      {/* Visit information */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Good to know"
          title="Planning your visit"
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {VISIT_INFO.map((info) => (
            <Card key={info.label} className="flex items-start gap-3 bg-ivory">
              <span className="mt-0.5 text-olive">
                <InfoIcon size={22} />
              </span>
              <div>
                <h3 className="text-[17px] font-semibold text-olive-dark">
                  {info.label}
                </h3>
                <p className="mt-1 text-[15px] leading-relaxed text-muted">
                  {info.value}
                </p>
              </div>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-[13px] italic text-muted">
          Some details above are placeholders and will be confirmed soon.
        </p>
      </section>
    </>
  );
}

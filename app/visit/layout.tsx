import type { Metadata } from "next";
import { DesktopNav } from "@/components/visit/layout/DesktopNav";
import { MobileHeader } from "@/components/visit/layout/MobileHeader";
import { MobileBottomNav } from "@/components/visit/layout/MobileBottomNav";
import { businessConfig } from "@/config/business";

export const metadata: Metadata = {
  title: {
    default: "Kaki Harmoni | Relax, Refresh & Reconnect",
    template: "%s | Kaki Harmoni",
  },
  description:
    "Enjoy a comfortable warm leg soak, coffee and a quiet moment at Kaki Harmoni in Kuala Lumpur. View sessions, prices and booking information.",
  openGraph: {
    title: "Kaki Harmoni | Relax, Refresh & Reconnect",
    description:
      "A cosy space for a warm leg soak, good coffee and great company in Kuala Lumpur.",
    type: "website",
  },
};

export default function VisitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="visit-scope min-h-screen bg-cream text-ink">
      <DesktopNav />
      <MobileHeader />
      {/* pb leaves room for the mobile bottom nav; cleared on desktop */}
      <main className="mx-auto max-w-[1200px] px-[18px] pb-28 pt-2 sm:px-8 lg:px-10 lg:pb-16">
        {children}
      </main>
      <MobileBottomNav />
      {/* Local business structured data (no medical claims). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CafeOrCoffeeShop",
            name: businessConfig.name,
            slogan: businessConfig.tagline,
            telephone: businessConfig.phone,
            address: {
              "@type": "PostalAddress",
              streetAddress: businessConfig.address.lines[0],
              addressLocality: "Kuala Lumpur",
              postalCode: "58200",
              addressCountry: "MY",
            },
            openingHours: "Mo-Su 10:00-20:00",
          }),
        }}
      />
    </div>
  );
}

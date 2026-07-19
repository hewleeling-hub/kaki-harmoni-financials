import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Kaki Harmoni Financials",
  description:
    "Counter POS + bookkeeping for a 4-chair foot-spa café — chairs, sales, expenses, daily cashflow.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-neutral-50 text-neutral-900 min-h-screen">
        <ServiceWorkerRegister />
        <OfflineBanner />
        <NavBar />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { DM_Serif_Display, Inter } from "next/font/google";
import "./globals.css";
import { AppFrame } from "@/components/AppFrame";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dm-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  // Staff app default; the customer site (/visit) sets its own metadata.
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
    <html lang="en" className={`${dmSerif.variable} ${inter.variable}`}>
      <body className="antialiased min-h-screen">
        <ServiceWorkerRegister />
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}

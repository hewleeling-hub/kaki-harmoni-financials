"use client";

import { usePathname } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { OfflineBanner } from "@/components/OfflineBanner";

/**
 * Chooses the app chrome by route:
 *  - /visit/*  → renders children bare; the customer layout supplies its own
 *                warm header + bottom nav.
 *  - everything else → the existing staff bookkeeping chrome (unchanged).
 */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname?.startsWith("/visit")) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#1F2937]">
      <OfflineBanner />
      <NavBar />
      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}

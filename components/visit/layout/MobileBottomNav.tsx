"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mobileNav } from "@/config/navigation";
import { NAV_ICONS } from "@/components/visit/ui/icons";

/** Sticky bottom tab bar for mobile/tablet (hidden on lg). */
export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto mb-2 max-w-md px-3">
        <ul className="flex items-stretch justify-around rounded-[30px] border border-line bg-ivory/95 px-2 py-1.5 shadow-[var(--shadow-warm-lg)] backdrop-blur">
          {mobileNav.map((item) => {
            const base = item.href.split("#")[0];
            const active =
              base === "/visit"
                ? pathname === "/visit"
                : pathname.startsWith(base);
            const Icon = NAV_ICONS[item.icon];
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-[24px] px-1 py-1 text-[12px] font-medium transition ${
                    active ? "text-olive" : "text-brown/70"
                  }`}
                >
                  <span
                    className={`flex h-8 w-full max-w-[64px] items-center justify-center rounded-full transition ${
                      active ? "bg-olive/12" : ""
                    }`}
                  >
                    <Icon size={22} />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

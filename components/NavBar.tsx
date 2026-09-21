"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Fourteen links no longer fit on one line, and a link you have to scroll
// sideways to find is a link nobody finds. So they're grouped by what you're
// doing — the floor, the paperwork, the books — and the row wraps on a wide
// screen instead of running off the edge. Narrow screens keep the single
// scrolling row, where a wrapped nav would eat half the screen.
const GROUPS: { href: string; label: string }[][] = [
  [
    { href: "/dashboard", label: "Financial Model" },
    { href: "/", label: "Chair Board" },
    { href: "/sessions", label: "Sessions" },
    { href: "/sales", label: "Sales" },
    { href: "/products", label: "Products" },
  ],
  [
    { href: "/stock-take", label: "Stock Take" },
    { href: "/expenses", label: "Purchases" },
    { href: "/reimbursements", label: "Reimbursements" },
    { href: "/notes", label: "Notes" },
  ],
  [
    { href: "/accounts", label: "Accounts" },
    { href: "/ledger", label: "Ledger" },
    { href: "/amortisation", label: "Amortisation" },
    { href: "/budget", label: "Budget" },
    { href: "/reports", label: "Reports" },
  ],
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-[1280px] px-4">
        <div className="flex items-start gap-2 overflow-x-auto py-3 md:overflow-x-visible">
          <Link
            href="/dashboard"
            className="mr-3 shrink-0 py-2 font-serif text-lg font-bold tracking-tight"
            aria-label="Kaki Harmoni"
          >
            <span style={{ color: "#1F5A5E" }}>Kaki</span>{" "}
            <span style={{ color: "#D2825E" }}>
              Harm<span aria-hidden="true">♥</span>ni
            </span>
          </Link>
          <nav className="flex items-center gap-1 md:flex-wrap">
            {GROUPS.map((group, gi) => (
              <div key={gi} className="flex items-center gap-1">
                {gi > 0 && (
                  <span
                    aria-hidden="true"
                    className="mx-1 hidden h-5 w-px shrink-0 bg-neutral-200 md:block"
                  />
                )}
                {group.map((l) => {
                  const active =
                    l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "bg-neutral-900 text-white"
                          : "text-neutral-600 hover:bg-neutral-100"
                      }`}
                    >
                      {l.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Financial Model" },
  { href: "/", label: "Chair Board" },
  { href: "/sessions", label: "Sessions" },
  { href: "/sales", label: "Sales" },
  { href: "/products", label: "Products" },
  { href: "/expenses", label: "Purchases" },
  { href: "/reimbursements", label: "Reimbursements" },
  { href: "/accounts", label: "Accounts" },
  { href: "/ledger", label: "Ledger" },
  { href: "/budget", label: "Budget" },
  { href: "/reports", label: "Reports" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center gap-2 py-3 overflow-x-auto">
          <Link
            href="/dashboard"
            className="mr-3 shrink-0 font-serif text-lg font-bold tracking-tight"
            aria-label="Kaki Harmoni"
          >
            <span style={{ color: "#1F5A5E" }}>Kaki</span>{" "}
            <span style={{ color: "#D2825E" }}>
              Harm<span aria-hidden="true">♥</span>ni
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {LINKS.map((l) => {
              const active =
                l.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(l.href);
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
          </nav>
        </div>
      </div>
    </header>
  );
}

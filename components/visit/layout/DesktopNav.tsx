"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { desktopNav } from "@/config/navigation";
import { Button } from "@/components/visit/ui/primitives";
import { CalendarIcon, UserIcon } from "@/components/visit/ui/icons";
import { Wordmark } from "./Wordmark";

/** Desktop top navigation bar (hidden below lg). */
export function DesktopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 hidden border-b border-line bg-cream/90 backdrop-blur lg:block">
      <div className="mx-auto flex max-w-[1200px] items-center gap-6 px-8 py-3 xl:px-10">
        <Wordmark />
        <nav className="flex items-center gap-1" aria-label="Main">
          {desktopNav.map((item) => {
            const base = item.href.split("#")[0];
            const active =
              base === "/visit"
                ? pathname === "/visit"
                : pathname.startsWith(base);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3.5 py-2 text-[15px] font-medium transition ${
                  active
                    ? "bg-olive/12 text-olive-dark"
                    : "text-muted hover:bg-beige/50 hover:text-olive-dark"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/visit/account"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-medium text-muted transition hover:bg-beige/50 hover:text-olive-dark"
          >
            <UserIcon size={20} /> My Account
          </Link>
          <Button href="/visit/book" size="md" icon={<CalendarIcon size={20} />}>
            Book a Session
          </Button>
        </div>
      </div>
    </header>
  );
}

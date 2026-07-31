import type { ReactNode } from "react";
import { Lotti } from "@/components/visit/ui/Lotti";

type LottiVariant = "sitting" | "waving" | "celebrating";

/** Warm page header used across the customer sub-pages. */
export function PageHeader({
  title,
  subtitle,
  lotti,
  children,
}: {
  title: string;
  subtitle?: string;
  lotti?: LottiVariant;
  children?: ReactNode;
}) {
  return (
    <header className="fade-up mt-4 rounded-[24px] border border-line bg-[radial-gradient(circle_at_85%_20%,#EFD6BD_0%,#FFFDF8_70%)] p-6 shadow-[var(--shadow-warm)] sm:p-8">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-[30px] leading-tight text-olive-dark sm:text-[38px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-xl text-[18px] leading-relaxed text-muted">
              {subtitle}
            </p>
          )}
        </div>
        {lotti && (
          <div className="hidden w-24 shrink-0 sm:block">
            <Lotti variant={lotti} className="h-auto w-full" />
          </div>
        )}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </header>
  );
}

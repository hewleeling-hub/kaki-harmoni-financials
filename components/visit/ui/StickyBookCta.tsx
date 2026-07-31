import { Button } from "./primitives";
import { CalendarIcon } from "./icons";

/**
 * Mobile-only sticky booking button. Sits just above the bottom tab bar so
 * booking is always one tap away on long pages. Hidden on desktop.
 */
export function StickyBookCta({ label = "Book a Session" }: { label?: string }) {
  return (
    <div
      className="fixed inset-x-0 bottom-[74px] z-20 px-4 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-md">
        <Button
          href="/visit/book"
          full
          size="lg"
          icon={<CalendarIcon size={22} />}
          className="shadow-[var(--shadow-warm-lg)]"
        >
          {label}
        </Button>
      </div>
    </div>
  );
}

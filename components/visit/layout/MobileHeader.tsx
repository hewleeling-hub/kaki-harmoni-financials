import { Wordmark } from "./Wordmark";
import { Button } from "@/components/visit/ui/primitives";
import { CalendarIcon } from "@/components/visit/ui/icons";

/** Compact top bar for mobile/tablet (hidden on lg where DesktopNav shows). */
export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-cream/95 px-4 py-2.5 backdrop-blur lg:hidden">
      <Wordmark />
      <Button
        href="/visit/book"
        size="md"
        className="ml-auto !min-h-11 !px-4 text-[15px]"
        icon={<CalendarIcon size={18} />}
      >
        Book
      </Button>
    </header>
  );
}

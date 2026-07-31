import type { Metadata } from "next";
import { PageHeader } from "@/components/visit/layout/PageHeader";
import { BookingForm } from "@/components/visit/booking/BookingForm";

export const metadata: Metadata = {
  title: "Book a Session",
  description:
    "Book your relaxing warm leg soak at Kaki Harmoni. Choose a session, pick a time and send your request — no account needed.",
};

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; pass?: string }>;
}) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader
        title="Book a Session"
        subtitle="Tell us when you'd like to visit — we'll confirm on WhatsApp. No account needed."
        lotti="waving"
      />
      <BookingForm initialSession={sp.session} passParam={sp.pass} />
    </>
  );
}

import { ExpenseForm } from "@/components/ExpenseForm";

export const dynamic = "force-dynamic";

// `?market=1` opens the form ready for a wet market trip — self-certified, with
// the slip column showing. Passed as a prop rather than read in the client so
// the form stays a plain component with no Suspense boundary to arrange.
export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string }>;
}) {
  const { market } = await searchParams;
  return <ExpenseForm market={market === "1"} />;
}

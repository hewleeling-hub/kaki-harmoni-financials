import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ExpenseForm } from "@/components/ExpenseForm";
import type { Expense } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .single();
  if (!data) notFound();
  return <ExpenseForm initial={data as Expense} />;
}

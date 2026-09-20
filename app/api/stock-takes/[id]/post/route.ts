import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowsForTake } from "@/lib/stockTakeServer";
import { postableRows, stockTakeProblems, totalConsumed } from "@/lib/stockTake";
import type { Account, StockTake, StockTakeLine } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/stock-takes/[id]/post — charge the consumed stock to cost of goods.
//
//   Dr  cost of goods (5xxx)   consumed
//       Cr  inventory (12xx)              consumed
//
// One pair per stock class, in a single month-end journal.
// Body: { accounts: { <stock_class>: "<cogs account code>" } } — required for
// any class whose cost-of-goods account isn't unambiguous.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const chosen = (body.accounts ?? {}) as Record<string, string>;

  const supabase = createAdminClient();

  const { data: takeRow } = await supabase
    .from("stock_takes")
    .select("*")
    .eq("id", id)
    .single();
  if (!takeRow)
    return NextResponse.json({ error: "Stock take not found." }, { status: 404 });
  const take = takeRow as StockTake;

  if (take.journal_id)
    return NextResponse.json(
      {
        error:
          "This take has already been posted. Reverse its journal in the Ledger if it needs changing.",
      },
      { status: 409 },
    );

  const { data: lineRows } = await supabase
    .from("stock_take_lines")
    .select("*")
    .eq("stock_take_id", id);
  const lines = (lineRows ?? []) as StockTakeLine[];

  const { rows } = await rowsForTake(supabase, take, lines);

  const problems = stockTakeProblems(rows);
  if (problems.length)
    return NextResponse.json(
      {
        error: problems
          .map((p) => `${p.stock_class.replace(/_/g, " ")}: ${p.message}`)
          .join(" "),
        problems,
      },
      { status: 400 },
    );

  const movers = postableRows(rows);
  if (!movers.length)
    return NextResponse.json(
      { error: "Nothing was consumed in this period — there is nothing to charge." },
      { status: 400 },
    );

  // Resolve the cost-of-goods account for each class: the suggestion where it
  // is unambiguous, otherwise whatever the user picked.
  const resolved = movers.map((r) => ({
    ...r,
    cogs: chosen[r.stock_class] || r.cogsAccount || null,
  }));
  const unresolved = resolved.filter((r) => !r.cogs);
  if (unresolved.length)
    return NextResponse.json(
      {
        error: `Choose a cost-of-goods account for: ${unresolved
          .map((r) => r.stock_class.replace(/_/g, " "))
          .join(", ")}.`,
        needsAccount: unresolved.map((r) => r.stock_class),
      },
      { status: 400 },
    );

  // Every account must be a real, active, postable leaf — same rule the manual
  // journal route enforces.
  const codes = [
    ...new Set(resolved.flatMap((r) => [r.cogs!, r.inventoryAccount!])),
  ];
  const { data: accs } = await supabase
    .from("accounts")
    .select("code, name, is_postable, is_active")
    .in("code", codes);
  const byCode = new Map(
    ((accs ?? []) as Pick<Account, "code" | "name" | "is_postable" | "is_active">[]).map(
      (a) => [a.code, a],
    ),
  );
  for (const code of codes) {
    const a = byCode.get(code);
    if (!a)
      return NextResponse.json({ error: `Account ${code} does not exist.` }, { status: 400 });
    if (!a.is_postable)
      return NextResponse.json(
        { error: `${code} is a header account — post to a leaf account.` },
        { status: 400 },
      );
    if (!a.is_active)
      return NextResponse.json({ error: `Account ${code} is inactive.` }, { status: 400 });
  }

  const { data: journal, error: jErr } = await supabase
    .from("journals")
    .insert({
      entry_date: take.take_date,
      memo: `Stock take ${take.take_date} — stock consumed charged to cost of goods`,
      reference: `STOCK-${take.take_date}`,
      source: "stock_take",
    })
    .select()
    .single();
  if (jErr || !journal)
    return NextResponse.json(
      { error: jErr?.message ?? "Could not create the journal." },
      { status: 400 },
    );

  // Debits first, then the matching credits, so the entry reads top to bottom.
  const journalLines = [
    ...resolved.map((r, i) => ({
      journal_id: journal.id,
      line_no: i + 1,
      account_code: r.cogs!,
      debit: r.consumed,
      credit: 0,
      memo: `${r.stock_class.replace(/_/g, " ")} consumed`,
    })),
    ...resolved.map((r, i) => ({
      journal_id: journal.id,
      line_no: resolved.length + i + 1,
      account_code: r.inventoryAccount!,
      debit: 0,
      credit: r.consumed,
      memo: `${r.stock_class.replace(/_/g, " ")} relieved`,
    })),
  ];

  const { error: lErr } = await supabase.from("journal_lines").insert(journalLines);
  if (lErr) {
    await supabase.from("journals").delete().eq("id", journal.id);
    return NextResponse.json({ error: lErr.message }, { status: 400 });
  }

  // Record which account each class went to, and mark the take posted.
  for (const r of resolved) {
    await supabase
      .from("stock_take_lines")
      .update({ cogs_account: r.cogs })
      .eq("stock_take_id", id)
      .eq("stock_class", r.stock_class);
  }
  await supabase
    .from("stock_takes")
    .update({ journal_id: journal.id, posted_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json(
    { journal, charged: totalConsumed(rows) },
    { status: 201 },
  );
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Account } from "@/lib/types";

export const dynamic = "force-dynamic";

// PATCH — edit an account. System-locked accounts allow only description +
// active-status changes (never code / type / normal balance).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const body = await req.json().catch(() => ({}));

  const { data: current } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .single();
  if (!current)
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  const acc = current as Account;

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim())
    patch.name = body.name.trim();
  if ("description" in body)
    patch.description = body.description ? String(body.description) : null;

  // Type / normal balance are locked on system accounts.
  if ("account_type" in body || "normal_balance" in body) {
    if (acc.system_locked)
      return NextResponse.json(
        { error: "This is a system-controlled account; its type is locked." },
        { status: 403 },
      );
    if (body.account_type) patch.account_type = body.account_type;
    if ("normal_balance" in body) patch.normal_balance = body.normal_balance;
    if (body.account_type)
      patch.is_postable = body.account_type !== "header";
  }

  if ("parent_code" in body) {
    const parent_code = body.parent_code ? String(body.parent_code) : null;
    if (parent_code) {
      const { data: p } = await supabase
        .from("accounts")
        .select("account_type")
        .eq("code", parent_code)
        .single();
      if (!p)
        return NextResponse.json(
          { error: `Parent ${parent_code} does not exist.` },
          { status: 400 },
        );
      if ((p as Account).account_type !== "header")
        return NextResponse.json(
          { error: `Parent ${parent_code} must be a header account.` },
          { status: 400 },
        );
    }
    patch.parent_code = parent_code;
  }

  let action = "updated";
  if ("is_active" in body && body.is_active !== acc.is_active) {
    patch.is_active = !!body.is_active;
    action = body.is_active ? "activated" : "deactivated";
  }

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ account: acc });

  patch.updated_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("accounts")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    const msg =
      error.code === "23505"
        ? "An account with that name already exists under this parent."
        : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await supabase.from("account_audit").insert({
    account_id: id,
    account_code: acc.code,
    action,
    detail: patch,
  });

  return NextResponse.json({ account: data as Account });
}

// DELETE — blocked for system-locked accounts and headers with children.
// (A future ledger will also block accounts that carry transactions.)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: current } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .single();
  if (!current)
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  const acc = current as Account;

  async function blocked(reason: string) {
    await supabase.from("account_audit").insert({
      account_id: id,
      account_code: acc.code,
      action: "delete_blocked",
      detail: { reason },
    });
    return NextResponse.json({ error: reason }, { status: 409 });
  }

  if (acc.system_locked)
    return blocked("System-controlled accounts cannot be deleted. Deactivate it instead.");

  const { count } = await supabase
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("parent_code", acc.code);
  if ((count ?? 0) > 0)
    return blocked("This account has sub-accounts. Move or delete them first, or deactivate this account.");

  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("account_audit").insert({
    account_code: acc.code,
    action: "deleted",
    detail: { code: acc.code, name: acc.name },
  });
  return NextResponse.json({ ok: true });
}

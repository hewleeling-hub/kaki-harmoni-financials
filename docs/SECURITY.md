# Security

## Secrets
- `SUPABASE_SERVICE_ROLE_KEY` — server-side API routes only, never in client bundle
- `SUPABASE_ANON_KEY` — client-safe, protected by RLS
- All secrets in Vercel environment variables, never in `.env.local` committed to repo

## Permission Model (v1 → lock-down)
| Phase | Rule |
|---|---|
| v1 demo | Permissive RLS — all tables readable and writable by anon |
| Lock-down | Staff role: insert sessions/sales only; Owner role: full read on all tables, insert on expenses |
| Lock-down | `auth.uid() = user_id` on all write policies; reports pages server-side check role claim |

## Agent Permissions
- Agents execute only named tools listed in AGENTIC_LAYER.md
- No `run_any_sql`, `send_any_request`, or raw RPC calls
- Agent inherits the session user's role — staff agent cannot read expenses
- Every tool call is logged to `audit_logs` before the action executes

## Audit Principle
- Meaningful actions (session start, expense save, reimbursement settle, void) always write an audit row
- Audit rows are insert-only — no update or delete policy on `audit_logs`
- If a security boundary is unclear (e.g. multi-device session conflict), stop and get the owner to decide — do not guess

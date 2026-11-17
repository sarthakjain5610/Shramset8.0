# WURK UP — Worker & Contractor dashboards

_Branch: `arena/ec593218-shramset8-0` (based on `main` @ `d85ac8d1`). No production Supabase,
RLS, migration or deployment setting was changed by this work._

## 1. What this is

A rebuilt dashboard layer for the two authenticated roles:

- **Worker workspace** — overview, attendance muster, wage ledger, approvals, disputes, profile.
- **Contractor workspace** — overview, crew, sites, attendance, wages, approvals, disputes.

It replaces the two previous stop-gap screens (`WorkerCloudWorkspace`,
`ContractorCloudWorkspace`, now deleted) which only listed a directory row and a
profile. The judge-demo exhibit (`DemoWorkerPortal` / `DemoContractorDashboard`)
is untouched and stays strictly separate: **real accounts never render synthetic
records**, and the demo never reads Supabase.

Every figure shown comes from a row the signed-in user is authorized to read. When
a workflow has no authorized server-side operation, the dashboard says so instead
of inventing data.

## 2. File map

```
src/services/dashboardData.ts        typed queries + mutations, RLS-aware, error mapping
src/services/dashboardAnalytics.ts   pure money/aggregation/formatting maths
src/hooks/useDashboardResource.ts    loading / refresh / offline / stale-response guard
src/components/dashboard/
  DashboardShell.tsx                 command bar, section rail, content frame
  ui.tsx                             surfaces, KPI tiles, pills, states, tables, chart
  dashboardCopy.ts                   bilingual dictionary (typed: en ⇄ hi parity enforced)
  types.ts                           panel prop contracts
  worker/WorkerDashboard.tsx         worker shell + panel routing + onboarding gate
  worker/WorkerOverview.tsx
  worker/WorkerAttendance.tsx
  worker/WorkerWages.tsx
  worker/WorkerApprovals.tsx
  worker/WorkerDisputes.tsx
  worker/WorkerProfile.tsx
  contractor/ContractorDashboard.tsx contractor shell + panel routing
  contractor/ContractorOverview.tsx
  contractor/ContractorCrew.tsx
  contractor/ContractorSites.tsx
  contractor/ContractorAttendance.tsx
  contractor/ContractorWages.tsx
  contractor/ContractorApprovals.tsx
  contractor/ContractorDisputes.tsx
scripts/dashboard-test.tsx           117 assertions: maths, RLS contract, copy, rendering
```

Entry points are unchanged for the rest of the app: `WorkerPortal` and
`ContractorDashboard` still decide `isJudgeDemo` vs real account, and only the
real-account branch now points at the new dashboards.

## 3. Data contract (verified against the deployed project)

Introspected on project `qpgnoherjkvvasrwjcmf` (region `ap-south-1`): 9 tables,
12 policies, and the column-level grants below. The dashboards were written to
exactly this contract, not to the local migration files alone.

| Table | Granted to `authenticated` | Rows visible | Writes granted |
| --- | --- | --- | --- |
| `profiles` | SELECT | own row | none |
| `workers` | SELECT `id, name, hindi_name, trade, skill_level, daily_base_wage_paise, active_site_id, created_at, contact_sharing_consent` | own row (`user_id = auth.uid()`) or assigned | none |
| `sites` | SELECT (all columns) | contractor with an assigned worker on that site | none |
| `contractor_worker_assignments` | SELECT | `contractor_id = auth.uid()` | none |
| `attendance_records` | SELECT | own / assigned worker | none |
| `wage_ledger_entries` | SELECT | own / assigned worker | none |
| `disputes` | SELECT, INSERT | own / assigned worker | worker INSERT only (own record) |
| `approval_requests` | SELECT, INSERT, UPDATE (`status`, `responded_at`) | own / assigned worker | contractor INSERT (pending, assigned worker); worker UPDATE while pending |
| `worker_private_data` | **no direct access** | via `get_worker_private_data(text)` RPC only | via RPC |
| `qr_credentials`, `audit_events` | none | server-side only | none |

Consequences that shaped the UI:

- The directory projection **never selects `user_id`, `phone`, or any private
  identifier** — those columns are not granted, and selecting them fails.
- Workers cannot read `sites`, so the worker dashboard shows the site *reference*
  and never fabricates a site name.
- Contractor phone reveal goes through `get_assigned_worker_contact`, which
  enforces assignment **and** worker consent. The response is one number, nothing else.
- Dispute filing is the only worker write; it is validated client-side (type,
  positive amount, no future incident date, ≥20-character statement) before the
  policy is even reached.
- Contractor approval creation is always `status = 'pending'`; only the worker can
  decide, and only while pending.
- **Contractor responses to disputes are not writable from the browser** (the
  policy grants INSERT to workers only). The contractor disputes panel is
  explicitly read-only.

## 4. Money handling

`wage_ledger_entries.amount_paise` is signed: positive credits, negative advances,
deductions and payouts. All maths runs in integer paise; rupees appear only at the
formatting boundary (`formatPaise`). Balance = signed sum, so a negative balance
means the worker was overpaid and the UI labels it that way.

## 5. What is deliberately not wired

These have no authorized browser operation in the current database and are shown
as "Not connected" rather than simulated:

- writing attendance / muster rows,
- changing wage rates,
- recording payments, settling advances,
- worker acknowledgment of ledger entries,
- creating contractor↔worker assignments (policy intentionally denies mutation),
- contractor responses to disputes,
- audit event emission,
- QR pass issuance (`qr_credentials` is server-only).

Wiring any of these requires a new server-side operation (validated RPC or edge
function) plus a policy — **not** a client-side change.

## 6. Configuration

`src/services/supabase.ts` reads Vite build-time env:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable anon key>   # never a service_role key
```

With no configuration the dashboards fail closed: the shell renders with a
"Supabase is not configured" notice and no data. Offline and expired-session states
are handled explicitly, and real accounts never fall back to local demo records.

## 7. Tests

```bash
npm run test:dashboard   # 117 assertions: maths, RLS projections, bilingual copy, panel rendering
npm run test:all         # tsc + 60 core tests + dashboard suite + 13 screen renders + 27 flow steps
```

The dashboard suite renders every panel with fixtures in both languages, asserts
that no private phone number can appear in a contractor view, and pins the query
projections so a future edit cannot quietly add an un-granted column.

## 8. Extending

1. Add the server-side operation (RPC/edge function) with its own authorization check.
2. Add the matching grant/policy in a **new** timestamped migration — never edit a
   shipped one.
3. Add the typed query/mutation to `dashboardData.ts`.
4. Add the copy keys to `dashboardCopy.ts` (both languages — the compiler enforces it).
5. Add assertions to `scripts/dashboard-test.tsx`.

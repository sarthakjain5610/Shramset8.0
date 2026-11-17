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

## 4b. Grievance submission references (not government filing numbers)

WURK UP records grievances inside the platform. It does **not** submit them to the
District Labour Office, a labour court, or any other government authority, and it
does not open an official complaint on a worker's behalf. The UI and generated
records were corrected to say exactly that.

**Reference format**

```
WU-DSP-YYYYMMDD-XXXXXXXXXX
  WU-DSP       WURK UP dispute submission
  YYYYMMDD     local calendar date the record was created
  XXXXXXXXXX   10 symbols from a 32-character alphabet that omits I and O
```

Generated by `src/services/submissionReference.ts`:

- `buildSubmissionReference()` — builds the reference (CSPRNG via `crypto.getRandomValues`,
  rejection-free because the 32-symbol alphabet divides 256 evenly).
- `isSubmissionReference()` — validates the format.
- `isLegacyGovernmentStyleReference()` — recognises pre-correction `DLO-…` / `MP-DLO-…`
  values so history can label them **Legacy reference** instead of rewriting them.
- `referenceDate()` — reads the encoded date back out.
- `hasSecureRandom()` — true only when `crypto.getRandomValues` exists.

**No insecure fallback.** References are generated only from the Web Crypto CSPRNG.
`Math.random()` is never used, because a predictable reference would let someone guess
another worker's record id. When Web Crypto is unavailable, `buildSubmissionReference()`
throws `SubmissionReferenceError` (`code: 'crypto_unavailable'`) and
`requireSubmissionReference()` in `dashboardData.ts` converts it into a
`DashboardError('not_configured')` — the dispute write is aborted before any payload is
built, the message says nothing was saved, and the judge-demo form shows a bilingual
`role="alert"` instead of recording.

**Storage compatibility (no migration)**

The deployed column `public.disputes.dlo_filing_ref (VARCHAR(50) UNIQUE)` keeps its
historical name. Only the generated value (`WU-DSP-…`) and its presentation changed.
No schema change, no migration, no data rewrite, no new backend operation. Older rows
with `DLO-…` values continue to load and are rendered with a legacy badge.

**Wording**

| Where | English | Hindi |
| --- | --- | --- |
| Reference label | WURK UP submission reference | WURK UP जमा संदर्भ |
| Form notice title | WURK UP internal record only | केवल WURK UP आंतरिक रिकॉर्ड |
| Short notice | Not a District Labour Office or government filing. | जिला श्रम पदाधिकारी या सरकारी फाइलिंग नहीं। |
| Success | Grievance recorded in WURK UP | शिकायत WURK UP में दर्ज हुई |

The full disclaimer (both languages) states that the grievance is recorded inside
WURK UP only, is not forwarded to the District Labour Office, a labour court or any
government authority, starts no official complaint or statutory case, and that any
formal claim must be filed by the worker directly. It appears:

1. as a short notice on the Grievances panel (visible without opening the form),
2. in full inside the grievance form, and
3. under the confirmation showing the new reference.

The judge-demo grievance screen was corrected the same way: its document is now a
`WURK UP GRIEVANCE RECORD (INTERNAL)` with an explicit "has not been submitted"
notice, and its submit button no longer claims to generate a legal notice.

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

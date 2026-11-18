# WURK UP — technical handover

_Last updated: 17 November 2026 (Asia/Calcutta). Contains no credentials or secret values — only
configuration names, states and evidence._

This document is the short version for whoever picks this work up next: what is on the branch, why
the outage happened and how it was fixed, what is proven and what is not, and where the long version
lives. The long version is
[`docs/technical/WURKUP_COMPLETE_TECHNICAL_MANUAL.md`](technical/WURKUP_COMPLETE_TECHNICAL_MANUAL.md)
(43 pages, also built as a PDF beside it).

---

## 1. Where this work lives

| | |
| --- | --- |
| Repository | `sarthakjain5610/ShramSet8.0` |
| Branch | `arena/ec593218-shramset8-0` |
| Base | `main` @ `d85ac8d1edce44b414e1c2a908a1efa3a88f852a` |
| Pull request | [#12 — Add Worker and Contractor dashboards backed by live Supabase data](https://github.com/sarthakjain5610/Shramset8.0/pull/12), **open**, reported `MERGEABLE` |
| Commits | 10 (`e3b4817` → `9055ea0`), tip pushed |
| Size | 84 files changed, +14,768 / −920 lines |

The branch name is fixed by the Arena session; a `feature/…` name was not available and the user
approved working on the session branch.

### Commits, newest first

| Commit | What it does |
| --- | --- |
| `9055ea0` | `test:all` no longer chains PR #11's absent auth suite; two PDF orphan-heading fixes; manual rebuilt |
| `89bbdff` | Records the finished bilingual coverage in the manual (42 → rebuilt at 43 pages) |
| `ea47cbf` | Bilingual coverage completed: 120 → 0 hardcoded strings across 21 components |
| `949d847` | The complete technical manual (Markdown, 12 generated figures, PDF builder, PDF) |
| `a8bbfcf` | Corrects the integration-testing verification date; records real evidence |
| `231fa4f` | Grievance references require Web Crypto; `Math.random` fallback removed |
| `8d473fc` | Wage-benchmark note softened to "prototype reference, not a legal determination" |
| `4aeae63` | Documents the local PR #11 + PR #12 integration procedure |
| `2fd71a4` | Grievance references are internal `WU-DSP-…` references, never government filings |
| `e3b4817` | Worker and Contractor dashboards backed by live Supabase data (PR #11 + #12 integration) |

---

## 2. What changed, by area

| Area | Files | Notes |
| --- | --- | --- |
| New dashboards | `src/components/dashboard/**` (18 files), `src/services/dashboardData.ts`, `dashboardAnalytics.ts`, `src/hooks/useDashboardResource.ts` | Real accounts read Supabase through RLS; Judge Demo keeps the demo portals. `WorkerCloudWorkspace.tsx` and `ContractorCloudWorkspace.tsx` deleted. |
| Fixed migration | `supabase/migrations/20261117120000_worker_identity_rls_helpers.sql` | The 42501 fix (§3). Migration 7 of 7. |
| RLS evidence | `supabase/tests/rls_permissions.sql`, `scripts/rls-contract-test.ts` | Live scenario script (9 groups) and a 37-check static contract test. |
| Translation | `src/services/i18n.ts` + 21 components | 120 hardcoded strings → 0; `scripts/i18n-audit.ts` enforces it. |
| Other source | `src/services/{db,anomalyEngine,submissionReference}.ts`, `src/types/index.ts`, `src/main.tsx`, `src/components/**` (public shell, worker/contractor portals, modals, `WorkerCard`, `ErrorBoundary`) | Bilingual copy, grievance reference format, error boundary language. |
| Tooling | `scripts/{i18n-audit,rls-contract-test,dashboard-test,smoke-render,browser-verify}`, `package.json` | See §5 for commands. |
| Documentation | `docs/technical/**` (manual, figures, PDF builder, PDF), `docs/DASHBOARD.md`, `docs/INTEGRATION_TESTING.md`, `docs/AI_HANDOFF.md`, this file | |

Generated artefacts intentionally committed: the 12 figure PNGs and the 42–43-page PDF, because the
reviewer reads them without a Python toolchain. `docs/technical/.gitignore` keeps `__pycache__` out.

---

## 3. The outage: root cause and fix

**Symptom.** A signed-in worker saw `42501 permission denied` for attendance, wage ledger, disputes
and approvals, while the pass and sites worked.

**Root cause (proven, not inferred).** Six policies expressed "is this my row?" as a subquery against
`workers`:

```sql
EXISTS (SELECT 1 FROM workers w WHERE w.id = attendance_records.worker_id AND w.user_id = auth.uid())
```

Policy subqueries run with the caller's privileges. `20261031120000_worker_private_data_security.sql`
had revoked table-wide `SELECT` on `workers` and re-granted only eight columns — `user_id` not among
them. So the subquery itself failed with 42501, before any row was considered. Policies:
`attendance_participant_read`, `ledger_participant_read`, `dispute_participant_read`,
`approval_participant_read`, `dispute_worker_create`, `approval_worker_respond`.

**Fix.** Migration 7 adds three `SECURITY DEFINER` helpers (`STABLE`, `SET search_path = ''`, `EXECUTE`
revoked from `PUBLIC`/`anon`, granted to `authenticated`):

```sql
public.is_current_worker(text)      -- workers.id belongs to auth.uid()
public.is_assigned_contractor(text) -- auth.uid() is assigned to that worker
public.can_read_worker(text)        -- both, for read policies
```

The six policies were recreated with identical semantics but calling the helpers, so the caller's
column privileges no longer matter and the grant surface on `workers` stays narrow. Re-running is
safe (`CREATE OR REPLACE`, `DROP POLICY IF EXISTS … CREATE POLICY`).

**Evidence.** Owner reads all four tables and inserts an own dispute; a foreign worker's insert →
42501; an unrelated account → 0 rows; an assigned contractor sees own + assigned workers and cannot
insert a worker dispute; `workers.user_id` is unreadable to `authenticated`.
`supabase/tests/rls_permissions.sql` prints `ALL RLS TESTS PASSED (9 groups)`; the static contract
test is 37/37.

**Regression guard.** `npm run test:rls` parses the migrations (comments stripped, last policy/grant
per name wins) and fails if a participant policy stops going through a helper or if a revoke is
loosened.

---

## 4. E-mail (SMTP) status

Read from the Supabase Auth configuration on 17 November 2026. Values only; no secrets recorded.

| Item | State |
| --- | --- |
| Provider | Brevo (`smtp-relay.brevo.com:587`), sender name `WURK UP`, admin `sarthakjain5610@gmail.com` |
| `mailer_autoconfirm` | `false` — new accounts must confirm by e-mail |
| Site URL | `https://wurkup.sarthakjain5610.workers.dev` |
| Redirect allow-list | site URL + `http://localhost:3000` |
| SMTP rate limit | 60/hour |
| Templates | Supabase defaults; not branded or translated |

**Not verified:** whether the Brevo relay is enabled, whether the sender/domain is authenticated
(SPF/DKIM), and whether any message actually arrives. No test e-mail was sent, because that would
deliver real mail to a real address and the Brevo dashboard is not reachable from this environment.
Treat signup confirmation and password recovery as **unproven** until someone requests a reset on the
team's own address and watches Brevo → Transactional → Logs.

---

## 5. Test results

Environment: the Arena sandbox — Node 22, Linux, no browser runtime. Suites are headless (jsdom /
SSR / pure functions). Date: 17 November 2026.

| Check | Command | Result |
| --- | --- | --- |
| Type safety | `npx tsc --noEmit` (also `npm run lint`) | **0 errors** |
| Core logic | `npm test` | **60 / 60** |
| Dashboards | `npm run test:dashboard` | **189 / 189** |
| RLS contract (static) | `npm run test:rls` | **37 / 37** |
| RLS live (rolled back) | `psql "$SUPABASE_DB_URL" -f supabase/tests/rls_permissions.sql` | **9 / 9 scenario groups** |
| Translation dictionary | `npm run test:i18n` | PASS — en 325 / hi 325 keys, 0 defects |
| Hardcoded English text | `npm run test:i18n:strict` | **PASS — 0 strings** (was 120) |
| Screen render (en + hi) | `npm run test:render` | **13 / 13** |
| Interaction flows | `npm run test:ui` | **27 / 27** |
| Production build | `npm run build` | success (existing >500 kB chunk warning) |
| Everything above in one command | `npm run test:all` | passes end to end |
| Auth / registration (21 checks) | `npm run test:auth` | **not available on this branch** — the suite file ships with PR #11; the combined-tree run is recorded in the manual §14.3 |

### Not run, and why

* **No real browser.** The sandbox has no Chromium runtime (`libnss3`/`libnspr4` missing;
  `@sparticuz/chromium` fails to launch). `scripts/browser-verify.mjs` (`npm run test:browser`) is
  written and ready: it signs in as a worker and as a contractor against an origin, captures
  screenshots, and asserts no 42501 appears in the network log. Run it once on a machine with
  Chromium. **No browser or visual verification of this branch has been performed by the agent.**
* **No production deployment** and no change to Cloudflare, Supabase settings, DNS or e-mail
  configuration in this work.
* **No e-mail delivery test** (§4).
* **The live RLS run** used two existing worker accounts and a rolled-back assignment; it creates no
  permanent rows and proves nothing about a specific new account's data.

---

## 6. Known limitations worth reading before you judge the work

* Worker-side writes that the product describes (attendance creation by a contractor, wage-rate
  changes, payouts, dispute responses) are **not connected** — they are labelled "Not connected" in
  the UI rather than simulated. Nothing in the app moves money or claims payment.
* The audit bench verifies the SHA-256 chain of **demo data**; it is not a production integrity
  guarantee.
* Hindi copy is complete (0 hardcoded strings) but has had **no native proofreading**, particularly
  the statutory sentences.
* No admin/support console exists, deliberately: no privileged bypass path.
* No secondary indexes; fine at current volume.
* Documented, not hidden: `docs/technical/…manual.md` §15.4 lists L1–L9 and Appendix C.1 lists the
  three things this session deliberately did not verify.

---

## 7. How to pick this up

```bash
npm install
npm run lint            # tsc, 0 errors
npm run test:all        # core + dashboards + RLS contract + strict i18n + render + flows
npm run test:rls:live   # needs SUPABASE_DB_URL; rolled back, safe on the live project
npm run test:browser    # needs Chromium; the one gap the sandbox cannot close
```

Rebuilding the manual (needs Python with `reportlab`, `matplotlib`, `pypdfium2`):

```bash
python docs/technical/figures/generate_figures.py     # regenerates the 12 PNGs
python docs/technical/build_manual_pdf.py             # writes the PDF, prints pages/figures/tables
```

Next owner's first three tasks, in order: (1) run `test:browser` on a Chromium machine and attach the
screenshots to PR #12; (2) send one real password-recovery e-mail and confirm delivery in Brevo;
(3) have a Hindi speaker read §13's screens once, since coverage is proven and quality is not.

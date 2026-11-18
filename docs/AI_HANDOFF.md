# WURK UP AI Handoff

_Last verified: 2026-11-07 (Asia/Calcutta). This file contains no credentials or secrets._

## GitHub

- Repository: `sarthakjain5610/ShramSet8.0`
- Latest verified `main`: `644cd443f240ef283ac0680d5c1b126759a3b3d8`, merge commit for PR #9.
- PR #9 — [Fix WURK UP service-worker asset and SPA handling](https://github.com/sarthakjain5610/ShramSet8.0/pull/9) — is **MERGED**. Its reviewed head was `7110f4ca4834098eae63d5ccce8013760d5a22ee`; merge commit `644cd443f240ef283ac0680d5c1b126759a3b3d8` is the current `main` head.
- PR #9 was developed on `arena/895b41a0-shramset8-0`. The current Arena session is fixed to `arena/074ef226-shramset8-0`; post-merge handoff corrections are being proposed separately.

## Code and tests

- Supabase frontend configuration is read at Vite build time from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `src/services/supabase.ts`.
- `VITE_APP_URL` is also read by `src/services/verifyLink.ts` for generated app links.
- `wrangler.jsonc` defines the `wurkup` static-assets site with `./dist`, `not_found_handling: "404-page"`, and `previews: {}`; no custom `public/404.html` or `_headers` file was added. Wrangler 4.158.0 `deploy --dry-run` passed and read the built assets; Cloudflare Workers Builds ran automatically after merge (details below), with no separate manual deployment by Arena.
- `public/sw.js` uses `wurkup-shell-v4`: network-first navigation, refreshes the cached root only from a validated HTTP 200 HTML response to `/`, preserves offline fallback, validates shell/JS/CSS/font caching, limits cache cleanup to obsolete `wurkup-shell-*` caches, preserves unrelated caches, and bypasses `/sw.js`, `/api`, and `/auth`. Missing JS/CSS responses that resolve to HTML become empty 404s.
- `scripts/service-worker-preview-smoke.mjs` and `npm run test:service-worker` use local Vite preview plus a simulated service-worker/cache harness. They test asset MIME types, cache upgrade/preservation, excluded paths, missing JS/CSS, root shell refresh after a 200 HTML response, no replacement by an arbitrary 404 route, and offline fallback to the refreshed shell. They are not real browser service-worker tests or Cloudflare preview tests.
- A separate local Wrangler runtime check (`wrangler dev --local` using `wrangler.jsonc`) tested `/index.html` (307 to `/`, final 200 HTML), `/` (200 HTML), `/manifest.json` (200 JSON), and missing JS/CSS (404 with empty bodies/no Content-Type, never HTML). Wrangler logged a non-blocking `Request.cf` TLS-fetch warning and used its default placeholder; this does not verify Cloudflare edge behavior.
- Build, JS syntax checks, `npm run test:service-worker`, local Wrangler runtime checks, and Wrangler production dry-run passed. Build emits the existing >500 kB chunk warning. Earlier `npm run lint`, `npm run test:all` (60 automated tests, 9/9 screen renders, 27/27 flow steps), and `npm run test:offline` (12/12 checks) also passed.
- Browser verification scope: the user reports testing the actual Cloudflare **preview** (homepage, sign-in opening, refresh, no JavaScript MIME errors, and preview isolated from production Supabase authentication). Arena did not independently run those browser tests. No production browser HTTP verification has been performed; do not claim it passed.
- Main contains the worker onboarding RPC, nullable unassigned-wage behavior, onboarding form, and the corrective onboarding conflict-target migration. PR #9 made no new Supabase migration; the production history remains at six migrations.
- The RLS/pgTAP suite declares 64 assertions. The original test run reported an ambiguous `worker_id` conflict target; the follow-up migration uses `ON CONFLICT ON CONSTRAINT worker_private_data_pkey`. A successful post-fix 64-test execution has not been verified by Arena.
- No Supabase, RLS, migration, Brevo, Cloudflare dashboard, or unrelated application behavior changes were made in PR #9.

## Supabase

- Project `Wurk UP`, ref `qpgnoherjkvvasrwjcmf`, region `ap-south-1`; project and Auth/DB/REST health were reported healthy by the Supabase connector on 2026-11-07.
- Production migration history verified on 2026-11-07 contains six versions: `20261025000000`, `20261031000000`, `20261031120000`, `20261102000000`, `20261102010000`, and `20261102120000` (onboarding conflict-target correction included).
- Auth Site URL is `https://wurkup.sarthakjain5610.workers.dev`; redirect allow-list is that origin plus `http://localhost:3000`. Email auth is enabled, phone auth is disabled, and email auto-confirm remains disabled.
- No schema, RLS, database permission, or migration changes were made in the 2026-11-07 audit.
- Post-correction 64-assertion pgTAP result remains unverified; do not claim it passed without a run/result.

## Cloudflare deployment

- PR #9's Workers Builds preview check passed for reviewed commit `7110f4ca4834098eae63d5ccce8013760d5a22ee`; the Cloudflare GitHub App also reported preview build and deployment success. The user reports manually verifying the actual preview in a browser (homepage, sign-in opening, refresh, no JavaScript MIME errors, and isolation from production Supabase authentication); Arena did not independently perform these browser checks.
- After PR #9 merged, the production Workers Builds check for main commit `644cd443f240ef283ac0680d5c1b126759a3b3d8` completed successfully. Latest reported production build ID: `0c7b5f77-bd47-49ee-b411-ad30c1be1844`; production version ID: `1f919bcf-a2a3-45b3-87eb-41cf6be37f07`; reported production traffic allocation: 100%.
- Production browser HTTP verification has not been performed by Arena and remains pending. The build/version/traffic reports are not evidence that production browser smoke tests passed. No separate manual production deployment was run.
- Earlier Workers Builds preview failure `f8c3057e-62f1-40b2-a946-22b9e91250be` reported a missing `previews` block. Root `wrangler.jsonc` now has `"previews": {}`; a later preview build passed. Arena's Cloudflare connector lookup is unsupported, so direct dashboard inspection is unavailable.
- No Cloudflare dashboard settings were changed by Arena. Do not place production credentials in preview builds or expose secret values here.

## Brevo

- Brevo is not connected to this Arena session and was not changed or verified by Arena.
- Supabase Auth SMTP fields were empty in the latest connector inspection. A future setup requires a Brevo account, verified/authenticated sender domain, SMTP credentials, Supabase custom SMTP, and confirmation/OTP and recovery templates. Keep OTP generation and verification in Supabase; Brevo only delivers messages.

## Blockers and next owners

- **User/authorized production owner:** perform and record production browser HTTP smoke tests; no passing production HTTP result is currently documented.
- **Arena:** maintain GitHub/Supabase implementation; arrange a local run of all 64 pgTAP assertions when a supported local Postgres/Supabase test environment is available.
- **User:** authorize any future production deployment or other production changes before they occur.

## Worker & Contractor dashboards (separate project)

- Separate dashboard work happens on `arena/ec593218-shramset8-0`, branched from `main` @ `d85ac8d1edce44b414e1c2a908a1efa3a88f852a`. PR #11 (`arena/2b71e6b4-shramset8-0`, authentication/registration) is **not** merged and **none** of its commits are in this branch. Isolation was verified with `git log origin/main..origin/pr11` plus an ancestry check.
- The requested branch name `feature/worker-contractor-dashboard` could not be used: an Arena session is locked to its own `arena/<session>-<repo>` branch. The user approved proceeding on the locked branch, which sits exactly on `main` at the required base commit.
- New dashboard layer: `src/services/dashboardData.ts`, `src/services/dashboardAnalytics.ts`, `src/hooks/useDashboardResource.ts`, `src/components/dashboard/**`. `WorkerCloudWorkspace.tsx` and `ContractorCloudWorkspace.tsx` were deleted; `WorkerPortal`/`ContractorDashboard` keep the `isJudgeDemo` split and route real accounts to the new dashboards. See `docs/DASHBOARD.md`.
- The deployed schema was re-verified read-only through the Supabase connector on 2026-11-17 (same session as commit `e3b4817`): 9 public tables, 12 policies, `authenticated` column grants as documented in `docs/DASHBOARD.md` §3, and `worker_private_data` reachable only through RPCs. **No schema, policy, grant, migration or auth setting was changed** and no migration was applied. Row counts at inspection: 4 profiles, 2 workers, 0 sites/assignments/attendance/ledger/disputes/approvals.
- Dashboards fail closed when `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` are absent, when offline, and on expired sessions. Real accounts never render synthetic rows. Attendance writing, wage-rate changes, payment recording, worker acknowledgments, assignment mutation, contractor dispute responses, audit emission and QR issuance remain unwired because no authorized browser operation exists for them; each is labelled "Not connected" rather than simulated.
- Verified locally: `npm run lint` (tsc, 0 errors), `npm test` (60/60), `npm run test:dashboard` (117/117, new), `npm run test:render` (13/13 screens incl. both dashboards in en + hi), `npm run test:ui` (27/27), `npm run build` (success). Tests are headless; **no browser or production HTTP verification was performed for the dashboards**, and no preview/production deploy was run.

## Grievance reference correction (PR #12)

- The Worker grievance flow no longer presents its reference as a District Labour Office (DLO) filing. References are generated as `WU-DSP-YYYYMMDD-XXXXXXXXXX` by `src/services/submissionReference.ts`; the deployed column `public.disputes.dlo_filing_ref` keeps its historical name for compatibility (no migration, no data rewrite, no new backend operation).
- All user-facing "DLO reference / DLO filing" labels became **WURK UP submission reference** (Hindi: **WURK UP जमा संदर्भ**). An explicit disclaimer — in the grievances panel, inside the form, and under the confirmation — states that a grievance is recorded inside WURK UP only and is not forwarded to the District Labour Office, a labour court or any government authority. Rows written before the correction are labelled **Legacy reference** rather than rewritten.
- The judge-demo grievance screen was corrected too: its document is now a `WURK UP GRIEVANCE RECORD (INTERNAL)` with a "has not been submitted" notice, the submit button no longer says "Generate Legal Notice", and the helpline label no longer implies the DLO office. Public copy in `Home.tsx` and `HelpContact.tsx` was aligned.
- Grievance references are generated **only** from the Web Crypto CSPRNG. There is no `Math.random()` fallback: `buildSubmissionReference()` throws `SubmissionReferenceError` (`code: 'crypto_unavailable'`) and `requireSubmissionReference()` turns that into a `DashboardError('not_configured')` whose message says nothing was saved, so a dispute row is never written with a predictable reference. The judge-demo form shows a bilingual `role="alert"` instead of recording.
- Dashboard suite grew from 117 to 189 assertions, adding reference-format, uniqueness, legacy-detection, copy-consistency, jsdom form-interaction, judge-demo record and crypto-availability (no-`Math.random`) checks. `npm test` (60), render (13) and flow (27) suites are unchanged and still pass; `npm run build` succeeds.
- Verified read-only: the deployed `disputes` table still has `dlo_filing_ref` and the same policies/grants. No schema, RLS, auth or production data change was made, and nothing was merged or deployed.

## Session handover — 2026-11-17 (branch `arena/ec593218-shramset8-0`, PR #12)

- Short version for a new owner: **[`docs/TECHNICAL_HANDOVER.md`](TECHNICAL_HANDOVER.md)** — scope,
  commit list, changed files, root cause, SMTP state, test results, gaps. Long version:
  `docs/technical/WURKUP_COMPLETE_TECHNICAL_MANUAL.{md,pdf}` (43 pages, 12 figures, 44 tables).
- Branch tip `9055ea0`, base `main` @ `d85ac8d`; 10 commits; PR #12 open and `MERGEABLE`. Nothing was
  merged, deployed, or changed in Supabase settings; the only schema change is migration 7
  (`20261117120000_worker_identity_rls_helpers.sql`), which is already applied to the project.
- **The 42501 outage is fixed and proven**: six participant policies ran `EXISTS (… workers w WHERE
  w.user_id = auth.uid())` under the caller's privileges, and the column grant on `workers` excludes
  `user_id`. Migration 7 replaces them with `SECURITY DEFINER` helpers (`is_current_worker`,
  `is_assigned_contractor`, `can_read_worker`). Live scenario script: 9/9 groups passed; static
  contract test: 37/37.
- **Translation is complete**: `npm run test:i18n:strict` reports **0** hardcoded user-facing strings
  (was 120), dictionary en 325 / hi 325. Coverage is proven; proofs of quality are not — the Hindi
  copy has had no native review (§15.4 L3 of the manual).
- **`npm run test:all` was broken on this branch** and now works: it chained PR #11's
  `scripts/auth-registration-test.ts`, which does not exist here. Those 21 auth checks still exist
  only in the combined PR #11 + #12 tree recorded in `docs/INTEGRATION_TESTING.md` and manual §14.3.
- **Still not verified** (do not claim otherwise): real e-mail delivery through Brevo (relay/sender
  authentication and delivery are unknown), any browser rendering (no Chromium in this sandbox —
  run `npm run test:browser` elsewhere), and any live production deployment.

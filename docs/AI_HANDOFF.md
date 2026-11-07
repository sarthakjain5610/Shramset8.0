# WURK UP AI Handoff

_Last verified: 2026-11-07 (Asia/Calcutta). This file contains no credentials or secrets._

## GitHub

- Repository: `sarthakjain5610/ShramSet8.0`
- Latest verified `main`: `4b7e051886160fe185e231c0cead64673bb34188` (merge of PR #8).
- Active Arena session branch: `arena/895b41a0-shramset8-0`; no code changes made in this handoff task.
- Open PRs: none at last successful GitHub CLI check.
- `docs/AI_HANDOFF.md` was absent and is being added in a reviewable PR.

## Code and tests

- Supabase frontend configuration is read at Vite build time from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `src/services/supabase.ts`.
- `VITE_APP_URL` is also read by `src/services/verifyLink.ts` for generated app links.
- The application has no checked-in Wrangler config or Wrangler deploy script; Cloudflare Workers Build settings are external to this repository.
- Main contains the worker onboarding RPC, nullable unassigned-wage behavior, onboarding form, and the corrective onboarding conflict-target migration.
- The RLS/pgTAP suite declares 64 assertions. The original test run reported an ambiguous `worker_id` conflict target; the follow-up migration uses `ON CONFLICT ON CONSTRAINT worker_private_data_pkey`. A successful post-fix 64-test execution has not been verified by Arena.
- No application source changes or application tests were run for the configuration audit.

## Supabase

- Project `Wurk UP`, ref `qpgnoherjkvvasrwjcmf`, region `ap-south-1`; project and Auth/DB/REST health were reported healthy by the Supabase connector on 2026-11-07.
- Production migration history verified on 2026-11-07 contains six versions: `20261025000000`, `20261031000000`, `20261031120000`, `20261102000000`, `20261102010000`, and `20261102120000` (onboarding conflict-target correction included).
- Auth Site URL is `https://wurkup.sarthakjain5610.workers.dev`; redirect allow-list is that origin plus `http://localhost:3000`. Email auth is enabled, phone auth is disabled, and email auto-confirm remains disabled.
- No schema, RLS, database permission, or migration changes were made in the 2026-11-07 audit.
- Post-correction 64-assertion pgTAP result remains unverified; do not claim it passed without a run/result.

## Cloudflare deployment

- Cloudflare/Workers Builds is Claude's exclusive integration responsibility. Arena did not inspect or change Cloudflare settings in this handoff task.
- Previously, Arena's Cloudflare connector lookup returned unsupported. Build variables, API token status, configured build/deploy commands, latest deployment version, and production traffic remain unverified by Arena.
- The reported production warning is consistent with a Vite build missing or receiving invalid `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`; this is a source-based diagnosis, not confirmation of current Cloudflare settings or a successful live fix.
- Required Cloudflare action: Claude/authorized owner verify Workers Builds **Build variables and secrets** (not only runtime bindings), use the production Supabase URL and publishable key, then verify the build/deployment and live site. Do not expose or store key values here.

## Brevo

- Brevo is Claude's exclusive integration responsibility and is not configured/verified by Arena.
- Supabase Auth SMTP fields were empty in the latest connector inspection. Next phase: Brevo account; verified/authenticated sender domain; SMTP login/key; Supabase custom SMTP; confirmation/OTP and recovery templates. Keep OTP generation and verification in Supabase; Brevo only delivers messages.

## Blockers and next owners

- **Claude:** verify Cloudflare Worker/Workers Builds configuration, build variables, API token status, active deployment and live smoke tests; report findings for this handoff.
- **Arena:** maintain GitHub/Supabase implementation; arrange a local run of all 64 pgTAP assertions when a supported local Postgres/Supabase test environment is available.
- **User:** authorize any production deployment or other production changes before they occur.

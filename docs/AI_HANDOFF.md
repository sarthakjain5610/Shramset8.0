# WURK UP AI Handoff

_Last verified: 2026-11-07 (Asia/Calcutta). This file contains no credentials or secrets._

## GitHub

- Repository: `sarthakjain5610/ShramSet8.0`
- Latest verified `main`: `4b7e051886160fe185e231c0cead64673bb34188` (merge of PR #8).
- Active Arena session branch: `arena/895b41a0-shramset8-0` (fixed by Arena; the requested feature branch name could not be used).
- Open PR: [#9 — Add shared WURK UP AI handoff record](https://github.com/sarthakjain5610/ShramSet8.0/pull/9), from `arena/895b41a0-shramset8-0` to `main`; service-worker changes and this updated handoff are being added to that existing PR.
- `docs/AI_HANDOFF.md` is tracked in PR #9. Latest service-worker patch is local/uncommitted until the next handoff update.

## Code and tests

- Supabase frontend configuration is read at Vite build time from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `src/services/supabase.ts`.
- `VITE_APP_URL` is also read by `src/services/verifyLink.ts` for generated app links.
- `wrangler.jsonc` defines the `wurkup` static-assets site with `./dist` and `not_found_handling: "404-page"`; no custom `public/404.html` or `_headers` file was added. Wrangler 4.158.0 `deploy --dry-run` passed and read the built assets; no production deploy was performed.
- `public/sw.js` now uses `wurkup-shell-v4`: network-first navigation with validated cached-shell fallback, validated shell/JS/CSS/font caching scoped to the current WURK UP cache, cleanup limited to obsolete `wurkup-shell-*` caches, preservation of unrelated caches, and bypass for `/sw.js`, `/api`, and `/auth`. Missing JS/CSS responses that resolve to HTML become empty 404s.
- `scripts/service-worker-preview-smoke.mjs` and `npm run test:service-worker` exercise preview MIME checks, cache upgrade/preservation, excluded routes, missing assets, offline navigation, and hash routes.
- `npm run build`, JS syntax checks, `npm run lint`, `npm run test:service-worker`, `npm run test:all` (60 automated tests, 9/9 screen renders, 27/27 flow steps), and `npm run test:offline` (12/12 checks) passed. Build emits the existing >500 kB chunk warning; `test:all` emits its expected missing-translation diagnostic for the deliberate negative test.
- Main contains the worker onboarding RPC, nullable unassigned-wage behavior, onboarding form, and the corrective onboarding conflict-target migration.
- The RLS/pgTAP suite declares 64 assertions. The original test run reported an ambiguous `worker_id` conflict target; the follow-up migration uses `ON CONFLICT ON CONSTRAINT worker_private_data_pkey`. A successful post-fix 64-test execution has not been verified by Arena.
- No Supabase, RLS, migration, Brevo, Cloudflare dashboard, or unrelated application behavior changes were made.

## Supabase

- Project `Wurk UP`, ref `qpgnoherjkvvasrwjcmf`, region `ap-south-1`; project and Auth/DB/REST health were reported healthy by the Supabase connector on 2026-11-07.
- Production migration history verified on 2026-11-07 contains six versions: `20261025000000`, `20261031000000`, `20261031120000`, `20261102000000`, `20261102010000`, and `20261102120000` (onboarding conflict-target correction included).
- Auth Site URL is `https://wurkup.sarthakjain5610.workers.dev`; redirect allow-list is that origin plus `http://localhost:3000`. Email auth is enabled, phone auth is disabled, and email auto-confirm remains disabled.
- No schema, RLS, database permission, or migration changes were made in the 2026-11-07 audit.
- Post-correction 64-assertion pgTAP result remains unverified; do not claim it passed without a run/result.

## Cloudflare deployment

- Cloudflare/Workers Builds dashboard configuration is Claude's exclusive integration responsibility. Arena did not inspect or change Cloudflare settings for this patch; only the repository Wrangler config was dry-run validated.
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

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

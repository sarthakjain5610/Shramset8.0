# Local integration testing: PR #11 (auth) + PR #12 (dashboards)

PR #11 and PR #12 must stay independent pull requests. To test them **together**
without touching either branch, combine them in a **temporary local worktree** that
is never pushed. Nothing in this procedure creates a commit on, or pushes to,
`arena/2b71e6b4-shramset8-0` (PR #11) or `arena/ec593218-shramset8-0` (PR #12).

Verified: the procedure below was executed end to end on 2026-11-11 in a detached
worktree at `origin/main` + PR #11 + PR #12. Results:

```
tsc --noEmit .................... clean
run-all-tests ................... 60 / 60 passed
auth-registration-test .......... 21 / 21 passed
dashboard-test .................. 176 / 176 checks passed
smoke-render .................... 16 / 16 screens rendered cleanly
flow-test ....................... 29 / 29 steps passed
vite build ...................... succeeded
```

Only two files conflict — `package.json` and `scripts/smoke-render.ts` — because each
PR added its own test command and its own screen-render assertions. Both sides must
be **kept**, never dropped.

## 1. Prepare the worktree (PowerShell)

Run from the repository root. Use a folder **outside** the repository so nothing can
be committed by accident.

```powershell
Set-Location C:\Users\<you>\Shramset8.0

# make sure both PR heads are available locally
git fetch origin

# temporary worktree, detached HEAD at main (no branch is created)
git worktree add --detach ..\wurkup-integration origin/main
Set-Location ..\wurkup-integration

# reuse the existing install and the existing local env (values are never printed)
cmd /c mklink /J node_modules C:\Users\<you>\Shramset8.0\node_modules
Copy-Item ..\Shramset8.0\.env.local .env.local -ErrorAction SilentlyContinue

# if the junction is not possible, install instead:
# npm ci

git log --oneline -1
```

`.env.local` supplies `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and
`VITE_APP_URL`. It is already git-ignored (`.env*`); never print, commit or paste its
contents. It is only used by `npm run dev`; the headless suites below need no
credentials and fail closed to the explicit "not configured" state.

## 2. Merge both PR branches locally

```powershell
git -c user.name="Local Integration" -c user.email="local@example.com" `
    merge --no-ff origin/arena/2b71e6b4-shramset8-0 -m "local integration: PR 11"

git -c user.name="Local Integration" -c user.email="local@example.com" `
    merge --no-ff origin/arena/ec593218-shramset8-0 -m "local integration: PR 12"
```

The second merge stops with `CONFLICT (content)` in exactly two files.

## 3. Resolve the two conflicts (keep both sides)

### `package.json`

Delete the conflict markers and keep **all three** commands. The merged block must be:

```jsonc
"test:all": "tsc --noEmit && tsx scripts/run-all-tests.ts && tsx scripts/auth-registration-test.ts && tsx scripts/dashboard-test.tsx && tsx scripts/smoke-render.ts && tsx scripts/flow-test.ts",
"test:dashboard": "tsx scripts/dashboard-test.tsx",
"test:auth": "tsx scripts/auth-registration-test.ts",
```

(`test:dashboard` comes from PR #12, `test:auth` from PR #11; `test:all` runs both.)

### `scripts/smoke-render.ts`

Both PRs appended assertion blocks in the same place. Keep **both**:

1. PR #11's two `ResetPassword` checks ("expired-link guidance" and "success
   confirmation") — each is its own `try { … } catch (error) { … }` pair;
2. PR #12's dashboard block — the two `await import(...)` lines, the
   `dashboardUser`/`dashboards` arrays and the `for (const [name, Component, props,
   needles] of dashboards)` loop.

The result must read: ResetPassword expired-link `try/catch`, ResetPassword
success-confirmation `try/catch`, then the dashboard imports/array/loop, and the
loop's closing `}` followed by the outer `} catch (error: any) {`. Nothing else in
the file changes.

Quick sanity check for leftover markers (must print nothing):

```powershell
Select-String -Path package.json,scripts/smoke-render.ts -Pattern "<<<<<<<","=======",">>>>>>>"
```

## 4. Run the combined suite

```powershell
npx tsc --noEmit                # type check both features together
npm run test                    # 60 app tests
npm run test:auth               # PR #11   — 21 auth/registration checks
npm run test:dashboard          # PR #12   — 176 dashboard + reference checks
npm run test:render             # screen renders: PR #11 ResetPassword + PR #12 dashboards
npm run test:ui                 # navigation/flow steps
npm run build                   # production build
# or everything at once
npm run test:all
```

## 5. Manual verification in the browser

```powershell
npm run dev     # http://localhost:3000
```

1. **PR #11 paths:** sign up with a new email → confirmation screen; request a
   password reset → open the emailed link → "Password updated" → sign in.
2. **PR #12 paths:** sign in as the worker → Overview / Attendance / Wages /
   Approvals / Disputes / Profile load from Supabase (not the "not configured" state).
3. **Grievance correction:** open Disputes → the short "Not a District Labour Office
   or government filing." notice is visible without opening the form → open the form →
   full disclaimer → submit a grievance → the confirmation shows a
   `WU-DSP-YYYYMMDD-XXXXXXXXXX` reference labelled *WURK UP submission reference*, and
   says the grievance was recorded in WURK UP only.
4. Switch the language toggle and repeat step 3 in Hindi: `WURK UP जमा संदर्भ`,
   "जिला श्रम पदाधिकारी या सरकारी फाइलिंग नहीं।", "शिकायत WURK UP में दर्ज हुई".
5. Contractor account → Disputes shows the same reference label, read-only.
6. Judge demo → grievance screen renders `WURK UP GRIEVANCE RECORD (INTERNAL)` with a
   "has not been submitted" notice and no "legal notice"/"legal petition" wording.

Delete any test grievance once verified if the account is a real one.

## 6. Clean up (nothing is pushed, nothing lingers)

```powershell
Set-Location C:\Users\<you>\Shramset8.0
git worktree remove --force ..\wurkup-integration
git worktree prune
git worktree list          # only the main checkout remains
git status --short         # your branches are untouched
git log --oneline -3 origin/arena/2b71e6b4-shramset8-0   # PR #11: unchanged
git log --oneline -3 origin/arena/ec593218-shramset8-0   # PR #12: unchanged
```

Because the worktree is on a **detached HEAD**, `git push` from it cannot publish
anything; there is no local integration branch to push either. If you prefer a named
local branch, create it as `local/integration-pr11-pr12` and treat it as throwaway —
never `git push` it, and delete it with `git branch -D local/integration-pr11-pr12`
before finishing.

## 7. What must not happen

- Do not merge PR #11 or PR #12 on GitHub as part of this test.
- Do not push the integration worktree or any merge commit from it.
- Do not resolve the conflicts by dropping either PR's test command or render block.
- Do not commit `.env.local`, keys, tokens or any credential.
- Do not change Supabase schema, RLS, grants, auth settings or production data.

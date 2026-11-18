/**
 * WURK UP — RLS/privilege contract regression test (static).
 *
 * The live behaviour is covered by `supabase/tests/rls_permissions.sql`; this test
 * guards the repository so the 42501 class of bug cannot come back through a future
 * migration:
 *
 *   1. No policy may filter on `workers.user_id` directly (policies run with the
 *      caller's privileges, and that column is intentionally not granted).
 *   2. The helper functions that replaced those subqueries must be SECURITY DEFINER
 *      with an empty search_path.
 *   3. `public.workers` must never receive a table-wide SELECT grant.
 *   4. The participant policies must reference the helper, not a subquery on workers.
 *
 * Run with: npx tsx scripts/rls-contract-test.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const MIGRATIONS = join(ROOT, 'supabase/migrations');

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed += 1;
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort();

/** Strip SQL comments so prose in a header can never satisfy or trip a regex. */
const stripComments = (sql: string): string =>
  sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');

const sources = files.map((name) => ({
  name,
  sql: stripComments(readFileSync(join(MIGRATIONS, name), 'utf8')),
}));

check('the six baseline migrations are still present', files.length >= 6, `${files.length} files`);
check(
  'the worker-identity fix migration exists',
  files.includes('20261117120000_worker_identity_rls_helpers.sql'),
  files.join(', ')
);

/* 1. Policies must not reference workers.user_id directly. */
/** Effective definition of each policy = the last CREATE POLICY across migrations. */
const effectivePolicies = new Map<string, { name: string; statement: string }>();
for (const { name, sql } of sources) {
  for (const match of sql.matchAll(/CREATE POLICY\s+([a-z_]+)[\s\S]*?;/gi)) {
    effectivePolicies.set(match[1].toLowerCase(), { name, statement: match[0] });
  }
}
const policyStatements = Array.from(effectivePolicies.values());

const offending = policyStatements.filter(({ statement }) =>
  /FROM\s+public\.workers/i.test(statement) && /user_id\s*=\s*auth\.uid\(\)/i.test(statement)
);

check(
  'no CREATE POLICY filters on workers.user_id inside a subquery',
  offending.length === 0,
  offending.map((item) => item.name).join(', ')
);

/* 2. Helper functions must be security definer with a pinned search_path. */
const helperNames = ['is_current_worker', 'is_assigned_contractor', 'can_read_worker'];
for (const helper of helperNames) {
  const definition = sources
    .map(({ sql }) => sql)
    .join('\n')
    .match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${helper}\\([\\s\\S]*?\\$\\$;`, 'i'))?.[0];
  check(`helper ${helper}() is defined`, Boolean(definition), 'missing definition');
  if (!definition) continue;
  check(`${helper}() is SECURITY DEFINER`, /SECURITY DEFINER/i.test(definition));
  check(`${helper}() pins search_path`, /SET search_path = ''/i.test(definition));
  check(`${helper}() is STABLE`, /\bSTABLE\b/i.test(definition));
  check(`${helper}() returns boolean only`, /RETURNS boolean/i.test(definition));
}

/* 3. Replay the worker grants in migration order and inspect the end state. */
let tableWideSelect = false;
const grantedColumns = new Set<string>();
for (const { sql } of sources) {
  for (const match of sql.matchAll(/REVOKE\s+ALL\s+ON\s+public\.workers[^;]*;/gi)) {
    void match;
    tableWideSelect = false;
    grantedColumns.clear();
  }
  for (const match of sql.matchAll(/GRANT\s+SELECT\s+ON\s+public\.workers[^;]*;/gi)) {
    tableWideSelect = true;
  }
  for (const match of sql.matchAll(/GRANT\s+SELECT\s*\(([^)]*)\)\s*ON\s+public\.workers[^;]*;/gi)) {
    for (const column of match[1].split(',')) {
      const name = column.trim().toLowerCase();
      if (name) grantedColumns.add(name);
    }
  }
}
check('effective worker privilege is never a table-wide SELECT', tableWideSelect === false);
check('worker directory columns are granted', grantedColumns.size > 0, `${grantedColumns.size} columns`);
check('workers.user_id is never granted', !grantedColumns.has('user_id'), [...grantedColumns].join(','));
check('no private identity columns are granted',
  ['phone', 'aadhaar_last4', 'eshram_uan', 'bocw_registration_no', 'bank_account_last4', 'ifsc_code', 'upi_id', 'blood_group']
    .every((column) => !grantedColumns.has(column)),
  [...grantedColumns].join(','));

/* 4. Participant policies must use the helper. */
const participantPolicies = ['attendance_participant_read', 'ledger_participant_read', 'dispute_participant_read', 'approval_participant_read'];
for (const policy of participantPolicies) {
  const definition = effectivePolicies.get(policy)?.statement;
  check(`${policy} exists`, Boolean(definition));
  if (!definition) continue;
  check(`${policy} reads through can_read_worker()/is_current_worker()`,
    /public\.(can_read_worker|is_current_worker)\s*\(/i.test(definition), definition.slice(0, 120));
}

const writePolicies = ['dispute_worker_create', 'approval_worker_respond'];
for (const policy of writePolicies) {
  const definition = effectivePolicies.get(policy)?.statement;
  check(`${policy} exists`, Boolean(definition));
  if (!definition) continue;
  check(`${policy} is scoped by is_current_worker()`, /public\.is_current_worker\s*\(/i.test(definition));
  check(`${policy} is not granted to anon`, !/TO\s+(anon|public)\b/i.test(definition));
}

/* 5. RLS must remain enabled everywhere it was enabled. */
const disableRls = sources.filter(({ sql }) => /DISABLE ROW LEVEL SECURITY/i.test(sql));
check('no migration disables row level security', disableRls.length === 0,
  disableRls.map((f) => f.name).join(', '));

console.log('\nRLS contract test');
console.log('=================');
if (failures.length === 0) {
  console.log(`PASSED ${passed}/${passed} checks`);
  process.exit(0);
}
console.log(`PASSED ${passed}/${passed + failures.length} checks\n`);
for (const failure of failures) console.log(`  FAIL ${failure}`);
process.exit(1);

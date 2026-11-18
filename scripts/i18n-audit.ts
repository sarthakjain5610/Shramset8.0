/**
 * WURK UP — English/Hindi translation audit.
 *
 * Two independent checks:
 *
 *   A. Dictionary integrity
 *      - `translations.en` and `translations.hi` must have identical key sets
 *        (the typed dictionary already enforces this at compile time, this proves
 *        it at runtime and catches keys added through `as any`/spreads).
 *      - No Hindi value may be empty, a raw key, or an untranslated copy of the
 *        English value (with a small allowlist for brand names, numerals, units
 *        and identifiers that are legitimately identical).
 *      - Hindi values must contain Devanagari, English values must not.
 *      - No `{placeholder}` may exist in one language but not the other.
 *
 *   B. Hardcoded user-facing text
 *      - Scans every .tsx/.ts source file for JSX text nodes and user-facing
 *        string props (`placeholder`, `title`, `aria-label`, `alt`, `label`)
 *        that contain prose and are not produced by the translation layer.
 *        Anything found is reported with file:line so it can be moved into the
 *        dictionary.
 *
 * Usage:
 *   npx tsx scripts/i18n-audit.ts          # report
 *   npx tsx scripts/i18n-audit.ts --strict # exit 1 when anything is reported
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { translations, type Language } from '../src/services/i18n';
import { PUBLIC_COPY } from '../src/services/publicCopy';

const ROOT = new URL('../', import.meta.url).pathname;
const strict = process.argv.includes('--strict');

type Problem = { kind: string; detail: string };

const problems: Problem[] = [];
const notes: string[] = [];

/* -------------------------------------------------------------------------- */
/* A. Dictionary integrity                                                    */
/* -------------------------------------------------------------------------- */

/** Values that may legitimately be identical in both languages. */
const IDENTICAL_ALLOWLIST = new Set([
  // The language switch shows the target language in its own script on purpose.
  'हिन्दी',
  'English',
  'WURK UP',
  'WURK UP —',
  'PDF',
  'QR',
  'UPI',
  'OTP',
  'SMS',
  'PIN',
  'ABHA',
  'e-Shram',
  'MGNREGA',
  'BOCW',
  'ISO',
  'WURK UP',
]);

const BRAND_TOKENS = ['WURK UP', 'WURKUP', 'WurkUp', 'e-Shram', 'BOCW', 'MGNREGA', 'PDF', 'QR', 'OTP', 'UPI', 'SMS', 'PIN', 'ABHA', 'ESIC', 'EPFO', 'DLO', 'ID'];

const looksLikeBrandOnly = (value: string): boolean => {
  const stripped = BRAND_TOKENS.reduce((acc, token) => acc.split(token).join(' '), value);
  // Remove digits, punctuation and whitespace: anything left is prose.
  const leftover = stripped.replace(/[\s\d.,:;!?()/–—-]/g, '');
  return leftover.length === 0;
};

const hasDevanagari = (value: string): boolean => /[\u0900-\u097F]/.test(value);
const hasLatinLetter = (value: string): boolean => /[A-Za-z]/.test(value);
const placeholders = (value: string): string[] =>
  Array.from(value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)).map((match) => match[1]).sort();

const en = translations.en as Record<string, string>;
const hi = translations.hi as unknown as Record<string, string>;

const enKeys = Object.keys(en);
const hiKeys = Object.keys(hi);

for (const key of enKeys) {
  if (!(key in hi)) problems.push({ kind: 'missing-hi-key', detail: key });
}
for (const key of hiKeys) {
  if (!(key in en)) problems.push({ kind: 'missing-en-key', detail: key });
}

for (const key of enKeys) {
  if (!(key in hi)) continue;
  const enValue = String(en[key]);
  const hiValue = String(hi[key]);

  if (!enValue.trim()) problems.push({ kind: 'empty-en', detail: key });
  if (!hiValue.trim()) problems.push({ kind: 'empty-hi', detail: key });
  if (hiValue === key || enValue === key) problems.push({ kind: 'raw-key', detail: key });

  // Untranslated: identical text that is not purely a brand/number token.
  if (enValue === hiValue && !IDENTICAL_ALLOWLIST.has(enValue) && !looksLikeBrandOnly(enValue)) {
    problems.push({ kind: 'untranslated', detail: `${key} → "${enValue}"` });
  }

  // Language purity: Devanagari text must not leak into English, and substantive
  // Hindi strings must contain Devanagari rather than pure English prose.
  const languageToggle = key.startsWith('toggleTo');
  if (hasDevanagari(enValue) && !languageToggle) problems.push({ kind: 'devanagari-in-en', detail: key });
  if (!hasDevanagari(hiValue) && !looksLikeBrandOnly(hiValue) && hasLatinLetter(hiValue) && !languageToggle) {
    problems.push({ kind: 'no-devanagari-in-hi', detail: `${key} → "${hiValue}"` });
  }
  if (hiValue.includes('{{') || enValue.includes('{{')) {
    problems.push({ kind: 'double-brace', detail: key });
  }

  const enSlots = placeholders(enValue).join(',');
  const hiSlots = placeholders(hiValue).join(',');
  if (enSlots !== hiSlots) {
    problems.push({ kind: 'placeholder-mismatch', detail: `${key} (en:{${enSlots}} hi:{${hiSlots}})` });
  }
}

/* Public shell copy */
const flatten = (value: unknown, prefix = ''): Record<string, string> => {
  if (typeof value === 'string') return { [prefix]: value };
  if (Array.isArray(value)) {
    return value.reduce<Record<string, string>>((acc, item, index) => {
      Object.assign(acc, flatten(item, `${prefix}[${index}]`));
      return acc;
    }, {});
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
      (acc, [key, child]) => {
        Object.assign(acc, flatten(child, prefix ? `${prefix}.${key}` : key));
        return acc;
      },
      {}
    );
  }
  return {};
};

const publicEn = flatten(PUBLIC_COPY.en);
const publicHi = flatten(PUBLIC_COPY.hi);
for (const key of Object.keys(publicEn)) {
  if (!(key in publicHi)) problems.push({ kind: 'missing-public-hi-key', detail: key });
}
for (const key of Object.keys(publicHi)) {
  if (!(key in publicEn)) problems.push({ kind: 'missing-public-en-key', detail: key });
}
for (const key of Object.keys(publicEn)) {
  if (!(key in publicHi)) continue;
  const enValue = publicEn[key];
  const hiValue = publicHi[key];
  if (enValue === hiValue && !looksLikeBrandOnly(enValue) && !IDENTICAL_ALLOWLIST.has(enValue)) {
    problems.push({ kind: 'public-untranslated', detail: `${key} → "${enValue}"` });
  }
  if (!hasDevanagari(hiValue) && !looksLikeBrandOnly(hiValue) && hasLatinLetter(hiValue)) {
    problems.push({ kind: 'public-no-devanagari-in-hi', detail: `${key} → "${hiValue}"` });
  }
  if (hasDevanagari(enValue)) problems.push({ kind: 'public-devanagari-in-en', detail: key });
}

/* -------------------------------------------------------------------------- */
/* B. Hardcoded user-facing text                                              */
/* -------------------------------------------------------------------------- */

const SCAN_DIRS = ['src/components', 'src/services', 'src/hooks'];
const SKIP_FILES = new Set([
  'src/services/i18n.ts',
  'src/services/publicCopy.ts',
  'src/services/pageCopy.ts',
  'src/services/dashboardCopy.ts',
  'src/services/db.ts',
  'src/services/submissionReference.ts',
]);

const SOURCE_EXT = /\.(tsx?|jsx?)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(entry)) out.push(full);
  }
  return out;
}

/** A heuristic: prose has at least three words and at least one lowercase letter. */
const isProse = (text: string): boolean => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 8) return false;
  // Reject code fragments that the JSX heuristic picks up by accident.
  if (/[=(){};'"`<>]/.test(cleaned)) return false;
  if (!/[a-z]/.test(cleaned)) return false;
  const words = cleaned.split(' ').filter((word) => /[a-zA-Z]/.test(word));
  if (words.length < 3) return false;
  // Code often looks like `const [x, setX] = useState`; those are filtered above,
  // this catches other fragments such as `null; // Reset state`.
  const codeish = /\b(const|let|var|useState|useEffect|return|import|export|function)\b/.test(cleaned);
  return !codeish;
};

const ALLOWED_JSX_TEXT = [
  /^WURK UP$/,
  /^[0-9₹:.,%/()\-–—+× ]+$/,
  /^[A-Z0-9]{2,6}$/,
];

/** Text the components may legitimately hold inline (proper nouns, units, enums). */
const IGNORE_CONTEXT = /className=|style=|data-|aria-|role=|key=|id=|href=|type=|name=|value=|onClick|console\.|import |from '/;

const hardcoded: string[] = [];

const lineOf = (source: string, index: number): number => source.slice(0, index).split('\n').length;

for (const dir of SCAN_DIRS) {
  const absolute = join(ROOT, dir);
  let files: string[] = [];
  try {
    files = walk(absolute);
  } catch {
    continue;
  }
  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (SKIP_FILES.has(rel)) continue;
    const source = readFileSync(file, 'utf8');

    // JSX text nodes: >text< with no braces or tags in between.
    const jsxText = /<[A-Za-z][^>]*>\s*([^<>{}\n][^<>{}]*?)\s*</g;
    for (const match of source.matchAll(jsxText)) {
      const text = match[1].replace(/\s+/g, ' ').trim();
      if (!text) continue;
      if (ALLOWED_JSX_TEXT.some((re) => re.test(text))) continue;
      if (!isProse(text)) continue;
      hardcoded.push(`${rel}:${lineOf(source, match.index ?? 0)} "${text.slice(0, 90)}"`);
    }

    // User-facing string props.
    const props = /\b(placeholder|title|alt|aria-label|label|description|subtitle|helperText|emptyMessage)\s*=\s*"([^"]{8,})"/g;
    for (const match of source.matchAll(props)) {
      const text = match[2];
      if (!isProse(text)) continue;
      const before = source.slice(Math.max(0, (match.index ?? 0) - 40), match.index ?? 0);
      if (IGNORE_CONTEXT.test(before)) continue;
      hardcoded.push(`${rel}:${lineOf(source, match.index ?? 0)} ${match[1]}="${text.slice(0, 90)}"`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Report                                                                     */
/* -------------------------------------------------------------------------- */

const byKind = (list: Problem[]) => {
  const grouped = new Map<string, string[]>();
  for (const problem of list) {
    const bucket = grouped.get(problem.kind) ?? [];
    bucket.push(problem.detail);
    grouped.set(problem.kind, bucket);
  }
  return grouped;
};

console.log('WURK UP translation audit');
console.log('=========================');
console.log(`Dictionary keys: en=${enKeys.length} hi=${hiKeys.length}`);
console.log(`Public shell keys: en=${Object.keys(publicEn).length} hi=${Object.keys(publicHi).length}`);
console.log('');

if (problems.length === 0) {
  console.log('A. Dictionary integrity: PASS (no missing, empty or untranslated keys)');
} else {
  console.log(`A. Dictionary integrity: ${problems.length} problem(s)`);
  for (const [kind, details] of byKind(problems)) {
    console.log(`  - ${kind} (${details.length})`);
    for (const detail of details.slice(0, 40)) console.log(`      ${detail}`);
    if (details.length > 40) console.log(`      … ${details.length - 40} more`);
  }
}

console.log('');
if (hardcoded.length === 0) {
  console.log('B. Hardcoded user-facing text: PASS (none found)');
} else {
  console.log(`B. Hardcoded user-facing text: ${hardcoded.length} occurrence(s) in ${new Set(hardcoded.map((h) => h.split(':')[0])).size} file(s)`);
  for (const item of hardcoded.slice(0, 120)) console.log(`  - ${item}`);
  if (hardcoded.length > 120) console.log(`  … ${hardcoded.length - 120} more`);
}

for (const note of notes) console.log(`note: ${note}`);

const failed = problems.length > 0 || (strict && hardcoded.length > 0);
console.log('');
console.log(failed ? 'AUDIT RESULT: FAIL' : 'AUDIT RESULT: PASS');
if (strict && hardcoded.length > 0) {
  console.log(`(strict mode: ${hardcoded.length} hardcoded string(s) must be moved into the dictionaries)`);
}
process.exit(failed ? 1 : 0);

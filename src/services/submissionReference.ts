/**
 * WURK UP — internal submission references.
 *
 * WURK UP records grievances inside the platform. It does not submit them to the
 * District Labour Office, a labour court, or any government authority, and it does
 * not open an official complaint on a worker's behalf. The references below are
 * therefore WURK UP tracking identifiers, not government filing numbers.
 *
 * Storage note: the deployed column `public.disputes.dlo_filing_ref` keeps its
 * original name for backwards compatibility with the deployed schema. Only the
 * generated value (now `WU-DSP-…`) and its presentation changed. No migration is
 * required and no data is rewritten.
 *
 * Format:  WU-DSP-YYYYMMDD-XXXXXXXXXX
 *   WU-DSP    WURK UP dispute submission
 *   YYYYMMDD  local calendar date the record was created
 *   XXXXXXXXXX  10 characters from a 32-symbol unambiguous alphabet
 */

export const SUBMISSION_REFERENCE_PREFIX = 'WU-DSP';
export const SUBMISSION_REFERENCE_BODY_LENGTH = 10;

/** Crockford-style alphabet: no `I` or `O`, so a spoken or handwritten code is unambiguous. */
const REFERENCE_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';

const REFERENCE_PATTERN = /^WU-DSP-(\d{4})(\d{2})(\d{2})-[0-9A-HJ-NP-Z]{10}$/;

/** Local calendar date as `YYYY-MM-DD` (not UTC, so the reference matches the filing date shown). */
export function localIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function randomSymbols(length: number): string {
  const output: string[] = [];
  const alphabetSize = REFERENCE_ALPHABET.length; // 32 — divides 256 evenly, so no modulo bias
  const buffer = new Uint8Array(length);

  const canUseCrypto =
    typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function';

  if (canUseCrypto) {
    crypto.getRandomValues(buffer);
    for (let i = 0; i < length; i += 1) {
      output.push(REFERENCE_ALPHABET[buffer[i] % alphabetSize]);
    }
    return output.join('');
  }

  for (let i = 0; i < length; i += 1) {
    output.push(REFERENCE_ALPHABET[Math.floor(Math.random() * alphabetSize)]);
  }
  return output.join('');
}

/** Builds `WU-DSP-YYYYMMDD-XXXXXXXXXX`. */
export function buildSubmissionReference(date: Date = new Date()): string {
  const stamp = localIsoDate(date).replace(/-/g, '');
  return `${SUBMISSION_REFERENCE_PREFIX}-${stamp}-${randomSymbols(SUBMISSION_REFERENCE_BODY_LENGTH)}`;
}

/** True when a stored value is a WURK UP reference in the current format. */
export function isSubmissionReference(value: string | null | undefined): boolean {
  return typeof value === 'string' && REFERENCE_PATTERN.test(value);
}

/**
 * True for references written before the terminology correction (`DLO-…`,
 * `MP-DLO-…`, `DLO-IND-WAGE-…`). Rows are never rewritten; they are only
 * labelled as legacy records in the UI.
 */
export function isLegacyGovernmentStyleReference(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^DLO-|^MP-DLO-/i.test(value);
}

/** The date encoded in a WURK UP reference, or `null` when the format does not match. */
export function referenceDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = REFERENCE_PATTERN.exec(value);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

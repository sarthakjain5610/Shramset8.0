/**
 * WURK UP — Dashboard analytics.
 *
 * Pure functions only: no React, no network, no clock reads except where an
 * explicit `today` argument is supplied. This keeps every wage figure in the
 * dashboards reproducible and unit-testable.
 *
 * Money is carried in integer paise everywhere; rupees only appear at the
 * formatting boundary. `wage_ledger_entries.amount_paise` is signed — positive
 * for earnings/allowances, negative for advances, deductions and payouts.
 */

import type {
  CloudAttendanceRow,
  CloudLedgerRow,
  CloudDisputeRow,
  CloudApprovalRow,
  LedgerType,
  AckStatus,
  PaymentMode,
  DisputeType,
  DisputeStatus,
  ApprovalAction,
  ApprovalStatus,
  ShiftType,
} from '../services/dashboardData';

export const PAISE_PER_RUPEE = 100;

/* ------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* ------------------------------------------------------------------------- */

/** Formats integer paise as an Indian-grouped rupee amount. */
export function formatPaise(paise: number | null | undefined): string {
  if (paise == null || !Number.isFinite(paise)) return '—';
  const negative = paise < 0;
  const rupees = Math.abs(paise) / PAISE_PER_RUPEE;
  const hasFraction = Math.abs(paise) % PAISE_PER_RUPEE !== 0;
  const body = rupees.toLocaleString('en-IN', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${negative ? '−' : ''}₹${body}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-11-04` → `4 Nov 2026`. Dates are already calendar dates from Postgres. */
export function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const [, y, m, d] = match;
  const monthIndex = Number(m) - 1;
  if (monthIndex < 0 || monthIndex > 11) return iso;
  return `${Number(d)} ${MONTHS[monthIndex]} ${y}`;
}

/** `2026-11-04` → `4 Nov`. */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const [, , m, d] = match;
  const monthIndex = Number(m) - 1;
  if (monthIndex < 0 || monthIndex > 11) return iso;
  return `${Number(d)} ${MONTHS[monthIndex]}`;
}

/** Trims Postgres `HH:MM:SS` to `HH:MM`. */
export function formatClock(time: string | null | undefined): string {
  if (!time) return '—';
  return time.slice(0, 5);
}

/** `2026-11-04T09:12:00Z` → `4 Nov 2026, 09:12`. */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatIsoDate(value);
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${dd} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${hh}:${mm}`;
}

/** Calendar month bucket key, e.g. `2026-11`. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** `2026-11` → `Nov 2026`. */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const monthIndex = Number(m) - 1;
  if (!y || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) return key;
  return `${MONTHS[monthIndex]} ${y}`;
}

export function todayIso(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isoDaysAgo(days: number, now: Date = new Date()): string {
  const copy = new Date(now.getTime());
  copy.setDate(copy.getDate() - days);
  return todayIso(copy);
}

/* ------------------------------------------------------------------------- */
/* Attendance                                                                 */
/* ------------------------------------------------------------------------- */

export interface AttendanceSummary {
  shifts: number;
  fullShifts: number;
  halfShifts: number;
  overtimeShifts: number;
  overtimeHours: number;
  shiftWagePaise: number;
  geoVerifiedShifts: number;
  distinctSites: number;
  distinctWorkers: number;
}

export function summarizeAttendance(rows: CloudAttendanceRow[]): AttendanceSummary {
  const summary: AttendanceSummary = {
    shifts: rows.length,
    fullShifts: 0,
    halfShifts: 0,
    overtimeShifts: 0,
    overtimeHours: 0,
    shiftWagePaise: 0,
    geoVerifiedShifts: 0,
    distinctSites: 0,
    distinctWorkers: 0,
  };
  const sites = new Set<string>();
  const workers = new Set<string>();

  for (const row of rows) {
    if (row.status === 'half_day') summary.halfShifts += 1;
    else if (row.status === 'overtime') summary.overtimeShifts += 1;
    else summary.fullShifts += 1;

    summary.overtimeHours += Number(row.overtime_hours) || 0;
    summary.shiftWagePaise += Number(row.calculated_wage_paise) || 0;
    if (row.geo_verified) summary.geoVerifiedShifts += 1;
    if (row.site_id) sites.add(row.site_id);
    if (row.worker_id) workers.add(row.worker_id);
  }

  summary.distinctSites = sites.size;
  summary.distinctWorkers = workers.size;
  return summary;
}

export interface AttendanceTrendPoint {
  date: string;
  shifts: number;
  wagePaise: number;
}

/** Oldest-first daily series for the last `days` calendar days (inclusive of today). */
export function attendanceTrend(
  rows: CloudAttendanceRow[],
  days = 14,
  now: Date = new Date()
): AttendanceTrendPoint[] {
  const buckets = new Map<string, AttendanceTrendPoint>();
  const span = Math.max(1, Math.floor(days));
  for (let offset = span - 1; offset >= 0; offset -= 1) {
    const date = isoDaysAgo(offset, now);
    buckets.set(date, { date, shifts: 0, wagePaise: 0 });
  }
  for (const row of rows) {
    const bucket = buckets.get(row.date);
    if (!bucket) continue;
    bucket.shifts += 1;
    bucket.wagePaise += Number(row.calculated_wage_paise) || 0;
  }
  return Array.from(buckets.values());
}

/** Groups attendance by worker for the contractor roster. */
export function groupAttendanceByWorker(rows: CloudAttendanceRow[]): Map<string, CloudAttendanceRow[]> {
  const grouped = new Map<string, CloudAttendanceRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.worker_id);
    if (list) list.push(row);
    else grouped.set(row.worker_id, [row]);
  }
  return grouped;
}

/** Shifts recorded on one calendar date. */
export function attendanceOnDate(rows: CloudAttendanceRow[], date: string): CloudAttendanceRow[] {
  return rows.filter((row) => row.date === date);
}

/** Distinct months present in a record set, newest first. */
export function monthsPresent(isoDates: string[]): string[] {
  const keys = new Set<string>();
  for (const iso of isoDates) if (iso) keys.add(monthKey(iso));
  return Array.from(keys).sort((a, b) => (a < b ? 1 : -1));
}

/* ------------------------------------------------------------------------- */
/* Wage ledger                                                                */
/* ------------------------------------------------------------------------- */

export interface LedgerSummary {
  entries: number;
  earnedPaise: number;
  paidPaise: number;
  deductionsPaise: number;
  netPaise: number;
  settledEntries: number;
  pendingEntries: number;
  awaitingAcknowledgment: number;
  acknowledgedEntries: number;
  disputedEntries: number;
  disputedPaise: number;
}

const ACK_COMPLETE: AckStatus[] = ['acknowledged_by_worker'];
const ACK_DISPUTED: AckStatus[] = ['disputed'];

export function isAwaitingAcknowledgment(status: AckStatus): boolean {
  return !ACK_COMPLETE.includes(status) && !ACK_DISPUTED.includes(status);
}

export function summarizeLedger(rows: CloudLedgerRow[]): LedgerSummary {
  const summary: LedgerSummary = {
    entries: rows.length,
    earnedPaise: 0,
    paidPaise: 0,
    deductionsPaise: 0,
    netPaise: 0,
    settledEntries: 0,
    pendingEntries: 0,
    awaitingAcknowledgment: 0,
    acknowledgedEntries: 0,
    disputedEntries: 0,
    disputedPaise: 0,
  };

  for (const row of rows) {
    const amount = Number(row.amount_paise) || 0;
    if (amount > 0) summary.earnedPaise += amount;
    else summary.paidPaise += Math.abs(amount);

    if (row.type === 'deduction' || row.type === 'penalty_adjustment') {
      summary.deductionsPaise += Math.abs(amount);
    }
    summary.netPaise += amount;

    if (row.status === 'settled') summary.settledEntries += 1;
    else summary.pendingEntries += 1;

    if (isAwaitingAcknowledgment(row.acknowledgment_status)) summary.awaitingAcknowledgment += 1;
    else if (ACK_COMPLETE.includes(row.acknowledgment_status)) summary.acknowledgedEntries += 1;

    if (ACK_DISPUTED.includes(row.acknowledgment_status)) {
      summary.disputedEntries += 1;
      summary.disputedPaise += Math.abs(amount);
    }
  }

  return summary;
}

/** Signed balance: positive means the contractor still owes the worker. */
export function balancePaise(rows: CloudLedgerRow[]): number {
  return rows.reduce((total, row) => total + (Number(row.amount_paise) || 0), 0);
}

export function groupLedgerByWorker(rows: CloudLedgerRow[]): Map<string, CloudLedgerRow[]> {
  const grouped = new Map<string, CloudLedgerRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.worker_id);
    if (list) list.push(row);
    else grouped.set(row.worker_id, [row]);
  }
  return grouped;
}

/* ------------------------------------------------------------------------- */
/* Approvals and disputes                                                     */
/* ------------------------------------------------------------------------- */

export function pendingApprovals(rows: CloudApprovalRow[]): CloudApprovalRow[] {
  return rows.filter((row) => row.status === 'pending');
}

export interface DisputeSummary {
  total: number;
  open: number;
  resolved: number;
  closed: number;
  claimedPaise: number;
}

const CLOSED_DISPUTE_STATUSES: DisputeStatus[] = ['settled'];

export function summarizeDisputes(rows: CloudDisputeRow[]): DisputeSummary {
  const summary: DisputeSummary = { total: rows.length, open: 0, resolved: 0, closed: 0, claimedPaise: 0 };
  for (const row of rows) {
    summary.claimedPaise += Number(row.claimed_amount_paise) || 0;
    if (row.contractor_response) summary.resolved += 1;
    if (CLOSED_DISPUTE_STATUSES.includes(row.status)) summary.closed += 1;
    else summary.open += 1;
  }
  return summary;
}

/** Number of days a dispute has been open, used to flag ageing cases. */
export function daysOpen(filingDate: string, now: Date = new Date()): number {
  const filed = new Date(`${filingDate}T00:00:00`);
  if (Number.isNaN(filed.getTime())) return 0;
  const diff = now.getTime() - filed.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

/* ------------------------------------------------------------------------- */
/* Lookup tables for labels and tones                                        */
/* ------------------------------------------------------------------------- */

export type Tone = 'neutral' | 'positive' | 'warning' | 'critical' | 'info';

export interface LabelPair {
  en: string;
  hi: string;
}

export const SHIFT_LABELS: Record<ShiftType, LabelPair> = {
  full_day: { en: 'Full day', hi: 'पूरा दिन' },
  half_day: { en: 'Half day', hi: 'आधा दिन' },
  overtime_2h: { en: '+2h overtime', hi: '+2 घंटे ओवरटाइम' },
  overtime_4h: { en: '+4h overtime', hi: '+4 घंटे ओवरटाइम' },
};

export const LEDGER_TYPE_LABELS: Record<LedgerType, LabelPair> = {
  daily_credit: { en: 'Daily credit', hi: 'दैनिक जमा' },
  advance_kharcha: { en: 'Advance (kharcha)', hi: 'अग्रिम (खर्चा)' },
  weekly_settlement: { en: 'Weekly settlement', hi: 'साप्ताहिक भुगतान' },
  bonus: { en: 'Bonus', hi: 'बोनस' },
  penalty_adjustment: { en: 'Penalty adjustment', hi: 'जुर्माना समायोजन' },
  deduction: { en: 'Deduction', hi: 'कटौती' },
};

export const PAYMENT_MODE_LABELS: Record<PaymentMode, LabelPair> = {
  cash: { en: 'Cash', hi: 'नकद' },
  upi: { en: 'UPI', hi: 'यूपीआई' },
  bank_transfer: { en: 'Bank transfer', hi: 'बैंक ट्रांसफर' },
};

export const ACK_LABELS: Record<AckStatus, LabelPair> = {
  unpaid: { en: 'Unpaid', hi: 'अवैतनिक' },
  partially_paid: { en: 'Partially paid', hi: 'आंशिक भुगतान' },
  recorded_by_contractor: { en: 'Recorded by contractor', hi: 'ठेकेदार द्वारा दर्ज' },
  acknowledged_by_worker: { en: 'Acknowledged by worker', hi: 'श्रमिक द्वारा पुष्ट' },
  disputed: { en: 'Disputed', hi: 'विवादित' },
};

export const DISPUTE_TYPE_LABELS: Record<DisputeType, LabelPair> = {
  unpaid_wages: { en: 'Unpaid wages', hi: 'अवैतनिक मजदूरी' },
  arbitrary_deduction: { en: 'Arbitrary deduction', hi: 'मनमानी कटौती' },
  denied_overtime: { en: 'Denied overtime', hi: 'ओवरटाइम से इनकार' },
  unsafe_conditions: { en: 'Unsafe conditions', hi: 'असुरक्षित स्थिति' },
  bocw_benefit_denial: { en: 'BOCW benefit denial', hi: 'BOCW लाभ से वंचना' },
};

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, LabelPair> = {
  submitted: { en: 'Submitted', hi: 'दर्ज' },
  under_inquiry: { en: 'Under inquiry', hi: 'जांच में' },
  notice_issued: { en: 'Notice issued', hi: 'नोटिस जारी' },
  settled: { en: 'Settled', hi: 'निपटाया' },
};

export const APPROVAL_ACTION_LABELS: Record<ApprovalAction, LabelPair> = {
  attendance_confirmation: { en: 'Attendance confirmation', hi: 'उपस्थिति पुष्टि' },
  wage_payment_acknowledgment: { en: 'Wage payment acknowledgment', hi: 'मजदूरी भुगतान पुष्टि' },
  site_joining: { en: 'Site joining', hi: 'साइट जॉइनिंग' },
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, LabelPair> = {
  pending: { en: 'Awaiting response', hi: 'उत्तर प्रतीक्षित' },
  approved: { en: 'Approved', hi: 'स्वीकृत' },
  rejected: { en: 'Rejected', hi: 'अस्वीकृत' },
  reported_suspicious: { en: 'Reported suspicious', hi: 'संदिग्ध बताया' },
};

export const ACK_TONES: Record<AckStatus, Tone> = {
  unpaid: 'critical',
  partially_paid: 'warning',
  recorded_by_contractor: 'info',
  acknowledged_by_worker: 'positive',
  disputed: 'critical',
};

export const DISPUTE_TONES: Record<DisputeStatus, Tone> = {
  submitted: 'info',
  under_inquiry: 'warning',
  notice_issued: 'warning',
  settled: 'positive',
};

export const APPROVAL_TONES: Record<ApprovalStatus, Tone> = {
  pending: 'warning',
  approved: 'positive',
  rejected: 'critical',
  reported_suspicious: 'critical',
};

export function pickLabel(pair: LabelPair | undefined, lang: 'en' | 'hi'): string {
  if (!pair) return '—';
  return lang === 'hi' ? pair.hi : pair.en;
}

export function skillLabel(skill: string, lang: 'en' | 'hi'): string {
  const map: Record<string, LabelPair> = {
    unskilled: { en: 'Unskilled', hi: 'अकुशल' },
    semi_skilled: { en: 'Semi-skilled', hi: 'अर्ध-कुशल' },
    skilled: { en: 'Skilled', hi: 'कुशल' },
    highly_skilled: { en: 'Highly skilled', hi: 'अति-कुशल' },
  };
  return pickLabel(map[skill], lang);
}

/** Initials for avatar chips, tolerant of Devanagari names. */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

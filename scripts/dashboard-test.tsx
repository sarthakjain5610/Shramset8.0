/**
 * WURK UP — Dashboard test suite.
 *
 * Covers three things that must not silently regress:
 *
 *   1. Money and aggregation maths (integer paise, signed ledger, trends).
 *   2. The RLS contract the dashboards query against — column projections must
 *      never include columns the database does not grant, and private worker
 *      fields must never reach a contractor view.
 *   3. Server-side rendering of every dashboard panel with realistic fixtures,
 *      so an empty or oddly shaped row can't crash a screen.
 *
 * Run with: npx tsx scripts/dashboard-test.tsx
 */
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:3000/#/home',
  pretendToBeVisual: true,
});
const w = dom.window as unknown as Window & typeof globalThis;
Object.assign(globalThis as any, {
  window: w,
  document: w.document,
  localStorage: w.localStorage,
  HTMLElement: w.HTMLElement,
  Element: w.Element,
  Node: w.Node,
  getComputedStyle: w.getComputedStyle,
});
Object.defineProperty(globalThis, 'navigator', {
  value: w.navigator,
  configurable: true,
  writable: true,
});

const { renderToString } = await import('react-dom/server');

import {
  formatPaise,
  formatIsoDate,
  formatShortDate,
  formatClock,
  monthKey,
  monthLabel,
  monthsPresent,
  todayIso,
  isoDaysAgo,
  summarizeAttendance,
  summarizeLedger,
  attendanceTrend,
  attendanceOnDate,
  groupLedgerByWorker,
  balancePaise,
  isAwaitingAcknowledgment,
  pendingApprovals,
  summarizeDisputes,
  daysOpen,
  initialsOf,
  pickLabel,
  skillLabel,
  LEDGER_TYPE_LABELS,
} from '../src/services/dashboardAnalytics';
import {
  classifyDataError,
  validateDisputeInput,
  DIRECTORY_COLUMNS,
  ATTENDANCE_COLUMNS,
  LEDGER_COLUMNS,
  DISPUTE_COLUMNS,
  APPROVAL_COLUMNS,
  SITE_COLUMNS,
  SUPPORTED_TRADES,
  SKILL_LEVELS,
  type CloudAttendanceRow,
  type CloudLedgerRow,
  type CloudDisputeRow,
  type CloudApprovalRow,
  type CloudSiteRow,
  type CloudAssignmentRow,
  type NewDisputeInput,
} from '../src/services/dashboardData';
import { allDashboardKeys, dashboardCopy, dc } from '../src/components/dashboard/dashboardCopy';
import {
  buildSubmissionReference,
  isSubmissionReference,
  isLegacyGovernmentStyleReference,
  referenceDate,
  localIsoDate,
  SUBMISSION_REFERENCE_PREFIX,
} from '../src/services/submissionReference';
import type { CloudWorkerDirectoryRecord, UserProfile, Worker, DisputeGrievance } from '../src/types';
import { GrievanceRedressal } from '../src/components/GrievanceRedressal';
import { WorkerOverview } from '../src/components/dashboard/worker/WorkerOverview';
import { WorkerAttendance } from '../src/components/dashboard/worker/WorkerAttendance';
import { WorkerWages } from '../src/components/dashboard/worker/WorkerWages';
import { WorkerApprovals } from '../src/components/dashboard/worker/WorkerApprovals';
import { WorkerDisputes } from '../src/components/dashboard/worker/WorkerDisputes';
import { WorkerProfile } from '../src/components/dashboard/worker/WorkerProfile';
import { ContractorOverview } from '../src/components/dashboard/contractor/ContractorOverview';
import { ContractorCrew } from '../src/components/dashboard/contractor/ContractorCrew';
import { ContractorSites } from '../src/components/dashboard/contractor/ContractorSites';
import { ContractorAttendance } from '../src/components/dashboard/contractor/ContractorAttendance';
import { ContractorWages } from '../src/components/dashboard/contractor/ContractorWages';
import { ContractorApprovals } from '../src/components/dashboard/contractor/ContractorApprovals';
import { ContractorDisputes } from '../src/components/dashboard/contractor/ContractorDisputes';

let passed = 0;
let total = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string) {
  total += 1;
  if (condition) {
    passed += 1;
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const noop = () => {};

/* ------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* ------------------------------------------------------------------------- */

const TODAY = todayIso();

const worker: CloudWorkerDirectoryRecord = {
  id: 'WKR-TEST-0001',
  name: 'Sunita Bai Verma',
  hindi_name: 'सुनीता बाई वर्मा',
  trade: 'Head Mason (मुख्य राजमिस्त्री)',
  skill_level: 'skilled',
  daily_base_wage_paise: 55000,
  active_site_id: 'SITE-IND-01',
  contact_sharing_consent: true,
  created_at: '2026-10-01T09:00:00Z',
};

const secondWorker: CloudWorkerDirectoryRecord = {
  ...worker,
  id: 'WKR-TEST-0002',
  name: 'Rameshwar Ahirwar',
  contact_sharing_consent: false,
  daily_base_wage_paise: null,
};

const privatePhone = '9826014820';

const attendance: CloudAttendanceRow[] = [
  {
    id: 'ATT-1',
    worker_id: worker.id,
    site_id: 'SITE-IND-01',
    date: TODAY,
    time_in: '08:00:00',
    time_out: '17:00:00',
    shift_type: 'full_day',
    base_hours: 8,
    overtime_hours: 0,
    calculated_wage_paise: 55000,
    status: 'present',
    supervisor_name: 'Sunil Patel',
    verification_hash: 'a'.repeat(64),
    geo_verified: true,
  },
  {
    id: 'ATT-2',
    worker_id: worker.id,
    site_id: 'SITE-IND-01',
    date: isoDaysAgo(3),
    time_in: '08:00:00',
    time_out: '19:00:00',
    shift_type: 'overtime_2h',
    base_hours: 8,
    overtime_hours: 2,
    calculated_wage_paise: 69000,
    status: 'overtime',
    supervisor_name: 'Sunil Patel',
    verification_hash: 'b'.repeat(64),
    geo_verified: false,
  },
  {
    id: 'ATT-3',
    worker_id: secondWorker.id,
    site_id: 'SITE-IND-01',
    date: TODAY,
    time_in: '08:00:00',
    time_out: '12:00:00',
    shift_type: 'half_day',
    base_hours: 4,
    overtime_hours: 0,
    calculated_wage_paise: 27500,
    status: 'half_day',
    supervisor_name: 'Sunil Patel',
    verification_hash: 'c'.repeat(64),
    geo_verified: true,
  },
  {
    id: 'ATT-4',
    worker_id: worker.id,
    site_id: 'SITE-IND-01',
    date: isoDaysAgo(60),
    time_in: '08:00:00',
    time_out: '17:00:00',
    shift_type: 'full_day',
    base_hours: 8,
    overtime_hours: 0,
    calculated_wage_paise: 50000,
    status: 'present',
    supervisor_name: 'Sunil Patel',
    verification_hash: 'd'.repeat(64),
    geo_verified: true,
  },
];

const ledger: CloudLedgerRow[] = [
  {
    id: 'LDG-1',
    worker_id: worker.id,
    site_id: 'SITE-IND-01',
    date: TODAY,
    type: 'daily_credit',
    amount_paise: 55000,
    description: 'Daily credit for full day',
    hindi_description: 'पूरे दिन की मजदूरी',
    payment_mode: 'cash',
    status: 'settled',
    acknowledgment_status: 'acknowledged_by_worker',
  },
  {
    id: 'LDG-2',
    worker_id: worker.id,
    site_id: 'SITE-IND-01',
    date: isoDaysAgo(2),
    type: 'advance_kharcha',
    amount_paise: -20000,
    description: 'Cash advance',
    payment_mode: 'upi',
    status: 'settled',
    acknowledgment_status: 'recorded_by_contractor',
  },
  {
    id: 'LDG-3',
    worker_id: worker.id,
    site_id: 'SITE-IND-01',
    date: isoDaysAgo(5),
    type: 'deduction',
    amount_paise: -5000,
    description: 'Tool damage deduction',
    payment_mode: 'cash',
    status: 'pending',
    acknowledgment_status: 'disputed',
  },
];

const disputes: CloudDisputeRow[] = [
  {
    id: 'DSP-1',
    worker_id: worker.id,
    contractor_name: 'Narmada Infra',
    contractor_phone: '07312928100',
    site_name: 'Vijay Nagar Metro',
    dispute_type: 'unpaid_wages',
    claimed_amount_paise: 150000,
    incident_date: isoDaysAgo(9),
    filing_date: isoDaysAgo(4),
    status: 'under_inquiry',
    description: 'Two shifts were recorded but the weekly settlement did not include them.',
    dlo_filing_ref: 'WU-DSP-20261107-4H7K2M9QXB',
    evidence_muster_count: 2,
  },
];

const approvals: CloudApprovalRow[] = [
  {
    id: 'APR-1',
    worker_id: worker.id,
    contractor_id: '00000000-0000-4000-8000-000000000001',
    contractor_name: 'Narmada Infra',
    action_type: 'attendance_confirmation',
    record_id: 'ATT-1',
    amount_paise: 55000,
    status: 'pending',
    created_at: '2026-11-08T05:30:00Z',
  },
  {
    id: 'APR-2',
    worker_id: wordSafe(secondWorker.id),
    contractor_id: '00000000-0000-4000-8000-000000000001',
    contractor_name: 'Narmada Infra',
    action_type: 'site_joining',
    record_id: 'SITE-IND-01',
    amount_paise: null,
    status: 'approved',
    created_at: '2026-11-01T05:30:00Z',
    responded_at: '2026-11-02T06:00:00Z',
  },
];

function wordSafe(value: string): string {
  return value;
}

const sites: CloudSiteRow[] = [
  {
    id: 'SITE-IND-01',
    name: 'Vijay Nagar Metro Package 4',
    hindi_name: 'विजय नगर मेट्रो पैकेज 4',
    location: 'Vijay Nagar, Scheme 54',
    city: 'Indore',
    contractor_name: 'Narmada Infra',
    contractor_phone: '07312928100',
    project_type: 'Metro civil',
    active_workers: 12,
    safety_rating: 'Grade A (BOCW Compliant)',
  },
];

const assignments: CloudAssignmentRow[] = [
  {
    id: 'ASG-1',
    worker_id: worker.id,
    contractor_id: '00000000-0000-4000-8000-000000000001',
    created_at: '2026-10-02T05:00:00Z',
  },
];

const contractorUser = { fullName: 'Anil Sisodiya', id: '00000000-0000-4000-8000-000000000001' };

const userProfile: UserProfile = {
  id: contractorUser.id,
  email: 'anil@example.com',
  phone: '+91 731 2928100',
  fullName: contractorUser.fullName,
  role: 'contractor',
  organizationName: 'Narmada Infra',
  contactVerificationStatus: 'number_supplied',
  manualChecks: [],
  consentToShareContact: false,
  privacyAccepted: true,
  qrReferenceToken: 'token',
  createdAt: '2026-10-01T00:00:00Z',
};

/* ------------------------------------------------------------------------- */
/* 1. Formatting                                                              */
/* ------------------------------------------------------------------------- */

check('formatPaise renders whole rupees', formatPaise(55000) === '₹550', formatPaise(55000));
check('formatPaise keeps paise fractions', formatPaise(12345) === '₹123.45', formatPaise(12345));
check('formatPaise groups in Indian style', formatPaise(12345600) === '₹1,23,456', formatPaise(12345600));
check('formatPaise marks negatives', formatPaise(-20000) === '−₹200', formatPaise(-20000));
check('formatPaise handles null', formatPaise(null) === '—');
check('formatIsoDate', formatIsoDate('2026-11-04') === '4 Nov 2026', formatIsoDate('2026-11-04'));
check('formatShortDate', formatShortDate('2026-11-04') === '4 Nov');
check('formatClock trims seconds', formatClock('08:30:00') === '08:30');
check('monthKey', monthKey('2026-11-04') === '2026-11');
check('monthLabel', monthLabel('2026-11') === 'Nov 2026');
check('initialsOf two words', initialsOf('Sunita Bai Verma') === 'SV');
check('initialsOf single word', initialsOf('Rameshwar') === 'RA');
check('skillLabel English', skillLabel('semi_skilled', 'en') === 'Semi-skilled');
check('skillLabel Hindi', skillLabel('skilled', 'hi') === 'कुशल');
check('pickLabel Hindi', pickLabel(LEDGER_TYPE_LABELS.daily_credit, 'hi') === 'दैनिक जमा');

/* ------------------------------------------------------------------------- */
/* 2. Attendance aggregation                                                  */
/* ------------------------------------------------------------------------- */

const workerOneShifts = attendance.filter((row) => row.worker_id === worker.id);
const attSummary = summarizeAttendance(workerOneShifts);
check('attendance shift count', attSummary.shifts === 3, String(attSummary.shifts));
check('attendance overtime hours', attSummary.overtimeHours === 2, String(attSummary.overtimeHours));
check('attendance overtime shifts', attSummary.overtimeShifts === 1);
check('attendance geo verified count', attSummary.geoVerifiedShifts === 2, String(attSummary.geoVerifiedShifts));
check(
  'attendance wage total',
  attSummary.shiftWagePaise === 55000 + 69000 + 50000,
  String(attSummary.shiftWagePaise)
);
check('attendance distinct sites', attSummary.distinctSites === 1);

const trend = attendanceTrend(attendance, 14);
check('trend has 14 buckets', trend.length === 14, String(trend.length));
check('trend ends today', trend[trend.length - 1].date === TODAY);
check(
  'trend counts today only once per worker row',
  trend[trend.length - 1].shifts === 2,
  String(trend[trend.length - 1].shifts)
);
check(
  'trend excludes rows outside the window',
  trend.reduce((sum, point) => sum + point.shifts, 0) === 3,
  String(trend.reduce((sum, point) => sum + point.shifts, 0))
);

check('attendanceOnDate filters by date', attendanceOnDate(attendance, TODAY).length === 2);
check(
  'monthsPresent sorts newest first',
  monthsPresent(attendance.map((row) => row.date))[0] === monthKey(TODAY)
);

/* ------------------------------------------------------------------------- */
/* 3. Ledger maths                                                            */
/* ------------------------------------------------------------------------- */

const ledgerSummary = summarizeLedger(ledger);
check('ledger credits', ledgerSummary.earnedPaise === 55000, String(ledgerSummary.earnedPaise));
check('ledger payouts', ledgerSummary.paidPaise === 25000, String(ledgerSummary.paidPaise));
check('ledger net', ledgerSummary.netPaise === 30000, String(ledgerSummary.netPaise));
check('ledger deductions', ledgerSummary.deductionsPaise === 5000, String(ledgerSummary.deductionsPaise));
check('ledger disputed total', ledgerSummary.disputedPaise === 5000, String(ledgerSummary.disputedPaise));
check('ledger awaiting ack', ledgerSummary.awaitingAcknowledgment === 1, String(ledgerSummary.awaitingAcknowledgment));
check('ledger settled count', ledgerSummary.settledEntries === 2);
check('ledger pending count', ledgerSummary.pendingEntries === 1);
check('balance matches signed sum', balancePaise(ledger) === 30000);
check('groupLedgerByWorker', groupLedgerByWorker(ledger).get(worker.id)?.length === 3);
check(
  'acknowledgment completeness',
  !isAwaitingAcknowledgment('acknowledged_by_worker') && isAwaitingAcknowledgment('partially_paid')
);
check('empty ledger nets to zero', summarizeLedger([]).netPaise === 0);

/* ------------------------------------------------------------------------- */
/* 4. Approvals and disputes                                                  */
/* ------------------------------------------------------------------------- */

check('pendingApprovals filters', pendingApprovals(approvals).length === 1);
check('pendingApprovals ids', pendingApprovals(approvals)[0].id === 'APR-1');
const disputeSummary = summarizeDisputes(disputes);
check('dispute open count', disputeSummary.open === 1);
check('dispute claimed total', disputeSummary.claimedPaise === 150000);
check('dispute ageing is non-negative', daysOpen(disputes[0].filing_date) >= 0);
check('dispute ageing for future date is zero', daysOpen(isoDaysAgo(-5)) === 0);

/* ------------------------------------------------------------------------- */
/* 4b. Grievance submission references (WURK UP, never a government filing)    */
/* ------------------------------------------------------------------------- */

const sampleRef = buildSubmissionReference(new Date(2026, 10, 11));
check(
  'reference uses the WU-DSP prefix',
  sampleRef.startsWith(`${SUBMISSION_REFERENCE_PREFIX}-`),
  sampleRef
);
check('reference encodes the local date', sampleRef.startsWith('WU-DSP-20261111-'), sampleRef);
check('reference matches WU-DSP-YYYYMMDD-XXXXXXXXXX', /^WU-DSP-\d{8}-[0-9A-HJ-NP-Z]{10}$/.test(sampleRef), sampleRef);
check('reference body is exactly 10 characters', sampleRef.split('-')[3].length === 10, sampleRef);
check('reference alphabet avoids I and O', !/[IO]/.test(sampleRef.split('-')[3]), sampleRef);
check('isSubmissionReference accepts generated values', isSubmissionReference(sampleRef));
check('referenceDate round-trips the encoded date', referenceDate(sampleRef) === '2026-11-11', String(referenceDate(sampleRef)));
check('localIsoDate is zero padded', /^\d{4}-\d{2}-\d{2}$/.test(localIsoDate(new Date(2026, 0, 5))));

const manyRefs = new Set(Array.from({ length: 250 }, () => buildSubmissionReference()));
check('references are effectively unique', manyRefs.size === 250, String(manyRefs.size));
check(
  'every generated reference validates',
  Array.from(manyRefs).every((value) => isSubmissionReference(value))
);

check('empty reference rejected', !isSubmissionReference(''));
check('null reference rejected', !isSubmissionReference(null));
check('old DLO value is not a WURK UP reference', !isSubmissionReference('DLO-20261107-ABC123'));
check('DLO values are detected as legacy', isLegacyGovernmentStyleReference('DLO-20261107-ABC123'));
check('MP-DLO values are detected as legacy', isLegacyGovernmentStyleReference('MP-DLO-IND-41293'));
check('WURK UP values are not legacy', !isLegacyGovernmentStyleReference(sampleRef));
check('legacy detection ignores empty', !isLegacyGovernmentStyleReference(undefined));

// The deployed storage column must keep its historical name: no migration, no rewrite.
check(
  'deployed storage column name is preserved',
  DISPUTE_COLUMNS.includes('dlo_filing_ref'),
  DISPUTE_COLUMNS
);

// No worker-facing dispute label may call the reference a DLO filing.
const disputeCopyKeys = [
  'disputesHeading',
  'disputesSub',
  'disputesReference',
  'disputesFormTitle',
  'disputesFormSub',
  'disputesSubmitted',
  'disputesDisclaimerTitle',
  'disputesDisclaimerBody',
  'disputesNotOfficial',
  'contractorDisputesSub',
] as const;
const dloMentions = disputeCopyKeys.filter((key) =>
  /\bDLO\b/.test(dashboardCopy.en[key]) || /DLO/.test(dashboardCopy.hi[key])
);
check('no dispute label mentions DLO as the filing authority', dloMentions.length === 0, dloMentions.join(','));
check(
  'English reference label names WURK UP',
  dashboardCopy.en.disputesReference === 'WURK UP submission reference',
  dashboardCopy.en.disputesReference
);
check(
  'Hindi reference label names WURK UP',
  dashboardCopy.hi.disputesReference.includes('WURK UP'),
  dashboardCopy.hi.disputesReference
);
check(
  'English disclaimer states no government filing',
  /District Labour Office/.test(dashboardCopy.en.disputesDisclaimerBody) &&
    /does not forward/i.test(dashboardCopy.en.disputesDisclaimerBody)
);
check(
  'Hindi disclaimer states no government filing',
  /जिला श्रम पदाधिकारी/.test(dashboardCopy.hi.disputesDisclaimerBody) &&
    dashboardCopy.hi.disputesDisclaimerBody.includes('नहीं भेजता')
);
check(
  'English short notice is explicit',
  /not a District Labour Office or government filing/i.test(dashboardCopy.en.disputesNotOfficial)
);
check(
  'Hindi short notice is explicit',
  dashboardCopy.hi.disputesNotOfficial.includes('नहीं')
);

/* ------------------------------------------------------------------------- */
/* 5. Validation and error mapping                                            */
/* ------------------------------------------------------------------------- */

const validDispute: NewDisputeInput = {
  workerId: worker.id,
  contractorName: 'Narmada Infra',
  contractorPhone: '07312928100',
  siteName: 'Vijay Nagar Metro',
  disputeType: 'unpaid_wages',
  claimedAmountPaise: 150000,
  incidentDate: isoDaysAgo(3),
  description: 'Two shifts were recorded but never included in the settlement.',
  evidenceMusterCount: 2,
};
check('valid dispute has no problems', validateDisputeInput(validDispute).length === 0);
check('zero amount rejected', validateDisputeInput({ ...validDispute, claimedAmountPaise: 0 }).length === 1);
check(
  'future incident rejected',
  validateDisputeInput({ ...validDispute, incidentDate: isoDaysAgo(-2) }).length === 1
);
check('short statement rejected', validateDisputeInput({ ...validDispute, description: 'too short' }).length === 1);
check(
  'unknown dispute type rejected',
  validateDisputeInput({ ...validDispute, disputeType: 'made_up' as any }).length === 1
);
check('missing contractor rejected', validateDisputeInput({ ...validDispute, contractorName: '  ' }).length === 1);

check('RLS permission error kind', classifyDataError({ code: '42501' }).kind === 'unauthorized');
check(
  'RLS policy text maps to unauthorized',
  classifyDataError({ message: 'new row violates row-level security policy' }).kind === 'unauthorized'
);
check('JWT expiry maps to unauthorized', classifyDataError({ code: 'PGRST301' }).kind === 'unauthorized');
check('duplicate key maps to validation', classifyDataError({ code: '23505' }).kind === 'validation');
check('check constraint maps to validation', classifyDataError({ code: '23514' }).kind === 'validation');
check('foreign key maps to not_found', classifyDataError({ code: '23503' }).kind === 'not_found');
check('fetch failure maps to network', classifyDataError({ message: 'Failed to fetch' }).kind === 'network');
check('unknown failure kind', classifyDataError({ message: 'boom' }).kind === 'unknown');
check('null error kind', classifyDataError(null).kind === 'unknown');

/* ------------------------------------------------------------------------- */
/* 6. RLS contract of the query projections                                   */
/* ------------------------------------------------------------------------- */

check('directory columns exclude user_id', !DIRECTORY_COLUMNS.split(',').includes('user_id'));
check('directory columns exclude phone', !DIRECTORY_COLUMNS.split(',').includes('phone'));
check('directory columns exclude aadhaar', !DIRECTORY_COLUMNS.includes('aadhaar'));
check('ledger projection is explicit', LEDGER_COLUMNS.includes('acknowledgment_status'));
check('attendance projection has verification hash', ATTENDANCE_COLUMNS.includes('verification_hash'));
check('dispute projection has filing ref', DISPUTE_COLUMNS.includes('dlo_filing_ref'));
check('approval projection is explicit', APPROVAL_COLUMNS.includes('responded_at'));
check('site projection has safety rating', SITE_COLUMNS.includes('safety_rating'));
check('eight supported trades', SUPPORTED_TRADES.length === 8, String(SUPPORTED_TRADES.length));
check('four skill levels', SKILL_LEVELS.length === 4);
check(
  'trades match the deployed RPC vocabulary',
  SUPPORTED_TRADES.includes('General Helper & Concrete Batching (बेलदार)')
);

/* ------------------------------------------------------------------------- */
/* 7. Bilingual copy parity                                                   */
/* ------------------------------------------------------------------------- */

check('copy keys are unique and non-empty', allDashboardKeys.length > 100, String(allDashboardKeys.length));
check(
  'every key exists in both languages',
  allDashboardKeys.every((key) => typeof dashboardCopy.en[key] === 'string' && typeof dashboardCopy.hi[key] === 'string')
);
check(
  'no empty translations',
  allDashboardKeys.every((key) => dashboardCopy.en[key].trim().length > 0 && dashboardCopy.hi[key].trim().length > 0)
);
check('hindi differs from english', dc('hi', 'navOverview') !== dc('en', 'navOverview'));
check('unknown language falls back to english', dc('fr' as any, 'navWages') === 'Wages');

/* ------------------------------------------------------------------------- */
/* 8. Panel rendering (both roles, both languages)                            */
/* ------------------------------------------------------------------------- */

const render = (element: React.ReactElement): string => {
  try {
    return renderToString(element);
  } catch (error: any) {
    failures.push(`render threw: ${error?.message ?? String(error)}`);
    return '';
  }
};

const workerShell = render(
  React.createElement(WorkerOverview, {
    lang: 'en',
    worker,
    privateData: null,
    privateDataNotice: null,
    attendance,
    ledger,
    disputes,
    approvals,
  })
);
check('worker overview renders balance', workerShell.includes('₹300'), workerShell.slice(0, 0));
check('worker overview renders worker name', workerShell.includes(worker.name));
check('worker overview renders awaiting count', workerShell.includes('Outstanding balance'));
check('worker overview marks unwired modules', workerShell.includes('What is not connected yet'));

const attendanceHtml = render(React.createElement(WorkerAttendance, { lang: 'en', attendance }));
check('attendance panel renders rows', attendanceHtml.includes('Full day'));
check('attendance panel renders half day', attendanceHtml.includes('Half day'));
check('attendance panel shows supervisor', attendanceHtml.includes('Sunil Patel'));
check('attendance panel shows shift wages', attendanceHtml.includes('₹550') && attendanceHtml.includes('₹275'));

const wagesHtml = render(React.createElement(WorkerWages, { lang: 'en', ledger }));
check('wages panel renders net due', wagesHtml.includes('₹300'));
check('wages panel renders credits', wagesHtml.includes('₹550'));
check('wages panel renders disputed amount', wagesHtml.includes('Disputed amount'));
check('wages panel renders acknowledgment pill', wagesHtml.includes('Acknowledged by worker'));
check('wages hindi descriptions appear in English mode', !wagesHtml.includes('पूरे दिन की मजदूरी'));

const hindiWages = render(React.createElement(WorkerWages, { lang: 'hi', ledger }));
check('wages panel is bilingual', hindiWages.includes('मजदूरी बही'));
check('wages hindi description shown in Hindi mode', hindiWages.includes('पूरे दिन की मजदूरी'));

const approvalsHtml = render(React.createElement(WorkerApprovals, { lang: 'en', approvals, onChanged: noop }));
check('approvals panel renders pending action', approvalsHtml.includes('Approve'));
check('approvals panel renders reject', approvalsHtml.includes('Reject'));
check('approvals panel shows record reference', approvalsHtml.includes('ATT-1'));

const disputesHtml = render(
  React.createElement(WorkerDisputes, {
    lang: 'en',
    worker,
    disputes,
    attendance,
    onChanged: noop,
  })
);
check('grievance history renders the WURK UP reference', disputesHtml.includes('WU-DSP-20261107-4H7K2M9QXB'));
check('disputes panel renders claim', disputesHtml.includes('₹1,500'));
check('disputes panel exposes filing action', disputesHtml.includes('File a dispute'));

const privateNotice = 'worker private record unavailable';
const profileHtml = render(
  React.createElement(WorkerProfile, {
    lang: 'en',
    worker,
    privateData: null,
    privateDataNotice: privateNotice,
    onChanged: noop,
  })
);
check('profile panel renders consent control', profileHtml.includes('Phone sharing'));
check('profile panel surfaces private-data notice', profileHtml.includes(privateNotice));
check('profile panel renders worker id', profileHtml.includes(worker.id));

const contractorOverviewHtml = render(
  React.createElement(ContractorOverview, {
    lang: 'en',
    user: contractorUser,
    workers: [worker, secondWorker],
    sites,
    assignments,
    attendance,
    ledger,
    disputes,
    approvals,
    onChanged: noop,
  })
);
check('contractor overview renders crew count', contractorOverviewHtml.includes('Assigned crew'));
check('contractor overview renders site name', contractorOverviewHtml.includes(sites[0].name));
check('contractor overview renders balance', contractorOverviewHtml.includes('₹300'));

const crewHtml = render(
  React.createElement(ContractorCrew, {
    lang: 'en',
    workers: [worker, secondWorker],
    assignments,
    ledger,
  })
);
check('crew panel renders consent state', crewHtml.includes('Phone sharing on'));
check('crew panel renders wage-not-assigned state', crewHtml.includes('Wage not assigned yet'));
check('crew panel does not leak private phone', !crewHtml.includes(privatePhone));
check('crew panel hides numbers even when consent is on', !crewHtml.includes('9826'));

const sitesHtml = render(React.createElement(ContractorSites, { lang: 'en', sites, workers: [worker] }));
check('sites panel renders safety grade', sitesHtml.includes('BOCW Compliant'));
check('sites panel renders crew slot label', sitesHtml.includes('Worker slots'));

const contractorAttendanceHtml = render(
  React.createElement(ContractorAttendance, { lang: 'en', workers: [worker, secondWorker], attendance })
);
check('contractor attendance renders today rows', contractorAttendanceHtml.includes('Sunita Bai Verma'));
check(
  'contractor attendance renders today shift types',
  contractorAttendanceHtml.includes('Full day') && contractorAttendanceHtml.includes('Half day')
);

const contractorWagesHtml = render(
  React.createElement(ContractorWages, { lang: 'en', workers: [worker, secondWorker], ledger })
);
check('contractor wages renders payable label', contractorWagesHtml.includes('Payable to worker'));
check('contractor wages renders awaiting confirmation', contractorWagesHtml.includes('Awaiting worker confirmation'));

const contractorApprovalsHtml = render(
  React.createElement(ContractorApprovals, {
    lang: 'en',
    user: contractorUser,
    workers: [worker, secondWorker],
    approvals,
    onChanged: noop,
  })
);
check('contractor approvals renders new-request action', contractorApprovalsHtml.includes('New approval request'));
check('contractor approvals renders pending status', contractorApprovalsHtml.includes('Awaiting response'));

const contractorDisputesHtml = render(
  React.createElement(ContractorDisputes, { lang: 'en', workers: [worker], disputes })
);
check('contractor disputes renders response state', contractorDisputesHtml.includes('No contractor response recorded yet.'));
check('contractor disputes is read-only', contractorDisputesHtml.includes('Read-only'));

/* ------------------------------------------------------------------------- */
/* 9. Grievance submission experience (interactive, jsdom)                    */
/* ------------------------------------------------------------------------- */

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');

const legacyDisputes: CloudDisputeRow[] = [
  {
    ...disputes[0],
    id: 'DSP-LEGACY',
    dlo_filing_ref: 'DLO-IND-WAGE-2026/0419',
    filing_date: isoDaysAgo(120),
    description: 'Legacy row recorded before the reference terminology correction.',
  },
  ...disputes,
];

async function openGrievanceForm(lang: 'en' | 'hi') {
  const host = w.document.createElement('div');
  w.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      React.createElement(WorkerDisputes, {
        lang,
        worker,
        disputes: legacyDisputes,
        attendance,
        onChanged: noop,
      })
    );
  });
  const beforeOpen = host.textContent || '';
  const openButton = Array.from(host.querySelectorAll('button')).find((button) =>
    (button.textContent || '').includes(dashboardCopy[lang].actionNewDispute)
  );
  check(`grievance form trigger exists (${lang})`, !!openButton);
  await act(async () => {
    openButton?.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  });
  const text = host.textContent || '';
  const html = host.innerHTML;
  await act(async () => {
    root.unmount();
  });
  host.remove();
  return { text, html, beforeOpen };
}

const enForm = await openGrievanceForm('en');
check('English form states it is a WURK UP internal record', enForm.text.includes(dashboardCopy.en.disputesDisclaimerTitle));
check(
  'English form explains nothing is forwarded to the District Labour Office',
  enForm.text.includes('does not forward it to the District Labour Office')
);
check('English form offers the WURK UP reference label', enForm.text.includes('WURK UP submission reference'));
check('English form never calls the reference a DLO filing', !/DLO reference/i.test(enForm.text));
check('English history keeps the deployed column value readable', enForm.text.includes('DLO-IND-WAGE-2026/0419'));
check('English history marks pre-correction values as legacy', enForm.text.includes('Legacy reference'));
check(
  'English panel shows the short notice before the form is opened',
  enForm.beforeOpen.includes(dashboardCopy.en.disputesNotOfficial)
);
check(
  'English full disclaimer text only appears once the form is open',
  !enForm.beforeOpen.includes('does not forward it to the District Labour Office')
);

const hiForm = await openGrievanceForm('hi');
check('Hindi form states it is a WURK UP internal record', hiForm.text.includes(dashboardCopy.hi.disputesDisclaimerTitle));
check(
  'Hindi form explains nothing is forwarded to the District Labour Office',
  hiForm.text.includes('जिला श्रम पदाधिकारी')
);
check('Hindi form offers the WURK UP reference label', hiForm.text.includes('WURK UP जमा संदर्भ'));
check('Hindi form keeps the reference label free of DLO', !hiForm.text.includes('DLO संदर्भ'));
check('Hindi form shows the Hindi short notice', hiForm.text.includes(dashboardCopy.hi.disputesNotOfficial));
check(
  'Hindi panel shows the short notice before the form is opened',
  hiForm.beforeOpen.includes(dashboardCopy.hi.disputesNotOfficial)
);

// A recorded reference must render as WURK UP, not as a government filing, in both roles.
check(
  'worker history labels the reference as WURK UP',
  disputesHtml.includes('WURK UP submission reference')
);
check('worker history has no DLO filing label', !/DLO reference|DLO filing/i.test(disputesHtml));
check(
  'contractor history labels the reference as WURK UP',
  contractorDisputesHtml.includes('WURK UP submission reference')
);
check('contractor history has no DLO filing label', !/DLO reference|DLO filing/i.test(contractorDisputesHtml));

/* ------------------------------------------------------------------------- */
/* 10. Judge-demo grievance experience (internal record, not a filing)        */
/* ------------------------------------------------------------------------- */

const demoWorker: Worker = {
  id: 'WKR-DEMO-1',
  name: 'Rameshwar Lal Ahirwar',
  hindiName: 'रामेश्वर लाल अहिरवार',
  phone: '+91 98260 14820',
  trade: 'Head Mason (मुख्य राजमिस्त्री)',
  skillLevel: 'skilled',
  dailyBaseWage: 550,
  eShramUAN: '123456789012',
  bocwRegistrationNo: 'MP/BOCW/2026/001',
  aadhaarLast4: '4321',
  bloodGroup: 'B+',
  emergencyContact: { name: 'Sunita Bai', phone: '+91 98260 00000', relation: 'Spouse' },
  photoUrl: '',
  joinedDate: '2026-01-01',
  activeSiteId: 'SITE-IND-01',
};

const demoGrievance: DisputeGrievance = {
  id: 'GRV-DEMO-1',
  workerId: demoWorker.id,
  workerName: demoWorker.name,
  workerPhone: demoWorker.phone,
  contractorName: 'Radhe Construction Services',
  contractorPhone: '+91 94250 81920',
  siteName: 'Super Corridor Ring Road Project',
  disputeType: 'unpaid_wages',
  claimedAmount: 4200,
  incidentDate: '2026-10-28',
  filingDate: '2026-11-04',
  status: 'submitted',
  description: 'Ten days of concrete batching work were recorded but never paid.',
  dloFilingRef: 'WU-DSP-20261104-9M2XQ7KB4T',
  evidenceMusterCount: 10,
  isDemoRecord: true,
};

const createdGrievances: DisputeGrievance[] = [];

async function renderDemoGrievance(lang: 'en' | 'hi') {
  const host = w.document.createElement('div');
  w.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      React.createElement(GrievanceRedressal, {
        worker: demoWorker,
        grievances: [demoGrievance],
        onAddGrievance: (grievance: DisputeGrievance) => {
          createdGrievances.push(grievance);
        },
        lang,
      })
    );
  });
  const text = host.textContent || '';
  const form = host.querySelector('form');
  await act(async () => {
    form?.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    root.unmount();
  });
  host.remove();
  return text;
}

const demoEn = await renderDemoGrievance('en');
check('demo grievance history shows the WURK UP reference', demoEn.includes('WU-DSP-20261104-9M2XQ7KB4T'));
check('demo record header is an internal WURK UP record', demoEn.includes('WURK UP GRIEVANCE RECORD (INTERNAL)'));
check('demo record states it was not submitted anywhere', demoEn.includes('has not been submitted to the'));
check('demo form shows the internal-record notice', demoEn.includes('WURK UP record only'));
check('demo UI never claims a DLO petition', !/BEFORE THE DISTRICT LABOUR OFFICER/i.test(demoEn));
check('demo UI never claims a statutory petition', !/PETITION UNDER SECTION 20/i.test(demoEn));
check('demo UI never claims legal grounding', !/Valid Legal Grounding/i.test(demoEn));

check('demo submission created a grievance', createdGrievances.length === 1, String(createdGrievances.length));
check(
  'demo submission reference is a WURK UP reference',
  createdGrievances.every((row) => isSubmissionReference(row.dloFilingRef)),
  createdGrievances.map((row) => row.dloFilingRef).join(',')
);
check(
  'demo submission reference is not a DLO value',
  createdGrievances.every((row) => !/^DLO-|^MP-DLO-/i.test(row.dloFilingRef))
);

const demoHi = await renderDemoGrievance('hi');
check('demo Hindi record header is internal', demoHi.includes('WURK UP शिकायत रिकॉर्ड (आंतरिक)'));
check('demo Hindi form notice is present', demoHi.includes('केवल WURK UP रिकॉर्ड'));
check('demo Hindi UI never claims a DLO petition', !/जिला श्रम पदाधिकारी इंदौर कानूनी आवेदन पत्र/.test(demoHi));
check(
  'demo Hindi record keeps the internal-record disclaimer',
  demoHi.includes('सरकारी प्राधिकरण में दायर नहीं')
);

/* ------------------------------------------------------------------------- */
/* Report                                                                     */
/* ------------------------------------------------------------------------- */

if (failures.length > 0) {
  console.log('\nDashboard suite failures:');
  for (const failure of failures) console.log(`  ✗ ${failure}`);
}

console.log(`\n===========================================`);
console.log(`DASHBOARD SUITE COMPLETED: ${passed} / ${total} CHECKS PASSED`);
console.log(`===========================================`);

if (userProfile.role !== 'contractor') console.log('fixture guard');
process.exit(failures.length === 0 ? 0 : 1);

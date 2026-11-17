/**
 * WURK UP — Dashboard data access layer.
 *
 * Every query and mutation in this file is written against the deployed
 * row-level-security contract (verified against project ref qpgnoherjkvvasrwjcmf):
 *
 *   workers                     SELECT granted columns only (never `user_id`)
 *   sites                       SELECT scoped to contractors with an assigned worker on site
 *   contractor_worker_assignments SELECT scoped to contractor_id = auth.uid()
 *   attendance_records          SELECT scoped to the worker or an assigned contractor
 *   wage_ledger_entries         SELECT scoped to the worker or an assigned contractor
 *   disputes                    SELECT scoped; INSERT only by the owning worker
 *   approval_requests           SELECT scoped; INSERT by assigning contractor;
 *                               UPDATE limited to (status, responded_at) by the worker
 *
 * Nothing here invents data. When a workflow is not backed by an authorized
 * server-side operation the caller renders an explicit "not connected" state
 * instead of a synthetic record.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { CloudWorkerDirectoryRecord, SkillLevel, WorkerPrivateDataRecord } from '../types';
import { buildSubmissionReference, localIsoDate } from './submissionReference';
import {
  completeMyWorkerOnboarding,
  getAssignedWorkerContact,
  getMyWorkerPrivateData,
  setMyWorkerContactSharing,
} from './workerCloudData';

/** Directory projection: the only worker columns granted to `authenticated`. */
export const DIRECTORY_COLUMNS =
  'id,name,hindi_name,trade,skill_level,daily_base_wage_paise,active_site_id,contact_sharing_consent,created_at';

export const SITE_COLUMNS =
  'id,name,hindi_name,location,city,contractor_name,contractor_phone,project_type,latitude,longitude,active_workers,safety_rating,created_at';

export const ATTENDANCE_COLUMNS =
  'id,worker_id,site_id,date,time_in,time_out,shift_type,base_hours,overtime_hours,calculated_wage_paise,status,supervisor_name,verification_hash,previous_hash,geo_verified,notes';

export const LEDGER_COLUMNS =
  'id,worker_id,site_id,date,type,amount_paise,description,hindi_description,payment_mode,status,acknowledgment_status,acknowledged_at,acknowledged_by_worker_id,utr_or_receipt_no';

export const DISPUTE_COLUMNS =
  'id,worker_id,contractor_name,contractor_phone,site_name,dispute_type,claimed_amount_paise,incident_date,filing_date,status,description,contractor_response,contractor_response_date,dlo_filing_ref,evidence_muster_count';

export const APPROVAL_COLUMNS =
  'id,worker_id,contractor_id,contractor_name,action_type,record_id,amount_paise,status,created_at,responded_at';

export const ASSIGNMENT_COLUMNS = 'id,worker_id,contractor_id,created_at';

/* ------------------------------------------------------------------------- */
/* Row types (mirror the deployed columns)                                    */
/* ------------------------------------------------------------------------- */

export type ShiftType = 'full_day' | 'half_day' | 'overtime_2h' | 'overtime_4h';
export type AttendanceStatus = 'present' | 'half_day' | 'overtime';
export type LedgerType =
  | 'daily_credit'
  | 'advance_kharcha'
  | 'weekly_settlement'
  | 'bonus'
  | 'penalty_adjustment'
  | 'deduction';
export type PaymentMode = 'cash' | 'upi' | 'bank_transfer';
export type LedgerStatus = 'settled' | 'pending';
export type AckStatus =
  | 'unpaid'
  | 'partially_paid'
  | 'recorded_by_contractor'
  | 'acknowledged_by_worker'
  | 'disputed';
export type DisputeType =
  | 'unpaid_wages'
  | 'arbitrary_deduction'
  | 'denied_overtime'
  | 'unsafe_conditions'
  | 'bocw_benefit_denial';
export type DisputeStatus = 'submitted' | 'under_inquiry' | 'notice_issued' | 'settled';
export type ApprovalAction = 'attendance_confirmation' | 'wage_payment_acknowledgment' | 'site_joining';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'reported_suspicious';

export interface CloudSiteRow {
  id: string;
  name: string;
  hindi_name?: string | null;
  location: string;
  city?: string | null;
  contractor_name: string;
  contractor_phone?: string | null;
  project_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  active_workers?: number | null;
  safety_rating?: string | null;
  created_at?: string | null;
}

export interface CloudAssignmentRow {
  id: string;
  worker_id: string;
  contractor_id: string;
  created_at: string;
}

export interface CloudAttendanceRow {
  id: string;
  worker_id: string;
  site_id: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
  shift_type: ShiftType;
  base_hours: number;
  overtime_hours: number;
  calculated_wage_paise: number;
  status: AttendanceStatus;
  supervisor_name: string;
  verification_hash: string;
  previous_hash?: string | null;
  geo_verified?: boolean | null;
  notes?: string | null;
}

export interface CloudLedgerRow {
  id: string;
  worker_id: string;
  site_id: string;
  date: string;
  type: LedgerType;
  amount_paise: number;
  description: string;
  hindi_description?: string | null;
  payment_mode: PaymentMode;
  status: LedgerStatus;
  acknowledgment_status: AckStatus;
  acknowledged_at?: string | null;
  acknowledged_by_worker_id?: string | null;
  utr_or_receipt_no?: string | null;
}

export interface CloudDisputeRow {
  id: string;
  worker_id: string;
  contractor_name: string;
  contractor_phone: string;
  site_name: string;
  dispute_type: DisputeType;
  claimed_amount_paise: number;
  incident_date: string;
  filing_date: string;
  status: DisputeStatus;
  description: string;
  contractor_response?: string | null;
  contractor_response_date?: string | null;
  /**
   * WURK UP submission reference (`WU-DSP-YYYYMMDD-XXXXXXXXXX`).
   * The column keeps its legacy `dlo_filing_ref` name for schema compatibility;
   * it is not a District Labour Office filing number.
   */
  dlo_filing_ref: string;
  evidence_muster_count?: number | null;
}

export interface CloudApprovalRow {
  id: string;
  worker_id: string;
  contractor_id: string;
  contractor_name: string;
  action_type: ApprovalAction;
  record_id: string;
  amount_paise?: number | null;
  status: ApprovalStatus;
  created_at: string;
  responded_at?: string | null;
}

/* ------------------------------------------------------------------------- */
/* Errors                                                                     */
/* ------------------------------------------------------------------------- */

export type DashboardErrorKind =
  | 'not_configured'
  | 'offline'
  | 'unauthorized'
  | 'not_found'
  | 'validation'
  | 'network'
  | 'unknown';

export class DashboardError extends Error {
  readonly kind: DashboardErrorKind;

  constructor(kind: DashboardErrorKind, message: string) {
    super(message);
    this.name = 'DashboardError';
    this.kind = kind;
  }
}

interface PostgrestLikeError {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/** Maps PostgREST/Postgres failures onto user-actionable kinds without leaking SQL detail. */
export function classifyDataError(error: PostgrestLikeError | null | undefined): DashboardError {
  const code = error?.code || '';
  const message = (error?.message || '').toLowerCase();

  if (code === '42501' || message.includes('permission denied') || message.includes('row-level security')) {
    return new DashboardError(
      'unauthorized',
      'Your account is not authorized for this record. Nothing was changed.'
    );
  }
  if (code === 'PGRST301' || message.includes('jwt') || message.includes('invalid claim')) {
    return new DashboardError('unauthorized', 'Your session has expired. Please sign in again.');
  }
  if (code === '23505' || message.includes('duplicate key')) {
    return new DashboardError('validation', 'This record already exists. No duplicate was created.');
  }
  if (code === '23503' || message.includes('violates foreign key')) {
    return new DashboardError('not_found', 'A linked record no longer exists, so this action was rejected.');
  }
  if (code === '22P02' || code === '23514' || code === '22023' || message.includes('violates check constraint')) {
    return new DashboardError('validation', 'The submitted values were rejected by the database rules.');
  }
  if (message.includes('failed to fetch') || message.includes('networkerror') || message.includes('load failed')) {
    return new DashboardError('network', 'The network dropped the request. Check your connection and retry.');
  }
  if (error?.message) {
    return new DashboardError('unknown', error.message);
  }
  return new DashboardError('unknown', 'The request could not be completed.');
}

function requireClient(): SupabaseClient {
  if (!supabase) {
    throw new DashboardError(
      'not_configured',
      'Supabase is not configured for this build. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
    );
  }
  return supabase;
}

function assertOnline(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new DashboardError('offline', 'You are offline. Cash and muster data is not cached for real accounts.');
  }
}

function unwrap<T>(data: unknown, error: PostgrestLikeError | null): T {
  if (error) throw classifyDataError(error);
  return data as T;
}

/* ------------------------------------------------------------------------- */
/* Worker snapshot                                                            */
/* ------------------------------------------------------------------------- */

export interface WorkerDashboardSnapshot {
  worker: CloudWorkerDirectoryRecord;
  privateData: WorkerPrivateDataRecord | null;
  privateDataNotice: string | null;
  attendance: CloudAttendanceRow[];
  ledger: CloudLedgerRow[];
  disputes: CloudDisputeRow[];
  approvals: CloudApprovalRow[];
  loadedAt: string;
}

export type WorkerLoadResult =
  | { status: 'ready'; snapshot: WorkerDashboardSnapshot }
  | { status: 'needs_onboarding' };

const MAX_ROWS = 400;

export async function fetchWorkerSnapshot(): Promise<WorkerLoadResult> {
  const client = requireClient();
  assertOnline();

  const workersResult = await client.from('workers').select(DIRECTORY_COLUMNS).limit(2);
  const rows = unwrap<CloudWorkerDirectoryRecord[]>(workersResult.data, workersResult.error);

  if (!rows || rows.length === 0) return { status: 'needs_onboarding' };
  if (rows.length > 1) {
    throw new DashboardError(
      'unauthorized',
      'More than one worker record is visible to this account. For safety no record was selected — contact support.'
    );
  }

  const worker = rows[0];

  // RLS already scopes these to the signed-in worker; the worker_id filter keeps
  // the query honest if a future policy widens visibility.
  const [attendanceResult, ledgerResult, disputeResult, approvalResult] = await Promise.all([
    client
      .from('attendance_records')
      .select(ATTENDANCE_COLUMNS)
      .eq('worker_id', worker.id)
      .order('date', { ascending: false })
      .limit(MAX_ROWS),
    client
      .from('wage_ledger_entries')
      .select(LEDGER_COLUMNS)
      .eq('worker_id', worker.id)
      .order('date', { ascending: false })
      .limit(MAX_ROWS),
    client
      .from('disputes')
      .select(DISPUTE_COLUMNS)
      .eq('worker_id', worker.id)
      .order('filing_date', { ascending: false })
      .limit(100),
    client
      .from('approval_requests')
      .select(APPROVAL_COLUMNS)
      .eq('worker_id', worker.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const attendance = unwrap<CloudAttendanceRow[]>(attendanceResult.data, attendanceResult.error);
  const ledger = unwrap<CloudLedgerRow[]>(ledgerResult.data, ledgerResult.error);
  const disputes = unwrap<CloudDisputeRow[]>(disputeResult.data, disputeResult.error);
  const approvals = unwrap<CloudApprovalRow[]>(approvalResult.data, approvalResult.error);

  // Private identifiers are optional: a worker can exist without a private row,
  // and that must not block the whole dashboard. The RPC itself is worker-only.
  let privateData: WorkerPrivateDataRecord | null = null;
  let privateDataNotice: string | null = null;
  try {
    privateData = await getMyWorkerPrivateData(worker.id);
  } catch (error) {
    privateDataNotice =
      error instanceof Error
        ? error.message
        : 'Private details could not be loaded for this worker record.';
  }

  return {
    status: 'ready',
    snapshot: {
      worker,
      privateData,
      privateDataNotice,
      attendance: attendance || [],
      ledger: ledger || [],
      disputes: disputes || [],
      approvals: approvals || [],
      loadedAt: new Date().toISOString(),
    },
  };
}

/* ------------------------------------------------------------------------- */
/* Contractor snapshot                                                        */
/* ------------------------------------------------------------------------- */

export interface ContractorDashboardSnapshot {
  workers: CloudWorkerDirectoryRecord[];
  sites: CloudSiteRow[];
  assignments: CloudAssignmentRow[];
  attendance: CloudAttendanceRow[];
  ledger: CloudLedgerRow[];
  disputes: CloudDisputeRow[];
  approvals: CloudApprovalRow[];
  loadedAt: string;
}

export async function fetchContractorSnapshot(): Promise<ContractorDashboardSnapshot> {
  const client = requireClient();
  assertOnline();

  const [workersResult, sitesResult, assignmentResult, attendanceResult, ledgerResult, disputeResult, approvalResult] =
    await Promise.all([
      client.from('workers').select(DIRECTORY_COLUMNS).order('name', { ascending: true }).limit(MAX_ROWS),
      client.from('sites').select(SITE_COLUMNS).order('name', { ascending: true }).limit(200),
      client
        .from('contractor_worker_assignments')
        .select(ASSIGNMENT_COLUMNS)
        .order('created_at', { ascending: true })
        .limit(MAX_ROWS),
      client
        .from('attendance_records')
        .select(ATTENDANCE_COLUMNS)
        .order('date', { ascending: false })
        .limit(MAX_ROWS),
      client
        .from('wage_ledger_entries')
        .select(LEDGER_COLUMNS)
        .order('date', { ascending: false })
        .limit(MAX_ROWS),
      client.from('disputes').select(DISPUTE_COLUMNS).order('filing_date', { ascending: false }).limit(200),
      client
        .from('approval_requests')
        .select(APPROVAL_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

  return {
    workers: unwrap<CloudWorkerDirectoryRecord[]>(workersResult.data, workersResult.error) || [],
    sites: unwrap<CloudSiteRow[]>(sitesResult.data, sitesResult.error) || [],
    assignments: unwrap<CloudAssignmentRow[]>(assignmentResult.data, assignmentResult.error) || [],
    attendance: unwrap<CloudAttendanceRow[]>(attendanceResult.data, attendanceResult.error) || [],
    ledger: unwrap<CloudLedgerRow[]>(ledgerResult.data, ledgerResult.error) || [],
    disputes: unwrap<CloudDisputeRow[]>(disputeResult.data, disputeResult.error) || [],
    approvals: unwrap<CloudApprovalRow[]>(approvalResult.data, approvalResult.error) || [],
    loadedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------------- */
/* Onboarding vocabulary — must match complete_my_worker_onboarding() exactly  */
/* ------------------------------------------------------------------------- */

export const SUPPORTED_TRADES = [
  'Head Mason (मुख्य राजमिस्त्री)',
  'Steel Binder & Rigging Helper (सरिया बाइंडर)',
  'Site Electrician & Cable Jointer (साइट इलेक्ट्रीशियन)',
  'General Helper & Concrete Batching (बेलदार)',
  'Tile Grinding & Surface Polisher (फिनिशिंग)',
  'Carpenter & Shuttering (शटरिंग बढ़ई)',
  'Plumber & Pipe Fitter (प्लंबर)',
  'Painter & Putty Applicator (पेंटर)',
] as const;

export const SKILL_LEVELS: SkillLevel[] = ['unskilled', 'semi_skilled', 'skilled', 'highly_skilled'];

/* ------------------------------------------------------------------------- */
/* Mutations                                                                  */
/* ------------------------------------------------------------------------- */

export async function onboardWorkerProfile(trade: string, skill: SkillLevel): Promise<string> {
  requireClient();
  assertOnline();
  try {
    return await completeMyWorkerOnboarding(trade, skill);
  } catch (error) {
    if (error instanceof DashboardError) throw error;
    throw new DashboardError(
      'unknown',
      error instanceof Error ? error.message : 'Worker onboarding could not be confirmed.'
    );
  }
}

export async function updateMyContactSharing(enabled: boolean): Promise<void> {
  requireClient();
  assertOnline();
  try {
    await setMyWorkerContactSharing(enabled);
  } catch (error) {
    if (error instanceof DashboardError) throw error;
    throw new DashboardError(
      'unknown',
      error instanceof Error ? error.message : 'Contact-sharing consent could not be updated.'
    );
  }
}

export async function requestAssignedWorkerPhone(workerId: string): Promise<string | null> {
  requireClient();
  assertOnline();
  try {
    const result = await getAssignedWorkerContact(workerId);
    return result?.phone ?? null;
  } catch (error) {
    if (error instanceof DashboardError) throw error;
    throw new DashboardError(
      'unknown',
      error instanceof Error ? error.message : 'The consent-protected contact lookup failed.'
    );
  }
}

export interface NewDisputeInput {
  workerId: string;
  contractorName: string;
  contractorPhone: string;
  siteName: string;
  disputeType: DisputeType;
  claimedAmountPaise: number;
  incidentDate: string;
  description: string;
  evidenceMusterCount: number;
}

const DISPUTE_TYPES: DisputeType[] = [
  'unpaid_wages',
  'arbitrary_deduction',
  'denied_overtime',
  'unsafe_conditions',
  'bocw_benefit_denial',
];

function randomSuffix(length = 6): string {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, length).toUpperCase();
}

export function validateDisputeInput(input: NewDisputeInput): string[] {
  const problems: string[] = [];
  if (!input.workerId) problems.push('A worker record is required.');
  if (!DISPUTE_TYPES.includes(input.disputeType)) problems.push('Choose a valid dispute type.');
  if (!Number.isFinite(input.claimedAmountPaise) || input.claimedAmountPaise <= 0) {
    problems.push('Claimed amount must be greater than zero.');
  }
  if (!input.incidentDate) problems.push('An incident date is required.');
  else if (input.incidentDate > localIsoDate()) problems.push('The incident date cannot be in the future.');
  if (!input.description.trim() || input.description.trim().length < 20) {
    problems.push('Describe the dispute in at least 20 characters.');
  }
  if (input.description.length > 4000) problems.push('The statement is too long (4000 characters maximum).');
  if (!input.contractorName.trim()) problems.push('Contractor name is required.');
  if (!input.siteName.trim()) problems.push('Site name is required.');
  return problems;
}

export async function fileWorkerDispute(input: NewDisputeInput): Promise<CloudDisputeRow> {
  const client = requireClient();
  assertOnline();

  const problems = validateDisputeInput(input);
  if (problems.length > 0) throw new DashboardError('validation', problems[0]);

  const filingDate = localIsoDate();
  const payload = {
    id: `DSP-${randomSuffix(10)}`,
    worker_id: input.workerId,
    contractor_name: input.contractorName.trim(),
    contractor_phone: input.contractorPhone.trim(),
    site_name: input.siteName.trim(),
    dispute_type: input.disputeType,
    claimed_amount_paise: Math.round(input.claimedAmountPaise),
    incident_date: input.incidentDate,
    filing_date: filingDate,
    status: 'submitted' as DisputeStatus,
    description: input.description.trim(),
    // WURK UP internal reference. WURK UP does not file with the District Labour
    // Office or any government authority; the storage column merely keeps its
    // historical name so no migration or data rewrite is needed.
    dlo_filing_ref: buildSubmissionReference(),
    evidence_muster_count: Math.max(0, Math.round(input.evidenceMusterCount)),
  };

  const result = await client.from('disputes').insert(payload).select(DISPUTE_COLUMNS).single();
  return unwrap<CloudDisputeRow>(result.data, result.error);
}

export async function respondToApproval(
  approvalId: string,
  decision: 'approved' | 'rejected' | 'reported_suspicious'
): Promise<CloudApprovalRow> {
  const client = requireClient();
  assertOnline();
  if (!['approved', 'rejected', 'reported_suspicious'].includes(decision)) {
    throw new DashboardError('validation', 'Choose a valid response.');
  }
  // Only (status, responded_at) is granted to the worker, and RLS requires the
  // request to still be pending and to belong to this worker's own record.
  const result = await client
    .from('approval_requests')
    .update({ status: decision, responded_at: new Date().toISOString() })
    .eq('id', approvalId)
    .select(APPROVAL_COLUMNS)
    .single();
  return unwrap<CloudApprovalRow>(result.data, result.error);
}

export interface NewApprovalInput {
  workerId: string;
  contractorName: string;
  actionType: ApprovalAction;
  recordId: string;
  amountPaise?: number | null;
}

export async function createApprovalRequest(input: NewApprovalInput): Promise<CloudApprovalRow> {
  const client = requireClient();
  assertOnline();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData?.user) {
    throw new DashboardError('unauthorized', 'Your session has expired. Please sign in again.');
  }
  if (!input.workerId || !input.recordId.trim()) {
    throw new DashboardError('validation', 'Choose an assigned worker and reference the record being approved.');
  }
  if (!['attendance_confirmation', 'wage_payment_acknowledgment', 'site_joining'].includes(input.actionType)) {
    throw new DashboardError('validation', 'Choose a valid approval action.');
  }
  const payload = {
    id: `APR-${randomSuffix(10)}`,
    worker_id: input.workerId,
    contractor_id: userData.user.id,
    contractor_name: input.contractorName,
    action_type: input.actionType,
    record_id: input.recordId.trim(),
    amount_paise: input.amountPaise == null ? null : Math.round(input.amountPaise),
    status: 'pending' as ApprovalStatus,
  };
  const result = await client.from('approval_requests').insert(payload).select(APPROVAL_COLUMNS).single();
  return unwrap<CloudApprovalRow>(result.data, result.error);
}

/** True when the build has Supabase environment configuration. */
export function isDashboardConfigured(): boolean {
  return !!supabase;
}

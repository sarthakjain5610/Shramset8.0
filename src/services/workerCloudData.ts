import { supabase } from './supabase';
import { CloudWorkerDirectoryRecord, WorkerPrivateDataRecord, SkillLevel } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { reportAuthDiagnostic } from './authDiagnostics';

/** Cloud directory query: request only the explicit non-sensitive worker projection. */
export async function getWorkerDirectory(): Promise<CloudWorkerDirectoryRecord[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('workers')
    .select('id,name,hindi_name,trade,skill_level,daily_base_wage_paise,active_site_id,contact_sharing_consent,created_at');
  if (error) throw new Error(error.message);
  return (data || []) as CloudWorkerDirectoryRecord[];
}

/** Private identifiers/banking details are retrieved only via the worker-authorized RPC. */
export async function getMyWorkerPrivateData(workerId: string): Promise<WorkerPrivateDataRecord> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('get_worker_private_data', { p_worker_id: workerId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Private worker record was not returned.');
  return row as WorkerPrivateDataRecord;
}

/** Create or retrieve the authenticated worker's own directory record through the protected onboarding RPC. */
class WorkerOnboardingError extends Error {}

export async function completeMyWorkerOnboarding(
  trade: string,
  skillLevel: SkillLevel,
  client: SupabaseClient | null = supabase,
): Promise<string> {
  if (!client) {
    reportAuthDiagnostic('worker_onboarding', { code: 'supabase_not_configured' });
    throw new Error('Worker onboarding is unavailable because cloud authentication is not configured.');
  }
  try {
    const { data, error } = await client.rpc('complete_my_worker_onboarding', {
      p_trade: trade,
      p_skill_level: skillLevel,
    });
    if (error) {
      reportAuthDiagnostic('worker_onboarding', error);
      throw new WorkerOnboardingError('Supabase could not confirm worker onboarding. Your account remains; do not register again. Check the diagnostic code with support.');
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.worker_id !== 'string' || !row.worker_id) {
      reportAuthDiagnostic('worker_onboarding', { code: 'invalid_rpc_response' });
      throw new WorkerOnboardingError('Supabase did not confirm the worker record. Your account remains; do not register again.');
    }
    return row.worker_id;
  } catch (error) {
    if (error instanceof WorkerOnboardingError) throw error;
    reportAuthDiagnostic('worker_onboarding', error);
    throw new Error('Worker onboarding could not be confirmed. Your account remains; do not register again. Check the diagnostic code with support.');
  }
}

/** The authenticated worker changes their own consent through the protected RPC. */
export async function setMyWorkerContactSharing(enabled: boolean): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('set_my_worker_contact_sharing', { p_enabled: enabled });
  if (error) throw new Error(error.message);
}

/** Contractor contact lookup returns only a consented phone for an assigned worker. */
export async function getAssignedWorkerContact(workerId: string): Promise<{ worker_id: string; phone: string } | null> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('get_assigned_worker_contact', { p_worker_id: workerId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return row ? row as { worker_id: string; phone: string } : null;
}

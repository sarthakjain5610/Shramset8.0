import { supabase } from './supabase';
import { CloudWorkerDirectoryRecord, WorkerPrivateDataRecord } from '../types';

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

/** Contractor contact lookup returns only a consented phone for an assigned worker. */
export async function getAssignedWorkerContact(workerId: string): Promise<{ worker_id: string; phone: string } | null> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('get_assigned_worker_contact', { p_worker_id: workerId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return row ? row as { worker_id: string; phone: string } : null;
}

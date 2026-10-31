import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  url: string | null;
  mode: 'unverified' | 'local_demo_offline';
  statusMessage: string;
}

const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
const rawUrl = env?.VITE_SUPABASE_URL as string | undefined;
const rawKey = env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const validUrl = (() => { try { const u = new URL(rawUrl || ''); return u.protocol === 'https:' && !!u.host; } catch { return false; } })();
const validKey = !!rawKey?.trim() && !/service_role|secret/i.test(rawKey);

export const supabase: SupabaseClient | null = validUrl && validKey
  ? createClient(rawUrl!, rawKey!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export function getSupabaseStatus(): SupabaseConfigStatus {
  const configured = !!supabase;
  return {
    isConfigured: configured,
    url: configured ? rawUrl! : null,
    mode: configured ? 'unverified' : 'local_demo_offline',
    statusMessage: configured ? 'Supabase configured — connection not yet verified' : 'Local Demo Mode (Supabase is not configured)',
  };
}

/** Performs a real, bounded request. Configuration alone is never reported as connected. */
export async function checkSupabaseConnection(): Promise<{ connected: boolean; message: string }> {
  if (!supabase) return { connected: false, message: 'Supabase is not configured.' };
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { connected: false, message: 'Offline — Supabase connection cannot be checked.' };
  try {
    const result = await Promise.race([
      supabase.from('profiles').select('id').limit(1),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Connection check timed out.')), 8000)),
    ]);
    if (result.error) return { connected: false, message: result.error.message };
    return { connected: true, message: 'Supabase request succeeded.' };
  } catch (e) { return { connected: false, message: e instanceof Error ? e.message : 'Supabase request failed.' }; }
}

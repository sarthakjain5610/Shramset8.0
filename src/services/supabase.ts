import { createClient, SupabaseClient } from '@supabase/supabase-js';

const AUTH_CALLBACK_KEYS = ['code', 'error', 'error_code', 'access_token', 'refresh_token', 'token_hash'];

/** Detect callback intent before Supabase consumes or cleans its URL parameters. */
export function hasSupabaseAuthCallback(urlText?: string): boolean {
  if (!urlText && typeof window === 'undefined') return false;
  try {
    const url = new URL(urlText || window.location.href);
    const fragment = url.hash.replace(/^#\/?/, '');
    const query = new URLSearchParams(url.search);
    const hashParams = new URLSearchParams(fragment.includes('?') ? fragment.slice(fragment.indexOf('?') + 1) : fragment);
    return AUTH_CALLBACK_KEYS.some((key) => query.has(key) || hashParams.has(key));
  } catch { return false; }
}

// Capture this before createClient's automatic callback processing can clear the URL.
export const initialSupabaseAuthCallbackPending = hasSupabaseAuthCallback();

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
  ? createClient(rawUrl!, rawKey!, {
      // Supabase exchanges recovery callback codes/tokens and emits PASSWORD_RECOVERY;
      // application routing must not rewrite the URL before this detection completes.
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
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

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Cloud, LoaderCircle, Phone, RefreshCw, ShieldCheck, Users, WifiOff } from 'lucide-react';
import { CloudWorkerDirectoryRecord, UserProfile } from '../../types';
import { getAssignedWorkerContact, getWorkerDirectory } from '../../services/workerCloudData';

interface Props { user: UserProfile }
export const ContractorCloudWorkspace: React.FC<Props> = ({ user }) => {
  const [workers, setWorkers] = useState<CloudWorkerDirectoryRecord[]>([]);
  const [contacts, setContacts] = useState<Record<string, string | null>>({});
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});
  const [busyContact, setBusyContact] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' || navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('You are offline. No cloud directory is available; demo records are not shown for real accounts.');
      const rows = await getWorkerDirectory();
      setWorkers(rows);
      setContacts({});
      setContactErrors({});
    } catch (e) {
      setWorkers([]);
      setError(e instanceof Error ? e.message : 'Could not load assigned workers from Supabase.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const revealContact = async (workerId: string) => {
    setBusyContact(workerId);
    setContactErrors((prev) => ({ ...prev, [workerId]: '' }));
    try {
      const result = await getAssignedWorkerContact(workerId);
      setContacts((prev) => ({ ...prev, [workerId]: result?.phone ?? null }));
    } catch (e) {
      setContactErrors((prev) => ({ ...prev, [workerId]: e instanceof Error ? e.message : 'Contact lookup failed.' }));
    } finally { setBusyContact(null); }
  };

  return <main className="min-h-screen bg-sand-50 px-4 py-6 sm:px-8 sm:py-9"><div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-sky-800">WurkUp · Contractor</p><h1 className="mt-1 text-2xl font-extrabold text-ink-950 sm:text-3xl">Workforce dashboard</h1><p className="mt-1 text-sm text-ink-600">Assigned workers are loaded from the RLS-scoped Supabase directory.</p></div><div className="flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-2 text-xs font-bold text-sky-900"><Cloud size={15}/>{!loading && !error ? 'Cloud data loaded' : 'Supabase account'}</div></header>
    {!online && <div role="status" className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><WifiOff size={18} className="shrink-0"/>Offline. No local worker records are substituted for this real account.</div>}
    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><AlertCircle size={18} className="mt-0.5 shrink-0"/><span>{error}</span></div>}
    <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-xl bg-sky-50 p-2.5 text-sky-800"><Users size={22}/></div><div><h2 className="font-bold text-ink-950">Assigned worker directory</h2><p className="text-xs text-ink-500">Only non-sensitive directory fields are shown</p></div></div><span className="rounded-full bg-sand-100 px-3 py-1 text-xs font-bold text-ink-700">{workers.length} workers</span></div>
      {loading ? <div className="flex items-center gap-2 p-8 text-sm text-ink-600"><LoaderCircle size={18} className="animate-spin"/>Loading workers permitted by your account…</div> : error ? null : workers.length === 0 ? <div className="rounded-xl border border-dashed border-sand-300 p-7 text-center"><ShieldCheck className="mx-auto mb-2 text-ink-400"/><p className="font-semibold text-ink-800">No assigned workers are visible</p><p className="mt-1 text-sm text-ink-500">Assignments must be created through an authorized backend workflow; this dashboard cannot self-assign workers.</p></div> : <div className="grid gap-4 md:grid-cols-2">{workers.map((worker) => <article key={worker.id} className="rounded-xl border border-sand-200 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-ink-950">{worker.name}</h3><p className="mt-1 text-sm text-ink-600">{worker.trade} · {worker.skill_level}</p></div><span className="rounded-full bg-forest-50 px-2.5 py-1 text-[11px] font-bold text-forest-800">Assigned</span></div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-sand-100 pt-3 text-sm"><div><p className="text-[11px] uppercase tracking-wide text-ink-500">Daily base wage</p><p className="mt-1 font-semibold text-ink-900">{worker.daily_base_wage_paise == null ? 'Wage not assigned yet' : `₹${(worker.daily_base_wage_paise / 100).toLocaleString('en-IN')}`}</p></div><div><p className="text-[11px] uppercase tracking-wide text-ink-500">Site reference</p><p className="mt-1 break-all font-semibold text-ink-900">{worker.active_site_id || 'Not assigned'}</p></div></div>
        <div className="mt-4 border-t border-sand-100 pt-3"><button type="button" disabled={busyContact === worker.id} onClick={() => void revealContact(worker.id)} className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-900 disabled:opacity-50"><Phone size={14}/>{busyContact === worker.id ? 'Checking consent…' : contacts[worker.id] ? 'Refresh shared phone' : 'Request shared contact'}</button>
          {contacts[worker.id] && <p className="mt-2 text-sm font-semibold text-ink-900">Phone: {contacts[worker.id]} <span className="font-normal text-ink-500">(released by consent-protected RPC)</span></p>}
          {Object.prototype.hasOwnProperty.call(contacts, worker.id) && contacts[worker.id] === null && <p role="status" className="mt-2 text-xs text-ink-600">Phone not shared or unavailable. No private contact details were returned.</p>}
          {contactErrors[worker.id] && <p role="alert" className="mt-2 text-xs text-rose-800">Contact lookup failed: {contactErrors[worker.id]}</p>}
        </div>
      </article>)}</div>}
    </section>
    <section className="rounded-2xl border border-sand-200 bg-white p-5 text-sm text-ink-700"><p className="font-bold text-ink-900">Secure workflow status</p><p className="mt-1">Phone numbers are fetched only on request through <code>get_assigned_worker_contact</code>, which enforces assignment and worker consent. Banking, identity, emergency and other private details are never requested. Attendance, wage/payment writes, approvals, assignment creation and audit events remain unavailable until authorized server-side workflows are implemented.</p></section>
    <button type="button" onClick={() => void load(true)} disabled={loading || refreshing} className="inline-flex items-center gap-2 rounded-xl border border-sand-300 bg-white px-4 py-2 text-sm font-semibold text-ink-800 disabled:opacity-50"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''}/>Refresh cloud directory</button>
    <span className="sr-only">Signed in as {user.fullName}</span>
  </div></main>;
};

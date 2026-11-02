import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Cloud, LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { UserProfile, CloudWorkerDirectoryRecord, WorkerPrivateDataRecord } from '../../types';
import { getMyWorkerPrivateData, getWorkerDirectory, setMyWorkerContactSharing } from '../../services/workerCloudData';

interface Props { user: UserProfile }

export const WorkerCloudWorkspace: React.FC<Props> = ({ user }) => {
  const [worker, setWorker] = useState<CloudWorkerDirectoryRecord | null>(null);
  const [privateData, setPrivateData] = useState<WorkerPrivateDataRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
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
    setWorker(null);
    setPrivateData(null);
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('You are offline. No cloud data is available in this session; demo data is not shown for real accounts.');
      const rows = await getWorkerDirectory();
      if (rows.length === 0) return;
      if (rows.length !== 1) throw new Error('More than one worker directory record is visible to this account. For safety, no record was selected. Contact support.');
      const row = rows[0];
      // This RPC verifies both worker role and worker.user_id = auth.uid(). Do not
      // display even the directory candidate until that ownership check succeeds.
      const ownPrivateData = await getMyWorkerPrivateData(row.id);
      setWorker(row);
      setPrivateData(ownPrivateData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your worker profile from Supabase.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateConsent = async () => {
    if (!worker || consentBusy) return;
    setConsentBusy(true);
    setError(null);
    try {
      await setMyWorkerContactSharing(!worker.contact_sharing_consent);
      setWorker({ ...worker, contact_sharing_consent: !worker.contact_sharing_consent });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update contact-sharing consent.');
    } finally { setConsentBusy(false); }
  };

  const privateFields = [
    ['Phone', privateData?.phone],
    ['e-Shram UAN', privateData?.eshram_uan],
    ['BOCW registration', privateData?.bocw_registration_no],
    ['Aadhaar last four', privateData?.aadhaar_last4],
    ['Bank account last four', privateData?.bank_account_last4],
    ['IFSC', privateData?.ifsc_code],
    ['UPI ID', privateData?.upi_id],
    ['Blood group', privateData?.blood_group],
  ] as const;

  return <main className="min-h-screen bg-sand-50 px-4 py-6 sm:px-8 sm:py-9">
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-forest-700">WurkUp · Worker</p><h1 className="mt-1 text-2xl font-extrabold text-ink-950 sm:text-3xl">My worker space</h1><p className="mt-1 text-sm text-ink-600">Your account data is loaded from Supabase. No local demo records are mixed in.</p></div>
        <div className="flex items-center gap-2 rounded-full border border-forest-200 bg-white px-3 py-2 text-xs font-bold text-forest-800"><Cloud size={15}/>{worker ? 'Cloud data loaded' : 'Supabase account'}</div>
      </header>
      {!online && <div role="status" className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><WifiOff size={18} className="shrink-0"/>Offline. This account has no local cloud-data cache; demo records will not be substituted.</div>}
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><AlertCircle size={18} className="mt-0.5 shrink-0"/><span>{error}</span></div>}
      {loading ? <div className="flex items-center gap-2 rounded-2xl border border-sand-200 bg-white p-8 text-sm text-ink-600"><LoaderCircle size={18} className="animate-spin"/>Loading your authorized cloud profile…</div> : worker ? <>
        <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-forest-50 p-2.5 text-forest-800"><ShieldCheck size={22}/></div><div><h2 className="font-bold text-ink-950">Worker directory profile</h2><p className="text-xs text-ink-500">Visible fields from your RLS-authorized worker record</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name" value={worker.name}/><Field label="Trade" value={worker.trade}/><Field label="Skill level" value={worker.skill_level}/><Field label="Daily base wage" value={`₹${(worker.daily_base_wage_paise / 100).toLocaleString('en-IN')}`}/><Field label="Active site reference" value={worker.active_site_id || 'Not assigned'}/><Field label="Worker record" value={worker.id}/>
          </div>
        </section>
        <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-sky-50 p-2.5 text-sky-800"><LockKeyhole size={22}/></div><div><h2 className="font-bold text-ink-950">Your private details</h2><p className="text-xs text-ink-500">Requested only through the worker-authorized private-data RPC</p></div></div>
          {!privateData && <p className="text-sm text-ink-500">No private details were returned for this worker record.</p>}
          {privateData && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{privateFields.map(([label, value]) => <Field key={label} label={label} value={value || 'Not provided'}/>)}</div>}
          <div className="mt-6 flex flex-col justify-between gap-4 border-t border-sand-100 pt-5 sm:flex-row sm:items-center">
            <div><p className="text-sm font-semibold text-ink-900">Share your phone with assigned contractors</p><p className="mt-1 text-xs text-ink-500">Contractors can retrieve it only when assigned and only while you consent.</p></div>
            <button type="button" disabled={consentBusy} onClick={() => void updateConsent()} className={`rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50 ${worker.contact_sharing_consent ? 'bg-forest-700 text-white' : 'border border-sand-300 bg-white text-ink-800'}`}>
              {consentBusy ? 'Saving…' : worker.contact_sharing_consent ? 'Sharing enabled · Turn off' : 'Sharing off · Turn on'}
            </button>
          </div>
        </section>
      </> : !error && !loading ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-bold text-amber-950">No linked worker record</h2><p className="mt-2 text-sm text-amber-900">Your authenticated account has no worker directory row visible under its current Supabase policies. No profile or private details have been fabricated. Ask your administrator to link your worker record.</p></section> : null}
      <section className="rounded-2xl border border-sand-200 bg-white p-5 text-sm text-ink-700"><p className="font-bold text-ink-900">Other workflows</p><p className="mt-1">Attendance, wage changes, payment acknowledgments, approvals and disputes are not connected to an authorized cloud operation yet. They are not written locally from this real account. Demo/offline sample workflows remain separate.</p></section>
      <button type="button" onClick={() => void load(true)} disabled={loading || refreshing} className="inline-flex items-center gap-2 rounded-xl border border-sand-300 bg-white px-4 py-2 text-sm font-semibold text-ink-800 disabled:opacity-50"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''}/>Refresh cloud data</button>
    </div>
  </main>;
};

const Field: React.FC<{label: string; value: string}> = ({ label, value }) => <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-ink-900">{value}</p></div>;

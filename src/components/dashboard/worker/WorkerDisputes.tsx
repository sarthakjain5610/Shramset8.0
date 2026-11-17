import React, { useMemo, useState } from 'react';
import { AlertTriangle, FileText, Gavel, LoaderCircle, Plus } from 'lucide-react';
import type { WorkerViewProps } from '../types';
import { dc } from '../dashboardCopy';
import {
  Surface,
  EmptyState,
  Pill,
  ErrorNotice,
  SuccessNotice,
  DashboardButton,
  KpiCard,
  Field,
} from '../ui';
import {
  fileWorkerDispute,
  validateDisputeInput,
  DashboardError,
  type DisputeType,
  type NewDisputeInput,
} from '../../../services/dashboardData';
import {
  formatPaise,
  formatIsoDate,
  summarizeDisputes,
  daysOpen,
  monthKey,
  todayIso,
  pickLabel,
  DISPUTE_TYPE_LABELS,
  DISPUTE_STATUS_LABELS,
  DISPUTE_TONES,
} from '../../../services/dashboardAnalytics';

interface Props extends Pick<WorkerViewProps, 'lang' | 'disputes' | 'attendance' | 'worker'> {
  onChanged: () => void;
}

const DISPUTE_TYPE_ORDER: DisputeType[] = [
  'unpaid_wages',
  'arbitrary_deduction',
  'denied_overtime',
  'unsafe_conditions',
  'bocw_benefit_denial',
];

export const WorkerDisputes: React.FC<Props> = ({ lang, disputes, attendance, worker, onChanged }) => {
  const summary = useMemo(() => summarizeDisputes(disputes), [disputes]);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filedRef, setFiledRef] = useState<string | null>(null);

  const [disputeType, setDisputeType] = useState<DisputeType>('unpaid_wages');
  const [amountRupees, setAmountRupees] = useState('');
  const [incidentDate, setIncidentDate] = useState(todayIso());
  const [contractorName, setContractorName] = useState('');
  const [contractorPhone, setContractorPhone] = useState('');
  const [siteName, setSiteName] = useState('');
  const [description, setDescription] = useState('');

  const evidenceCount = useMemo(
    () => attendance.filter((row) => monthKey(row.date) === monthKey(incidentDate)).length,
    [attendance, incidentDate]
  );

  const buildInput = (): NewDisputeInput => ({
    workerId: worker.id,
    contractorName,
    contractorPhone,
    siteName,
    disputeType,
    claimedAmountPaise: Math.round(Number(amountRupees || '0') * 100),
    incidentDate,
    description,
    evidenceMusterCount: evidenceCount,
  });

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const input = buildInput();
    const problems = validateDisputeInput(input);
    if (problems.length > 0) {
      setError(problems[0]);
      setFiledRef(null);
      return;
    }
    setBusy(true);
    setError(null);
    setFiledRef(null);
    try {
      const created = await fileWorkerDispute(input);
      setFiledRef(created.dlo_filing_ref);
      setFormOpen(false);
      setAmountRupees('');
      setDescription('');
      setContractorName('');
      setContractorPhone('');
      setSiteName('');
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof DashboardError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : 'The dispute could not be filed.'
      );
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'mt-1 w-full rounded-xl border border-sand-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200';

  return (
    <div className="space-y-4">
      {error && <ErrorNotice title={dc(lang, 'commonErrorTitle')} message={error} />}
      {filedRef && <SuccessNotice message={`${dc(lang, 'disputesSubmitted')} ${filedRef}`} />}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={dc(lang, 'disputesHeading')} value={summary.total} icon={<FileText size={16} />} />
        <KpiCard label={dc(lang, 'kpiOpenDisputes')} value={summary.open} tone="warning" icon={<AlertTriangle size={16} />} />
        <KpiCard label={dc(lang, 'contractorWagesSettled')} value={summary.closed} tone="positive" />
        <KpiCard label={dc(lang, 'disputesClaimed')} value={formatPaise(summary.claimedPaise)} icon={<Gavel size={16} />} />
      </div>

      <Surface
        title={dc(lang, 'disputesHeading')}
        subtitle={dc(lang, 'disputesSub')}
        icon={<Gavel size={17} />}
        action={
          <DashboardButton
            variant={formOpen ? 'outline' : 'primary'}
            onClick={() => {
              setFormOpen((open) => !open);
              setError(null);
            }}
            icon={<Plus size={13} />}
          >
            {formOpen ? dc(lang, 'actionCancel') : dc(lang, 'actionNewDispute')}
          </DashboardButton>
        }
      >
        {formOpen && (
          <form onSubmit={submit} className="mb-5 rounded-xl border border-sand-200 bg-sand-50/60 p-4">
            <p className="text-sm font-extrabold text-ink-950">{dc(lang, 'disputesFormTitle')}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">{dc(lang, 'disputesFormSub')}</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-ink-600">
                {dc(lang, 'disputesType')}
                <select
                  value={disputeType}
                  onChange={(event) => setDisputeType(event.target.value as DisputeType)}
                  className={inputClass}
                >
                  {DISPUTE_TYPE_ORDER.map((type) => (
                    <option key={type} value={type}>
                      {pickLabel(DISPUTE_TYPE_LABELS[type], lang)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-ink-600">
                {dc(lang, 'disputesAmountLabel')}
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={amountRupees}
                  onChange={(event) => setAmountRupees(event.target.value)}
                  className={`${inputClass} font-mono`}
                  placeholder="1500"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-ink-600">
                {dc(lang, 'disputesIncidentLabel')}
                <input
                  type="date"
                  required
                  max={todayIso()}
                  value={incidentDate}
                  onChange={(event) => setIncidentDate(event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-ink-600">
                {dc(lang, 'disputesContractorLabel')}
                <input
                  type="text"
                  required
                  value={contractorName}
                  onChange={(event) => setContractorName(event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-ink-600">
                {dc(lang, 'disputesContractorPhone')}
                <input
                  type="tel"
                  value={contractorPhone}
                  onChange={(event) => setContractorPhone(event.target.value)}
                  className={inputClass}
                  placeholder="+91"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-ink-600">
                {dc(lang, 'disputesSiteLabel')}
                <input
                  type="text"
                  required
                  value={siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

            <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-ink-600">
              {dc(lang, 'disputesDescription')}
              <textarea
                required
                minLength={20}
                maxLength={4000}
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={`${inputClass} resize-y leading-relaxed`}
              />
              <span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-ink-500">
                {dc(lang, 'disputesDescriptionHint')} · {description.trim().length}/20
              </span>
            </label>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-sand-200 pt-3">
              <span className="text-[11px] font-semibold text-ink-600">
                {dc(lang, 'disputesEvidence')}: <span className="font-mono">{evidenceCount}</span>
              </span>
              <div className="flex items-center gap-2">
                <DashboardButton variant="ghost" onClick={() => setFormOpen(false)}>
                  {dc(lang, 'actionCancel')}
                </DashboardButton>
                <DashboardButton
                  variant="primary"
                  type="submit"
                  disabled={busy}
                  icon={busy ? <LoaderCircle size={13} className="animate-spin" /> : <Gavel size={13} />}
                >
                  {busy ? dc(lang, 'actionSubmitting') : dc(lang, 'actionSubmit')}
                </DashboardButton>
              </div>
            </div>
          </form>
        )}

        {disputes.length === 0 ? (
          <EmptyState title={dc(lang, 'disputesEmpty')} body={dc(lang, 'disputesFormSub')} icon={<Gavel size={18} />} />
        ) : (
          <ul className="space-y-3">
            {disputes.map((row) => (
              <li key={row.id} className="rounded-xl border border-sand-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-extrabold text-ink-950">
                      {pickLabel(DISPUTE_TYPE_LABELS[row.dispute_type], lang)}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-500">{row.dlo_filing_ref}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {row.status !== 'settled' && (
                      <Pill tone="neutral">
                        {daysOpen(row.filing_date)} {dc(lang, 'disputesAgeing')}
                      </Pill>
                    )}
                    <Pill tone={DISPUTE_TONES[row.status]}>{pickLabel(DISPUTE_STATUS_LABELS[row.status], lang)}</Pill>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 border-t border-sand-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label={dc(lang, 'disputesClaimed')} value={formatPaise(row.claimed_amount_paise)} />
                  <Field label={dc(lang, 'disputesContractor')} value={row.contractor_name} />
                  <Field label={dc(lang, 'disputesSite')} value={row.site_name} />
                  <Field label={dc(lang, 'disputesIncident')} value={formatIsoDate(row.incident_date)} />
                </div>

                <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-ink-700">{row.description}</p>

                <div className="mt-3 rounded-lg bg-sand-50 p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-500">
                    {dc(lang, 'disputesResponse')}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-700">
                    {row.contractor_response || dc(lang, 'disputesNoResponse')}
                  </p>
                </div>

                <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-ink-500">
                  <span>
                    {dc(lang, 'disputesFiled')}: <span className="font-semibold">{formatIsoDate(row.filing_date)}</span>
                  </span>
                  <span>
                    {dc(lang, 'disputesEvidence')}:{' '}
                    <span className="font-mono font-semibold">{row.evidence_muster_count ?? 0}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </div>
  );
};

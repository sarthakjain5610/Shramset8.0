import React, { useMemo, useState } from 'react';
import { ClipboardCheck, LoaderCircle, Plus, Send } from 'lucide-react';
import type { ContractorViewProps } from '../types';
import { dc } from '../dashboardCopy';
import {
  Surface,
  EmptyState,
  Pill,
  TableWrap,
  thClass,
  tdClass,
  tdNumericClass,
  ErrorNotice,
  SuccessNotice,
  DashboardButton,
  SecondChanceNotice,
} from '../ui';
import {
  createApprovalRequest,
  DashboardError,
  type ApprovalAction,
} from '../../../services/dashboardData';
import {
  formatPaise,
  formatTimestamp,
  pendingApprovals,
  pickLabel,
  APPROVAL_ACTION_LABELS,
  APPROVAL_STATUS_LABELS,
  APPROVAL_TONES,
} from '../../../services/dashboardAnalytics';

const ACTION_ORDER: ApprovalAction[] = ['attendance_confirmation', 'wage_payment_acknowledgment', 'site_joining'];

export const ContractorApprovals: React.FC<
  Pick<ContractorViewProps, 'lang' | 'workers' | 'approvals' | 'user'> & { onChanged: () => void }
> = ({ lang, workers, approvals, user, onChanged }) => {
  const [formOpen, setFormOpen] = useState(false);
  const [workerId, setWorkerId] = useState('');
  const [actionType, setActionType] = useState<ApprovalAction>('attendance_confirmation');
  const [recordId, setRecordId] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const worker of workers) map.set(worker.id, worker.name);
    return map;
  }, [workers]);

  const pending = useMemo(() => pendingApprovals(approvals), [approvals]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await createApprovalRequest({
        workerId,
        contractorName: user.fullName,
        actionType,
        recordId,
        amountPaise: amountRupees ? Math.round(Number(amountRupees) * 100) : null,
      });
      setDone(true);
      setRecordId('');
      setAmountRupees('');
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof DashboardError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : 'The approval request could not be created.'
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
      {done && <SuccessNotice message={dc(lang, 'contractorApprovalsCreated')} />}

      <Surface
        title={dc(lang, 'contractorApprovalsHeading')}
        subtitle={dc(lang, 'contractorApprovalsSub')}
        icon={<ClipboardCheck size={17} />}
        action={
          <DashboardButton
            variant={formOpen ? 'outline' : 'primary'}
            onClick={() => {
              setFormOpen((open) => !open);
              setError(null);
            }}
            icon={<Plus size={13} />}
          >
            {formOpen ? dc(lang, 'actionCancel') : dc(lang, 'contractorApprovalsNew')}
          </DashboardButton>
        }
      >
        {formOpen && (
          <form onSubmit={submit} className="mb-5 rounded-xl border border-sand-200 bg-sand-50/60 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-ink-600">
                {dc(lang, 'contractorApprovalsWorker')}
                <select required value={workerId} onChange={(event) => setWorkerId(event.target.value)} className={inputClass}>
                  <option value="">{dc(lang, 'contractorApprovalsPickWorker')}</option>
                  {workers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.name} · {worker.trade}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-ink-500">
                  {dc(lang, 'commonWorkerPickerHint')}
                </span>
              </label>

              <label className="block text-xs font-bold uppercase tracking-wide text-ink-600">
                {dc(lang, 'contractorApprovalsAction')}
                <select
                  value={actionType}
                  onChange={(event) => setActionType(event.target.value as ApprovalAction)}
                  className={inputClass}
                >
                  {ACTION_ORDER.map((action) => (
                    <option key={action} value={action}>
                      {pickLabel(APPROVAL_ACTION_LABELS[action], lang)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold uppercase tracking-wide text-ink-600">
                {dc(lang, 'contractorApprovalsRecord')}
                <input
                  type="text"
                  required
                  value={recordId}
                  onChange={(event) => setRecordId(event.target.value)}
                  placeholder="ATT-2026-11-04-001"
                  className={`${inputClass} font-mono`}
                />
              </label>

              <label className="block text-xs font-bold uppercase tracking-wide text-ink-600">
                {dc(lang, 'contractorApprovalsAmount')}
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={amountRupees}
                  onChange={(event) => setAmountRupees(event.target.value)}
                  className={`${inputClass} font-mono`}
                  placeholder="550"
                />
              </label>
            </div>

            <div className="mt-3 flex justify-end gap-2 border-t border-sand-200 pt-3">
              <DashboardButton variant="ghost" onClick={() => setFormOpen(false)}>
                {dc(lang, 'actionCancel')}
              </DashboardButton>
              <DashboardButton
                type="submit"
                variant="primary"
                disabled={busy || !workerId}
                icon={busy ? <LoaderCircle size={13} className="animate-spin" /> : <Send size={13} />}
              >
                {busy ? dc(lang, 'actionSubmitting') : dc(lang, 'actionCreateRequest')}
              </DashboardButton>
            </div>
          </form>
        )}

        {approvals.length === 0 ? (
          <EmptyState
            title={dc(lang, 'contractorApprovalsEmpty')}
            body={dc(lang, 'contractorApprovalsNote')}
            icon={<ClipboardCheck size={18} />}
          />
        ) : (
          <TableWrap minWidth="min-w-[46rem]">
            <thead>
              <tr className="border-b border-sand-200">
                <th className={thClass}>{dc(lang, 'crewWorker')}</th>
                <th className={thClass}>{dc(lang, 'approvalsAction')}</th>
                <th className={thClass}>{dc(lang, 'approvalsRecord')}</th>
                <th className={`${thClass} text-right`}>{dc(lang, 'approvalsAmount')}</th>
                <th className={thClass}>{dc(lang, 'labelStatus')}</th>
                <th className={thClass}>{dc(lang, 'approvalsCreated')}</th>
                <th className={thClass}>{dc(lang, 'approvalsRespondedAt')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {approvals.map((row) => (
                <tr key={row.id} className="hover:bg-sand-50/70">
                  <td className={`${tdClass} font-semibold`}>{nameById.get(row.worker_id) || row.worker_id}</td>
                  <td className={tdClass}>{pickLabel(APPROVAL_ACTION_LABELS[row.action_type], lang)}</td>
                  <td className={`${tdClass} font-mono text-[11px] text-ink-600`}>{row.record_id}</td>
                  <td className={tdNumericClass}>{row.amount_paise == null ? '—' : formatPaise(row.amount_paise)}</td>
                  <td className={tdClass}>
                    <Pill tone={APPROVAL_TONES[row.status]}>{pickLabel(APPROVAL_STATUS_LABELS[row.status], lang)}</Pill>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-[12px] text-ink-600`}>{formatTimestamp(row.created_at)}</td>
                  <td className={`${tdClass} whitespace-nowrap text-[12px] text-ink-600`}>
                    {row.responded_at ? formatTimestamp(row.responded_at) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}

        <div className="mt-4">
          <SecondChanceNotice
            title={`${pending.length} ${dc(lang, 'approvalsPending')}`}
            message={dc(lang, 'contractorApprovalsNote')}
          />
        </div>
      </Surface>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, LoaderCircle, ShieldQuestion, XCircle } from 'lucide-react';
import type { WorkerViewProps } from '../types';
import { dc } from '../dashboardCopy';
import {
  Surface,
  EmptyState,
  Pill,
  TableWrap,
  thClass,
  tdClass,
  ErrorNotice,
  SuccessNotice,
  DashboardButton,
  SecondChanceNotice,
} from '../ui';
import { respondToApproval, DashboardError, type ApprovalStatus } from '../../../services/dashboardData';
import {
  formatPaise,
  formatTimestamp,
  pendingApprovals,
  pickLabel,
  APPROVAL_ACTION_LABELS,
  APPROVAL_STATUS_LABELS,
  APPROVAL_TONES,
} from '../../../services/dashboardAnalytics';

export const WorkerApprovals: React.FC<Pick<WorkerViewProps, 'lang' | 'approvals'> & { onChanged: () => void }> = ({
  lang,
  approvals,
  onChanged,
}) => {
  const pending = useMemo(() => pendingApprovals(approvals), [approvals]);
  const history = useMemo(() => approvals.filter((row) => row.status !== 'pending'), [approvals]);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const respond = async (id: string, decision: Extract<ApprovalStatus, 'approved' | 'rejected' | 'reported_suspicious'>) => {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    setDone(null);
    try {
      await respondToApproval(id, decision);
      setDone(id);
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof DashboardError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : 'The response could not be saved.'
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorNotice title={dc(lang, 'commonErrorTitle')} message={error} />}
      {done && <SuccessNotice message={dc(lang, 'approvalsSaved')} />}

      <Surface
        title={dc(lang, 'approvalsHeading')}
        subtitle={dc(lang, 'approvalsSub')}
        icon={<ClipboardCheck size={17} />}
        action={<Pill tone={pending.length > 0 ? 'warning' : 'positive'}>{`${pending.length} ${dc(lang, 'approvalsPending')}`}</Pill>}
      >
        {pending.length === 0 ? (
          <EmptyState title={dc(lang, 'approvalsEmpty')} body={dc(lang, 'approvalsSub')} icon={<CheckCircle2 size={18} />} />
        ) : (
          <ul className="space-y-3">
            {pending.map((row) => (
              <li key={row.id} className="rounded-xl border border-sand-200 bg-sand-50/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-extrabold text-ink-950">
                      {pickLabel(APPROVAL_ACTION_LABELS[row.action_type], lang)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      {dc(lang, 'approvalsContractor')}: {row.contractor_name}
                    </p>
                  </div>
                  <Pill tone="warning">{dc(lang, 'approvalsPending')}</Pill>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-sand-200 pt-3 sm:grid-cols-3">
                  <div className="min-w-0">
                    <dt className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-500">
                      {dc(lang, 'approvalsRecord')}
                    </dt>
                    <dd className="mt-0.5 truncate font-mono text-[12px] font-semibold text-ink-900">{row.record_id}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-500">
                      {dc(lang, 'approvalsAmount')}
                    </dt>
                    <dd className="mt-0.5 font-mono text-[13px] font-semibold text-ink-900">
                      {row.amount_paise == null ? '—' : formatPaise(row.amount_paise)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-500">
                      {dc(lang, 'approvalsCreated')}
                    </dt>
                    <dd className="mt-0.5 text-[12px] font-semibold text-ink-900">{formatTimestamp(row.created_at)}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-sand-200 pt-3">
                  <DashboardButton
                    variant="primary"
                    disabled={busyId === row.id}
                    onClick={() => void respond(row.id, 'approved')}
                    icon={busyId === row.id ? <LoaderCircle size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  >
                    {dc(lang, 'actionApprove')}
                  </DashboardButton>
                  <DashboardButton
                    variant="danger"
                    disabled={busyId === row.id}
                    onClick={() => void respond(row.id, 'rejected')}
                    icon={<XCircle size={13} />}
                  >
                    {dc(lang, 'actionReject')}
                  </DashboardButton>
                  <DashboardButton
                    variant="ghost"
                    disabled={busyId === row.id}
                    onClick={() => void respond(row.id, 'reported_suspicious')}
                    icon={<ShieldQuestion size={13} />}
                  >
                    {dc(lang, 'actionFlag')}
                  </DashboardButton>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <SecondChanceNotice title={dc(lang, 'approvalsNote')} message={dc(lang, 'onlineNote')} />
        </div>
      </Surface>

      <Surface title={dc(lang, 'approvalsHistory')} icon={<ClipboardCheck size={17} />}>
        {history.length === 0 ? (
          <EmptyState title={dc(lang, 'commonEmptyTitle')} body={dc(lang, 'approvalsEmpty')} />
        ) : (
          <TableWrap minWidth="min-w-[40rem]">
            <thead>
              <tr className="border-b border-sand-200">
                <th className={thClass}>{dc(lang, 'approvalsAction')}</th>
                <th className={thClass}>{dc(lang, 'approvalsContractor')}</th>
                <th className={thClass}>{dc(lang, 'approvalsRecord')}</th>
                <th className={`${thClass} text-right`}>{dc(lang, 'approvalsAmount')}</th>
                <th className={thClass}>{dc(lang, 'labelStatus')}</th>
                <th className={thClass}>{dc(lang, 'approvalsRespondedAt')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {history.map((row) => (
                <tr key={row.id} className="hover:bg-sand-50/70">
                  <td className={`${tdClass} font-semibold`}>{pickLabel(APPROVAL_ACTION_LABELS[row.action_type], lang)}</td>
                  <td className={tdClass}>{row.contractor_name}</td>
                  <td className={`${tdClass} font-mono text-[11px] text-ink-600`}>{row.record_id}</td>
                  <td className={`${tdClass} text-right font-mono tabular-nums`}>
                    {row.amount_paise == null ? '—' : formatPaise(row.amount_paise)}
                  </td>
                  <td className={tdClass}>
                    <Pill tone={APPROVAL_TONES[row.status]}>{pickLabel(APPROVAL_STATUS_LABELS[row.status], lang)}</Pill>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-[12px]`}>{formatTimestamp(row.responded_at)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Surface>
    </div>
  );
};

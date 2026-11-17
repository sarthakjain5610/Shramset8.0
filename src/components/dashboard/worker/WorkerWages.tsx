import React, { useMemo } from 'react';
import { Coins, ArrowDownRight, ArrowUpRight, FileWarning, Wallet } from 'lucide-react';
import type { WorkerViewProps } from '../types';
import { dc } from '../dashboardCopy';
import { Surface, EmptyState, Pill, TableWrap, thClass, tdClass, tdNumericClass, Meter, SecondChanceNotice } from '../ui';
import {
  formatPaise,
  formatIsoDate,
  summarizeLedger,
  pickLabel,
  LEDGER_TYPE_LABELS,
  PAYMENT_MODE_LABELS,
  ACK_LABELS,
  ACK_TONES,
} from '../../../services/dashboardAnalytics';

export const WorkerWages: React.FC<Pick<WorkerViewProps, 'lang' | 'ledger'>> = ({ lang, ledger }) => {
  const summary = useMemo(() => summarizeLedger(ledger), [ledger]);
  const isOverpaid = summary.netPaise < 0;
  const totalFlow = summary.earnedPaise + summary.paidPaise;
  const settledPct = totalFlow > 0 ? (summary.paidPaise / totalFlow) * 100 : 0;

  return (
    <div className="space-y-4">
      <Surface title={dc(lang, 'wagesBalanceTitle')} subtitle={dc(lang, 'wagesSub')} icon={<Wallet size={17} />}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="rounded-2xl border border-sand-200 bg-gradient-to-br from-sand-50 to-white p-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-500">
              {isOverpaid ? dc(lang, 'kpiOverpaid') : dc(lang, 'wagesNet')}
            </p>
            <p
              className={`mt-1 font-mono text-3xl font-bold tabular-nums tracking-tight ${
                isOverpaid ? 'text-rose-700' : 'text-forest-900'
              }`}
            >
              {formatPaise(Math.abs(summary.netPaise))}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
              {summary.entries} {dc(lang, 'wagesHeading').toLowerCase()} · {summary.settledEntries}{' '}
              {dc(lang, 'contractorWagesSettled').toLowerCase()}
            </p>
            <div className="mt-4">
              <Meter value={settledPct} max={100} tone={isOverpaid ? 'critical' : 'positive'} />
              <div className="mt-1.5 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                <span>{dc(lang, 'wagesPaid')}</span>
                <span>{dc(lang, 'wagesEarned')}</span>
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-forest-100 bg-forest-50/60 p-3">
              <dt className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-forest-800">
                <ArrowUpRight size={12} aria-hidden="true" />
                {dc(lang, 'wagesEarned')}
              </dt>
              <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-forest-900">
                {formatPaise(summary.earnedPaise)}
              </dd>
            </div>
            <div className="rounded-xl border border-sand-200 bg-white p-3">
              <dt className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-500">
                <ArrowDownRight size={12} aria-hidden="true" />
                {dc(lang, 'wagesPaid')}
              </dt>
              <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-ink-900">
                {formatPaise(summary.paidPaise)}
              </dd>
            </div>
            <div className="rounded-xl border border-sand-200 bg-white p-3">
              <dt className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-500">
                {dc(lang, 'wagesDeductions')}
              </dt>
              <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-ink-900">
                {formatPaise(summary.deductionsPaise)}
              </dd>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3">
              <dt className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-rose-900">
                <FileWarning size={12} aria-hidden="true" />
                {dc(lang, 'wagesDisputed')}
              </dt>
              <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-rose-900">
                {formatPaise(summary.disputedPaise)}
              </dd>
            </div>
          </dl>
        </div>

        {summary.awaitingAcknowledgment > 0 && (
          <div className="mt-4">
            <SecondChanceNotice
              title={`${summary.awaitingAcknowledgment} ${dc(lang, 'wagesAwaitingAck')}`}
              message={dc(lang, 'wagesAckNote')}
            />
          </div>
        )}
      </Surface>

      <Surface title={dc(lang, 'wagesHeading')} subtitle={dc(lang, 'wagesSub')} icon={<Coins size={17} />}>
        {ledger.length === 0 ? (
          <EmptyState title={dc(lang, 'wagesEmpty')} body={dc(lang, 'overviewNextStepsBody')} icon={<Coins size={18} />} />
        ) : (
          <TableWrap minWidth="min-w-[52rem]">
            <thead>
              <tr className="border-b border-sand-200">
                <th className={thClass}>{dc(lang, 'labelDate')}</th>
                <th className={thClass}>{dc(lang, 'disputesType')}</th>
                <th className={thClass}>{dc(lang, 'disputesDescription')}</th>
                <th className={thClass}>{dc(lang, 'labelMode')}</th>
                <th className={`${thClass} text-right`}>{dc(lang, 'labelAmount')}</th>
                <th className={thClass}>{dc(lang, 'wagesAckStatus')}</th>
                <th className={thClass}>{dc(lang, 'wagesReference')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {ledger.map((entry) => (
                <tr key={entry.id} className="transition-colors hover:bg-sand-50/70">
                  <td className={`${tdClass} whitespace-nowrap font-semibold`}>{formatIsoDate(entry.date)}</td>
                  <td className={tdClass}>
                    <Pill tone={entry.amount_paise < 0 ? 'warning' : 'positive'}>
                      {pickLabel(LEDGER_TYPE_LABELS[entry.type], lang)}
                    </Pill>
                  </td>
                  <td className={`${tdClass} max-w-[16rem]`}>
                    <p className="truncate text-[13px] font-semibold text-ink-900">{entry.description}</p>
                    {lang === 'hi' && entry.hindi_description && (
                      <p className="truncate text-[11px] text-ink-500">{entry.hindi_description}</p>
                    )}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-[12px]`}>
                    {pickLabel(PAYMENT_MODE_LABELS[entry.payment_mode], lang)}
                  </td>
                  <td
                    className={`${tdNumericClass} font-bold ${
                      entry.amount_paise < 0 ? 'text-rose-700' : 'text-forest-800'
                    }`}
                  >
                    {formatPaise(entry.amount_paise)}
                  </td>
                  <td className={tdClass}>
                    <Pill tone={ACK_TONES[entry.acknowledgment_status]}>
                      {pickLabel(ACK_LABELS[entry.acknowledgment_status], lang)}
                    </Pill>
                  </td>
                  <td className={`${tdClass} font-mono text-[11px] text-ink-600`}>
                    {entry.utr_or_receipt_no || entry.id.slice(0, 14)}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Surface>
    </div>
  );
};

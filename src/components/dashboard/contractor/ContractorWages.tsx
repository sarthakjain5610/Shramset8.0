import React, { useMemo } from 'react';
import { Coins, FileWarning, Scale, Wallet } from 'lucide-react';
import type { ContractorViewProps } from '../types';
import { dc } from '../dashboardCopy';
import { Surface, EmptyState, Pill, KpiCard, TableWrap, thClass, tdClass, tdNumericClass } from '../ui';
import {
  formatPaise,
  formatIsoDate,
  summarizeLedger,
  groupLedgerByWorker,
  balancePaise,
  isAwaitingAcknowledgment,
  pickLabel,
  LEDGER_TYPE_LABELS,
  PAYMENT_MODE_LABELS,
  ACK_LABELS,
  ACK_TONES,
} from '../../../services/dashboardAnalytics';

export const ContractorWages: React.FC<Pick<ContractorViewProps, 'lang' | 'workers' | 'ledger'>> = ({
  lang,
  workers,
  ledger,
}) => {
  const totals = useMemo(() => summarizeLedger(ledger), [ledger]);
  const byWorker = useMemo(() => groupLedgerByWorker(ledger), [ledger]);

  const perWorker = useMemo(
    () =>
      workers
        .map((worker) => {
          const rows = byWorker.get(worker.id) || [];
          const summary = summarizeLedger(rows);
          return { worker, summary, balance: balancePaise(rows) };
        })
        .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)),
    [workers, byWorker]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={dc(lang, 'wagesEarned')} value={formatPaise(totals.earnedPaise)} icon={<Coins size={16} />} />
        <KpiCard label={dc(lang, 'wagesPaid')} value={formatPaise(totals.paidPaise)} />
        <KpiCard
          emphasis
          label={dc(lang, 'contractorWagesPositive')}
          value={formatPaise(Math.max(0, totals.netPaise))}
          hint={`${totals.entries} ${dc(lang, 'wagesHeading').toLowerCase()}`}
          icon={<Scale size={16} />}
        />
        <KpiCard
          label={dc(lang, 'contractorWagesAwaitingAck')}
          value={totals.awaitingAcknowledgment}
          tone={totals.awaitingAcknowledgment > 0 ? 'warning' : 'positive'}
          hint={`${totals.disputedEntries} ${dc(lang, 'wagesDisputed').toLowerCase()}`}
          icon={<FileWarning size={16} />}
        />
      </div>

      <Surface title={dc(lang, 'contractorWagesHeading')} subtitle={dc(lang, 'contractorWagesSub')} icon={<Wallet size={17} />}>
        {workers.length === 0 ? (
          <EmptyState title={dc(lang, 'crewEmpty')} body={dc(lang, 'crewSub')} icon={<Wallet size={18} />} />
        ) : ledger.length === 0 ? (
          <EmptyState title={dc(lang, 'contractorWagesEmpty')} body={dc(lang, 'wagesEmpty')} icon={<Wallet size={18} />} />
        ) : (
          <TableWrap minWidth="min-w-[40rem]">
            <thead>
              <tr className="border-b border-sand-200">
                <th className={thClass}>{dc(lang, 'crewWorker')}</th>
                <th className={`${thClass} text-right`}>{dc(lang, 'wagesEarned')}</th>
                <th className={`${thClass} text-right`}>{dc(lang, 'wagesPaid')}</th>
                <th className={`${thClass} text-right`}>{dc(lang, 'kpiBalance')}</th>
                <th className={thClass}>{dc(lang, 'contractorWagesAwaitingAck')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {perWorker.map(({ worker, summary, balance }) => (
                <tr key={worker.id} className="hover:bg-sand-50/70">
                  <td className={tdClass}>
                    <p className="text-[13px] font-bold text-ink-900">{worker.name}</p>
                    <p className="text-[11px] text-ink-500">
                      {worker.trade} · {summary.entries} {dc(lang, 'wagesHeading').toLowerCase()}
                    </p>
                  </td>
                  <td className={tdNumericClass}>{formatPaise(summary.earnedPaise)}</td>
                  <td className={tdNumericClass}>{formatPaise(summary.paidPaise)}</td>
                  <td className={`${tdNumericClass} font-bold ${balance < 0 ? 'text-rose-700' : 'text-forest-800'}`}>
                    {formatPaise(balance)}
                  </td>
                  <td className={tdClass}>
                    {summary.awaitingAcknowledgment > 0 ? (
                      <Pill tone="warning">{summary.awaitingAcknowledgment}</Pill>
                    ) : (
                      <Pill tone="positive">0</Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Surface>

      <Surface title={dc(lang, 'overviewRecentWages')} subtitle={dc(lang, 'wagesSub')} icon={<Coins size={17} />}>
        {ledger.length === 0 ? (
          <EmptyState title={dc(lang, 'contractorWagesEmpty')} icon={<Coins size={18} />} />
        ) : (
          <TableWrap minWidth="min-w-[46rem]">
            <thead>
              <tr className="border-b border-sand-200">
                <th className={thClass}>{dc(lang, 'labelDate')}</th>
                <th className={thClass}>{dc(lang, 'crewWorker')}</th>
                <th className={thClass}>{dc(lang, 'disputesType')}</th>
                <th className={thClass}>{dc(lang, 'labelMode')}</th>
                <th className={`${thClass} text-right`}>{dc(lang, 'labelAmount')}</th>
                <th className={thClass}>{dc(lang, 'wagesAckStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {ledger.slice(0, 20).map((entry) => (
                <tr key={entry.id} className="hover:bg-sand-50/70">
                  <td className={`${tdClass} whitespace-nowrap font-semibold`}>{formatIsoDate(entry.date)}</td>
                  <td className={`${tdClass} font-mono text-[11px] text-ink-600`}>{entry.worker_id}</td>
                  <td className={tdClass}>
                    <Pill tone={entry.amount_paise < 0 ? 'warning' : 'positive'}>
                      {pickLabel(LEDGER_TYPE_LABELS[entry.type], lang)}
                    </Pill>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-[12px]`}>
                    {pickLabel(PAYMENT_MODE_LABELS[entry.payment_mode], lang)}
                  </td>
                  <td className={`${tdNumericClass} font-bold ${entry.amount_paise < 0 ? 'text-rose-700' : 'text-forest-800'}`}>
                    {formatPaise(entry.amount_paise)}
                  </td>
                  <td className={tdClass}>
                    <Pill tone={ACK_TONES[entry.acknowledgment_status]}>
                      {isAwaitingAcknowledgment(entry.acknowledgment_status)
                        ? dc(lang, 'contractorWagesAwaitingAck')
                        : pickLabel(ACK_LABELS[entry.acknowledgment_status], lang)}
                    </Pill>
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

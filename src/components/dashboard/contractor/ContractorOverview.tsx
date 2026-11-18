import React, { useMemo } from 'react';
import { Building2, CalendarCheck2, ClipboardCheck, Gavel, Users, Wallet } from 'lucide-react';
import type { ContractorViewProps } from '../types';
import { dc } from '../dashboardCopy';
import { KpiCard, Surface, EmptyState, Pill, Avatar, TableWrap, thClass, tdClass, tdNumericClass } from '../ui';
import {
  formatPaise,
  formatIsoDate,
  formatShortDate,
  summarizeAttendance,
  summarizeLedger,
  groupLedgerByWorker,
  pendingApprovals,
  summarizeDisputes,
  attendanceOnDate,
  todayIso,
  monthKey,
  initialsOf,
  balancePaise,
} from '../../../services/dashboardAnalytics';

export const ContractorOverview: React.FC<ContractorViewProps & { onJump?: (panel: string) => void }> = ({
  lang,
  workers,
  sites,
  attendance,
  ledger,
  disputes,
  approvals,
  onJump,
}) => {
  const stats = useMemo(() => {
    const today = todayIso();
    const month = monthKey(today);
    const monthAttendance = attendance.filter((row) => row.date.startsWith(month));
    const ledgerByWorker = groupLedgerByWorker(ledger);
    const balances = workers.map((worker) => ({
      worker,
      balance: balancePaise(ledgerByWorker.get(worker.id) || []),
      entries: (ledgerByWorker.get(worker.id) || []).length,
    }));
    return {
      todayShifts: attendanceOnDate(attendance, today).length,
      monthAttendance: summarizeAttendance(monthAttendance),
      ledger: summarizeLedger(ledger),
      pending: pendingApprovals(approvals),
      disputes: summarizeDisputes(disputes),
      balances,
      onSiteToday: new Set(attendanceOnDate(attendance, today).map((row) => row.worker_id)).size,
    };
  }, [workers, attendance, ledger, disputes, approvals]);

  const topBalances = stats.balances.filter((row) => row.balance !== 0).slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={dc(lang, 'kpiCrew')}
          value={workers.length}
          hint={`${sites.length} ${dc(lang, 'sitesHeading').toLowerCase()}`}
          icon={<Users size={16} />}
        />
        <KpiCard
          label={dc(lang, 'kpiOnSiteToday')}
          value={stats.onSiteToday}
          hint={`${stats.todayShifts} ${dc(lang, 'kpiShifts').toLowerCase()}`}
          icon={<CalendarCheck2 size={16} />}
        />
        <KpiCard
          emphasis
          label={dc(lang, 'kpiBalance')}
          value={formatPaise(Math.max(0, stats.ledger.netPaise))}
          hint={`${formatPaise(Math.abs(stats.ledger.netPaise))} ${dc(lang, 'kpiWageLiability').toLowerCase()}`}
          icon={<Wallet size={16} />}
        />
        <KpiCard
          label={dc(lang, 'kpiPendingApprovals')}
          value={stats.pending.length}
          tone={stats.pending.length > 0 ? 'warning' : 'positive'}
          hint={`${stats.disputes.open} ${dc(lang, 'kpiOpenDisputes').toLowerCase()}`}
          icon={<ClipboardCheck size={16} />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Surface
          title={dc(lang, 'sitesHeading')}
          subtitle={dc(lang, 'crewSub')}
          icon={<Building2 size={17} />}
          action={
            <button
              type="button"
              onClick={() => onJump?.('sites')}
              className="text-[11px] font-bold text-forest-800 hover:underline"
            >
              {dc(lang, 'navSites')} →
            </button>
          }
        >
          {sites.length === 0 ? (
            <EmptyState title={dc(lang, 'sitesEmpty')} body={dc(lang, 'crewEmpty')} icon={<Building2 size={18} />} />
          ) : (
            <ul className="space-y-2">
              {sites.slice(0, 4).map((site) => (
                <li key={site.id} className="flex items-start justify-between gap-3 rounded-xl border border-sand-200 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-ink-900">{site.name}</p>
                    <p className="truncate text-[11px] text-ink-500">
                      {site.location}
                      {site.city ? ` · ${site.city}` : ''}
                    </p>
                  </div>
                  <Pill tone="info">{site.project_type || dc(lang, 'sitesType')}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        <Surface
          title={dc(lang, 'contractorWagesHeading')}
          subtitle={dc(lang, 'contractorWagesSub')}
          icon={<Wallet size={17} />}
          action={
            <button
              type="button"
              onClick={() => onJump?.('wages')}
              className="text-[11px] font-bold text-forest-800 hover:underline"
            >
              {dc(lang, 'navWages')} →
            </button>
          }
        >
          {workers.length === 0 ? (
            <EmptyState title={dc(lang, 'crewEmpty')} icon={<Users size={18} />} />
          ) : topBalances.length === 0 ? (
            <EmptyState title={dc(lang, 'contractorWagesEmpty')} body={dc(lang, 'wagesEmpty')} icon={<Wallet size={18} />} />
          ) : (
            <TableWrap minWidth="min-w-[24rem]">
              <thead>
                <tr className="border-b border-sand-200">
                  <th className={thClass}>{dc(lang, 'crewWorker')}</th>
                  <th className={`${thClass} text-right`}>{dc(lang, 'kpiBalance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {topBalances.map(({ worker, balance, entries }) => (
                  <tr key={worker.id}>
                    <td className={tdClass}>
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={initialsOf(worker.name)} className="h-8 w-8 rounded-lg text-[10px]" />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-bold text-ink-900">{worker.name}</p>
                          <p className="truncate text-[11px] text-ink-500">
                            {worker.trade} · {entries} {dc(lang, 'contractorWagesHeading').toLowerCase()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td
                      className={`${tdNumericClass} font-bold ${balance < 0 ? 'text-rose-700' : 'text-forest-800'}`}
                    >
                      {formatPaise(balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Surface>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Surface title={dc(lang, 'contractorApprovalsHeading')} subtitle={dc(lang, 'contractorApprovalsSub')} icon={<ClipboardCheck size={17} />}>
          {stats.pending.length === 0 ? (
            <EmptyState title={dc(lang, 'contractorApprovalsEmpty')} icon={<ClipboardCheck size={18} />} />
          ) : (
            <ul className="space-y-2">
              {stats.pending.slice(0, 4).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-brass-200 bg-brass-50/60 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-ink-900">{row.action_type.replace(/_/g, ' ')}</p>
                    <p className="truncate font-mono text-[11px] text-ink-500">{row.record_id}</p>
                  </div>
                  <Pill tone="warning">{dc(lang, 'approvalsPending')}</Pill>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-sand-100 pt-3 text-[11px] leading-relaxed text-ink-500">
            {dc(lang, 'contractorApprovalsNote')}
          </p>
        </Surface>

        <Surface title={dc(lang, 'contractorDisputesHeading')} subtitle={dc(lang, 'contractorDisputesSub')} icon={<Gavel size={17} />}>
          {disputes.length === 0 ? (
            <EmptyState title={dc(lang, 'contractorDisputesEmpty')} icon={<Gavel size={18} />} />
          ) : (
            <ul className="space-y-2">
              {disputes.slice(0, 3).map((row) => (
                <li key={row.id} className="rounded-xl border border-sand-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] font-bold text-ink-900">{row.dispute_type.replace(/_/g, ' ')}</p>
                    <Pill tone={row.contractor_response ? 'positive' : 'warning'}>
                      {row.contractor_response ? dc(lang, 'disputesResponse') : dc(lang, 'approvalsPending')}
                    </Pill>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-500">
                    {formatIsoDate(row.incident_date)} · {formatPaise(row.claimed_amount_paise)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-sand-100 pt-3 text-[11px] leading-relaxed text-ink-500">
            {dc(lang, 'contractorDisputesResponseNote')}
          </p>
        </Surface>
      </div>

      <p className="text-center text-[11px] text-ink-400">
        {dc(lang, 'attendanceSummaryTitle')}: {formatShortDate(todayIso())} · {stats.monthAttendance.shifts}{' '}
        {dc(lang, 'kpiShifts').toLowerCase()} · {formatPaise(stats.monthAttendance.shiftWagePaise)}
      </p>
    </div>
  );
};

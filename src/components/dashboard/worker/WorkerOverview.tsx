import React, { useMemo } from 'react';
import { CalendarDays, Coins, Clock3, ArrowLeftRight, TrendingUp, ShieldCheck, CircleSlash2 } from 'lucide-react';
import type { WorkerViewProps } from '../types';
import { dc } from '../dashboardCopy';
import {
  KpiCard,
  Surface,
  EmptyState,
  Pill,
  Avatar,
  Field,
  Meter,
  RhythmChart,
} from '../ui';
import {
  formatPaise,
  formatShortDate,
  formatIsoDate,
  summarizeAttendance,
  summarizeLedger,
  attendanceTrend,
  pendingApprovals,
  summarizeDisputes,
  monthKey,
  todayIso,
  initialsOf,
  pickLabel,
  skillLabel,
  LEDGER_TYPE_LABELS,
  ACK_LABELS,
  ACK_TONES,
} from '../../../services/dashboardAnalytics';

export const WorkerOverview: React.FC<WorkerViewProps & { onJump?: (panel: string) => void }> = ({
  lang,
  worker,
  attendance,
  ledger,
  disputes,
  approvals,
  onJump,
}) => {
  const stats = useMemo(() => {
    const month = monthKey(todayIso());
    const monthAttendance = attendance.filter((row) => row.date.startsWith(month));
    return {
      monthAttendance: summarizeAttendance(monthAttendance),
      allAttendance: summarizeAttendance(attendance),
      ledger: summarizeLedger(ledger),
      trend: attendanceTrend(attendance, 14),
      pending: pendingApprovals(approvals),
      disputeSummary: summarizeDisputes(disputes),
    };
  }, [attendance, ledger, disputes, approvals]);

  const recent = ledger.slice(0, 5);
  const paidShare = stats.ledger.earnedPaise + stats.ledger.paidPaise;
  const settledPct = paidShare > 0 ? (stats.ledger.paidPaise / paidShare) * 100 : 0;
  const hasTrend = stats.trend.some((point) => point.shifts > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={dc(lang, 'kpiShifts')}
          value={stats.monthAttendance.shifts}
          hint={`${stats.allAttendance.shifts} ${dc(lang, 'commonTotal').toLowerCase()}`}
          icon={<CalendarDays size={16} />}
        />
        <KpiCard
          label={dc(lang, 'kpiOvertime')}
          value={`${stats.monthAttendance.overtimeHours}h`}
          hint={`${stats.monthAttendance.overtimeShifts} ${dc(
            lang,
            'attendanceOvertimeShifts'
          ).toLowerCase()}`}
          icon={<Clock3 size={16} />}
        />
        <KpiCard
          label={dc(lang, 'kpiShiftWage')}
          value={formatPaise(stats.monthAttendance.shiftWagePaise)}
          hint={dc(lang, 'attendanceSummaryTitle')}
          icon={<Coins size={16} />}
        />
        <KpiCard
          emphasis
          label={stats.ledger.netPaise < 0 ? dc(lang, 'kpiOverpaid') : dc(lang, 'kpiBalance')}
          value={formatPaise(Math.abs(stats.ledger.netPaise))}
          hint={
            stats.ledger.awaitingAcknowledgment > 0
              ? `${stats.ledger.awaitingAcknowledgment} ${dc(lang, 'kpiAwaitingAck').toLowerCase()}`
              : dc(lang, 'wagesBalanceTitle')
          }
          icon={<ArrowLeftRight size={16} />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Surface
          title={dc(lang, 'overviewRhythm')}
          subtitle={dc(lang, 'attendanceSub')}
          icon={<TrendingUp size={17} />}
        >
          {hasTrend ? (
            <RhythmChart
              points={stats.trend}
              ariaLabel={dc(lang, 'overviewRhythm')}
              formatDay={formatShortDate}
              formatWage={formatPaise}
            />
          ) : (
            <EmptyState title={dc(lang, 'overviewRhythmEmpty')} body={dc(lang, 'attendanceEmpty')} icon={<CalendarDays size={18} />} />
          )}

          <div className="mt-5 border-t border-sand-100 pt-4">
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
              <span className="font-bold text-ink-800">{dc(lang, 'wagesBalanceTitle')}</span>
              <span className="font-mono text-[11px] text-ink-600">
                {formatPaise(stats.ledger.paidPaise)} / {formatPaise(stats.ledger.earnedPaise)}
              </span>
            </div>
            <Meter
              value={settledPct}
              max={100}
              tone={stats.ledger.netPaise < 0 ? 'critical' : 'positive'}
              label={`${Math.round(settledPct)}%`}
            />
            <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-ink-500">
              <span>{dc(lang, 'wagesPaid')}</span>
              <span>{dc(lang, 'wagesEarned')}</span>
            </div>
          </div>
        </Surface>

        <Surface title={dc(lang, 'overviewIdentity')} subtitle={dc(lang, 'profileSub')} icon={<ShieldCheck size={17} />}>
          <div className="flex items-center gap-3">
            <Avatar initials={initialsOf(worker.name)} />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-ink-950">{worker.name}</p>
              {worker.hindi_name && <p className="truncate text-xs text-ink-500">{worker.hindi_name}</p>}
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3">
            <Field label={dc(lang, 'labelTrade')} value={worker.trade} />
            <Field label={dc(lang, 'onboardingSkill')} value={skillLabel(worker.skill_level, lang)} />
            <Field
              label={dc(lang, 'labelDailyWage')}
              value={
                worker.daily_base_wage_paise == null
                  ? dc(lang, 'wageNotAssigned')
                  : formatPaise(worker.daily_base_wage_paise)
              }
            />
            <Field
              label={dc(lang, 'overviewAssignment')}
              value={worker.active_site_id || dc(lang, 'commonUnavailable')}
              mono
            />
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-sand-100 pt-3">
            <Pill tone={worker.contact_sharing_consent ? 'positive' : 'neutral'}>
              {worker.contact_sharing_consent ? dc(lang, 'crewConsentOn') : dc(lang, 'crewConsentOff')}
            </Pill>
            {stats.pending.length > 0 && (
              <button
                type="button"
                onClick={() => onJump?.('approvals')}
                className="rounded-full border border-brass-300 bg-brass-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-brass-900 hover:bg-brass-100"
              >
                {stats.pending.length} {dc(lang, 'approvalsPending')}
              </button>
            )}
            {stats.disputeSummary.open > 0 && (
              <button
                type="button"
                onClick={() => onJump?.('disputes')}
                className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-rose-900 hover:bg-rose-100"
              >
                {stats.disputeSummary.open} {dc(lang, 'kpiOpenDisputes')}
              </button>
            )}
          </div>
        </Surface>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Surface
          title={dc(lang, 'overviewRecentWages')}
          subtitle={dc(lang, 'wagesSub')}
          icon={<Coins size={17} />}
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
          {recent.length === 0 ? (
            <EmptyState title={dc(lang, 'wagesEmpty')} icon={<Coins size={18} />} />
          ) : (
            <ul className="divide-y divide-sand-100">
              {recent.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-ink-900">
                      {pickLabel(LEDGER_TYPE_LABELS[entry.type], lang)}
                    </p>
                    <p className="truncate text-[11px] text-ink-500">
                      {formatIsoDate(entry.date)} · {entry.description}
                    </p>
                    <div className="mt-1">
                      <Pill tone={ACK_TONES[entry.acknowledgment_status]}>
                        {pickLabel(ACK_LABELS[entry.acknowledgment_status], lang)}
                      </Pill>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-[13px] font-bold tabular-nums ${
                      entry.amount_paise < 0 ? 'text-rose-700' : 'text-forest-800'
                    }`}
                  >
                    {formatPaise(entry.amount_paise)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        <Surface title={dc(lang, 'overviewNextSteps')} icon={<CircleSlash2 size={17} />}>
          <p className="text-xs leading-relaxed text-ink-600">{dc(lang, 'overviewNextStepsBody')}</p>
          <ul className="mt-3 space-y-2">
            {[
              dc(lang, 'navAttendance'),
              dc(lang, 'wagesAckStatus'),
              dc(lang, 'disputesResponse'),
            ].map((item) => (
              <li key={item} className="flex items-center justify-between gap-3 rounded-lg border border-sand-200 bg-sand-50 px-3 py-2">
                <span className="text-xs font-semibold text-ink-800">{item}</span>
                <Pill tone="neutral">{dc(lang, 'commonNotConnected')}</Pill>
              </li>
            ))}
          </ul>
        </Surface>
      </div>
    </div>
  );
};

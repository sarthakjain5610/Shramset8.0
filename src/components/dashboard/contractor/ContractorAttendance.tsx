import React, { useMemo, useState } from 'react';
import { CalendarCheck2, CalendarDays, MapPin, Table2, UserCheck } from 'lucide-react';
import type { ContractorViewProps } from '../types';
import { dc } from '../dashboardCopy';
import { Surface, EmptyState, Pill, KpiCard, TableWrap, thClass, tdClass, tdNumericClass } from '../ui';
import {
  formatPaise,
  formatIsoDate,
  formatClock,
  summarizeAttendance,
  attendanceOnDate,
  groupAttendanceByWorker,
  monthKey,
  todayIso,
  pickLabel,
  SHIFT_LABELS,
} from '../../../services/dashboardAnalytics';

export const ContractorAttendance: React.FC<
  Pick<ContractorViewProps, 'lang' | 'workers' | 'attendance'>
> = ({ lang, workers, attendance }) => {
  const [date, setDate] = useState(todayIso());

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const worker of workers) map.set(worker.id, worker.name);
    return map;
  }, [workers]);

  const month = monthKey(date);
  const monthRows = useMemo(() => attendance.filter((row) => row.date.startsWith(month)), [attendance, month]);
  const summary = useMemo(() => summarizeAttendance(monthRows), [monthRows]);
  const dayRows = useMemo(() => attendanceOnDate(attendance, date), [attendance, date]);
  const byWorker = useMemo(() => groupAttendanceByWorker(monthRows), [monthRows]);

  const perWorker = useMemo(
    () =>
      workers
        .map((worker) => {
          const rows = byWorker.get(worker.id) || [];
          return {
            worker,
            shifts: rows.length,
            wagePaise: rows.reduce((total, row) => total + (Number(row.calculated_wage_paise) || 0), 0),
            lastDate: rows[0]?.date || null,
          };
        })
        .sort((a, b) => b.shifts - a.shifts),
    [workers, byWorker]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={dc(lang, 'contractorAttendanceToday')} value={dayRows.length} icon={<CalendarCheck2 size={16} />} />
        <KpiCard label={dc(lang, 'kpiShifts')} value={summary.shifts} hint={month} icon={<CalendarDays size={16} />} />
        <KpiCard
          label={dc(lang, 'kpiCrew')}
          value={`${summary.distinctWorkers}/${workers.length}`}
          hint={dc(lang, 'kpiOnSiteToday')}
          icon={<UserCheck size={16} />}
        />
        <KpiCard
          label={dc(lang, 'kpiShiftWage')}
          value={formatPaise(summary.shiftWagePaise)}
          hint={`${summary.overtimeHours}h ${dc(lang, 'kpiOvertime').toLowerCase()}`}
        />
      </div>

      <Surface
        title={dc(lang, 'contractorAttendanceHeading')}
        subtitle={dc(lang, 'contractorAttendanceSub')}
        icon={<Table2 size={17} />}
        action={
          <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-ink-500">
            {dc(lang, 'contractorAttendanceDate')}
            <input
              type="date"
              value={date}
              max={todayIso()}
              onChange={(event) => setDate(event.target.value)}
              className="rounded-lg border border-sand-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-900 focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
            />
          </label>
        }
      >
        {dayRows.length === 0 ? (
          <EmptyState
            title={dc(lang, 'contractorAttendanceNoRows')}
            body={attendance.length === 0 ? dc(lang, 'contractorAttendanceEmpty') : dc(lang, 'attendanceEmpty')}
            icon={<CalendarDays size={18} />}
          />
        ) : (
          <TableWrap>
            <thead>
              <tr className="border-b border-sand-200">
                <th className={thClass}>{dc(lang, 'crewWorker')}</th>
                <th className={thClass}>{dc(lang, 'labelShift')}</th>
                <th className={thClass}>{`${dc(lang, 'labelHours')} · in/out`}</th>
                <th className={thClass}>{dc(lang, 'attendanceSupervisor')}</th>
                <th className={thClass}>{dc(lang, 'labelSite')}</th>
                <th className={`${thClass} text-right`}>{dc(lang, 'labelWage')}</th>
                <th className={thClass}>{dc(lang, 'attendanceVerified')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {dayRows.map((row) => (
                <tr key={row.id} className="hover:bg-sand-50/70">
                  <td className={`${tdClass} font-semibold`}>{nameById.get(row.worker_id) || row.worker_id}</td>
                  <td className={tdClass}>
                    <Pill tone={row.shift_type === 'half_day' ? 'warning' : row.overtime_hours > 0 ? 'info' : 'positive'}>
                      {pickLabel(SHIFT_LABELS[row.shift_type], lang)}
                    </Pill>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap font-mono text-[12px] text-ink-700`}>
                    {formatClock(row.time_in)}–{formatClock(row.time_out)}
                    <span className="ml-2 text-ink-400">
                      {row.base_hours}h{row.overtime_hours > 0 ? ` +${row.overtime_hours}h` : ''}
                    </span>
                  </td>
                  <td className={`${tdClass} max-w-[10rem] truncate`}>{row.supervisor_name || '—'}</td>
                  <td className={`${tdClass} font-mono text-[11px] text-ink-600`}>{row.site_id || '—'}</td>
                  <td className={`${tdNumericClass} font-semibold`}>{formatPaise(row.calculated_wage_paise)}</td>
                  <td className={tdClass}>
                    {row.geo_verified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-forest-800">
                        <MapPin size={12} aria-hidden="true" />
                        {dc(lang, 'commonYes')}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-ink-400">{dc(lang, 'commonNo')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Surface>

      <Surface title={dc(lang, 'attendanceSummaryTitle')} subtitle={month} icon={<CalendarDays size={17} />}>
        {perWorker.length === 0 ? (
          <EmptyState title={dc(lang, 'crewEmpty')} icon={<UserCheck size={18} />} />
        ) : (
          <TableWrap minWidth="min-w-[32rem]">
            <thead>
              <tr className="border-b border-sand-200">
                <th className={thClass}>{dc(lang, 'crewWorker')}</th>
                <th className={`${thClass} text-right`}>{dc(lang, 'kpiShifts')}</th>
                <th className={`${thClass} text-right`}>{dc(lang, 'kpiShiftWage')}</th>
                <th className={thClass}>{dc(lang, 'lastUpdated')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {perWorker.map(({ worker, shifts, wagePaise, lastDate }) => (
                <tr key={worker.id} className="hover:bg-sand-50/70">
                  <td className={`${tdClass} font-semibold`}>{worker.name}</td>
                  <td className={`${tdNumericClass} ${shifts === 0 ? 'text-ink-400' : ''}`}>{shifts}</td>
                  <td className={tdNumericClass}>{formatPaise(wagePaise)}</td>
                  <td className={`${tdClass} whitespace-nowrap text-[12px] text-ink-600`}>
                    {lastDate ? formatIsoDate(lastDate) : '—'}
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

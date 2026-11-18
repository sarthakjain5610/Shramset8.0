import React, { useMemo, useState } from 'react';
import { CalendarDays, Clock3, MapPin, ShieldCheck, Table2 } from 'lucide-react';
import type { WorkerViewProps } from '../types';
import { dc } from '../dashboardCopy';
import { Surface, EmptyState, Pill, KpiCard, TableWrap, thClass, tdClass, tdNumericClass } from '../ui';
import {
  formatPaise,
  formatIsoDate,
  formatClock,
  summarizeAttendance,
  monthsPresent,
  monthLabel,
  monthKey,
  pickLabel,
  SHIFT_LABELS,
} from '../../../services/dashboardAnalytics';

export const WorkerAttendance: React.FC<Pick<WorkerViewProps, 'lang' | 'attendance'>> = ({ lang, attendance }) => {
  const months = useMemo(() => monthsPresent(attendance.map((row) => row.date)), [attendance]);
  const [month, setMonth] = useState<string>('all');

  const rows = useMemo(
    () => (month === 'all' ? attendance : attendance.filter((row) => monthKey(row.date) === month)),
    [attendance, month]
  );
  const summary = useMemo(() => summarizeAttendance(rows), [rows]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={dc(lang, 'attendanceFullShifts')} value={summary.fullShifts} icon={<CalendarDays size={16} />} />
        <KpiCard label={dc(lang, 'attendanceHalfShifts')} value={summary.halfShifts} />
        <KpiCard
          label={dc(lang, 'attendanceOvertimeShifts')}
          value={summary.overtimeShifts}
          hint={`${summary.overtimeHours}h ${dc(lang, 'kpiOvertime').toLowerCase()}`}
          icon={<Clock3 size={16} />}
        />
        <KpiCard
          label={dc(lang, 'attendanceVerified')}
          value={`${summary.geoVerifiedShifts}/${summary.shifts}`}
          hint={dc(lang, 'attendanceNotVerified')}
          icon={<ShieldCheck size={16} />}
        />
      </div>

      <Surface
        title={dc(lang, 'attendanceHeading')}
        subtitle={dc(lang, 'attendanceSub')}
        icon={<Table2 size={17} />}
        action={
          <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-ink-500">
            {dc(lang, 'attendanceMonthFilter')}
            <select
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="rounded-lg border border-sand-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-900 focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
            >
              <option value="all">{dc(lang, 'attendanceAllMonths')}</option>
              {months.map((key) => (
                <option key={key} value={key}>
                  {monthLabel(key)}
                </option>
              ))}
            </select>
          </label>
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            title={month === 'all' ? dc(lang, 'attendanceEmpty') : dc(lang, 'commonFilteredEmpty')}
            body={dc(lang, 'overviewNextStepsBody')}
            icon={<CalendarDays size={18} />}
          />
        ) : (
          <TableWrap>
            <thead>
              <tr className="border-b border-sand-200">
                <th className={thClass}>{dc(lang, 'labelDate')}</th>
                <th className={thClass}>{dc(lang, 'labelShift')}</th>
                <th className={thClass}>{`${dc(lang, 'labelHours')} · in/out`}</th>
                <th className={thClass}>{dc(lang, 'labelWage')}</th>
                <th className={thClass}>{dc(lang, 'attendanceSupervisor')}</th>
                <th className={thClass}>{dc(lang, 'labelSite')}</th>
                <th className={thClass}>{dc(lang, 'attendanceVerified')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-sand-50/70">
                  <td className={`${tdClass} whitespace-nowrap font-semibold`}>{formatIsoDate(row.date)}</td>
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
                  <td className={`${tdNumericClass} font-semibold`}>{formatPaise(row.calculated_wage_paise)}</td>
                  <td className={`${tdClass} max-w-[10rem] truncate`}>{row.supervisor_name || '—'}</td>
                  <td className={`${tdClass} font-mono text-[11px] text-ink-600`}>{row.site_id || '—'}</td>
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

        {rows.length > 0 && (
          <p className="mt-3 border-t border-sand-100 pt-3 text-[11px] leading-relaxed text-ink-500">
            {dc(lang, 'attendanceHash')}: <span className="font-mono">{rows[0].verification_hash.slice(0, 16)}…</span>
          </p>
        )}
      </Surface>
    </div>
  );
};

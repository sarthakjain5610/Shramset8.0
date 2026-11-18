/**
 * WURK UP — Dashboard UI primitives.
 *
 * A small, dependency-free kit that keeps every panel visually consistent:
 * surfaces, KPI tiles, status pills, empty/error/loading states, data tables and
 * the attendance rhythm chart. All colours come from the existing WurkUp theme
 * tokens (forest / brass / sand / ink), so the dashboards sit inside the product
 * rather than beside it.
 */

import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Info,
  LoaderCircle,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import type { Tone } from '../../services/dashboardAnalytics';

/* ------------------------------------------------------------------------- */
/* Tokens                                                                     */
/* ------------------------------------------------------------------------- */

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'border-sand-300 bg-sand-100 text-ink-700',
  positive: 'border-forest-200 bg-forest-50 text-forest-800',
  warning: 'border-brass-300 bg-brass-50 text-brass-900',
  critical: 'border-rose-200 bg-rose-50 text-rose-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
};

export const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-ink-400',
  positive: 'bg-forest-500',
  warning: 'bg-brass-500',
  critical: 'bg-rose-500',
  info: 'bg-sky-500',
};

export const thClass =
  'whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-500';
export const tdClass = 'px-3 py-3 align-top text-sm text-ink-800';
export const tdNumericClass = 'px-3 py-3 align-top text-right font-mono text-sm tabular-nums text-ink-900';

/* ------------------------------------------------------------------------- */
/* Surface                                                                    */
/* ------------------------------------------------------------------------- */

interface SurfaceProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}

export const Surface: React.FC<SurfaceProps> = ({
  title,
  subtitle,
  action,
  icon,
  children,
  className = '',
  bodyClassName = '',
  id,
}) => (
  <section
    id={id}
    className={`overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft ${className}`}
  >
    {(title || action) && (
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-sand-100 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <span className="mt-0.5 rounded-xl bg-forest-50 p-2 text-forest-800" aria-hidden="true">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-extrabold tracking-tight text-ink-950">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
    )}
    <div className={`px-5 py-4 sm:px-6 ${bodyClassName}`}>{children}</div>
  </section>
);

/* ------------------------------------------------------------------------- */
/* KPI                                                                        */
/* ------------------------------------------------------------------------- */

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
  icon?: React.ReactNode;
  emphasis?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({ label, value, hint, tone = 'neutral', icon, emphasis }) => (
  <div
    className={`relative flex min-w-0 flex-col justify-between gap-3 rounded-2xl border p-4 shadow-soft transition-transform duration-300 hover:-translate-y-0.5 ${
      emphasis ? 'border-forest-800 bg-forest-900 text-white' : 'border-sand-200 bg-white'
    }`}
  >
    <div className="flex items-start justify-between gap-2">
      <p
        className={`text-[10px] font-extrabold uppercase tracking-[0.14em] ${
          emphasis ? 'text-forest-200' : 'text-ink-500'
        }`}
      >
        {label}
      </p>
      {icon && (
        <span className={emphasis ? 'text-brass-200' : 'text-ink-400'} aria-hidden="true">
          {icon}
        </span>
      )}
    </div>
    <div className="min-w-0">
      <p
        className={`truncate font-mono text-xl font-bold tabular-nums tracking-tight sm:text-2xl ${
          emphasis ? 'text-white' : 'text-ink-950'
        }`}
      >
        {value}
      </p>
      {hint && (
        <p
          className={`mt-1 flex items-center gap-1 text-[11px] leading-snug ${
            emphasis ? 'text-forest-200' : 'text-ink-500'
          }`}
        >
          {tone !== 'neutral' && !emphasis && (
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} aria-hidden="true" />
          )}
          {hint}
        </p>
      )}
    </div>
  </div>
);

/* ------------------------------------------------------------------------- */
/* Pill / badge                                                               */
/* ------------------------------------------------------------------------- */

export const Pill: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string }> = ({
  tone = 'neutral',
  children,
  className = '',
}) => (
  <span
    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${TONE_CLASSES[tone]} ${className}`}
  >
    {children}
  </span>
);

export const Avatar: React.FC<{ initials: string; className?: string }> = ({ initials, className = '' }) => (
  <span
    aria-hidden="true"
    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-forest-700 to-forest-900 text-[12px] font-extrabold uppercase tracking-wide text-brass-100 ${className}`}
  >
    {initials}
  </span>
);

/* ------------------------------------------------------------------------- */
/* States                                                                     */
/* ------------------------------------------------------------------------- */

export const EmptyState: React.FC<{
  title: string;
  body?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, body, icon, action }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-sand-300 bg-sand-50/60 px-5 py-9 text-center">
    <span className="mb-3 rounded-xl bg-white p-2.5 text-ink-400 shadow-soft" aria-hidden="true">
      {icon ?? <Info size={20} />}
    </span>
    <p className="text-sm font-bold text-ink-800">{title}</p>
    {body && <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-500">{body}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const LoadingBlock: React.FC<{ label: string; compact?: boolean }> = ({ label, compact }) => (
  <div
    role="status"
    aria-live="polite"
    className={`flex items-center gap-2.5 text-sm text-ink-600 ${compact ? 'py-2' : 'justify-center rounded-xl border border-sand-200 bg-white px-5 py-10'}`}
  >
    <LoaderCircle size={16} className="animate-spin text-forest-700" aria-hidden="true" />
    <span>{label}</span>
  </div>
);

export const ErrorNotice: React.FC<{
  title: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  tone?: 'critical' | 'warning';
}> = ({ title, message, onRetry, retryLabel = 'Retry', tone = 'critical' }) => {
  const palette =
    tone === 'critical'
      ? 'border-rose-200 bg-rose-50 text-rose-900'
      : 'border-brass-300 bg-brass-50 text-brass-900';
  return (
    <div role="alert" className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4 ${palette}`}>
      <div className="flex min-w-0 items-start gap-2.5">
        <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-bold">{title}</p>
          <p className="mt-1 break-words text-xs leading-relaxed opacity-90">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-current/20 bg-white/70 px-3 py-1.5 text-xs font-bold hover:bg-white"
        >
          <RefreshCw size={13} aria-hidden="true" />
          {retryLabel}
        </button>
      )}
    </div>
  );
};

export const SecondChanceNotice: React.FC<{ title: string; message: string; icon?: React.ReactNode }> = ({
  title,
  message,
  icon,
}) => (
  <div role="status" className="flex items-start gap-2.5 rounded-xl border border-brass-300 bg-brass-50 p-4 text-brass-950">
    <span className="mt-0.5 shrink-0" aria-hidden="true">
      {icon ?? <Info size={18} />}
    </span>
    <div className="min-w-0">
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed opacity-90">{message}</p>
    </div>
  </div>
);

export const SuccessNotice: React.FC<{ message: string }> = ({ message }) => (
  <div role="status" className="flex items-start gap-2.5 rounded-xl border border-forest-200 bg-forest-50 p-4 text-forest-900">
    <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
    <p className="text-sm font-semibold">{message}</p>
  </div>
);

export const OfflineNotice: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <div role="status" className="flex items-start gap-2.5 rounded-xl border border-brass-300 bg-brass-50 p-4 text-brass-950">
    <WifiOff size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
    <div>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed opacity-90">{message}</p>
    </div>
  </div>
);

export const SyncBadge: React.FC<{ state: 'synced' | 'loading' | 'offline' | 'unconfigured'; label: string }> = ({
  state,
  label,
}) => {
  const map = {
    synced: { tone: 'border-forest-200 bg-forest-50 text-forest-800', icon: <Cloud size={13} /> },
    loading: { tone: 'border-sand-300 bg-sand-100 text-ink-700', icon: <LoaderCircle size={13} className="animate-spin" /> },
    offline: { tone: 'border-brass-300 bg-brass-50 text-brass-900', icon: <WifiOff size={13} /> },
    unconfigured: { tone: 'border-rose-200 bg-rose-50 text-rose-900', icon: <AlertCircle size={13} /> },
  } as const;
  const entry = map[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold ${entry.tone}`}
      role="status"
    >
      <span aria-hidden="true">{entry.icon}</span>
      {label}
    </span>
  );
};

/* ------------------------------------------------------------------------- */
/* Data helpers                                                               */
/* ------------------------------------------------------------------------- */

export const Field: React.FC<{ label: string; value: React.ReactNode; mono?: boolean; className?: string }> = ({
  label,
  value,
  mono,
  className = '',
}) => (
  <div className={`min-w-0 ${className}`}>
    <dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-500">{label}</dt>
    <dd className={`mt-1 break-words text-sm font-semibold text-ink-900 ${mono ? 'font-mono text-[13px]' : ''}`}>
      {value}
    </dd>
  </div>
);

export const FieldGrid: React.FC<{ children: React.ReactNode; cols?: string; className?: string }> = ({
  children,
  cols = 'sm:grid-cols-2 lg:grid-cols-3',
  className = '',
}) => <dl className={`grid gap-4 ${cols} ${className}`}>{children}</dl>;

export const TableWrap: React.FC<{ children: React.ReactNode; minWidth?: string }> = ({
  children,
  minWidth = 'min-w-[46rem]',
}) => (
  <div className="-mx-1 overflow-x-auto px-1">
    <table className={`w-full border-collapse ${minWidth}`}>{children}</table>
  </div>
);

/** Simple two-tone meter used for balance and consent visualisation. */
export const Meter: React.FC<{ value: number; max: number; tone?: Tone; label?: string }> = ({
  value,
  max,
  tone = 'positive',
  label,
}) => {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));
  const bar =
    tone === 'critical' ? 'bg-rose-500' : tone === 'warning' ? 'bg-brass-500' : tone === 'info' ? 'bg-sky-500' : 'bg-forest-600';
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-sand-200"
      role="img"
      aria-label={label ?? `${Math.round(pct)} percent`}
    >
      <div className={`h-full rounded-full ${bar} transition-[width] duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* Attendance rhythm chart                                                    */
/* ------------------------------------------------------------------------- */

export const RhythmChart: React.FC<{
  points: { date: string; shifts: number; wagePaise: number }[];
  ariaLabel: string;
  formatDay: (iso: string) => string;
  formatWage: (paise: number) => string;
}> = ({ points, ariaLabel, formatDay, formatWage }) => {
  const peak = points.reduce((max, point) => Math.max(max, point.shifts), 0);
  const scale = peak > 0 ? peak : 1;
  return (
    <div>
      <div className="flex h-28 items-end gap-1.5" role="img" aria-label={ariaLabel}>
        {points.map((point) => {
          const height = point.shifts === 0 ? 4 : Math.max(10, (point.shifts / scale) * 100);
          return (
            <div key={point.date} className="group relative flex h-full flex-1 items-end">
              <div
                className={`w-full rounded-t-md transition-colors duration-300 ${
                  point.shifts === 0 ? 'bg-sand-200' : 'bg-forest-600 group-hover:bg-forest-800'
                }`}
                style={{ height: `${height}%` }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-950 px-2 py-1 text-[10px] font-semibold text-white group-hover:block">
                {formatDay(point.date)} · {point.shifts} · {formatWage(point.wagePaise)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-ink-400">
        <span>{points.length > 0 ? formatDay(points[0].date) : ''}</span>
        <span>{points.length > 0 ? formatDay(points[points.length - 1].date) : ''}</span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* Buttons                                                                    */
/* ------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';

export const DashboardButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; icon?: React.ReactNode }
> = ({ variant = 'outline', icon, children, className = '', ...rest }) => {
  const styles: Record<ButtonVariant, string> = {
    primary: 'bg-forest-800 text-white hover:bg-forest-900 border border-forest-800',
    outline: 'border border-sand-300 bg-white text-ink-800 hover:border-forest-300 hover:bg-forest-50',
    ghost: 'border border-transparent bg-transparent text-ink-700 hover:bg-sand-100',
    danger: 'border border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100',
  };
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
};


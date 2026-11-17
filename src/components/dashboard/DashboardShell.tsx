/**
 * WURK UP — Dashboard shell.
 *
 * Shared frame for the worker and contractor workspaces: a sticky command bar
 * with identity, sync state and refresh, a vertical section rail on desktop, a
 * scrollable rail on mobile, and a single content region. It is presentation
 * only — data loading lives in each dashboard.
 */

import React from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import type { Language } from '../../services/i18n';
import { SyncBadge } from './ui';
import { dc } from './dashboardCopy';

export interface DashboardNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export type SyncState = 'synced' | 'loading' | 'offline' | 'unconfigured';

interface DashboardShellProps {
  lang: Language;
  role: 'worker' | 'contractor';
  title: string;
  subtitle: string;
  userName: string;
  nav: DashboardNavItem[];
  active: string;
  onSelect: (id: string) => void;
  syncState: SyncState;
  onRefresh: () => void;
  refreshing: boolean;
  refreshDisabled?: boolean;
  banner?: React.ReactNode;
  children: React.ReactNode;
}

const roleAccent = {
  worker: {
    ring: 'from-forest-800 via-forest-700 to-forest-900',
    chip: 'border-forest-200 bg-forest-50 text-forest-800',
    active: 'bg-forest-800 text-white shadow-soft',
  },
  contractor: {
    ring: 'from-ink-900 via-forest-900 to-ink-950',
    chip: 'border-sky-200 bg-sky-50 text-sky-900',
    active: 'bg-ink-900 text-white shadow-soft',
  },
} as const;

export const DashboardShell: React.FC<DashboardShellProps> = ({
  lang,
  role,
  title,
  subtitle,
  userName,
  nav,
  active,
  onSelect,
  syncState,
  onRefresh,
  refreshing,
  refreshDisabled,
  banner,
  children,
}) => {
  const accent = roleAccent[role];
  const syncLabel =
    syncState === 'synced'
      ? dc(lang, 'statusSynced')
      : syncState === 'offline'
        ? dc(lang, 'statusOffline')
        : syncState === 'unconfigured'
          ? dc(lang, 'statusNotConfigured')
          : dc(lang, 'statusLoading');

  return (
    <div className="min-h-[calc(100vh-8rem)] w-full">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-xl focus:bg-forest-800 focus:px-4 focus:py-2 focus:text-xs focus:font-bold focus:text-white"
      >
        {dc(lang, 'commonSkipNav')}
      </a>

      <div className="overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
        {/* Command bar */}
        <header className={`bg-gradient-to-r ${accent.ring} px-5 py-5 text-white sm:px-7 sm:py-6`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] ${accent.chip}`}
              >
                <ShieldCheck size={12} aria-hidden="true" />
                {role === 'worker' ? dc(lang, 'roleWorker') : dc(lang, 'roleContractor')}
              </span>
              <h1 className="mt-2.5 text-2xl font-extrabold leading-tight tracking-tight sm:text-[28px]">{title}</h1>
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-white/70">{subtitle}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden max-w-[14rem] truncate rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/90 sm:inline-block">
                {userName}
              </span>
              <SyncBadge state={syncState} label={syncLabel} />
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshDisabled || refreshing}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
                {refreshing ? dc(lang, 'commonRefreshing') : dc(lang, 'actionRefresh')}
              </button>
            </div>
          </div>
        </header>

        {banner && <div className="border-b border-sand-100 bg-sand-50/70 px-5 py-3 sm:px-7">{banner}</div>}

        <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
          {/* Section rail */}
          <nav
            aria-label={role === 'worker' ? dc(lang, 'brandWorker') : dc(lang, 'brandContractor')}
            className="border-b border-sand-100 bg-sand-50/60 p-2.5 lg:border-b-0 lg:border-r lg:p-4"
          >
            <ul className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {nav.map((item) => {
                const isActive = item.id === active;
                return (
                  <li key={item.id} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold transition-colors ${
                        isActive
                          ? accent.active
                          : 'text-ink-600 hover:bg-white hover:text-ink-950'
                      }`}
                    >
                      <span className={isActive ? 'text-current' : 'text-ink-400'} aria-hidden="true">
                        {item.icon}
                      </span>
                      <span className="whitespace-nowrap">{item.label}</span>
                      {typeof item.badge === 'number' && item.badge > 0 && (
                        <span
                          className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                            isActive ? 'bg-white/20 text-white' : 'bg-brass-200/60 text-brass-900'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 hidden rounded-xl border border-sand-200 bg-white/70 p-3 text-[10px] leading-relaxed text-ink-500 lg:block">
              {dc(lang, 'onlineNote')}
            </p>
          </nav>

          <main id="dashboard-main" className="min-w-0 animate-fade-up px-4 py-5 sm:px-6 sm:py-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

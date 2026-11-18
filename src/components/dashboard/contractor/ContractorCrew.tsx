import React, { useMemo, useState } from 'react';
import { LoaderCircle, Phone, PhoneOff, Search, ShieldCheck, Users } from 'lucide-react';
import type { ContractorViewProps } from '../types';
import { dc } from '../dashboardCopy';
import {
  Surface,
  EmptyState,
  Pill,
  Avatar,
  Field,
  DashboardButton,
  SecondChanceNotice,
} from '../ui';
import { requestAssignedWorkerPhone, DashboardError } from '../../../services/dashboardData';
import {
  formatPaise,
  formatIsoDate,
  groupLedgerByWorker,
  balancePaise,
  initialsOf,
  skillLabel,
} from '../../../services/dashboardAnalytics';

export const ContractorCrew: React.FC<Pick<ContractorViewProps, 'lang' | 'workers' | 'assignments' | 'ledger'>> = ({
  lang,
  workers,
  assignments,
  ledger,
}) => {
  const [query, setQuery] = useState('');
  const [phones, setPhones] = useState<Record<string, string | null>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const assignedSince = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of assignments) {
      if (!map.has(row.worker_id)) map.set(row.worker_id, row.created_at);
    }
    return map;
  }, [assignments]);

  const ledgerByWorker = useMemo(() => groupLedgerByWorker(ledger), [ledger]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return workers;
    return workers.filter(
      (worker) =>
        worker.name.toLowerCase().includes(needle) ||
        (worker.hindi_name || '').toLowerCase().includes(needle) ||
        worker.trade.toLowerCase().includes(needle)
    );
  }, [workers, query]);

  const reveal = async (workerId: string) => {
    if (busyId) return;
    setBusyId(workerId);
    setErrors((prev) => ({ ...prev, [workerId]: '' }));
    try {
      const phone = await requestAssignedWorkerPhone(workerId);
      setPhones((prev) => ({ ...prev, [workerId]: phone }));
    } catch (caught) {
      setErrors((prev) => ({
        ...prev,
        [workerId]:
          caught instanceof DashboardError
            ? caught.message
            : caught instanceof Error
              ? caught.message
              : 'Contact lookup failed.',
      }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Surface
        title={dc(lang, 'crewHeading')}
        subtitle={dc(lang, 'crewSub')}
        icon={<Users size={17} />}
        action={
          <label className="relative flex items-center">
            <Search size={13} className="absolute left-2.5 text-ink-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={dc(lang, 'crewSearchPlaceholder')}
              aria-label={dc(lang, 'actionSearch')}
              className="w-52 rounded-xl border border-sand-300 bg-white py-1.5 pl-7 pr-2.5 text-xs text-ink-900 focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
            />
          </label>
        }
      >
        {workers.length === 0 ? (
          <EmptyState title={dc(lang, 'crewEmpty')} body={dc(lang, 'crewSub')} icon={<Users size={18} />} />
        ) : filtered.length === 0 ? (
          <EmptyState title={dc(lang, 'commonFilteredEmpty')} icon={<Search size={18} />} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((worker) => {
              const balance = balancePaise(ledgerByWorker.get(worker.id) || []);
              const revealed = Object.prototype.hasOwnProperty.call(phones, worker.id);
              const phone = phones[worker.id];
              return (
                <article key={worker.id} className="rounded-xl border border-sand-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar initials={initialsOf(worker.name)} className="h-9 w-9 rounded-lg text-[11px]" />
                      <div className="min-w-0">
                        <h3 className="truncate text-[13px] font-extrabold text-ink-950">{worker.name}</h3>
                        <p className="truncate text-[11px] text-ink-500">
                          {worker.trade} · {skillLabel(worker.skill_level, lang)}
                        </p>
                      </div>
                    </div>
                    <Pill tone={worker.contact_sharing_consent ? 'positive' : 'neutral'}>
                      {worker.contact_sharing_consent ? dc(lang, 'crewConsentOn') : dc(lang, 'crewConsentOff')}
                    </Pill>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-sand-100 pt-3">
                    <Field
                      label={dc(lang, 'labelDailyWage')}
                      value={worker.daily_base_wage_paise == null ? dc(lang, 'wageNotAssigned') : formatPaise(worker.daily_base_wage_paise)}
                    />
                    <Field
                      label={dc(lang, 'kpiBalance')}
                      value={<span className={balance < 0 ? 'text-rose-700' : undefined}>{formatPaise(balance)}</span>}
                      mono
                    />
                    <Field label={dc(lang, 'labelSite')} value={worker.active_site_id || dc(lang, 'commonUnavailable')} mono />
                    <Field
                      label={dc(lang, 'crewSince')}
                      value={assignedSince.get(worker.id) ? formatIsoDate(assignedSince.get(worker.id)!.slice(0, 10)) : '—'}
                    />
                  </dl>

                  <div className="mt-3 border-t border-sand-100 pt-3">
                    <DashboardButton
                      variant="outline"
                      disabled={busyId === worker.id}
                      onClick={() => void reveal(worker.id)}
                      icon={
                        busyId === worker.id ? (
                          <LoaderCircle size={13} className="animate-spin" />
                        ) : worker.contact_sharing_consent ? (
                          <Phone size={13} />
                        ) : (
                          <PhoneOff size={13} />
                        )
                      }
                    >
                      {revealed ? dc(lang, 'actionRefreshPhone') : dc(lang, 'actionRequestPhone')}
                    </DashboardButton>

                    {revealed && phone && (
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] font-bold text-ink-900">
                        <span className="font-mono">{phone}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                          {dc(lang, 'crewPhoneRevealed')}
                        </span>
                      </p>
                    )}
                    {revealed && !phone && (
                      <p role="status" className="mt-2 text-[11px] text-ink-600">
                        {dc(lang, 'crewPhoneHidden')}
                      </p>
                    )}
                    {errors[worker.id] && (
                      <p role="alert" className="mt-2 text-[11px] font-semibold text-rose-800">
                        {dc(lang, 'crewPhoneError')}: {errors[worker.id]}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Surface>

      <SecondChanceNotice
        title={dc(lang, 'profileConsent')}
        message={dc(lang, 'profileConsentNote')}
        icon={<ShieldCheck size={18} />}
      />
    </div>
  );
};

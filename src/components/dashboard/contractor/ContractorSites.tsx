import React from 'react';
import { Building2, MapPin, Phone, ShieldCheck, Users } from 'lucide-react';
import type { ContractorViewProps } from '../types';
import { dc } from '../dashboardCopy';
import { Surface, EmptyState, Pill } from '../ui';

export const ContractorSites: React.FC<Pick<ContractorViewProps, 'lang' | 'sites' | 'workers'>> = ({
  lang,
  sites,
  workers,
}) => {
  const crewBySite = new Map<string, number>();
  for (const worker of workers) {
    if (!worker.active_site_id) continue;
    crewBySite.set(worker.active_site_id, (crewBySite.get(worker.active_site_id) || 0) + 1);
  }

  return (
    <div className="space-y-4">
      <Surface title={dc(lang, 'sitesHeading')} subtitle={dc(lang, 'crewSub')} icon={<Building2 size={17} />}>
        {sites.length === 0 ? (
          <EmptyState title={dc(lang, 'sitesEmpty')} body={dc(lang, 'crewEmpty')} icon={<Building2 size={18} />} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {sites.map((site) => (
              <article key={site.id} className="rounded-xl border border-sand-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[13px] font-extrabold text-ink-950">{site.name}</h3>
                    {site.hindi_name && <p className="truncate text-[11px] text-ink-500">{site.hindi_name}</p>}
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-600">
                      <MapPin size={11} aria-hidden="true" />
                      <span className="truncate">
                        {site.location}
                        {site.city ? `, ${site.city}` : ''}
                      </span>
                    </p>
                  </div>
                  <Pill tone="info">{site.project_type || dc(lang, 'sitesType')}</Pill>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-sand-100 pt-3 text-[12px]">
                  <div>
                    <dt className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-500">
                      <Users size={11} aria-hidden="true" />
                      {dc(lang, 'sitesWorkers')}
                    </dt>
                    <dd className="mt-0.5 font-mono font-semibold text-ink-900">
                      {crewBySite.get(site.id) || 0}
                      {site.active_workers != null && <span className="text-ink-400"> / {site.active_workers}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-500">
                      <ShieldCheck size={11} aria-hidden="true" />
                      {dc(lang, 'sitesSafety')}
                    </dt>
                    <dd className="mt-0.5 truncate font-semibold text-ink-900">{site.safety_rating || '—'}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-500">
                      <Phone size={11} aria-hidden="true" />
                      {dc(lang, 'sitesContact')}
                    </dt>
                    <dd className="mt-0.5 truncate font-semibold text-ink-900">
                      {site.contractor_name}
                      {site.contractor_phone ? ` · ${site.contractor_phone}` : ''}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </Surface>
    </div>
  );
};

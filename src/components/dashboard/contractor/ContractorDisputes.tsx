import React, { useMemo } from 'react';
import { Gavel, MessageSquareQuote, ShieldAlert } from 'lucide-react';
import type { ContractorViewProps } from '../types';
import { dc } from '../dashboardCopy';
import { Surface, EmptyState, Pill, KpiCard, Field, SecondChanceNotice } from '../ui';
import {
  formatPaise,
  formatIsoDate,
  summarizeDisputes,
  daysOpen,
  pickLabel,
  DISPUTE_TYPE_LABELS,
  DISPUTE_STATUS_LABELS,
  DISPUTE_TONES,
} from '../../../services/dashboardAnalytics';

export const ContractorDisputes: React.FC<Pick<ContractorViewProps, 'lang' | 'workers' | 'disputes'>> = ({
  lang,
  workers,
  disputes,
}) => {
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const worker of workers) map.set(worker.id, worker.name);
    return map;
  }, [workers]);

  const summary = useMemo(() => summarizeDisputes(disputes), [disputes]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={dc(lang, 'disputesHeading')} value={summary.total} icon={<Gavel size={16} />} />
        <KpiCard label={dc(lang, 'kpiOpenDisputes')} value={summary.open} tone="warning" icon={<ShieldAlert size={16} />} />
        <KpiCard label={dc(lang, 'disputesResponse')} value={summary.resolved} tone="positive" icon={<MessageSquareQuote size={16} />} />
        <KpiCard label={dc(lang, 'disputesClaimed')} value={formatPaise(summary.claimedPaise)} />
      </div>

      <Surface title={dc(lang, 'contractorDisputesHeading')} subtitle={dc(lang, 'contractorDisputesSub')} icon={<Gavel size={17} />}>
        {disputes.length === 0 ? (
          <EmptyState title={dc(lang, 'contractorDisputesEmpty')} body={dc(lang, 'contractorDisputesSub')} icon={<Gavel size={18} />} />
        ) : (
          <ul className="space-y-3">
            {disputes.map((row) => (
              <li key={row.id} className="rounded-xl border border-sand-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-extrabold text-ink-950">
                      {pickLabel(DISPUTE_TYPE_LABELS[row.dispute_type], lang)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      {nameById.get(row.worker_id) || row.worker_id} · <span className="font-mono">{row.dlo_filing_ref}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="neutral">
                      {daysOpen(row.filing_date)} {dc(lang, 'disputesAgeing')}
                    </Pill>
                    <Pill tone={DISPUTE_TONES[row.status]}>{pickLabel(DISPUTE_STATUS_LABELS[row.status], lang)}</Pill>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 border-t border-sand-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label={dc(lang, 'disputesClaimed')} value={formatPaise(row.claimed_amount_paise)} />
                  <Field label={dc(lang, 'disputesIncident')} value={formatIsoDate(row.incident_date)} />
                  <Field label={dc(lang, 'disputesFiled')} value={formatIsoDate(row.filing_date)} />
                  <Field label={dc(lang, 'disputesEvidence')} value={String(row.evidence_muster_count ?? 0)} mono />
                </div>

                <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-ink-700">{row.description}</p>

                <div className="mt-3 rounded-lg bg-sand-50 p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-500">
                    {dc(lang, 'disputesResponse')}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-700">
                    {row.contractor_response || dc(lang, 'disputesNoResponse')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      <SecondChanceNotice title={dc(lang, 'commonReadOnly')} message={dc(lang, 'contractorDisputesResponseNote')} />
    </div>
  );
};

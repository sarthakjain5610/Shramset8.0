import React, { useEffect, useState } from 'react';
import { BadgeCheck, IdCard, LoaderCircle, LockKeyhole, PhoneCall, UserCircle2 } from 'lucide-react';
import type { WorkerViewProps } from '../types';
import { dc } from '../dashboardCopy';
import {
  Surface,
  Field,
  FieldGrid,
  Pill,
  Avatar,
  ErrorNotice,
  SecondChanceNotice,
  DashboardButton,
} from '../ui';
import { updateMyContactSharing, DashboardError } from '../../../services/dashboardData';
import {
  formatPaise,
  formatTimestamp,
  initialsOf,
  skillLabel,
} from '../../../services/dashboardAnalytics';

interface Props extends Pick<WorkerViewProps, 'lang' | 'worker' | 'privateData' | 'privateDataNotice'> {
  onChanged: () => void;
}

export const WorkerProfile: React.FC<Props> = ({ lang, worker, privateData, privateDataNotice, onChanged }) => {
  const [consent, setConsent] = useState(worker.contact_sharing_consent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConsent(worker.contact_sharing_consent);
  }, [worker.contact_sharing_consent, worker.id]);

  const toggleConsent = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const next = !consent;
    try {
      await updateMyContactSharing(next);
      setConsent(next);
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof DashboardError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : 'Consent could not be updated.'
      );
    } finally {
      setBusy(false);
    }
  };

  const privateFields: [string, string | null | undefined][] = [
    [dc(lang, 'labelPhone'), privateData?.phone],
    ['e-Shram UAN', privateData?.eshram_uan],
    ['BOCW', privateData?.bocw_registration_no],
    ['Aadhaar (last 4)', privateData?.aadhaar_last4],
    ['Bank (last 4)', privateData?.bank_account_last4],
    ['IFSC', privateData?.ifsc_code],
    ['UPI', privateData?.upi_id],
    ['Blood group', privateData?.blood_group],
  ];

  return (
    <div className="space-y-4">
      {error && <ErrorNotice title={dc(lang, 'commonErrorTitle')} message={error} />}

      <Surface title={dc(lang, 'profileHeading')} subtitle={dc(lang, 'profileSub')} icon={<UserCircle2 size={17} />}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar initials={initialsOf(worker.name)} className="h-12 w-12 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold text-ink-950">{worker.name}</p>
              {worker.hindi_name && <p className="truncate text-xs text-ink-500">{worker.hindi_name}</p>}
              <p className="mt-1 font-mono text-[11px] text-ink-400">{worker.id}</p>
            </div>
          </div>
          <Pill tone="positive">
            <BadgeCheck size={12} aria-hidden="true" />
            {dc(lang, 'roleWorker')}
          </Pill>
        </div>

        <div className="mt-5 border-t border-sand-100 pt-4">
          <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-500">
            {dc(lang, 'profileDirectory')}
          </p>
          <FieldGrid>
            <Field label={dc(lang, 'labelTrade')} value={worker.trade} />
            <Field label={dc(lang, 'onboardingSkill')} value={skillLabel(worker.skill_level, lang)} />
            <Field
              label={dc(lang, 'labelDailyWage')}
              value={
                worker.daily_base_wage_paise == null ? dc(lang, 'wageNotAssigned') : formatPaise(worker.daily_base_wage_paise)
              }
            />
            <Field label={dc(lang, 'overviewAssignment')} value={worker.active_site_id || dc(lang, 'commonUnavailable')} mono />
            <Field label={dc(lang, 'profileWorkerId')} value={worker.id} mono />
            <Field label={dc(lang, 'lastUpdated')} value={formatTimestamp(worker.created_at)} />
          </FieldGrid>
        </div>
      </Surface>

      <Surface title={dc(lang, 'profilePrivate')} subtitle={dc(lang, 'profilePrivateNote')} icon={<LockKeyhole size={17} />}>
        {privateData ? (
          <FieldGrid cols="sm:grid-cols-2 lg:grid-cols-4">
            {privateFields.map(([label, value]) => (
              <Field key={label} label={label} value={value || dc(lang, 'profileMissing')} mono />
            ))}
          </FieldGrid>
        ) : (
          <SecondChanceNotice
            title={dc(lang, 'profilePrivateUnavailable')}
            message={privateDataNotice || dc(lang, 'profileMissing')}
            icon={<LockKeyhole size={18} />}
          />
        )}
      </Surface>

      <Surface title={dc(lang, 'profileConsent')} icon={<PhoneCall size={17} />}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 max-w-xl">
            <p className="text-sm font-bold text-ink-900">
              {consent ? dc(lang, 'profileConsentOn') : dc(lang, 'profileConsentOff')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">{dc(lang, 'profileConsentNote')}</p>
          </div>
          <DashboardButton
            variant={consent ? 'primary' : 'outline'}
            onClick={() => void toggleConsent()}
            disabled={busy}
            icon={busy ? <LoaderCircle size={13} className="animate-spin" /> : <IdCard size={13} />}
          >
            {busy
              ? dc(lang, 'profileConsentSaving')
              : consent
                ? dc(lang, 'actionTurnOffSharing')
                : dc(lang, 'actionTurnOnSharing')}
          </DashboardButton>
        </div>
      </Surface>
    </div>
  );
};

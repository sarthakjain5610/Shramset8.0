/**
 * WURK UP — Worker dashboard.
 *
 * Real-account surface only (judge-demo keeps its own synthetic workspace). Every
 * number on screen comes from a row the signed-in worker is authorized to read.
 * If the account has no worker record yet, the dashboard offers the secure
 * onboarding RPC instead of inventing a profile.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  CalendarDays,
  ClipboardCheck,
  Gavel,
  LayoutDashboard,
  LoaderCircle,
  UserCircle2,
  Wallet,
} from 'lucide-react';
import type { UserProfile } from '../../../types';
import type { SkillLevel } from '../../../types';
import type { Language } from '../../../services/i18n';
import { useDashboardResource } from '../../../hooks/useDashboardResource';
import {
  fetchWorkerSnapshot,
  onboardWorkerProfile,
  isDashboardConfigured,
  DashboardError,
  SUPPORTED_TRADES,
  SKILL_LEVELS,
  type WorkerLoadResult,
} from '../../../services/dashboardData';
import { pendingApprovals, summarizeDisputes } from '../../../services/dashboardAnalytics';
import { DashboardShell, type DashboardNavItem, type SyncState } from '../DashboardShell';
import { Surface, ErrorNotice, LoadingBlock, OfflineNotice, SuccessNotice, DashboardButton } from '../ui';
import { dc } from '../dashboardCopy';
import { WorkerOverview } from './WorkerOverview';
import { WorkerAttendance } from './WorkerAttendance';
import { WorkerWages } from './WorkerWages';
import { WorkerApprovals } from './WorkerApprovals';
import { WorkerDisputes } from './WorkerDisputes';
import { WorkerProfile } from './WorkerProfile';

type PanelId = 'overview' | 'attendance' | 'wages' | 'approvals' | 'disputes' | 'profile';

interface Props {
  user: UserProfile;
  lang: Language;
}

export const WorkerDashboard: React.FC<Props> = ({ user, lang }) => {
  const load = useCallback(() => fetchWorkerSnapshot(), []);
  const resource = useDashboardResource<WorkerLoadResult>(load);
  const [panel, setPanel] = useState<PanelId>('overview');

  const snapshot = resource.data?.status === 'ready' ? resource.data.snapshot : null;
  const needsOnboarding = resource.data?.status === 'needs_onboarding';

  const [onboardingTrade, setOnboardingTrade] = useState('');
  const [onboardingSkill, setOnboardingSkill] = useState<SkillLevel>('unskilled');
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(false);

  const nav = useMemo<DashboardNavItem[]>(() => {
    const pending = snapshot ? pendingApprovals(snapshot.approvals).length : 0;
    const openDisputes = snapshot ? summarizeDisputes(snapshot.disputes).open : 0;
    return [
      { id: 'overview', label: dc(lang, 'navOverview'), icon: <LayoutDashboard size={15} /> },
      { id: 'attendance', label: dc(lang, 'navAttendance'), icon: <CalendarDays size={15} /> },
      { id: 'wages', label: dc(lang, 'navWages'), icon: <Wallet size={15} /> },
      { id: 'approvals', label: dc(lang, 'navApprovals'), icon: <ClipboardCheck size={15} />, badge: pending },
      { id: 'disputes', label: dc(lang, 'navDisputes'), icon: <Gavel size={15} />, badge: openDisputes },
      { id: 'profile', label: dc(lang, 'navProfile'), icon: <UserCircle2 size={15} /> },
    ];
  }, [lang, snapshot]);

  const syncState: SyncState = !isDashboardConfigured()
    ? 'unconfigured'
    : !resource.online
      ? 'offline'
      : resource.loading || resource.refreshing
        ? 'loading'
        : 'synced';

  const submitOnboarding = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (onboardingBusy || !onboardingTrade) return;
    setOnboardingBusy(true);
    setOnboardingError(null);
    setOnboardingDone(false);
    try {
      await onboardWorkerProfile(onboardingTrade, onboardingSkill);
      setOnboardingDone(true);
      resource.refresh();
    } catch (caught) {
      setOnboardingError(
        caught instanceof DashboardError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : 'Worker onboarding could not be confirmed.'
      );
    } finally {
      setOnboardingBusy(false);
    }
  };

  const selectClass =
    'mt-1.5 block w-full rounded-xl border border-sand-300 bg-white px-3 py-2.5 text-sm font-normal text-ink-900 focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200';

  const body = (() => {
    if (resource.error?.kind === 'not_configured') {
      return (
        <div className="space-y-4">
          <ErrorNotice
            title={dc(lang, 'commonNotConfiguredTitle')}
            message={dc(lang, 'commonNotConfiguredBody')}
            tone="warning"
          />
          <Surface title={dc(lang, 'overviewNextSteps')}>
            <p className="text-xs leading-relaxed text-ink-600">{dc(lang, 'overviewNextStepsBody')}</p>
          </Surface>
        </div>
      );
    }

    if (!resource.online) {
      return (
        <div className="space-y-4">
          <OfflineNotice title={dc(lang, 'commonOfflineTitle')} message={dc(lang, 'commonOfflineBody')} />
        </div>
      );
    }

    if (resource.loading) return <LoadingBlock label={dc(lang, 'commonLoading')} />;

    if (resource.error) {
      return (
        <ErrorNotice
          title={dc(lang, 'commonErrorTitle')}
          message={resource.error.message}
          onRetry={resource.refresh}
          retryLabel={dc(lang, 'actionRetry')}
        />
      );
    }

    if (needsOnboarding) {
      return (
        <div className="space-y-4">
          {onboardingDone && <SuccessNotice message={dc(lang, 'onboardingDone')} />}
          {onboardingError && <ErrorNotice title={dc(lang, 'commonErrorTitle')} message={onboardingError} />}
          <Surface title={dc(lang, 'onboardingTitle')} subtitle={dc(lang, 'onboardingSub')} icon={<UserCircle2 size={17} />}>
            <form onSubmit={submitOnboarding} className="max-w-lg space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wide text-ink-700">
                {dc(lang, 'onboardingTrade')}
                <select
                  required
                  value={onboardingTrade}
                  onChange={(event) => setOnboardingTrade(event.target.value)}
                  className={selectClass}
                >
                  <option value="">{dc(lang, 'onboardingPickTrade')}</option>
                  {SUPPORTED_TRADES.map((trade) => (
                    <option key={trade} value={trade}>
                      {trade}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold uppercase tracking-wide text-ink-700">
                {dc(lang, 'onboardingSkill')}
                <select
                  value={onboardingSkill}
                  onChange={(event) => setOnboardingSkill(event.target.value as SkillLevel)}
                  className={selectClass}
                >
                  {SKILL_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>

              <p className="rounded-lg border border-sand-200 bg-sand-50 p-3 text-[11px] leading-relaxed text-ink-600">
                {dc(lang, 'onboardingNote')}
              </p>

              <DashboardButton
                type="submit"
                variant="primary"
                disabled={onboardingBusy || !onboardingTrade}
                icon={onboardingBusy ? <LoaderCircle size={13} className="animate-spin" /> : <UserCircle2 size={13} />}
              >
                {onboardingBusy ? dc(lang, 'actionSubmitting') : dc(lang, 'actionLoadProfile')}
              </DashboardButton>
            </form>
          </Surface>
        </div>
      );
    }

    if (!snapshot) return <LoadingBlock label={dc(lang, 'commonLoading')} />;

    const shared = {
      lang,
      worker: snapshot.worker,
      privateData: snapshot.privateData,
      privateDataNotice: snapshot.privateDataNotice,
      attendance: snapshot.attendance,
      ledger: snapshot.ledger,
      disputes: snapshot.disputes,
      approvals: snapshot.approvals,
    };

    switch (panel) {
      case 'attendance':
        return <WorkerAttendance lang={lang} attendance={snapshot.attendance} />;
      case 'wages':
        return <WorkerWages lang={lang} ledger={snapshot.ledger} />;
      case 'approvals':
        return <WorkerApprovals lang={lang} approvals={snapshot.approvals} onChanged={resource.refresh} />;
      case 'disputes':
        return (
          <WorkerDisputes
            lang={lang}
            worker={snapshot.worker}
            disputes={snapshot.disputes}
            attendance={snapshot.attendance}
            onChanged={resource.refresh}
          />
        );
      case 'profile':
        return (
          <WorkerProfile
            lang={lang}
            worker={snapshot.worker}
            privateData={snapshot.privateData}
            privateDataNotice={snapshot.privateDataNotice}
            onChanged={resource.refresh}
          />
        );
      default:
        return <WorkerOverview {...shared} onJump={(next) => setPanel(next as PanelId)} />;
    }
  })();

  return (
    <DashboardShell
      lang={lang}
      role="worker"
      title={dc(lang, 'brandWorker')}
      subtitle={dc(lang, 'onlineNote')}
      userName={user.fullName || user.phone}
      nav={nav}
      active={panel}
      onSelect={(id) => setPanel(id as PanelId)}
      syncState={syncState}
      onRefresh={resource.refresh}
      refreshing={resource.refreshing}
      refreshDisabled={!resource.online}
    >
      {body}
    </DashboardShell>
  );
};

/**
 * WURK UP — Contractor dashboard.
 *
 * Reads only the rows the signed-in contractor is authorized to see: assigned
 * workers, their sites, and participant-scoped muster, ledger, dispute and
 * approval records. Writes are limited to creating pending approval requests,
 * which is the only contractor write the deployed policy grants.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  ClipboardCheck,
  Gavel,
  LayoutDashboard,
  Users,
  Wallet,
} from 'lucide-react';
import type { UserProfile } from '../../../types';
import type { Language } from '../../../services/i18n';
import { useDashboardResource } from '../../../hooks/useDashboardResource';
import {
  fetchContractorSnapshot,
  isDashboardConfigured,
  type ContractorDashboardSnapshot,
} from '../../../services/dashboardData';
import { pendingApprovals, summarizeDisputes } from '../../../services/dashboardAnalytics';
import { DashboardShell, type DashboardNavItem, type SyncState } from '../DashboardShell';
import { ErrorNotice, LoadingBlock, OfflineNotice } from '../ui';
import { dc } from '../dashboardCopy';
import { ContractorOverview } from './ContractorOverview';
import { ContractorCrew } from './ContractorCrew';
import { ContractorSites } from './ContractorSites';
import { ContractorAttendance } from './ContractorAttendance';
import { ContractorWages } from './ContractorWages';
import { ContractorApprovals } from './ContractorApprovals';
import { ContractorDisputes } from './ContractorDisputes';

type PanelId = 'overview' | 'crew' | 'sites' | 'attendance' | 'wages' | 'approvals' | 'disputes';

interface Props {
  user: UserProfile;
  lang: Language;
}

export const ContractorDashboard: React.FC<Props> = ({ user, lang }) => {
  const load = useCallback(() => fetchContractorSnapshot(), []);
  const resource = useDashboardResource<ContractorDashboardSnapshot>(load);
  const [panel, setPanel] = useState<PanelId>('overview');

  const snapshot = resource.data; // safe defaults keep the shell usable while loading

  const nav = useMemo<DashboardNavItem[]>(() => {
    const pending = snapshot ? pendingApprovals(snapshot.approvals).length : 0;
    const openDisputes = snapshot ? summarizeDisputes(snapshot.disputes).open : 0;
    return [
      { id: 'overview', label: dc(lang, 'navOverview'), icon: <LayoutDashboard size={15} /> },
      { id: 'crew', label: dc(lang, 'navCrew'), icon: <Users size={15} /> },
      { id: 'sites', label: dc(lang, 'navSites'), icon: <Building2 size={15} /> },
      { id: 'attendance', label: dc(lang, 'navAttendance'), icon: <CalendarDays size={15} /> },
      { id: 'wages', label: dc(lang, 'navWages'), icon: <Wallet size={15} /> },
      { id: 'approvals', label: dc(lang, 'navApprovals'), icon: <ClipboardCheck size={15} />, badge: pending },
      { id: 'disputes', label: dc(lang, 'navDisputes'), icon: <Gavel size={15} />, badge: openDisputes },
    ];
  }, [lang, snapshot]);

  const syncState: SyncState = !isDashboardConfigured()
    ? 'unconfigured'
    : !resource.online
      ? 'offline'
      : resource.loading || resource.refreshing
        ? 'loading'
        : 'synced';

  const body = (() => {
    if (resource.error?.kind === 'not_configured') {
      return (
        <ErrorNotice
          title={dc(lang, 'commonNotConfiguredTitle')}
          message={dc(lang, 'commonNotConfiguredBody')}
          tone="warning"
        />
      );
    }

    if (!resource.online) {
      return <OfflineNotice title={dc(lang, 'commonOfflineTitle')} message={dc(lang, 'commonOfflineBody')} />;
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

    if (!snapshot) return <LoadingBlock label={dc(lang, 'commonLoading')} />;

    const shared = {
      lang,
      user: { fullName: user.fullName, id: user.id },
    };

    switch (panel) {
      case 'crew':
        return (
          <ContractorCrew
            lang={lang}
            workers={snapshot.workers}
            assignments={snapshot.assignments}
            ledger={snapshot.ledger}
          />
        );
      case 'sites':
        return <ContractorSites lang={lang} sites={snapshot.sites} workers={snapshot.workers} />;
      case 'attendance':
        return <ContractorAttendance lang={lang} workers={snapshot.workers} attendance={snapshot.attendance} />;
      case 'wages':
        return <ContractorWages lang={lang} workers={snapshot.workers} ledger={snapshot.ledger} />;
      case 'approvals':
        return (
          <ContractorApprovals
            {...shared}
            workers={snapshot.workers}
            approvals={snapshot.approvals}
            onChanged={resource.refresh}
          />
        );
      case 'disputes':
        return <ContractorDisputes lang={lang} workers={snapshot.workers} disputes={snapshot.disputes} />;
      default:
        return (
          <ContractorOverview
            {...shared}
            workers={snapshot.workers}
            sites={snapshot.sites}
            assignments={snapshot.assignments}
            attendance={snapshot.attendance}
            ledger={snapshot.ledger}
            disputes={snapshot.disputes}
            approvals={snapshot.approvals}
            onChanged={resource.refresh}
            onJump={(next) => setPanel(next as PanelId)}
          />
        );
    }
  })();

  return (
    <DashboardShell
      lang={lang}
      role="contractor"
      title={dc(lang, 'brandContractor')}
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

import type { CloudWorkerDirectoryRecord, WorkerPrivateDataRecord } from '../../types';
import type { Language } from '../../services/i18n';
import type {
  CloudApprovalRow,
  CloudAssignmentRow,
  CloudAttendanceRow,
  CloudDisputeRow,
  CloudLedgerRow,
  CloudSiteRow,
} from '../../services/dashboardData';

export interface WorkerViewProps {
  lang: Language;
  worker: CloudWorkerDirectoryRecord;
  privateData: WorkerPrivateDataRecord | null;
  privateDataNotice: string | null;
  attendance: CloudAttendanceRow[];
  ledger: CloudLedgerRow[];
  disputes: CloudDisputeRow[];
  approvals: CloudApprovalRow[];
}

export interface ContractorViewProps {
  lang: Language;
  user: { fullName: string; id: string };
  workers: CloudWorkerDirectoryRecord[];
  sites: CloudSiteRow[];
  assignments: CloudAssignmentRow[];
  attendance: CloudAttendanceRow[];
  ledger: CloudLedgerRow[];
  disputes: CloudDisputeRow[];
  approvals: CloudApprovalRow[];
  onChanged: () => void;
}

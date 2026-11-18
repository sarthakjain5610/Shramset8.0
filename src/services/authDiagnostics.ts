export type AuthDiagnosticStage =
  | 'auth_signup'
  | 'email_confirmation'
  | 'profile_provisioning'
  | 'worker_onboarding'
  | 'contractor_onboarding'
  | 'dashboard_routing'
  | 'sign_in';

export interface SafeAuthDiagnostic {
  stage: AuthDiagnosticStage;
  code?: string;
  status?: number;
}

/** Extract only protocol identifiers; never serialize backend messages, identities, or tokens. */
export function createSafeAuthDiagnostic(stage: AuthDiagnosticStage, error: unknown): SafeAuthDiagnostic {
  const details = error && typeof error === 'object'
    ? error as { code?: unknown; status?: unknown }
    : {};
  const candidateCode = typeof details.code === 'string' ? details.code.toLowerCase() : '';
  const code = /^[a-z0-9_-]{1,64}$/.test(candidateCode) ? candidateCode : undefined;
  const candidateStatus = Number(details.status);
  const status = Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus <= 599
    ? candidateStatus
    : undefined;
  return { stage, ...(code ? { code } : {}), ...(status ? { status } : {}) };
}

/** Browser-console diagnostic safe to attach to a support report. Do not pass form/session data. */
export function reportAuthDiagnostic(stage: AuthDiagnosticStage, error: unknown): SafeAuthDiagnostic {
  const diagnostic = createSafeAuthDiagnostic(stage, error);
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn('[WURKUP_AUTH_DIAGNOSTIC]', diagnostic);
  }
  return diagnostic;
}

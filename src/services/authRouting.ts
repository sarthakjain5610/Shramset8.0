import type { AuthState } from './auth';
import type { AppRoute } from './router';

/** Decide the authenticated landing route, keeping recovery flow ahead of dashboards. */
export function getAuthRedirectRoute(authState: Pick<AuthState, 'isAuthenticated' | 'isJudgeDemo' | 'user' | 'isPasswordRecovery'>, currentRoute: AppRoute): AppRoute | null {
  if (authState.isPasswordRecovery) return null;
  if (authState.isAuthenticated) {
    if (authState.isJudgeDemo) return 'judge-demo';
    if (authState.user?.role === 'worker') return 'worker';
    if (authState.user?.role === 'contractor') return 'contractor';
    return null;
  }
  if (currentRoute === 'worker' || currentRoute === 'contractor') return 'sign-in';
  return null;
}

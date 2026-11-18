/**
 * WurkUp - Role-Based Authentication & Contact Verification Engine
 * Handles user lifecycle for Workers and Contractors with Supabase Cloud Auth support
 * and an isolated, fully compliant Local Demo fallback when backend keys are unconfigured.
 * 
 * Strict Security Rules:
 * 1. Passwords are NEVER stored in localStorage or IndexedDB.
 * 2. "Remember my login ID" stores ONLY the email/login identifier, never the password.
 * 3. Newly registered workers do NOT inherit seeded demo data.
 * 4. Signing out preserves user data without resetting the database.
 * 5. Judge Demo Mode is strictly isolated from genuine user sessions.
 */

import { UserProfile, UserRole, ContactVerificationStatus, ManualContactCheckRecord } from '../types';
import { initialSupabaseAuthCallbackPending, supabase } from './supabase';
import { computeSha256Hex } from './cryptoAudit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { reportAuthDiagnostic } from './authDiagnostics';

const SESSION_STORAGE_KEY = 'shramsetu_auth_active_user';
const REMEMBERED_ID_KEY = 'shramsetu_remembered_login_id';
const LOCAL_USERS_KEY = 'shramsetu_registered_users_registry';
const PASSWORD_RECOVERY_STORAGE_KEY = 'shramsetu_password_recovery_active';
const PASSWORD_RECOVERY_COMPLETED_KEY = 'shramsetu_password_recovery_completed';
const PASSWORD_MIN_LENGTH = 6;
const INVALID_RECOVERY_LINK_MESSAGE = 'This password recovery link is invalid or has expired. Request a new recovery email or return to sign in.';

function getRecoveryErrorFromUrl(): string | null {
  if (typeof window === 'undefined' || !window.location) return null;
  const hash = window.location.hash.replace(/^#\/?/, '');
  const params = new URLSearchParams(`${window.location.search}&${hash}`);
  const errorCode = params.get('error_code') || params.get('error');
  return errorCode ? INVALID_RECOVERY_LINK_MESSAGE : null;
}

function stripAuthCallbackParams(url: URL): void {
  const callbackKeys = ['code', 'error', 'error_code', 'error_description', 'access_token', 'refresh_token', 'token_type', 'expires_in', 'type', 'provider_token', 'provider_refresh_token'];
  for (const key of callbackKeys) url.searchParams.delete(key);

  const fragment = url.hash.slice(1);
  if (!fragment) return;
  if (fragment.startsWith('/')) {
    const queryIndex = fragment.indexOf('?');
    if (queryIndex < 0) return;
    const route = fragment.slice(0, queryIndex);
    const params = new URLSearchParams(fragment.slice(queryIndex + 1));
    for (const key of callbackKeys) params.delete(key);
    const query = params.toString();
    url.hash = query ? `${route}?${query}` : route;
    return;
  }

  const params = new URLSearchParams(fragment);
  for (const key of callbackKeys) params.delete(key);
  url.hash = params.toString();
}

export interface AuthState {
  user: UserProfile | null;
  role: UserRole;
  isAuthenticated: boolean;
  isJudgeDemo: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  isPasswordRecovery: boolean;
  passwordRecoveryError: string | null;
  passwordRecoveryCompleted: boolean;
  isAuthCallbackPending: boolean;
}

export interface SignUpParams {
  role: 'worker' | 'contractor';
  fullName: string;
  phone: string;
  email: string;
  password: string;
  trade?: string;
  organizationName?: string;
  consentToShareContact: boolean;
  privacyAccepted: boolean;
}

export type AuthFailureKind = 'validation' | 'rate_limited' | 'already_registered' | 'invalid_credentials' | 'email_unconfirmed' | 'backend';

export type SignUpResult =
  | { success: true; state: 'authenticated'; user: UserProfile }
  | { success: true; state: 'confirmation_pending'; email: string }
  | { success: true; state: 'profile_pending'; email: string }
  | { success: false; kind: AuthFailureKind; error: string };

export type SignInResult =
  | { success: true; user: UserProfile }
  | { success: false; kind: AuthFailureKind; error: string };

export interface SignInParams {
  loginId: string;
  password?: string;
  rememberMe?: boolean;
}

function classifySupabaseError(error: unknown, context: 'signup' | 'signin' | 'recovery'): { kind: AuthFailureKind; message: string } {
  const details = (error && typeof error === 'object' ? error : {}) as { code?: unknown; status?: unknown; message?: unknown };
  const code = String(details.code || '').toLowerCase();
  const message = String(details.message || '').toLowerCase();
  const status = Number(details.status);

  if (code === 'over_email_send_rate_limit') {
    return {
      kind: 'rate_limited',
      message: context === 'recovery'
        ? 'Too many recovery emails were requested. Wait before trying again; do not retry repeatedly. Contact support if the problem continues.'
        : 'Too many confirmation emails were requested. Wait before trying again; do not retry repeatedly. Contact support if the problem continues.',
    };
  }
  if (code === 'over_request_rate_limit' || status === 429) {
    return { kind: 'rate_limited', message: 'Too many authentication requests were made. Wait before trying again and do not retry repeatedly.' };
  }
  if (code === 'user_already_exists' || code === 'email_exists' || /already (?:been )?registered|user already exists|email already exists/.test(message)) {
    return { kind: 'already_registered', message: 'An account may already exist for this email. Sign in or use password recovery instead of registering again.' };
  }
  if (code === 'email_not_confirmed') {
    return { kind: 'email_unconfirmed', message: 'Verify your email using the confirmation link before signing in.' };
  }
  if (context === 'signin' && (code === 'invalid_credentials' || code === 'invalid_grant' || /invalid login credentials/.test(message))) {
    return { kind: 'invalid_credentials', message: 'Email or password is incorrect. If you have not verified your email, check your confirmation message first.' };
  }
  if (code === 'validation_failed' || code === 'weak_password' || code === 'email_address_invalid' || /invalid email|password.*(?:short|weak)|email.*invalid/.test(message)) {
    return { kind: 'validation', message: 'Check the email address and password, then try again. Passwords must meet the minimum length shown in the form.' };
  }
  return {
    kind: 'backend',
    message: context === 'signup'
      ? 'We could not confirm the registration result. Do not submit repeatedly; try signing in or password recovery, or contact support.'
      : context === 'recovery'
        ? 'We could not process the password recovery request right now. Please try again later or contact support.'
        : 'We could not complete sign-in right now. Please try again later or contact support.',
  };
}

export class AuthService {
  private currentUser: UserProfile | null = null;
  private isJudgeDemo = false;
  private supabase: SupabaseClient | null;
  private listeners: ((state: AuthState) => void)[] = [];
  private isPasswordRecovery = false;
  private passwordRecoveryError: string | null = null;
  private passwordRecoveryUpdateInFlight = false;
  private passwordRecoveryCompleted = false;
  private isAuthCallbackPending = false;
  private authCallbackFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    client: SupabaseClient | null = supabase,
    restoreSession = true,
    authCallbackPending = initialSupabaseAuthCallbackPending,
  ) {
    this.supabase = client;
    this.passwordRecoveryError = getRecoveryErrorFromUrl();
    this.passwordRecoveryCompleted = this.passwordRecoveryError ? false : this.hasPersistedRecoveryCompletion();
    this.isPasswordRecovery = Boolean(this.passwordRecoveryError) || this.hasPersistedRecoveryState() || this.passwordRecoveryCompleted;
    this.isAuthCallbackPending = authCallbackPending && !this.passwordRecoveryError;
    if (this.passwordRecoveryError) {
      this.persistRecoveryState(true);
      this.persistRecoveryCompletion(false);
    }
    if (this.isAuthCallbackPending) {
      // A failed URL callback may not emit any auth event; surface a safe recovery error rather than hanging.
      this.authCallbackFallbackTimer = setTimeout(() => this.failPendingAuthCallback(), 8000);
    }
    if (restoreSession) this.restoreRemoteSession();
  }

  private clearAuthCallbackPending(): void {
    this.isAuthCallbackPending = false;
    if (this.authCallbackFallbackTimer) clearTimeout(this.authCallbackFallbackTimer);
    this.authCallbackFallbackTimer = null;
  }

  private failPendingAuthCallback(): void {
    if (!this.isAuthCallbackPending) return;
    this.clearAuthCallbackPending();
    this.isPasswordRecovery = true;
    this.passwordRecoveryError = INVALID_RECOVERY_LINK_MESSAGE;
    this.persistRecoveryState(true);
    this.persistRecoveryCompletion(false);
    this.notify();
  }

  private async restoreRemoteSession(): Promise<void> {
    if (!this.supabase) return;
    const { data: { subscription } } = this.supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        this.clearAuthCallbackPending();
        this.isPasswordRecovery = true;
        this.passwordRecoveryError = null;
        this.passwordRecoveryCompleted = false;
        this.persistRecoveryState(true);
        this.persistRecoveryCompletion(false);
        // The recovery screen needs the Supabase session, not a role/profile lookup.
        this.currentUser = null;
        this.isJudgeDemo = false;
        this.notify();
        return;
      }
      // Supabase emits INITIAL_SESSION as part of client startup; it can precede the
      // deferred PASSWORD_RECOVERY callback. Keep routing gated until the real event.
      if (event === 'INITIAL_SESSION' && this.isAuthCallbackPending) {
        this.notify();
        return;
      }
      const wasAuthCallbackPending = this.isAuthCallbackPending;
      if (this.isAuthCallbackPending) this.clearAuthCallbackPending();
      if (wasAuthCallbackPending && session?.user) reportAuthDiagnostic('email_confirmation', { code: 'callback_session_received' });
      if (!session?.user) {
        this.currentUser = null;
        this.isJudgeDemo = false;
        if (event === 'SIGNED_OUT') {
          this.isPasswordRecovery = false;
          this.passwordRecoveryError = null;
          this.persistRecoveryState(false);
        }
        this.notify();
        return;
      }
      // Defer network work until Supabase's auth callback has returned.
      queueMicrotask(() => { void this.loadAuthenticatedProfile(session.user.id); });
      this.notify();
    });
    void subscription;
    const { data, error } = await this.supabase.auth.getSession();
    if (!error && data.session?.user && !this.isPasswordRecovery && !this.isAuthCallbackPending) await this.loadAuthenticatedProfile(data.session.user.id);
    else if (error || !data.session?.user) {
      this.currentUser = null;
      if (this.isAuthCallbackPending) this.failPendingAuthCallback();
      else this.notify();
    } else this.notify();
  }

  private async loadAuthenticatedProfile(id: string): Promise<void> {
    if (!this.supabase) return;
    try {
      const { data, error } = await this.supabase.from('profiles').select('id, role, full_name, phone').eq('id', id).single();
      if (error || !data || !['worker', 'contractor'].includes(data.role)) {
        reportAuthDiagnostic('profile_provisioning', error || { code: 'profile_missing' });
        this.currentUser = null; this.isJudgeDemo = false; this.notify(); return;
      }
      this.currentUser = { id: data.id, fullName: data.full_name, phone: data.phone || '', role: data.role,
        contactVerificationStatus: 'number_supplied', manualChecks: [], consentToShareContact: false, privacyAccepted: true,
        qrReferenceToken: '', createdAt: new Date().toISOString(), isJudgeDemo: false };
      this.isJudgeDemo = false; this.notify();
    } catch (error) {
      reportAuthDiagnostic('profile_provisioning', error);
      this.currentUser = null; this.isJudgeDemo = false; this.notify();
    }
  }

  private hasPersistedRecoveryState(): boolean {
    if (typeof window === 'undefined') return false;
    try { return window.sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === 'true'; } catch { return false; }
  }

  private persistRecoveryState(active: boolean): void {
    if (typeof window === 'undefined') return;
    try {
      if (active) window.sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, 'true');
      else {
        window.sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
        window.sessionStorage.removeItem(PASSWORD_RECOVERY_COMPLETED_KEY);
      }
    } catch { /* session storage is a convenience, never the authorization source */ }
  }

  private hasPersistedRecoveryCompletion(): boolean {
    if (typeof window === 'undefined') return false;
    try { return window.sessionStorage.getItem(PASSWORD_RECOVERY_COMPLETED_KEY) === 'true'; } catch { return false; }
  }

  private persistRecoveryCompletion(completed: boolean): void {
    if (typeof window === 'undefined') return;
    try {
      if (completed) window.sessionStorage.setItem(PASSWORD_RECOVERY_COMPLETED_KEY, 'true');
      else window.sessionStorage.removeItem(PASSWORD_RECOVERY_COMPLETED_KEY);
    } catch { /* non-sensitive UI state only */ }
  }

  public getAuthState(): AuthState {
    const isAuthed = Boolean(this.currentUser);
    return {
      user: this.currentUser,
      role: this.currentUser ? this.currentUser.role : 'public_visitor',
      isAuthenticated: isAuthed,
      isJudgeDemo: this.isJudgeDemo,
      isLoading: false,
      errorMessage: null,
      isPasswordRecovery: this.isPasswordRecovery,
      passwordRecoveryError: this.passwordRecoveryError,
      passwordRecoveryCompleted: this.passwordRecoveryCompleted,
      isAuthCallbackPending: this.isAuthCallbackPending,
    };
  }

  public subscribe(cb: (state: AuthState) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify(): void {
    const state = this.getAuthState();
    this.listeners.forEach((cb) => cb(state));
  }

  /**
   * Generates a collision-resistant opaque token for permanent QR passes
   */
  public generateOpaqueToken(prefix: string = 'SS2'): string {
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `${prefix}-${randomHex.slice(0, 8)}-${Date.now().toString(36)}`;
  }

  /**
   * Register a new Worker or Contractor
   */
  public async signUp(params: SignUpParams): Promise<SignUpResult> {
    if (!this.supabase) return { success: false, kind: 'backend', error: 'Cloud authentication is not configured. Use explicitly labelled Local Demo Mode.' };
    const email = params.email?.trim() || '';
    if (!['worker', 'contractor'].includes(params.role)) return { success: false, kind: 'validation', error: 'Unsupported account role.' };
    if (!params.fullName?.trim() || !params.phone?.trim() || !email || !params.password) {
      return { success: false, kind: 'validation', error: 'Name, phone, email and password are required. Email is required for every account while phone sign-in is disabled.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, kind: 'validation', error: 'Enter a valid email address.' };
    }
    if (params.password.length < 6) return { success: false, kind: 'validation', error: 'Choose a password with at least 6 characters.' };
    if (!params.privacyAccepted) return { success: false, kind: 'validation', error: 'Privacy consent is required.' };

    try {
      // Supabase Site URL and the production redirect allow-list include this origin.
      // Use the origin only (not a path or arbitrary user-provided URL).
      const emailRedirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password: params.password,
        options: {
          data: { full_name: params.fullName.trim(), phone: params.phone.trim(), signup_role: params.role },
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
        },
      });
      if (error) {
        reportAuthDiagnostic('auth_signup', error);
        const mapped = classifySupabaseError(error, 'signup');
        return { success: false, kind: mapped.kind, error: mapped.message };
      }
      if (!data.user) {
        return { success: false, kind: 'backend', error: 'We could not confirm the registration result. Do not submit repeatedly; try signing in or password recovery, or contact support.' };
      }
      // Supabase can obscure duplicate-email errors by returning a user with no identities.
      // Treat that as an existing account; never attempt a second Auth/profile/worker insert.
      if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return { success: false, kind: 'already_registered', error: 'An account may already exist for this email. Sign in or use password recovery instead of registering again.' };
      }
      if (!data.session) return { success: true, state: 'confirmation_pending', email };

      // The role is passed only as user metadata. The database trigger constrains it
      // and creates the profile; workers are created later by the idempotent RPC.
      try {
        await this.loadAuthenticatedProfile(data.user.id);
      } catch {
        this.currentUser = null;
      }
      if (this.currentUser) return { success: true, state: 'authenticated', user: this.currentUser };

      // Auth creation already succeeded; sign out and do not ask the user to register again.
      try { await this.supabase.auth.signOut(); } catch { /* keep the original safe status */ }
      return { success: true, state: 'profile_pending', email };
    } catch (error) {
      reportAuthDiagnostic('auth_signup', error);
      const mapped = classifySupabaseError(error, 'signup');
      return { success: false, kind: mapped.kind, error: mapped.message };
    }
  }

  /** Sign in with the email address used at registration. Phone auth is disabled. */
  public async signIn(params: SignInParams): Promise<SignInResult> {
    const email = params.loginId.trim();
    if (params.rememberMe) this.setRememberedLoginId(email); else this.clearRememberedLoginId();
    if (!this.supabase) return { success: false, kind: 'backend', error: 'Cloud authentication is not configured. Local accounts are not accepted here; choose Local Demo Mode explicitly.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !params.password) {
      return { success: false, kind: 'validation', error: 'Use your registered email address and password.' };
    }
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password: params.password });
      if (error) {
        reportAuthDiagnostic('sign_in', error);
        const mapped = classifySupabaseError(error, 'signin');
        return { success: false, kind: mapped.kind, error: mapped.message };
      }
      await this.loadAuthenticatedProfile(data.user.id);
      if (!this.currentUser) {
        await this.supabase.auth.signOut();
        return { success: false, kind: 'backend', error: 'The account is authenticated but its WurkUp profile is not available. Contact support; do not register again.' };
      }
      return { success: true, user: this.currentUser };
    } catch (error) {
      reportAuthDiagnostic('sign_in', error);
      const mapped = classifySupabaseError(error, 'signin');
      return { success: false, kind: mapped.kind, error: mapped.message };
    }
  }

  /**
   * Sign Out (Clears session without deleting or resetting user records!)
   */
  public async signOut(): Promise<void> {
    if (this.supabase) {
      try {
        await this.supabase.auth.signOut();
      } catch {
        // ignore
      }
    }

    this.currentUser = null;
    this.isJudgeDemo = false;
    this.isPasswordRecovery = false;
    this.passwordRecoveryError = null;
    this.passwordRecoveryCompleted = false;
    this.isAuthCallbackPending = false;
    this.persistRecoveryState(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    this.notify();
  }

  /**
   * Password Recovery Request
   */
  public async requestPasswordRecovery(email: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    if (!this.supabase) return { success: false, message: 'Cloud authentication is not configured.' };
    try {
      const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await this.supabase.auth.resetPasswordForEmail(normalizedEmail, redirectTo ? { redirectTo } : undefined);
      if (error) return { success: false, message: classifySupabaseError(error, 'recovery').message };
      return {
        success: true,
        message: `If an account is associated with ${normalizedEmail}, password reset instructions have been dispatched.`,
      };
    } catch {
      return { success: false, message: 'We could not process the password recovery request right now. Please try again later or contact support.' };
    }
  }

  /** Leave the recovery form after an invalid/expired link and remove safe error callback parameters. */
  public async dismissPasswordRecovery(): Promise<void> {
    await this.signOut();
    if (typeof window === 'undefined' || !window.location || typeof window.history?.replaceState !== 'function') return;
    try {
      const url = new URL(window.location.href);
      stripAuthCallbackParams(url);
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch { /* callback cleanup is best-effort and never affects authentication */ }
  }

  /** Update a password only from an active, valid Supabase recovery session. */
  public async updatePasswordFromRecovery(password: string): Promise<{ success: boolean; message: string }> {
    if (!this.supabase) return { success: false, message: 'Cloud authentication is not configured.' };
    if (!this.isPasswordRecovery || this.passwordRecoveryError) {
      return { success: false, message: this.passwordRecoveryError || INVALID_RECOVERY_LINK_MESSAGE };
    }
    if (this.passwordRecoveryUpdateInFlight || this.passwordRecoveryCompleted) {
      return { success: false, message: 'This password update is already being processed. If it succeeded, sign in with your new password.' };
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      return { success: false, message: `Choose a password with at least ${PASSWORD_MIN_LENGTH} characters.` };
    }

    this.passwordRecoveryUpdateInFlight = true;
    try {
      const { data, error: sessionError } = await this.supabase.auth.getSession();
      if (sessionError || !data.session) {
        this.passwordRecoveryError = INVALID_RECOVERY_LINK_MESSAGE;
        this.notify();
        return { success: false, message: INVALID_RECOVERY_LINK_MESSAGE };
      }
      const { error } = await this.supabase.auth.updateUser({ password });
      if (error) return { success: false, message: classifySupabaseError(error, 'recovery').message };

      this.passwordRecoveryCompleted = true;
      this.persistRecoveryCompletion(true);
      this.notify();
      return { success: true, message: 'Your password has been updated. Sign in with your new password.' };
    } catch {
      return { success: false, message: 'We could not update your password right now. Request a new recovery link or contact support.' };
    } finally {
      this.passwordRecoveryUpdateInFlight = false;
    }
  }

  /**
   * Isolated Judge Demo Entry
   */
  public enterJudgeDemo(role: 'worker' | 'contractor' = 'worker', workerProfile?: Partial<UserProfile>): void {
    const demoUser: UserProfile = {
      id: role === 'worker' ? (workerProfile?.id || 'WKR-MP-001') : 'CTR-IND-METRO',
      email: 'judge-demo@shramsetu.gov.demo',
      phone: role === 'worker' ? '+91 98260 14820' : '+91 731 2928100',
      fullName: role === 'worker' ? (workerProfile?.fullName || 'Rameshwar Lal Ahirwar (Demo)') : 'Anil Sisodiya (Contractor Demo)',
      role,
      trade: role === 'worker' ? 'Head Mason (मुख्य राजमिस्त्री)' : undefined,
      organizationName: role === 'contractor' ? 'Narmada Infra & Urban Engineering Ltd.' : undefined,
      contactVerificationStatus: 'manual_check_completed',
      manualChecks: [
        {
          id: 'CHK-DEMO-01',
          targetUserId: 'WKR-MP-001',
          targetPhone: '+91 98260 14820',
          checkedByUserId: 'CTR-IND-METRO',
          checkedByName: 'Anil Sisodiya',
          checkedByRole: 'contractor',
          checkedAt: '2026-10-20T10:30:00Z',
          outcome: 'confirmed_match',
          notes: 'Personal telephonic check verified with worker prior to muster deployment.',
        },
      ],
      consentToShareContact: true,
      privacyAccepted: true,
      qrReferenceToken: 'WKR-DEMO-OPAQUE-TOKEN-001',
      assignedWorkerIds: ['WKR-MP-001', 'WKR-MP-002', 'WKR-MP-003', 'WKR-MP-004', 'WKR-MP-005'],
      createdAt: '2026-01-01T00:00:00Z',
      isJudgeDemo: true,
    };

    this.currentUser = demoUser;
    this.isJudgeDemo = true;
    this.saveSession(demoUser);
    this.notify();
  }

  /**
   * Records a manual mutual contact cross-check performed by an authorized counterpart
   */
  public recordManualContactCheck(
    targetUserId: string,
    targetPhone: string,
    outcome: ManualContactCheckRecord['outcome'],
    notes: string = ''
  ): ManualContactCheckRecord | null {
    if (!this.currentUser) return null;

    const checkRecord: ManualContactCheckRecord = {
      id: `CHK-${Date.now().toString().slice(-6)}`,
      targetUserId,
      targetPhone,
      checkedByUserId: this.currentUser.id,
      checkedByName: this.currentUser.fullName,
      checkedByRole: this.currentUser.role,
      checkedAt: new Date().toISOString(),
      outcome,
      notes: notes.trim(),
    };

    // Update target user's contact verification status in registry
    const users = this.getLocalUsers();
    const target = users.find((u) => u.id === targetUserId);
    if (target) {
      target.manualChecks = [...(target.manualChecks || []), checkRecord];
      if (outcome === 'confirmed_match') {
        target.contactVerificationStatus = 'manual_check_completed';
      } else if (outcome === 'details_mismatch' || outcome === 'reported_suspicious') {
        target.contactVerificationStatus = 'disputed_or_review';
      }
      this.updateUserInRegistry(target);
    }

    // Also update current user if they were the target
    if (this.currentUser.id === targetUserId) {
      this.currentUser.manualChecks = [...(this.currentUser.manualChecks || []), checkRecord];
      if (outcome === 'confirmed_match') {
        this.currentUser.contactVerificationStatus = 'manual_check_completed';
      } else if (outcome === 'details_mismatch' || outcome === 'reported_suspicious') {
        this.currentUser.contactVerificationStatus = 'disputed_or_review';
      }
      this.saveSession(this.currentUser);
    }

    this.notify();
    return checkRecord;
  }

  /**
   * Update Profile Details
   */
  public updateProfile(updates: Partial<UserProfile>): void {
    if (!this.currentUser) return;

    this.currentUser = {
      ...this.currentUser,
      ...updates,
    };
    this.saveSession(this.currentUser);
    this.updateUserInRegistry(this.currentUser);
    this.notify();
  }

  // --------------------------------------------------------------------------
  // Helpers & Local Storage Persistence
  // --------------------------------------------------------------------------
  private saveSession(user: UserProfile): void {
    if (typeof window === 'undefined') return;
    try {
      if (this.isJudgeDemo) window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // ignore
    }
  }

  public getLocalUsers(): UserProfile[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = window.localStorage.getItem(LOCAL_USERS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveLocalUser(user: UserProfile, passwordHash: string): void {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getLocalUsers();
      current.unshift(user);
      window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(current));

      if (passwordHash) {
        window.localStorage.setItem(`shramsetu_pwd_hash_${user.id}`, passwordHash);
      }
    } catch {
      // ignore
    }
  }

  private updateUserInRegistry(user: UserProfile): void {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getLocalUsers();
      const idx = current.findIndex((u) => u.id === user.id);
      if (idx !== -1) {
        current[idx] = user;
        window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(current));
      }
    } catch {
      // ignore
    }
  }

  private getLocalCreds(userId: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(`shramsetu_pwd_hash_${userId}`);
    } catch {
      return null;
    }
  }

  public getRememberedLoginId(): string {
    if (typeof window === 'undefined') return '';
    try {
      return window.localStorage.getItem(REMEMBERED_ID_KEY) || '';
    } catch {
      return '';
    }
  }

  public setRememberedLoginId(id: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(REMEMBERED_ID_KEY, id);
    } catch {
      // ignore
    }
  }

  public clearRememberedLoginId(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(REMEMBERED_ID_KEY);
    } catch {
      // ignore
    }
  }
}

export const auth = new AuthService();

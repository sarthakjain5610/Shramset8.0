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
import { supabase } from './supabase';
import { computeSha256Hex } from './cryptoAudit';
import type { SupabaseClient } from '@supabase/supabase-js';

const SESSION_STORAGE_KEY = 'shramsetu_auth_active_user';
const REMEMBERED_ID_KEY = 'shramsetu_remembered_login_id';
const LOCAL_USERS_KEY = 'shramsetu_registered_users_registry';

export interface AuthState {
  user: UserProfile | null;
  role: UserRole;
  isAuthenticated: boolean;
  isJudgeDemo: boolean;
  isLoading: boolean;
  errorMessage: string | null;
}

export interface SignUpParams {
  role: 'worker' | 'contractor';
  fullName: string;
  phone: string;
  email?: string;
  password?: string;
  trade?: string;
  organizationName?: string;
  consentToShareContact: boolean;
  privacyAccepted: boolean;
}

export interface SignInParams {
  loginId: string;
  password?: string;
  rememberMe?: boolean;
}

class AuthService {
  private currentUser: UserProfile | null = null;
  private isJudgeDemo = false;
  private supabase: SupabaseClient | null = supabase;
  private listeners: ((state: AuthState) => void)[] = [];

  constructor() {
    this.restoreRemoteSession();
  }

  private async restoreRemoteSession(): Promise<void> {
    if (!this.supabase) return;
    const { data: { subscription } } = this.supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) { this.currentUser = null; this.isJudgeDemo = false; this.notify(); return; }
      // Defer network work until Supabase's auth callback has returned.
      queueMicrotask(() => { void this.loadAuthenticatedProfile(session.user.id); });
    });
    void subscription;
    const { data, error } = await this.supabase.auth.getSession();
    if (!error && data.session?.user) await this.loadAuthenticatedProfile(data.session.user.id);
    else { this.currentUser = null; this.notify(); }
  }

  private async loadAuthenticatedProfile(id: string): Promise<void> {
    if (!this.supabase) return;
    const { data, error } = await this.supabase.from('profiles').select('id, role, full_name, phone').eq('id', id).single();
    if (error || !data || !['worker', 'contractor'].includes(data.role)) {
      this.currentUser = null; this.isJudgeDemo = false; this.notify(); return;
    }
    this.currentUser = { id: data.id, fullName: data.full_name, phone: data.phone || '', role: data.role,
      contactVerificationStatus: 'number_supplied', manualChecks: [], consentToShareContact: false, privacyAccepted: true,
      qrReferenceToken: '', createdAt: new Date().toISOString(), isJudgeDemo: false };
    this.isJudgeDemo = false; this.notify();
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
  public async signUp(params: SignUpParams): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    if (!this.supabase) return { success: false, error: 'Cloud authentication is not configured. Use explicitly labelled Local Demo Mode.' };
    if (!['worker', 'contractor'].includes(params.role)) return { success: false, error: 'Unsupported account role.' };
    if (!params.fullName?.trim() || !params.phone?.trim() || !params.email || !params.password)
      return { success: false, error: 'Name, phone, email and password are required.' };
    if (!params.privacyAccepted) return { success: false, error: 'Privacy consent is required.' };
    const { data, error } = await this.supabase.auth.signUp({ email: params.email.trim(), password: params.password,
      options: { data: { full_name: params.fullName.trim(), phone: params.phone.trim(), signup_role: params.role }, emailRedirectTo: window.location.origin } });
    if (error) return { success: false, error: error.message };
    if (!data.user) return { success: false, error: 'Supabase did not return an account.' };
    // The requested public role is passed only as signup metadata; the database trigger constrains it to worker/contractor.
    if (!data.session) return { success: true }; // Email confirmation is enabled; profile is provisioned by the database trigger.
    await this.loadAuthenticatedProfile(data.user.id);
    return this.currentUser ? { success: true, user: this.currentUser } : { success: false, error: 'Account created; profile role is not provisioned. Contact support or apply the database migration.' };
  }

  /**
   * Sign In with Email or Mobile Number
   */
  public async signIn(params: SignInParams): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const email = params.loginId.trim();
    if (params.rememberMe) this.setRememberedLoginId(email); else this.clearRememberedLoginId();
    if (!this.supabase) return { success: false, error: 'Cloud authentication is not configured. Local accounts are not accepted here; choose Local Demo Mode explicitly.' };
    if (!email.includes('@') || !params.password) return { success: false, error: 'Use your registered email and password.' };
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password: params.password });
    if (error) return { success: false, error: error.message };
    await this.loadAuthenticatedProfile(data.user.id);
    if (!this.currentUser) { await this.supabase.auth.signOut(); return { success: false, error: 'Authenticated user has no valid worker/contractor profile.' }; }
    return { success: true, user: this.currentUser };
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
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    this.notify();
  }

  /**
   * Password Recovery Request
   */
  public async requestPasswordRecovery(email: string): Promise<{ success: boolean; message: string }> {
    if (!email || !email.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    if (!this.supabase) return { success: false, message: 'Cloud authentication is not configured.' };
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) return { success: false, message: error.message };

    return {
      success: true,
      message: `If an account is associated with ${email}, password reset instructions have been dispatched.`,
    };
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

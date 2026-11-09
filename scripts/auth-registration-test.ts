import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthService, SignUpParams } from '../src/services/auth';
import { getAuthRedirectRoute } from '../src/services/authRouting';
import { completeMyWorkerOnboarding } from '../src/services/workerCloudData';

const PRODUCTION_ORIGIN = 'https://wurkup.sarthakjain5610.workers.dev';
const storage = new Map<string, string>();
const recoveryStorage = new Map<string, string>();
(globalThis as any).window = {
  location: { origin: PRODUCTION_ORIGIN, search: '', hash: '' },
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
  sessionStorage: {
    getItem: (key: string) => recoveryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => recoveryStorage.set(key, value),
    removeItem: (key: string) => recoveryStorage.delete(key),
  },
};

const baseParams: SignUpParams = {
  role: 'worker',
  fullName: 'Sunita Bai Verma',
  phone: '+91 9811122334',
  email: 'sunita@example.test',
  password: 'worker123',
  trade: 'Head Mason (मुख्य राजमिस्त्री)',
  consentToShareContact: true,
  privacyAccepted: true,
};

type User = { id: string; email: string; identities?: { provider: string }[] };
type AuthReply = { data: { user: User | null; session: { user: User } | null }; error: unknown };

function makeClient() {
  const calls = { signUp: [] as any[], signIn: [] as any[], recovery: [] as any[], rpc: [] as any[], signOut: 0, profileReads: 0, passwordUpdates: 0, passwordLength: 0 };
  let signUpReply: AuthReply = { data: { user: null, session: null }, error: null };
  let signInReply: AuthReply = { data: { user: null, session: null }, error: null };
  let recoveryReply: { error: unknown } = { error: null };
  let recoveryException: unknown = null;
  let updateUserError: unknown = null;
  let authSession: { user: User } | null = null;
  let authCallback: ((event: string, session: { user: User } | null) => void) | null = null;
  let profileRole: 'worker' | 'contractor' = 'worker';
  let onboardingId = 'WKR-AUTH-TEST';
  const profile = () => ({ id: 'auth-user-1', role: profileRole, full_name: 'Sunita Bai Verma', phone: '+91 9811122334' });

  const client = {
    auth: {
      signUp: async (args: any) => { calls.signUp.push(args); profileRole = args.options.data.signup_role; return signUpReply; },
      signInWithPassword: async (args: any) => { calls.signIn.push(args); return signInReply; },
      resetPasswordForEmail: async (...args: any[]) => {
        calls.recovery.push(args);
        if (recoveryException) throw recoveryException;
        return recoveryReply;
      },
      updateUser: async ({ password }: { password: string }) => { calls.passwordUpdates += 1; calls.passwordLength = password.length; return { error: updateUserError }; },
      signOut: async () => {
        calls.signOut += 1;
        authSession = null;
        authCallback?.('SIGNED_OUT', null);
        return { error: null };
      },
      getSession: async () => ({ data: { session: authSession }, error: null }),
      onAuthStateChange: (callback: (event: string, session: { user: User } | null) => void) => {
        authCallback = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => { calls.profileReads += 1; return { data: profile(), error: null }; } }),
      }),
    }),
    rpc: async (name: string, args: any) => {
      calls.rpc.push({ name, args });
      return { data: { worker_id: onboardingId }, error: null };
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    calls,
    setSignUp(reply: AuthReply) { signUpReply = reply; },
    setSignIn(reply: AuthReply) { signInReply = reply; },
    setRecovery(reply: { error: unknown }, exception: unknown = null) { recoveryReply = reply; recoveryException = exception; },
    setUpdateUserError(error: unknown) { updateUserError = error; },
    emitAuthEvent(event: string, session: { user: User } | null = { user }) { authSession = session; authCallback?.(event, session); },
    setProfileRole(role: 'worker' | 'contractor') { profileRole = role; },
    setOnboardingId(id: string) { onboardingId = id; },
  };
}

const user: User = { id: 'auth-user-1', email: baseParams.email, identities: [{ provider: 'email' }] };
const immediateSession = (): AuthReply => ({ data: { user, session: { user } }, error: null });
const pendingConfirmation = (): AuthReply => ({ data: { user, session: null }, error: null });

let passed = 0;
let total = 0;
async function test(name: string, run: () => Promise<void> | void) {
  total += 1;
  try {
    await run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}:`, error);
  }
}

await test('worker signup with immediate session provisions authenticated worker and safe redirect', async () => {
  const fake = makeClient();
  fake.setSignUp(immediateSession());
  const result = await new AuthService(fake.client, false).signUp(baseParams);
  assert.equal(result.success, true);
  assert.equal(result.success && result.state, 'authenticated');
  if (!result.success || result.state !== 'authenticated') throw new Error('Expected an authenticated worker result.');
  assert.equal(result.user.role, 'worker');
  assert.equal(fake.calls.signUp[0].options.data.signup_role, 'worker');
  assert.equal(fake.calls.signUp[0].options.emailRedirectTo, PRODUCTION_ORIGIN);
});

await test('contractor signup keeps constrained contractor role metadata', async () => {
  const fake = makeClient();
  fake.setSignUp(immediateSession());
  fake.setProfileRole('contractor');
  const result = await new AuthService(fake.client, false).signUp({ ...baseParams, role: 'contractor', organizationName: 'Narmada Infra' });
  if (!result.success || result.state !== 'authenticated') throw new Error('Expected an authenticated contractor result.');
  assert.equal(result.user.role, 'contractor');
  assert.equal(fake.calls.signUp[0].options.data.signup_role, 'contractor');
});

await test('signup accepted without a session returns confirmation-pending, not failure', async () => {
  const fake = makeClient();
  fake.setSignUp(pendingConfirmation());
  const service = new AuthService(fake.client, false);
  const result = await service.signUp(baseParams);
  assert.equal(result.success, true);
  if (!result.success || result.state !== 'confirmation_pending') throw new Error('Expected pending-confirmation success.');
  assert.equal(result.email, baseParams.email);
  assert.equal(service.getAuthState().isAuthenticated, false);
});

await test('email-send rate-limit code is matched specifically and not resent', async () => {
  const fake = makeClient();
  fake.setSignUp({ data: { user: null, session: null }, error: { code: 'over_email_send_rate_limit', status: 500, message: 'rate limit' } });
  const result = await new AuthService(fake.client, false).signUp(baseParams);
  assert.equal(result.success, false);
  assert.equal(result.success ? '' : result.kind, 'rate_limited');
  assert.match(result.success ? '' : result.error, /wait before trying again/i);
  assert.equal(fake.calls.signUp.length, 1);
});

await test('generic request rate-limit code and unclassified HTTP 429 stay generic', async () => {
  const coded = makeClient();
  coded.setSignUp({ data: { user: null, session: null }, error: { code: 'over_request_rate_limit', status: 429, message: 'request limit' } });
  const codedResult = await new AuthService(coded.client, false).signUp(baseParams);
  assert.equal(codedResult.success ? '' : codedResult.kind, 'rate_limited');
  assert.match(codedResult.success ? '' : codedResult.error, /authentication requests/i);
  assert.doesNotMatch(codedResult.success ? '' : codedResult.error, /confirmation emails/i);

  const unknown = makeClient();
  unknown.setSignUp({ data: { user: null, session: null }, error: { status: 429, message: 'too many requests' } });
  const unknownResult = await new AuthService(unknown.client, false).signUp(baseParams);
  assert.equal(unknownResult.success ? '' : unknownResult.kind, 'rate_limited');
  assert.match(unknownResult.success ? '' : unknownResult.error, /authentication requests/i);
  assert.doesNotMatch(unknownResult.success ? '' : unknownResult.error, /confirmation emails/i);
});

await test('recovery email rate limit maps safely without retrying or exposing backend text', async () => {
  const fake = makeClient();
  fake.setRecovery({ error: { code: 'over_email_send_rate_limit', status: 429, message: 'internal provider detail' } });
  const result = await new AuthService(fake.client, false).requestPasswordRecovery(baseParams.email);
  assert.equal(result.success, false);
  assert.match(result.message, /recovery emails/i);
  assert.doesNotMatch(result.message, /internal provider detail/i);
  assert.equal(fake.calls.recovery.length, 1);
  assert.equal(fake.calls.recovery[0][1].redirectTo, PRODUCTION_ORIGIN);
});

await test('recovery generic 429 and network exception return safe messages with no retry', async () => {
  const rateLimited = makeClient();
  rateLimited.setRecovery({ error: { status: 429, message: 'internal rate-limit details' } });
  const rateResult = await new AuthService(rateLimited.client, false).requestPasswordRecovery(baseParams.email);
  assert.equal(rateResult.success, false);
  assert.match(rateResult.message, /authentication requests/i);
  assert.doesNotMatch(rateResult.message, /internal rate-limit details/i);
  assert.equal(rateLimited.calls.recovery.length, 1);

  const networkFailure = makeClient();
  networkFailure.setRecovery({ error: null }, new Error('secret network endpoint details'));
  const networkResult = await new AuthService(networkFailure.client, false).requestPasswordRecovery(baseParams.email);
  assert.equal(networkResult.success, false);
  assert.match(networkResult.message, /could not process the password recovery request/i);
  assert.doesNotMatch(networkResult.message, /secret network endpoint details/i);
  assert.equal(networkFailure.calls.recovery.length, 1);
});

await test('PASSWORD_RECOVERY callback takes precedence and its marker survives a page refresh', async () => {
  recoveryStorage.clear();
  const location = (globalThis as any).window.location;
  location.search = '?code=opaque-pkce-code';
  location.hash = '#access_token=redacted-test-token&type=recovery';
  const initialUrl = `${location.search}${location.hash}`;
  const fake = makeClient();
  const callbackService = new AuthService(fake.client, true);
  fake.emitAuthEvent('PASSWORD_RECOVERY');
  assert.equal(callbackService.getAuthState().isPasswordRecovery, true);
  assert.equal(callbackService.getAuthState().isAuthenticated, false);
  assert.equal(fake.calls.profileReads, 0);
  assert.equal(recoveryStorage.get('shramsetu_password_recovery_active'), 'true');
  assert.equal(`${location.search}${location.hash}`, initialUrl, 'Auth callback URL remains intact until Supabase processes it');

  const refreshedService = new AuthService(fake.client, false);
  assert.equal(refreshedService.getAuthState().isPasswordRecovery, true);
  const updated = await refreshedService.updatePasswordFromRecovery('new-worker-password');
  assert.equal(updated.success, true);
  assert.equal(fake.calls.passwordUpdates, 1);
  assert.equal(fake.calls.passwordLength, 'new-worker-password'.length);
  assert.equal(refreshedService.getAuthState().isPasswordRecovery, true);
  assert.equal(refreshedService.getAuthState().passwordRecoveryCompleted, true);
  assert.equal(recoveryStorage.get('shramsetu_password_recovery_completed'), 'true');
  await refreshedService.dismissPasswordRecovery();
  assert.equal(refreshedService.getAuthState().isPasswordRecovery, false);
  assert.equal(recoveryStorage.has('shramsetu_password_recovery_active'), false);
  assert.equal(recoveryStorage.has('shramsetu_password_recovery_completed'), false);
  location.search = '';
  location.hash = '';
});

await test('expired recovery callbacks fail safely and unauthorized updates are rejected', async () => {
  recoveryStorage.clear();
  const location = (globalThis as any).window.location;
  location.search = '?error=access_denied&error_code=otp_expired&error_description=private-detail';
  location.hash = '';
  const expired = makeClient();
  const expiredService = new AuthService(expired.client, false);
  const state = expiredService.getAuthState();
  assert.equal(state.isPasswordRecovery, true);
  assert.match(state.passwordRecoveryError || '', /invalid or has expired/i);
  assert.doesNotMatch(state.passwordRecoveryError || '', /private-detail/i);
  const expiredResult = await expiredService.updatePasswordFromRecovery('new-worker-password');
  assert.equal(expiredResult.success, false);
  assert.equal(expired.calls.passwordUpdates, 0);

  location.search = '';
  const ordinary = makeClient();
  const ordinaryService = new AuthService(ordinary.client, false);
  const unauthorized = await ordinaryService.updatePasswordFromRecovery('new-worker-password');
  assert.equal(unauthorized.success, false);
  assert.equal(ordinary.calls.passwordUpdates, 0);

  const reused = makeClient();
  const reusedService = new AuthService(reused.client, true);
  reused.emitAuthEvent('PASSWORD_RECOVERY', null);
  const reusedResult = await reusedService.updatePasswordFromRecovery('new-worker-password');
  assert.equal(reusedResult.success, false);
  assert.match(reusedResult.message, /invalid or has expired/i);
  assert.equal(reused.calls.passwordUpdates, 0);
});

await test('duplicate recovery callbacks cannot trigger duplicate password updates', async () => {
  recoveryStorage.clear();
  const location = (globalThis as any).window.location;
  location.search = '';
  location.hash = '';
  const fake = makeClient();
  const service = new AuthService(fake.client, true);
  fake.emitAuthEvent('PASSWORD_RECOVERY');
  fake.emitAuthEvent('PASSWORD_RECOVERY');
  assert.equal(fake.calls.profileReads, 0);
  const results = await Promise.all([
    service.updatePasswordFromRecovery('new-worker-password'),
    service.updatePasswordFromRecovery('new-worker-password'),
  ]);
  assert.equal(results.filter((result) => result.success).length, 1);
  assert.equal(fake.calls.passwordUpdates, 1);
  assert.equal(service.getAuthState().passwordRecoveryCompleted, true);
  const repeated = await service.updatePasswordFromRecovery('new-worker-password');
  assert.equal(repeated.success, false);
  assert.equal(fake.calls.passwordUpdates, 1);
  await service.dismissPasswordRecovery();
});

await test('normal role-based dashboard redirects remain separate from recovery redirects', async () => {
  const userFor = (role: 'worker' | 'contractor') => ({ id: 'auth-user-1', fullName: 'Test', role } as any);
  assert.equal(getAuthRedirectRoute({ isAuthenticated: true, isJudgeDemo: false, user: userFor('worker'), isPasswordRecovery: false }, 'home'), 'worker');
  assert.equal(getAuthRedirectRoute({ isAuthenticated: true, isJudgeDemo: false, user: userFor('contractor'), isPasswordRecovery: false }, 'home'), 'contractor');
  assert.equal(getAuthRedirectRoute({ isAuthenticated: true, isJudgeDemo: false, user: userFor('worker'), isPasswordRecovery: true }, 'home'), null);
  assert.equal(getAuthRedirectRoute({ isAuthenticated: false, isJudgeDemo: false, user: null, isPasswordRecovery: false }, 'worker'), 'sign-in');
});

await test('genuine backend failures receive a safe non-technical message', async () => {
  const fake = makeClient();
  fake.setSignUp({ data: { user: null, session: null }, error: { status: 500, code: 'server_error', message: 'internal database detail' } });
  const result = await new AuthService(fake.client, false).signUp(baseParams);
  assert.equal(result.success, false);
  assert.equal(result.success ? '' : result.kind, 'backend');
  assert.doesNotMatch(result.success ? '' : result.error, /internal database detail/i);
  assert.match(result.success ? '' : result.error, /do not submit repeatedly/i);
});

await test('Supabase explicit already-registered error is distinguished', async () => {
  const fake = makeClient();
  fake.setSignUp({ data: { user: null, session: null }, error: { code: 'user_already_exists', message: 'User already registered' } });
  const result = await new AuthService(fake.client, false).signUp(baseParams);
  assert.equal(result.success, false);
  assert.equal(result.success ? '' : result.kind, 'already_registered');
});

await test('Supabase duplicate-user obfuscation is not shown as pending confirmation', async () => {
  const fake = makeClient();
  fake.setSignUp({ data: { user: { ...user, identities: [] }, session: null }, error: null });
  const result = await new AuthService(fake.client, false).signUp(baseParams);
  assert.equal(result.success, false);
  assert.equal(result.success ? '' : result.kind, 'already_registered');
});

await test('invalid credentials and unconfirmed email have separate safe messages', async () => {
  const fake = makeClient();
  const service = new AuthService(fake.client, false);
  fake.setSignIn({ data: { user: null, session: null }, error: { code: 'invalid_credentials', message: 'Invalid login credentials' } });
  const invalid = await service.signIn({ loginId: baseParams.email, password: baseParams.password });
  assert.equal(invalid.success, false);
  assert.equal(invalid.success ? '' : invalid.kind, 'invalid_credentials');
  fake.setSignIn({ data: { user: null, session: null }, error: { code: 'email_not_confirmed', message: 'Email not confirmed' } });
  const unconfirmed = await service.signIn({ loginId: baseParams.email, password: baseParams.password });
  assert.equal(unconfirmed.success, false);
  assert.equal(unconfirmed.success ? '' : unconfirmed.kind, 'email_unconfirmed');
});

await test('confirmed account can sign in and complete idempotent worker onboarding', async () => {
  const fake = makeClient();
  fake.setSignUp(pendingConfirmation());
  const service = new AuthService(fake.client, false);
  const signup = await service.signUp(baseParams);
  assert.equal(signup.success && signup.state, 'confirmation_pending');

  // Simulate successful email verification server-side, then sign in with that confirmed account.
  fake.setSignIn(immediateSession());
  const signin = await service.signIn({ loginId: baseParams.email, password: baseParams.password });
  assert.equal(signin.success, true);
  assert.equal(service.getAuthState().user?.role, 'worker');

  const first = await completeMyWorkerOnboarding(baseParams.trade!, 'skilled', fake.client);
  const retry = await completeMyWorkerOnboarding(baseParams.trade!, 'skilled', fake.client);
  assert.equal(first, 'WKR-AUTH-TEST');
  assert.equal(retry, first);
  assert.equal(fake.calls.rpc.length, 2);
  assert.equal(fake.calls.rpc[0].name, 'complete_my_worker_onboarding');
  assert.deepEqual(fake.calls.rpc[0].args, { p_trade: baseParams.trade, p_skill_level: 'skilled' });

  const rpcMigration = await readFile(new URL('../supabase/migrations/20261102120000_worker_onboarding_conflict_target_fix.sql', import.meta.url), 'utf8');
  assert.match(rpcMigration, /ON CONFLICT \(user_id\) DO NOTHING/);
  assert.match(rpcMigration, /ON CONFLICT ON CONSTRAINT worker_private_data_pkey DO NOTHING/);
});

await test('missing email is validation failure and makes no Auth request', async () => {
  const fake = makeClient();
  const result = await new AuthService(fake.client, false).signUp({ ...baseParams, email: '' });
  assert.equal(result.success, false);
  assert.equal(result.success ? '' : result.kind, 'validation');
  assert.match(result.success ? '' : result.error, /email is required/i);
  assert.equal(fake.calls.signUp.length, 0);
});

console.log(`\nAUTH REGISTRATION TESTS: ${passed}/${total} passed`);
if (passed !== total) process.exitCode = 1;

import React, { useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { auth } from '../../services/auth';
import { AppRoute } from '../../services/router';
import { Language } from '../../services/i18n';
import { AuthLayout } from './AuthLayout';

interface ResetPasswordProps {
  onNavigate: (route: AppRoute) => void;
  lang: Language;
  recoveryError: string | null;
  recoveryComplete: boolean;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ onNavigate, recoveryError, recoveryComplete }) => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const passwordWasUpdated = completed || recoveryComplete;

  const leaveRecovery = async (route: AppRoute) => {
    await auth.dismissPasswordRecovery();
    onNavigate(route);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Choose a password with at least 6 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await auth.updatePasswordFromRecovery(password);
      if (result.success) setCompleted(true);
      else setError(result.message);
    } catch {
      setError('We could not update your password right now. Request a new recovery link or contact support.');
    } finally {
      setIsLoading(false);
      setPassword('');
      setConfirmation('');
    }
  };

  return (
    <AuthLayout
      eyebrow="Secure account recovery"
      title={recoveryError ? 'Recovery link unavailable' : passwordWasUpdated ? 'Password updated' : 'Choose a new password'}
      subtitle={recoveryError
        ? 'For your security, this link cannot be used to change your password.'
        : passwordWasUpdated
          ? 'Your password has been changed. Sign in with the new password to continue.'
          : 'Enter and confirm a new password for your WURK UP account.'}
      icon={<KeyRound className="h-5 w-5" />}
      onNavigate={onNavigate}
      asideTitle="Your account stays protected."
      asidePoints={[
        'A valid Supabase recovery session is required to change your password',
        'Recovery links expire and can only be used for their intended account',
        'After resetting, sign in normally with your new password',
      ]}
    >
      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-[11.5px] text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {recoveryError ? (
        <div className="space-y-4">
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-[11.5px] text-rose-800">
            {recoveryError}
          </div>
          <button type="button" onClick={() => { void leaveRecovery('forgot-password'); }} className="btn btn-primary btn-lg w-full">
            Request a new recovery email <ArrowRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => { void leaveRecovery('sign-in'); }} className="w-full text-center text-[11.5px] font-bold text-forest-800 hover:underline">
            Back to sign in
          </button>
        </div>
      ) : passwordWasUpdated ? (
        <div className="space-y-4">
          <div role="status" className="flex items-start gap-2.5 rounded-xl border border-forest-200 bg-forest-50 p-3.5 text-[11.5px] text-forest-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" />
            <span>Your password has been updated. End this recovery session, then sign in with your new password.</span>
          </div>
          <button type="button" onClick={() => { void leaveRecovery('sign-in'); }} className="btn btn-primary btn-lg w-full">
            Continue to sign in <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="label">New password</label>
            <input id="new-password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="field" />
          </div>
          <div>
            <label htmlFor="confirm-password" className="label">Confirm new password</label>
            <input id="confirm-password" type="password" required minLength={6} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="field" />
          </div>
          <button type="submit" disabled={isLoading} className="btn btn-primary btn-lg w-full">
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</> : <>Update password <ArrowRight className="h-4 w-4" /></>}
          </button>
          <button type="button" onClick={() => { void leaveRecovery('forgot-password'); }} className="w-full text-center text-[11.5px] font-bold text-forest-800 hover:underline">
            Need a fresh recovery link?
          </button>
        </form>
      )}
    </AuthLayout>
  );
};

import React, { useState } from 'react';
import {
  KeyRound,
  Mail,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Phone,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { AppRoute } from '../../services/router';
import { Language } from '../../services/i18n';
import { APP_CONFIG } from '../../config';
import { AuthLayout } from './AuthLayout';

interface PasswordRecoveryProps {
  onNavigate: (route: AppRoute) => void;
  lang: Language;
}

export const PasswordRecovery: React.FC<PasswordRecoveryProps> = ({ onNavigate, lang }) => {
  // Bilingual helper: every user-facing string in this component is authored in
  // both languages, so a Hindi reader never sees an English fragment.
  const tr = (en: string, hi: string) => (lang === 'hi' ? hi : en);
  const [email, setEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setError(tr('Please provide a valid registered email address.', 'कृपया अपना पंजीकृत ईमेल पता सही-सही भरें।'));
      return;
    }

    setIsLoading(true);
    const res = await auth.requestPasswordRecovery(email.trim());
    setIsLoading(false);

    if (res.success) {
      setStatusMessage(res.message);
    } else {
      setError(
        res.message ||
          tr(
            'Unable to process the recovery request. Please try again.',
            'रीसेट अनुरोध पूरा नहीं हो सका। कृपया फिर से कोशिश करें।',
          ),
      );
    }
  };

  return (
    <AuthLayout
      eyebrow={tr('Account recovery', 'खाता पुनःप्राप्ति')}
      title={tr('Reset your password', 'अपना पासवर्ड रीसेट करें')}
      subtitle={tr(
        'Enter the email registered on your account and we will send recovery instructions.',
        'अपने खाते में पंजीकृत ईमेल दर्ज करें, हम रीसेट करने के निर्देश भेज देंगे।',
      )}
      icon={<KeyRound className="h-5 w-5" />}
      onNavigate={onNavigate}
      lang={lang}
      asideTitle={tr('Locked out? Your records are still safe.', 'लॉगिन नहीं हो पा रहा? आपके रिकॉर्ड सुरक्षित हैं।')}
      asidePoints={
        lang === 'hi'
          ? [
              'लॉगआउट करने पर शिफ्ट, मजदूरी और शिकायतें कभी नहीं मिटतीं',
              'साइन इन के लिए पंजीकृत ईमेल पता इस्तेमाल करें; मोबाइल नंबर से साइन इन की सुविधा चालू नहीं है।',
              'ईमेल उपलब्ध न हो तो हमारी हेल्पलाइन आपको व्यक्तिगत रूप से सत्यापित कर सकती है',
            ]
          : [
              'Shifts, wages and grievances are never deleted on sign-out',
              'Sign-in uses your registered email address; phone sign-in is not enabled',
              'Our helpline can verify you in person if email is unavailable',
            ]
      }
      footer={
        <div className="grid gap-2 sm:grid-cols-2">
          <a
            href={`tel:${APP_CONFIG.CONTACT_PHONE}`}
            className="flex items-center gap-2 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5 text-[11px] font-semibold text-ink-700 transition-colors hover:border-forest-300 hover:text-forest-800"
          >
            <Phone className="h-3.5 w-3.5 text-forest-700" />
            {APP_CONFIG.CONTACT_PHONE_DISPLAY}
          </a>
          <a
            href={APP_CONFIG.WHATSAPP_LINK}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5 text-[11px] font-semibold text-ink-700 transition-colors hover:border-forest-300 hover:text-forest-800"
          >
            <MessageCircle className="h-3.5 w-3.5 text-forest-700" />
            {tr('WhatsApp support', 'व्हाट्सएप सहायता')}
          </a>
        </div>
      }
    >
      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-[11.5px] text-rose-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          className="mb-4 flex items-start gap-2.5 rounded-xl border border-forest-200 bg-forest-50 p-3.5 text-[11.5px] text-forest-900"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="recovery-email" className="label">
            {tr('Registered email address', 'पंजीकृत ईमेल पता')}
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              id="recovery-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="field field-icon"
            />
          </div>
        </div>

        <button type="submit" disabled={isLoading} className="btn btn-primary btn-lg w-full">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {tr('Sending…', 'भेजा जा रहा है…')}
            </>
          ) : (
            <>
              {tr('Send recovery instructions', 'रीसेट निर्देश भेजें')}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        <p className="text-center text-[11.5px] text-ink-500">
          {tr('Remembered it?', 'याद आ गया?')}{' '}
          <button
            type="button"
            onClick={() => onNavigate('sign-in')}
            className="font-bold text-forest-800 hover:underline cursor-pointer"
          >
            {tr('Back to sign in', 'साइन इन पर वापस')}
          </button>
        </p>
      </form>
    </AuthLayout>
  );
};

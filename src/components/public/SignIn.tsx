import React, { useState, useEffect } from 'react';
import { LogIn, ArrowRight, AlertCircle, Phone, Lock, Sparkles, Eye, EyeOff, Loader2 } from 'lucide-react';
import { auth } from '../../services/auth';
import { AppRoute } from '../../services/router';
import { Language } from '../../services/i18n';
import { AuthLayout } from './AuthLayout';

interface SignInProps {
  onNavigate: (route: AppRoute) => void;
  lang: Language;
  onEnterJudgeDemo: () => void;
}

export const SignIn: React.FC<SignInProps> = ({ onNavigate, onEnterJudgeDemo, lang }) => {
  // Bilingual helper: every user-facing string in this component is authored in
  // both languages, so a Hindi reader never sees an English fragment.
  const tr = (en: string, hi: string) => (lang === 'hi' ? hi : en);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const remembered = auth.getRememberedLoginId();
    if (remembered) {
      setLoginId(remembered);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!loginId.trim()) {
      setError(
        tr(
          'Please enter your registered mobile number or email address.',
          'कृपया अपना पंजीकृत मोबाइल नंबर या ईमेल पता भरें।',
        ),
      );
      return;
    }

    setIsLoading(true);
    const res = await auth.signIn({
      loginId: loginId.trim(),
      password,
      rememberMe,
    });
    setIsLoading(false);

    if (res.success && res.user) {
      onNavigate(res.user.role === 'worker' ? 'worker' : 'contractor');
    } else {
      setError(
        res.error || tr('Sign in failed. Please check your credentials.', 'साइन इन नहीं हो सका। कृपया अपनी जानकारी जाँचें।'),
      );
    }
  };

  return (
    <AuthLayout
      eyebrow={tr('Welcome back', 'फिर से स्वागत है')}
      title={tr('Sign in to your portal', 'अपने पोर्टल में साइन इन करें')}
      subtitle={tr(
        'Access your verified work records, wage khata and approval requests.',
        'अपने सत्यापित कार्य रिकॉर्ड, मजदूरी खाता और मंज़ूरी अनुरोध देखें।',
      )}
      icon={<LogIn className="h-5 w-5" />}
      onNavigate={onNavigate}
      lang={lang}
      asideTitle={tr(
        'Your records are waiting exactly where you left them.',
        'आपके रिकॉर्ड वहीं सुरक्षित हैं जहाँ आपने छोड़े थे।',
      )}
      asidePoints={
        lang === 'hi'
          ? [
              'हर स्वीकृत शिफ्ट और भुगतान, एक ही समयरेखा में',
              'साइन आउट करने पर कुछ भी नहीं मिटता',
              'ऑफ़लाइन भी चलता है, कनेक्शन आते ही सिंक हो जाता है',
              'हिंदी और अंग्रेज़ी दोनों में उपलब्ध',
            ]
          : [
              'Every approved shift and payment, in one timeline',
              'Nothing is deleted when you sign out',
              'Works offline and syncs when you reconnect',
              'Available in Hindi and English',
            ]
      }
      footer={
        <div className="rounded-2xl border border-brass-200/80 bg-brass-50/70 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brass-200/70 text-brass-800">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11.5px] font-bold text-brass-900">
                {tr('Senior Bal Vigyan judge evaluation', 'सीनियर बाल विज्ञान जज मूल्यांकन')}
              </p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-brass-800/80">
                {tr(
                  'Tour the pre-populated Indore dataset without creating an account.',
                  'बिना खाता बनाए इंदौर का तैयार डेटा देखें।',
                )}
              </p>
              <button
                onClick={onEnterJudgeDemo}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-brass-500 px-3 py-1.5 text-[10.5px] font-bold text-ink-950 transition-colors hover:bg-brass-400 cursor-pointer"
              >
                {tr('Launch judge demo', 'जज डेमो खोलें')}
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      }
    >
      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-[11.5px] text-rose-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-id" className="label">
            {tr('Mobile number or email', 'मोबाइल नंबर या ईमेल')}
          </label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              id="login-id"
              type="text"
              required
              autoComplete="username"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="+91 98260 12345 or name@example.com"
              className="field field-icon"
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="login-password" className="label mb-0">
              {tr('Password', 'पासवर्ड')}
            </label>
            <button
              type="button"
              onClick={() => onNavigate('forgot-password')}
              className="text-[10.5px] font-semibold text-forest-800 transition-colors hover:text-forest-900 hover:underline cursor-pointer"
            >
              {tr('Forgot password?', 'पासवर्ड भूल गए?')}
            </button>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tr('Enter your password', 'अपना पासवर्ड दर्ज करें')}
              className="field field-icon pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword
                  ? tr('Hide password', 'पासवर्ड छिपाएँ')
                  : tr('Show password', 'पासवर्ड दिखाएँ')
              }
              className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-sand-100 hover:text-ink-700 cursor-pointer"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-ink-300 text-forest-700 accent-forest-700 focus:ring-forest-600"
            />
            <span className="text-[11px] text-ink-500">{tr('Remember my login ID', 'मेरा लॉगिन आईडी याद रखें')}</span>
          </label>
          <span className="text-[10px] text-ink-300">{tr('Password is never saved', 'पासवर्ड कभी सहेजा नहीं जाता')}</span>
        </div>

        <button type="submit" disabled={isLoading} className="btn btn-primary btn-lg w-full">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {tr('Verifying…', 'जाँच हो रही है…')}
            </>
          ) : (
            <>
              {tr('Sign in', 'साइन इन')}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        <p className="pt-1 text-center text-[11.5px] text-ink-500">
          {tr('New to WurkUp?', 'WurkUp पर नए हैं?')}{' '}
          <button
            type="button"
            onClick={() => onNavigate('create-account')}
            className="font-bold text-forest-800 hover:underline cursor-pointer"
          >
            {tr('Create an account', 'खाता बनाएँ')}
          </button>
        </p>
      </form>
    </AuthLayout>
  );
};

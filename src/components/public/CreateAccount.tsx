import React, { useMemo, useState } from 'react';
import {
  Users,
  Building2,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Phone,
  Lock,
  User,
  Briefcase,
  Mail,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { auth, SignUpParams } from '../../services/auth';
import { AppRoute } from '../../services/router';
import { Language } from '../../services/i18n';
import { AuthLayout } from './AuthLayout';

interface CreateAccountProps {
  onNavigate: (route: AppRoute) => void;
  lang: Language;
}

const TRADES = [
  'Head Mason (मुख्य राजमिस्त्री)',
  'Steel Binder & Rigging Helper (सरिया बाइंडर)',
  'Site Electrician & Cable Jointer (साइट इलेक्ट्रीशियन)',
  'General Helper & Concrete Batching (बेलदार)',
  'Tile Grinding & Surface Polisher (फिनिशिंग)',
  'Carpenter & Shuttering (शटरिंग बढ़ई)',
  'Plumber & Pipe Fitter (प्लंबर)',
  'Painter & Putty Applicator (पेंटर)',
];

export const CreateAccount: React.FC<CreateAccountProps> = ({ onNavigate, lang }) => {
  // Bilingual helper: every user-facing string in this component is authored in
  // both languages, so a Hindi reader never sees an English fragment.
  const tr = (en: string, hi: string) => (lang === 'hi' ? hi : en);
  const [accountType, setAccountType] = useState<'worker' | 'contractor'>('worker');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [trade, setTrade] = useState(TRADES[0]);
  const [organizationName, setOrganizationName] = useState('');
  const [consentToShareContact, setConsentToShareContact] = useState(true);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // Status
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const passwordScore = useMemo(() => {
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[0-9]/.test(password) && /[a-zA-Z]/.test(password)) score += 1;
    return score;
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }

    if (!phone || phone.replace(/\D/g, '').length < 10) {
      setError('Please provide a valid 10-digit mobile number with country code.');
      return;
    }

    if (!email.trim() && accountType === 'contractor') {
      setError('Contractors must provide a work email address for audit correspondence.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Please choose a secure password (minimum 6 characters).');
      return;
    }

    if (!privacyAccepted) {
      setError('You must accept the WurkUp privacy terms and data use policy.');
      return;
    }

    setIsLoading(true);

    const params: SignUpParams = {
      role: accountType,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      password,
      trade: accountType === 'worker' ? trade : undefined,
      organizationName: accountType === 'contractor' ? organizationName.trim() : undefined,
      consentToShareContact,
      privacyAccepted,
    };

    const res = await auth.signUp(params);
    setIsLoading(false);

    if (res.success && res.user) {
      onNavigate(res.user.role === 'worker' ? 'worker' : 'contractor');
    } else {
      setError(
        res.error || tr('Failed to create account. Please verify details.', 'खाता नहीं बन सका। कृपया विवरण जाँचें।'),
      );
    }
  };

  return (
    <AuthLayout
      eyebrow={tr('Create account', 'खाता बनाएँ')}
      title={tr('Set up your WurkUp record', 'अपना WurkUp रिकॉर्ड बनाएँ')}
      subtitle={tr(
        'One account, a permanent QR pass, and a wage ledger you can show to any authority.',
        'एक खाता, एक स्थायी QR पास, और मजदूरी की बही — जो आप किसी भी अधिकारी को दिखा सकते हैं।',
      )}
      icon={<ShieldCheck className="h-5 w-5" />}
      onNavigate={onNavigate}
      lang={lang}
      width="lg"
      asideTitle={tr(
        'Two minutes now saves a season of arguments later.',
        'अभी दो मिनट लगाएँ, आगे पूरे सीज़न की बहस बचाएँ।',
      )}
      asidePoints={
        lang === 'hi'
          ? [
              'कामगारों के लिए हमेशा मुफ़्त',
              'आधार नंबर न लिया जाता है, न छापा जाता है',
              'रिकॉर्ड पहले फ़ोन में सुरक्षित, फिर सिंक होते हैं',
              'कभी भी डेटा निर्यात करें या हटवाएँ',
            ]
          : [
              'Free for workers — permanently',
              'No Aadhaar number collected or printed',
              'Records stored locally first, then synced',
              'Cancel or export your data at any time',
            ]
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

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Role selector */}
        <fieldset>
          <legend className="label">{tr('I am registering as', 'मैं पंजीकरण कर रहा/रही हूँ')}</legend>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: 'worker' as const,
                icon: Users,
                title: tr('Worker', 'कामगार'),
                hint: tr('Daily wage, artisan, mason, helper', 'दिहाड़ी, कारीगर, राजमिस्त्री, हेल्पर'),
              },
              {
                id: 'contractor' as const,
                icon: Building2,
                title: tr('Contractor', 'ठेकेदार'),
                hint: tr('Builder, site engineer, supervisor', 'बिल्डर, साइट इंजीनियर, सुपरवाइज़र'),
              },
            ].map((option) => {
              const Icon = option.icon;
              const active = accountType === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAccountType(option.id)}
                  aria-pressed={active}
                  className={`group relative overflow-hidden rounded-2xl border-2 p-3.5 text-left transition-all duration-300 cursor-pointer ${
                    active
                      ? option.id === 'worker'
                        ? 'border-forest-700 bg-forest-50/70 shadow-soft'
                        : 'border-ink-800 bg-sand-100/70 shadow-soft'
                      : 'border-sand-200 bg-white hover:border-ink-200 hover:bg-sand-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-xl transition-colors ${
                        active
                          ? option.id === 'worker'
                            ? 'bg-forest-800 text-white'
                            : 'bg-ink-950 text-white'
                          : 'bg-sand-100 text-ink-500'
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    {active && (
                      <CheckCircle2
                        className={`h-4.5 w-4.5 ${
                          option.id === 'worker' ? 'text-forest-700' : 'text-ink-900'
                        }`}
                      />
                    )}
                  </div>
                  <span className="mt-3 block text-[13px] font-bold text-ink-900">{option.title}</span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-ink-400">
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Full name */}
          <div className="sm:col-span-2">
            <label htmlFor="full-name" className="label">
              {tr('Full legal name', 'पूरा कानूनी नाम')} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                id="full-name"
                type="text"
                required
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={
                  accountType === 'worker'
                    ? tr('e.g. Rameshwar Lal Ahirwar', 'जैसे रामेश्वर लाल अहिरवार')
                    : tr('e.g. Anil Sisodiya', 'जैसे अनिल सिसोदिया')
                }
                className="field field-icon"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="label">
              {tr('Mobile number', 'मोबाइल नंबर')} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                id="phone"
                type="tel"
                required
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98260 12345"
                className="field field-icon font-mono"
              />
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-ink-400">
              {tr(
                'Used only for mutual contact checks — never printed on the QR pass.',
                'सिर्फ़ आपसी संपर्क पुष्टि के लिए — QR पास पर कभी नहीं छपता।',
              )}
            </p>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="label">
              {tr('Email address', 'ईमेल पता')}{' '}
              {accountType === 'contractor' ? (
                <span className="text-rose-500">*</span>
              ) : (
                <span className="font-medium text-ink-400">{tr('(optional)', '(वैकल्पिक)')}</span>
              )}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                required={accountType === 'contractor'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="field field-icon"
              />
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-ink-400">
              {accountType === 'contractor'
                ? tr(
                    'Required for audit correspondence and account recovery.',
                    'ऑडिट पत्राचार और खाता पुनःप्राप्ति के लिए ज़रूरी।',
                  )
                : tr(
                    'Add one to recover your account without a phone call.',
                    'जोड़ें, ताकि बिना फ़ोन किए भी खाता वापस मिल सके।',
                  )}
            </p>
          </div>

          {/* Password */}
          <div className={accountType === 'worker' ? '' : 'sm:col-span-2'}>
            <label htmlFor="new-password" className="label">
              {tr('Password', 'पासवर्ड')} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tr('Minimum 6 characters', 'कम से कम 6 अक्षर')}
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
            <div className="mt-2 flex items-center gap-1.5" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                    passwordScore > i
                      ? passwordScore === 1
                        ? 'bg-rose-400'
                        : passwordScore === 2
                          ? 'bg-brass-400'
                          : 'bg-forest-500'
                      : 'bg-sand-200'
                  }`}
                />
              ))}
              <span className="ml-1 text-[9.5px] font-semibold text-ink-400">
                {password.length === 0
                  ? 'Not set'
                  : passwordScore <= 1
                    ? 'Weak'
                    : passwordScore === 2
                      ? 'Fair'
                      : 'Strong'}
              </span>
            </div>
          </div>

          {/* Worker: trade */}
          {accountType === 'worker' && (
            <div>
              <label htmlFor="trade" className="label">
                Trade or work category
              </label>
              <div className="relative">
                <Briefcase className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <select
                  id="trade"
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  className="field field-icon appearance-none bg-white pr-9"
                >
                  {TRADES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400">
                  ▾
                </span>
              </div>
            </div>
          )}

          {/* Contractor: organisation */}
          {accountType === 'contractor' && (
            <div className="sm:col-span-2">
              <label htmlFor="organization" className="label">
                {tr('Firm / agency name', 'फ़र्म / एजेंसी का नाम')}
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  id="organization"
                  type="text"
                  autoComplete="organization"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder={tr('e.g. Narmada Infra Engineering Ltd.', 'जैसे नर्मदा इंफ्रा इंजीनियरिंग लि.')}
                  className="field field-icon"
                />
              </div>
            </div>
          )}
        </div>

        {/* Consent */}
        <div className="space-y-3 rounded-2xl border border-sand-200 bg-sand-50/70 p-4">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={consentToShareContact}
              onChange={(e) => setConsentToShareContact(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-ink-300 accent-forest-700 focus:ring-forest-600"
            />
            <span className="text-[11px] leading-relaxed text-ink-600">
              {tr(
                'I consent to sharing my registered mobile number with my authorised workplace counterpart for manual shift cross-checks.',
                'मैं अपना पंजीकृत मोबाइल नंबर अपने अधिकृत कार्यस्थल साथी के साथ साझा करने की सहमति देता/देती हूँ, ताकि शिफ्ट की मैनुअल पुष्टि हो सके।',
              )}
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              required
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-ink-300 accent-forest-700 focus:ring-forest-600"
            />
            <span className="text-[11px] leading-relaxed text-ink-600">
              {tr('I agree to the', 'मैं सहमत हूँ')}{' '}
              <button
                type="button"
                onClick={() => onNavigate('privacy')}
                className="font-semibold text-forest-800 underline decoration-forest-300 underline-offset-2 hover:text-forest-900 cursor-pointer"
              >
                {tr('Privacy and Data Use Policy', 'गोपनीयता एवं डेटा उपयोग नीति')}
              </button>
              {tr(
                '. My shift and wage records will be maintained under Madhya Pradesh labour welfare standards.',
                '। मेरे शिफ्ट और मजदूरी रिकॉर्ड मध्य प्रदेश श्रम कल्याण मानकों के तहत रखे जाएँगे।',
              )}
            </span>
          </label>
        </div>

        <button type="submit" disabled={isLoading} className="btn btn-primary btn-lg w-full">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {tr('Creating your account…', 'आपका खाता बन रहा है…')}
            </>
          ) : (
            <>
              {tr('Register as', 'पंजीकरण करें')}{' '}
              {accountType === 'worker' ? tr('worker', 'कामगार') : tr('contractor', 'ठेकेदार')}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        <p className="text-center text-[11.5px] text-ink-500">
          {tr('Already registered?', 'पहले से पंजीकृत हैं?')}{' '}
          <button
            type="button"
            onClick={() => onNavigate('sign-in')}
            className="font-bold text-forest-800 hover:underline cursor-pointer"
          >
            {tr('Sign in instead', 'साइन इन करें')}
          </button>
        </p>
      </form>
    </AuthLayout>
  );
};

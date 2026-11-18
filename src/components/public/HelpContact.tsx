import React, { useState } from 'react';
import {
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Send,
  CheckCircle2,
  ShieldAlert,
  Clock,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { AppRoute } from '../../services/router';
import { Language } from '../../services/i18n';
import { APP_CONFIG } from '../../config';
import { PageHeader } from '../ui/PageHeader';
import { Reveal } from '../ui/Reveal';
import { LanguageNotice } from '../ui/LanguageNotice';
import { Accordion, AccordionItem } from '../ui/Accordion';

interface HelpContactProps {
  onNavigate: (route: AppRoute) => void;
  lang: Language;
}

type Tr = (en: string, hi: string) => string;

const buildCategories = (tr: Tr) => [
  { value: 'wage_dispute', label: tr('Unpaid or underpaid wages', 'बकाया या कम मजदूरी') },
  { value: 'qr_pass', label: tr('Smart Shram Pass help', 'स्मार्ट श्रम पास सहायता') },
  {
    value: 'contractor_onboarding',
    label: tr('Contractor compliance & muster integration', 'ठेकेदार अनुपालन और हाजिरी जोड़ना'),
  },
  {
    value: 'bal_vigyan',
    label: tr('Senior Bal Vigyan exhibit inquiry', 'सीनियर बाल विज्ञान प्रदर्शनी पूछताछ'),
  },
  { value: 'general', label: tr('General support', 'सामान्य सहायता') },
];

/** FAQ copy is authored in both languages; the answers keep their bold mid-sentence labels. */
const buildQuickHelp = (tr: Tr): AccordionItem[] => [
  {
    question: tr(
      'I worked but the contractor did not record my shift. What now?',
      'मैंने काम किया पर ठेकेदार ने मेरी शिफ्ट दर्ज नहीं की। अब क्या करें?',
    ),
    answer: (
      <>
        {tr(
          'Do not sign anything. Call the helpline and note the date, site name and supervisor. If your contractor is on WurkUp, an approval request will appear on your account — approving it is what creates the record. If they are not, we record the grievance in WurkUp so you have a dated, documented trail. That record is not a filing with any government office.',
          'किसी कागज़ पर हस्ताक्षर न करें। हेल्पलाइन पर कॉल करें और तारीख, साइट का नाम तथा सुपरवाइज़र लिख लें। अगर आपका ठेकेदार WurkUp पर है, तो आपके खाते में मंज़ूरी अनुरोध आएगा — उसे स्वीकार करने से ही रिकॉर्ड बनता है। अगर नहीं है, तो हम शिकायत WurkUp में दर्ज करते हैं, ताकि आपके पास तारीख-सहित लिखित रिकॉर्ड रहे। यह रिकॉर्ड किसी सरकारी कार्यालय में दायर शिकायत नहीं है।',
        )}
      </>
    ),
  },
  {
    question: tr('My pass QR code will not scan at the site.', 'साइट पर मेरा पास QR स्कैन नहीं हो रहा।'),
    answer: (
      <>
        {tr(
          'Reprint the pass from your portal — do not photocopy a photocopy, as contrast degrades. Ask the supervisor to scan in daylight and hold the phone 15–20 cm away. The pass can always be typed in manually using the reference code printed under the QR.',
          'पोर्टल से पास दोबारा प्रिंट करें — फोटोकॉपी की फोटोकॉपी न करें, क्योंकि कंट्रास्ट कम हो जाता है। सुपरवाइज़र से दिन की रोशनी में, फ़ोन 15–20 सेमी दूर रखकर स्कैन करने को कहें। QR के नीचे छपे संदर्भ कोड से पास हमेशा हाथ से भी दर्ज किया जा सकता है।',
        )}
      </>
    ),
  },
  {
    question: tr('Can I use WurkUp without a smartphone?', 'क्या बिना स्मार्टफ़ोन WurkUp चला सकते हैं?'),
    answer: (
      <>
        {tr(
          'Yes. The QR pass prints on paper and can be scanned by the contractor’s phone. For approvals and wage acknowledgements, a family member or a site coordinator can assist under your registered number — or use the helpline.',
          'हाँ। QR पास कागज़ पर छपता है और ठेकेदार का फ़ोन उसे स्कैन कर सकता है। मंज़ूरी और मजदूरी की पावती के लिए परिवार का कोई सदस्य या साइट समन्वयक आपके पंजीकृत नंबर पर सहायता कर सकता है — या हेल्पलाइन का उपयोग करें।',
        )}
      </>
    ),
  },
  {
    question: tr(
      'How do I correct a wrong entry in my wage khata?',
      'मजदूरी खाते में गलत प्रविष्टि कैसे सुधारें?',
    ),
    answer: (
      <>
        {tr('Open the entry in', 'प्रविष्टि खोलें')} <strong>{tr('Wages & Payments', 'मजदूरी और भुगतान')}</strong>{' '}
        {tr(
          'and raise a dispute instead of editing it. Corrections are appended as new signed events so the original entry stays visible — that is what makes the record credible to an auditor.',
          'में और उसे बदलने के बजाय विवाद दर्ज करें। सुधार नई हस्ताक्षरित प्रविष्टियों के रूप में जुड़ते हैं, इसलिए मूल प्रविष्टि दिखती रहती है — इसी से रिकॉर्ड ऑडिटर के लिए विश्वसनीय बनता है।',
        )}
      </>
    ),
  },
];

export const HelpContact: React.FC<HelpContactProps> = ({ onNavigate, lang }) => {
  // Bilingual helper: every user-facing string in this component is authored in
  // both languages, so a Hindi reader never sees an English fragment.
  const tr = (en: string, hi: string) => (lang === 'hi' ? hi : en);
  const categories = buildCategories(tr);
  const quickHelp = buildQuickHelp(tr);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [subject, setSubject] = useState('wage_dispute');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(tr('Please tell us your name so we can address you correctly.', 'कृपया अपना नाम बताएँ, ताकि हम आपको सही ढंग से संबोधित कर सकें।'));
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setError(
        tr(
          'Please enter a valid 10-digit mobile number so we can call you back.',
          'कृपया 10 अंकों का सही मोबाइल नंबर भरें, ताकि हम आपको वापस कॉल कर सकें।',
        ),
      );
      return;
    }
    if (message.trim().length < 12) {
      setError(
        tr(
          'Please describe the issue in at least a sentence — site, dates and amount help us act faster.',
          'कृपया समस्या कम से कम एक वाक्य में बताएँ — साइट, तारीखें और राशि से हमें जल्दी कार्रवाई में मदद मिलती है।',
        ),
      );
      return;
    }

    setIsSending(true);

    // Local-first: the inquiry is retained on-device for the support desk.
    try {
      const key = 'shramsetu_support_inquiries';
      const existing = JSON.parse(window.localStorage.getItem(key) || '[]');
      existing.unshift({
        id: `INQ-${Date.now().toString(36).toUpperCase()}`,
        name: name.trim(),
        phone: phone.trim(),
        category: subject,
        message: message.trim(),
        createdAt: new Date().toISOString(),
      });
      window.localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
    } catch {
      // Storage may be unavailable in private mode — the confirmation still stands.
    }

    window.setTimeout(() => {
      setIsSending(false);
      setIsSent(true);
      setName('');
      setPhone('+91 ');
      setMessage('');
    }, 700);
  };

  return (
    <div className="pb-4">
      <LanguageNotice lang={lang} />

      <PageHeader
        eyebrow={tr('Support', 'सहायता')}
        icon={<Phone className="h-5 w-5" />}
        title={tr('Help, support & a real human on the line', 'सहायता, समर्थन और सीधे एक इंसान से बात')}
        description={tr(
          'A wage problem does not keep office hours, so neither does our intent. Call, message on WhatsApp, or write below — every inquiry reaches a coordinator.',
          'मजदूरी की समस्या कार्यालय के समय नहीं देखती, इसलिए हमारा इरादा भी नहीं। कॉल करें, व्हाट्सएप पर संदेश भेजें, या नीचे लिखें — हर पूछताछ समन्वयक तक पहुँचती है।',
        )}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={`tel:${APP_CONFIG.CONTACT_PHONE}`}
            className="btn btn-primary btn-sm"
          >
            <Phone className="h-3.5 w-3.5" />
            {APP_CONFIG.CONTACT_PHONE_DISPLAY}
          </a>
          <a
            href={APP_CONFIG.WHATSAPP_LINK}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline btn-sm"
          >
            <MessageCircle className="h-3.5 w-3.5 text-forest-700" />
            {tr('WhatsApp support', 'व्हाट्सएप सहायता')}
          </a>
        </div>
      </PageHeader>

      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-10">
        {/* Contact rail */}
        <div className="space-y-4">
          <Reveal direction="left">
            <a
              href={`tel:${APP_CONFIG.CONTACT_PHONE}`}
              className="group flex items-start gap-4 rounded-2xl border border-sand-200 bg-white p-5 shadow-soft transition-all duration-400 hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-lift"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-forest-600 to-forest-800 text-white shadow-[0_12px_24px_-14px_rgba(22,58,43,0.9)]">
                <Phone className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-ink-400">
                  {tr('Worker helpline', 'कामगार हेल्पलाइन')}
                </span>
                <span className="mt-0.5 block font-mono text-[15px] font-bold text-ink-950 transition-colors group-hover:text-forest-800">
                  {APP_CONFIG.CONTACT_PHONE_DISPLAY}
                </span>
                <p className="mt-1 text-[11px] leading-snug text-ink-500">
                  {tr(
                    'Muster disputes, withheld wages, or pass trouble.',
                    'हाजिरी विवाद, रोकी गई मजदूरी, या पास से जुड़ी परेशानी।',
                  )}
                </p>
              </div>
            </a>
          </Reveal>

          <Reveal direction="left" delay={70}>
            <a
              href={APP_CONFIG.WHATSAPP_LINK}
              target="_blank"
              rel="noreferrer"
              className="group flex items-start gap-4 rounded-2xl border border-sand-200 bg-white p-5 shadow-soft transition-all duration-400 hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-lift"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-forest-700 text-white">
                <MessageCircle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-ink-400">
                  {tr('WhatsApp assistant', 'व्हाट्सएप सहायक')}
                </span>
                <span className="mt-0.5 block font-mono text-[14px] font-bold text-ink-950 transition-colors group-hover:text-forest-800">
                  wa.me/{APP_CONFIG.WHATSAPP_NUMBER}
                </span>
                <p className="mt-1 text-[11px] leading-snug text-ink-500">
                  {tr(
                    'Send muster photos or get audio guidance in Hindi.',
                    'हाजिरी की फ़ोटो भेजें या हिंदी में ऑडियो मार्गदर्शन पाएँ।',
                  )}
                </p>
              </div>
            </a>
          </Reveal>

          <Reveal direction="left" delay={140}>
            <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">
                <Clock className="h-3.5 w-3.5" />
                {tr('Response windows', 'जवाब मिलने का समय')}
              </div>
              <dl className="mt-3 space-y-2 text-[11.5px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-500">{tr('Phone & WhatsApp', 'फ़ोन और व्हाट्सएप')}</dt>
                  <dd className="font-semibold text-ink-900">{tr('Mon–Sat · 9am–7pm', 'सोम–शनि · सुबह 9 – शाम 7')}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-500">{tr('Written inquiries', 'लिखित पूछताछ')}</dt>
                  <dd className="font-semibold text-ink-900">{tr('Within 24 hours', '24 घंटे के भीतर')}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-500">{tr('Urgent wage withholding', 'मजदूरी रोके जाने की तत्काल शिकायत')}</dt>
                  <dd className="font-semibold text-forest-800">{tr('Same day', 'उसी दिन')}</dd>
                </div>
              </dl>
            </div>
          </Reveal>

          <Reveal direction="left" delay={210}>
            <div className="rounded-2xl border border-brass-200 bg-brass-50/70 p-5">
              <div className="flex items-center gap-2 text-[11px] font-bold text-brass-900">
                <MapPin className="h-4 w-4" />
                {tr('Exhibit & innovation centre', 'प्रदर्शनी और नवाचार केंद्र')}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-brass-900/80">
                {tr(
                  'Senior Bal Vigyan Project, Division II — Applied Digital Solutions.',
                  'सीनियर बाल विज्ञान परियोजना, प्रभाग II — एप्लाइड डिजिटल सॉल्यूशंस।',
                )}
                <br />
                {tr(
                  'Indore District, Madhya Pradesh, India.',
                  'इंदौर ज़िला, मध्य प्रदेश, भारत।',
                )}
                <br />
                {tr(
                  'Aligned with the MP Building & Other Construction Workers Welfare Board.',
                  'एमपी भवन एवं अन्य निर्माण श्रमिक कल्याण बोर्ड के अनुरूप।',
                )}
              </p>
              <a
                href={`mailto:${APP_CONFIG.SUPPORT_EMAIL}`}
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-brass-800 underline decoration-brass-300 underline-offset-2 hover:text-brass-900"
              >
                <Mail className="h-3.5 w-3.5" />
                {APP_CONFIG.SUPPORT_EMAIL}
              </a>
            </div>
          </Reveal>

          <Reveal direction="left" delay={280}>
            <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <p className="text-[10.5px] leading-relaxed text-rose-900/85">
                <strong className="font-bold">
                  {tr('In an emergency or unsafe site, call 112.', 'आपात स्थिति या असुरक्षित साइट पर 112 पर कॉल करें।')}
                </strong>{' '}
                {tr(
                  'For a formal labour complaint, the District Labour Officer, Indore can register it independently of this platform.',
                  'औपचारिक श्रम शिकायत के लिए इंदौर के ज़िला श्रम अधिकारी इस प्लेटफ़ॉर्म से अलग, स्वतंत्र रूप से उसे दर्ज कर सकते हैं।',
                )}
              </p>
            </div>
          </Reveal>
        </div>

        {/* Form + FAQ */}
        <div className="space-y-6">
          <Reveal direction="right">
            <div className="rounded-[1.5rem] border border-sand-200 bg-white p-6 shadow-soft sm:p-8">
              {isSent ? (
                <div className="py-6 text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-forest-50 text-forest-700 ring-8 ring-forest-50/50">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h2 className="mt-5 text-[1.25rem] text-ink-950">
                    {tr('Inquiry recorded', 'पूछताछ दर्ज हो गई')}
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-[12px] leading-relaxed text-ink-500">
                    {tr(
                      'Your message is stored on this device for the support desk. A coordinator will call the number you provided — usually the same working day.',
                      'आपका संदेश सहायता डेस्क के लिए इस डिवाइस पर सुरक्षित है। एक समन्वयक आपके दिए नंबर पर कॉल करेंगे — आमतौर पर उसी कार्यदिवस में।',
                    )}
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                    <button onClick={() => setIsSent(false)} className="btn btn-outline btn-sm">
                      {tr('Send another message', 'और संदेश भेजें')}
                    </button>
                    <button
                      onClick={() => onNavigate('how-it-works')}
                      className="btn btn-primary btn-sm"
                    >
                      {tr('Read how it works', 'यह कैसे काम करता है पढ़ें')}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[1.25rem] leading-snug text-ink-950">
                        {tr('Send a message or report an issue', 'संदेश भेजें या समस्या दर्ज करें')}
                      </h2>
                      <p className="mt-1 text-[11.5px] text-ink-500">
                        {tr(
                          'Our team and labour-welfare volunteers respond within 24 hours.',
                          'हमारी टीम और श्रम कल्याण स्वयंसेवक 24 घंटे के भीतर जवाब देते हैं।',
                        )}
                      </p>
                    </div>
                    <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand-100 text-forest-700 sm:grid">
                      <Send className="h-4.5 w-4.5" />
                    </span>
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-[11.5px] text-rose-800"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="help-name" className="label">
                          {tr('Your name', 'आपका नाम')}
                        </label>
                        <input
                          id="help-name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={tr('e.g. Santosh Verma', 'जैसे संतोष वर्मा')}
                          className="field"
                          autoComplete="name"
                        />
                      </div>
                      <div>
                        <label htmlFor="help-phone" className="label">
                          {tr('Mobile number', 'मोबाइल नंबर')}
                        </label>
                        <input
                          id="help-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98260 12345"
                          className="field font-mono"
                          autoComplete="tel"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="help-subject" className="label">
                        {tr('What is this about?', 'यह किस बारे में है?')}
                      </label>
                      <select
                        id="help-subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="field bg-white"
                      >
                        {categories.map((category) => (
                          <option key={category.value} value={category.value}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="help-message" className="label">
                        {tr('Message / incident details', 'संदेश / घटना का विवरण')}
                      </label>
                      <textarea
                        id="help-message"
                        rows={5}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={tr(
                          'Site location, dates, contractor name, amount due, and what happened…',
                          'साइट का स्थान, तारीखें, ठेकेदार का नाम, बकाया राशि और क्या हुआ…',
                        )}
                        className="field resize-y"
                      />
                      <p className="mt-1.5 text-[10px] text-ink-400">
                        {tr(
                          'Never include Aadhaar, bank or OTP details in this form.',
                          'इस फ़ॉर्म में कभी आधार, बैंक या OTP का विवरण न लिखें।',
                        )}
                      </p>
                    </div>

                    <button type="submit" disabled={isSending} className="btn btn-primary w-full">
                      {isSending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {tr('Recording…', 'दर्ज हो रहा है…')}
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          {tr('Submit inquiry', 'पूछताछ जमा करें')}
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </Reveal>

          <Reveal direction="right" delay={100}>
            <div>
              <h2 className="mb-3 px-1 text-[13px] font-bold text-ink-900">
                {tr('Quick answers', 'तुरंत उत्तर')}
              </h2>
              <Accordion items={quickHelp} defaultOpen={null} />
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
};

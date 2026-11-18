import React from 'react';
import {
  ShieldCheck,
  Lock,
  EyeOff,
  UserCheck,
  Scale,
  FileText,
  CheckCircle2,
  XCircle,
  Database,
  Trash2,
} from 'lucide-react';
import { AppRoute } from '../../services/router';
import { Language } from '../../services/i18n';
import { PageHeader } from '../ui/PageHeader';
import { Reveal } from '../ui/Reveal';
import { LanguageNotice } from '../ui/LanguageNotice';

interface PrivacyProps {
  onNavigate: (route: AppRoute) => void;
  lang: Language;
}

type Tr = (en: string, hi: string) => string;

/**
 * The policy is written section by section, in both languages, so the Hindi
 * page never falls back to English legal prose. `tr` is threaded in rather than
 * being a module constant because the copy must react to the active language.
 */
const buildNeverEncoded = (tr: Tr): string[] => [
  tr('Aadhaar or national biometric identifiers', 'आधार या राष्ट्रीय बायोमेट्रिक पहचान'),
  tr('Mobile phone numbers or residential addresses', 'मोबाइल नंबर या घर का पता'),
  tr('Bank account numbers, IFSC codes or UPI IDs', 'बैंक खाता संख्या, IFSC कोड या UPI आईडी'),
  tr('Accumulated wage balances or transaction amounts', 'जमा मजदूरी का बैलेंस या लेन-देन की राशि'),
  tr('Personal attendance logs or dispute filings', 'व्यक्तिगत हाजिरी लॉग या दर्ज शिकायतें'),
];

const buildSections = (tr: Tr) => [
  {
    id: 'qr',
    icon: Lock,
    title: tr('Zero-PII QR standard', 'शून्य-निजी-डेटा QR मानक'),
    body: (
      <>
        <p>
          {tr(
            'WurkUp guarantees that no personally identifiable information is encoded directly into a worker QR pass. The code encodes exclusively an opaque, unguessable token that resolves to a record on the host network.',
            'WurkUp गारंटी देता है कि कामगार के QR पास में किसी भी तरह की निजी पहचान सीधे नहीं भरी जाती। कोड में सिर्फ़ एक गूढ़, अनुमान-असंभव टोकन होता है जो होस्ट नेटवर्क पर एक रिकॉर्ड तक पहुँचाता है।',
          )}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-forest-200 bg-forest-50/60 p-4">
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-forest-800">
              <CheckCircle2 className="h-3.5 w-3.5" /> {tr('Encoded', 'कोड में होता है')}
            </p>
            <ul className="mt-2 space-y-1.5 text-[11.5px] text-forest-900/80">
              <li>{tr('Opaque reference token', 'गूढ़ संदर्भ टोकन')}</li>
              <li>{tr('Issue date', 'जारी करने की तारीख')}</li>
              <li>{tr('Integrity checksum', 'अखंडता चेकसम')}</li>
            </ul>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-rose-800">
              <XCircle className="h-3.5 w-3.5" /> {tr('Never encoded', 'कभी नहीं होता')}
            </p>
            <ul className="mt-2 space-y-1.5 text-[11.5px] text-rose-900/80">
              {buildNeverEncoded(tr).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </>
    ),
  },
  {
    id: 'phone',
    icon: UserCheck,
    title: tr('Mobile number & mutual verification', 'मोबाइल नंबर और आपसी सत्यापन'),
    body: (
      <>
        <p>
          {tr(
            'Mobile numbers are collected during registration solely to provide a human cross-check between workers and authorised contractors. They are only shown to counterparts who have mutually joined the same site or shift.',
            'मोबाइल नंबर पंजीकरण के समय सिर्फ़ इसलिए लिए जाते हैं कि कामगार और अधिकृत ठेकेदार आपस में मानवीय पुष्टि कर सकें। वे केवल उन्हीं साथियों को दिखते हैं जो एक ही साइट या शिफ्ट से आपसी सहमति से जुड़े हैं।',
          )}
        </p>
        <p className="mt-2">
          {tr(
            'Cross-checks record the timestamp, reporting party and outcome — confirmed match, details mismatch or unreachable.',
            'पुष्टि जाँच में समय, जाँच करने वाला पक्ष और नतीजा दर्ज होता है — पुष्टि मिली, विवरण मेल नहीं खाया, या संपर्क नहीं हुआ।',
          )}
        </p>
        <div className="mt-3 rounded-xl border border-brass-200 bg-brass-50/70 p-3.5 text-[11px] leading-relaxed text-brass-900">
          <strong className="font-bold">{tr('Legal clarification:', 'कानूनी स्पष्टीकरण:')}</strong>{' '}
          {tr(
            'mutual manual phone checks are human cross-checks between workplace counterparts. They do not constitute statutory identity verification, biometric authentication or definitive proof of legal identity.',
            'आपसी मैनुअल फ़ोन जाँच कार्यस्थल साथियों के बीच मानवीय पुष्टि है। यह वैधानिक पहचान सत्यापन, बायोमेट्रिक प्रमाणीकरण या कानूनी पहचान का अंतिम प्रमाण नहीं है।',
          )}
        </div>
      </>
    ),
  },
  {
    id: 'scoping',
    icon: Database,
    title: tr('Role-based scoping & isolation', 'भूमिका-आधारित सीमा और अलगाव'),
    body: (
      <p>
        {tr(
          'Workers can only access their own work records, wage balances and disputes. Contractors cannot inspect records of workers outside their authorised assignments. Newly created accounts start empty and never inherit demonstration data.',
          'कामगार केवल अपने कार्य रिकॉर्ड, मजदूरी बैलेंस और शिकायतें देख सकते हैं। ठेकेदार अपने अधिकृत कार्यभार से बाहर के कामगारों के रिकॉर्ड नहीं देख सकते। नए खाते खाली शुरू होते हैं और कभी डेमो डेटा नहीं पाते।',
        )}
      </p>
    ),
  },
  {
    id: 'credentials',
    icon: EyeOff,
    title: tr('Password & credential security', 'पासवर्ड और क्रेडेंशियल सुरक्षा'),
    body: (
      <p>
        {tr(
          'Passwords are handled by the authentication provider (Supabase Auth when configured) and are never stored in localStorage, sessionStorage or IndexedDB. The optional “Remember my login ID” feature stores only the public identifier, never the password.',
          'पासवर्ड प्रमाणीकरण प्रदाता (कॉन्फ़िगर होने पर Supabase Auth) संभालता है और ये localStorage, sessionStorage या IndexedDB में कभी नहीं रखे जाते। वैकल्पिक “मेरा लॉगिन आईडी याद रखें” सुविधा सिर्फ़ सार्वजनिक पहचानकर्ता रखती है, पासवर्ड कभी नहीं।',
        )}
      </p>
    ),
  },
  {
    id: 'audit',
    icon: FileText,
    title: tr('Non-repudiable audit log', 'अनैतिक-अस्वीकार्य ऑडिट लॉग'),
    body: (
      <p>
        {tr(
          'Critical transitions — muster punches, payouts, acknowledgements and dispute filings — are written into a sequential SHA-256 hash chain. Historical wage records cannot be altered retroactively without immediate detection by an auditor.',
          'महत्वपूर्ण घटनाएँ — हाजिरी प्रविष्टि, भुगतान, पावती और शिकायत दर्ज करना — क्रमिक SHA-256 हैश चेन में लिखी जाती हैं। पुराने मजदूरी रिकॉर्ड बिना ऑडिटर की तुरंत नज़र में आए बदले नहीं जा सकते।',
        )}
      </p>
    ),
  },
  {
    id: 'retention',
    icon: Trash2,
    title: tr('Retention & your controls', 'डेटा अवधि और आपके नियंत्रण'),
    body: (
      <>
        <p>
          {tr(
            'Records live primarily in your browser (IndexedDB) and are mirrored to the configured cloud backend when one exists. You can export a complete JSON backup at any time from the audit bench, and clearing your browser storage removes the local copy.',
            'रिकॉर्ड मुख्य रूप से आपके ब्राउज़र (IndexedDB) में रहते हैं और कॉन्फ़िगर क्लाउड बैकएंड होने पर वहाँ भी मिलते हैं। आप ऑडिट बेंच से कभी भी पूरा JSON बैकअप निर्यात कर सकते हैं, और ब्राउज़र स्टोरेज साफ़ करने पर स्थानीय प्रति हट जाती है।',
          )}
        </p>
        <p className="mt-2">
          {tr(
            'To request deletion of a cloud copy, contact the helpline with your registered mobile number. Accounts and statutory records may be retained where labour law requires it.',
            'क्लाउड प्रति हटवाने के लिए अपने पंजीकृत मोबाइल नंबर के साथ हेल्पलाइन पर संपर्क करें। जहाँ श्रम कानून अनिवार्य करता है, वहाँ खाते और वैधानिक रिकॉर्ड रखे जा सकते हैं।',
          )}
        </p>
      </>
    ),
  },
];

export const Privacy: React.FC<PrivacyProps> = ({ onNavigate, lang }) => {
  // Bilingual helper: every user-facing string in this component is authored in
  // both languages, so a Hindi reader never sees an English fragment.
  const tr = (en: string, hi: string) => (lang === 'hi' ? hi : en);
  const sections = buildSections(tr);

  return (
    <div className="pb-4">
      <LanguageNotice lang={lang} />

      <PageHeader
        eyebrow={tr('Informal worker privacy framework', 'अनौपचारिक कामगार गोपनीयता ढाँचा')}
        icon={<ShieldCheck className="h-5 w-5" />}
        title={tr('Privacy and data use, in plain language', 'गोपनीयता और डेटा उपयोग, आसान भाषा में')}
        description={tr(
          'Written to be read by the person it protects — not only by a lawyer. Effective for WurkUp · Senior Bal Vigyan Indore Innovation.',
          'यह उसी व्यक्ति के पढ़ने के लिए लिखा गया है जिसकी यह रक्षा करता है — सिर्फ़ वकील के लिए नहीं। WurkUp · सीनियर बाल विज्ञान इंदौर इनोवेशन के लिए प्रभावी।',
        )}
      >
        <div className="flex flex-wrap gap-2">
          {[
            tr('Zero-PII QR', 'शून्य-निजी-डेटा QR'),
            tr('No data resale', 'डेटा की बिक्री नहीं'),
            tr('Local-first storage', 'पहले स्थानीय भंडारण'),
            tr('Export any time', 'कभी भी निर्यात'),
          ].map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-forest-200 bg-forest-50 px-3 py-1.5 text-[10.5px] font-bold text-forest-800"
            >
              {tag}
            </span>
          ))}
        </div>
      </PageHeader>

      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.32fr_1fr] lg:gap-12">
        {/* Sticky index */}
        <nav aria-label={tr('Sections', 'अनुभाग')} className="hidden lg:block">
          <div className="sticky top-28 space-y-1">
            <p className="mb-3 text-[9.5px] font-bold uppercase tracking-[0.18em] text-ink-400">
              {tr('On this page', 'इस पृष्ठ पर')}
            </p>
            {sections.map((section, index) => (
              <a
                key={section.id}
                href={`#privacy-${section.id}`}
                className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[11.5px] font-semibold text-ink-500 transition-colors hover:bg-white hover:text-forest-800"
              >
                <span className="font-mono text-[9.5px] text-ink-300 group-hover:text-brass-600">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {section.title}
              </a>
            ))}
          </div>
        </nav>

        <div className="space-y-4">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <Reveal key={section.id} delay={index * 60}>
                <section
                  id={`privacy-${section.id}`}
                  className="scroll-mt-28 rounded-2xl border border-sand-200 bg-white p-6 shadow-soft sm:p-7"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-forest-50 to-sand-100 text-forest-700 ring-1 ring-inset ring-forest-100">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-[9.5px] font-bold tracking-[0.2em] text-ink-300">
                        {tr('SECTION', 'अनुभाग')} {String(index + 1).padStart(2, '0')}
                      </p>
                      <h2 className="mt-1 text-[15px] leading-snug text-ink-950">{section.title}</h2>
                    </div>
                  </div>
                  <div className="mt-3 text-[12px] leading-relaxed text-ink-500">{section.body}</div>
                </section>
              </Reveal>
            );
          })}

          <Reveal delay={80}>
            <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-sand-200 bg-sand-100/60 p-6 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <Scale className="mt-0.5 h-5 w-5 shrink-0 text-forest-700" />
                <div>
                  <p className="text-[12.5px] font-bold text-ink-900">
                    {tr('Questions about your data?', 'अपने डेटा के बारे में सवाल हैं?')}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-500">
                    {tr(
                      'Ask before you register — nothing is created until you submit the form.',
                      'पंजीकरण से पहले पूछ लें — फ़ॉर्म जमा करने तक कुछ भी नहीं बनता।',
                    )}
                  </p>
                </div>
              </div>
              <button onClick={() => onNavigate('help')} className="btn btn-primary btn-sm shrink-0">
                {tr('Contact the team', 'टीम से संपर्क करें')}
              </button>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
};

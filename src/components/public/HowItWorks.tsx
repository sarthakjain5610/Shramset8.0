import React from 'react';
import {
  QrCode,
  Smartphone,
  CheckCircle,
  Calculator,
  Lock,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  PhoneCall,
  FileCheck2,
  HelpCircle,
} from 'lucide-react';
import { AppRoute } from '../../services/router';
import { Language } from '../../services/i18n';
import { PageHeader } from '../ui/PageHeader';
import { Reveal } from '../ui/Reveal';
import { LanguageNotice } from '../ui/LanguageNotice';
import { SectionHeading } from '../ui/SectionHeading';
import { SpotlightCard } from '../ui/SpotlightCard';

interface HowItWorksProps {
  onNavigate: (route: AppRoute) => void;
  lang: Language;
}

const STEPS: {
  num: string;
  title: { en: string; hi: string };
  desc: { en: string; hi: string };
  detail: { en: string; hi: string };
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    num: '01',
    title: { en: 'A permanent worker pass is issued', hi: 'कामगार को स्थायी पास मिलता है' },
    desc: {
      en: 'Each registered worker receives one reusable, printable QR pass. The code carries strictly an opaque reference — no Aadhaar, no phone number, no wage balance.',
      hi: 'हर पंजीकृत कामगार को एक बार-बार काम आने वाला, प्रिंट करने योग्य QR पास मिलता है। कोड में सिर्फ़ एक गूढ़ संदर्भ होता है — न आधार, न फ़ोन नंबर, न मजदूरी का बैलेंस।',
    },
    detail: {
      en: 'Issued once · never expires · reprint any time',
      hi: 'एक बार जारी · कभी समाप्त नहीं · जब चाहें दोबारा प्रिंट',
    },
    icon: QrCode,
  },
  {
    num: '02',
    title: { en: 'Mutual phone contact cross-check', hi: 'फ़ोन पर आपसी संपर्क की पुष्टि' },
    desc: {
      en: 'Before a working relationship begins, both contractor and worker verify each other’s mobile contact through a manual check that is logged with a timestamp and an outcome.',
      hi: 'काम शुरू होने से पहले ठेकेदार और कामगार दोनों एक-दूसरे का मोबाइल संपर्क मैनुअल जाँच से सत्यापित करते हैं, जिसमें समय और नतीजा दर्ज होता है।',
    },
    detail: {
      en: 'Confirmed · mismatch · unreachable',
      hi: 'पुष्टि · विवरण मेल नहीं · संपर्क नहीं',
    },
    icon: UserCheck,
  },
  {
    num: '03',
    title: { en: 'The site scans the pass', hi: 'साइट पास स्कैन करती है' },
    desc: {
      en: 'The contractor scans the pass with a phone camera. Instead of silently writing a muster entry, WurkUp creates a pending approval request on the worker’s account.',
      hi: 'ठेकेदार फ़ोन कैमरे से पास स्कैन करता है। चुपचाप हाजिरी दर्ज करने के बजाय WurkUp कामगार के खाते में एक मंज़ूरी अनुरोध बनाता है।',
    },
    detail: {
      en: 'Geofence radius and site ID captured',
      hi: 'जियोफ़ेंस दायरा और साइट आईडी दर्ज',
    },
    icon: Smartphone,
  },
  {
    num: '04',
    title: { en: 'The worker approves the shift', hi: 'कामगार शिफ्ट स्वीकृत करता है' },
    desc: {
      en: 'The worker opens their own dashboard and verifies the date, site, hours and agreed rate. Only after that confirmation is the shift priced and written to the ledger.',
      hi: 'कामगार अपना डैशबोर्ड खोलकर तारीख, साइट, घंटे और तय दर जाँचता है। उसी पुष्टि के बाद शिफ्ट की गणना होकर बही में दर्ज होती है।',
    },
    detail: {
      en: 'Approval · rejection with reason · suspicious report',
      hi: 'स्वीकृति · कारण सहित अस्वीकृति · संदिग्ध की शिकायत',
    },
    icon: CheckCircle,
  },
  {
    num: '05',
    title: { en: 'Wages are computed by statute', hi: 'मजदूरी कानून के अनुसार जुड़ती है' },
    desc: {
      en: 'The engine calculates pro-rata overtime under the MP Minimum Wages Act in integer paise. Advances and deductions are recorded separately and never silently netted.',
      hi: 'इंजन एमपी न्यूनतम मजदूरी अधिनियम के तहत ओवरटाइम की गणना पूरे पैसे में करता है। एडवांस और कटौती अलग-अलग दर्ज होते हैं, चुपचाप जोड़-घटाव नहीं होता।',
    },
    detail: {
      en: 'Unskilled · semi-skilled · skilled · highly skilled',
      hi: 'अकुशल · अर्ध-कुशल · कुशल · उच्च कुशल',
    },
    icon: Calculator,
  },
  {
    num: '06',
    title: { en: 'The audit trail is sealed', hi: 'ऑडिट रिकॉर्ड सील हो जाता है' },
    desc: {
      en: 'Every muster punch, wage credit, disbursement and resolution is hashed into a sequential SHA-256 chain. Alter any past entry and the break is visible immediately.',
      hi: 'हर हाजिरी प्रविष्टि, मजदूरी जमा, भुगतान और समाधान क्रमिक SHA-256 चेन में हैश होता है। कोई पुरानी प्रविष्टि बदलते ही टूट तुरंत दिख जाती है।',
    },
    detail: {
      en: 'Chained hashes · verifiable offline',
      hi: 'श्रृंखलाबद्ध हैश · ऑफ़लाइन सत्यापन योग्य',
    },
    icon: Lock,
  },
];

const GUARANTEES: {
  icon: React.ComponentType<{ className?: string }>;
  title: { en: string; hi: string };
  body: { en: string; hi: string };
}[] = [
  {
    icon: PhoneCall,
    title: { en: 'A human always answers', hi: 'हमेशा एक इंसान जवाब देता है' },
    body: {
      en: 'Every screen shows the same helpline. A worker who cannot read the interface can call and be walked through it.',
      hi: 'हर स्क्रीन पर वही हेल्पलाइन दिखती है। जो कामगार स्क्रीन नहीं पढ़ पाता, वह कॉल करके पूरी प्रक्रिया समझ सकता है।',
    },
  },
  {
    icon: FileCheck2,
    title: { en: 'Conflict resolved before payment', hi: 'भुगतान से पहले विवाद सुलझता है' },
    body: {
      en: 'Disputes are filed against the same record both parties signed, so the conversation starts from shared facts.',
      hi: 'विवाद उसी रिकॉर्ड पर दर्ज होता है जिसे दोनों पक्षों ने स्वीकार किया, इसलिए बातचीत साझा तथ्यों से शुरू होती है।',
    },
  },
  {
    icon: ShieldCheck,
    title: { en: 'No hidden scoring', hi: 'कोई छिपा स्कोर नहीं' },
    body: {
      en: 'There is no credit score, no blacklist and no automated penalty. Only the entries you and your site approved.',
      hi: 'न कोई क्रेडिट स्कोर, न ब्लैकलिस्ट, न स्वचालित जुर्माना। सिर्फ़ वही प्रविष्टियाँ जिन्हें आपने और आपकी साइट ने स्वीकार किया।',
    },
  },
];

export const HowItWorks: React.FC<HowItWorksProps> = ({ onNavigate, lang }) => {
  // Bilingual helper: every user-facing string in this component is authored in
  // both languages, so a Hindi reader never sees an English fragment.
  const tr = (en: string, hi: string) => (lang === 'hi' ? hi : en);

  return (
    <div className="pb-4">
      <LanguageNotice lang={lang} />

      <PageHeader
        eyebrow={tr('Transparent workflow', 'पारदर्शी प्रक्रिया')}
        icon={<ShieldCheck className="h-5 w-5" />}
        title={
          lang === 'hi' ? (
            <>
              पहली साइट हाजिरी से लेकर{' '}
              <span className="italic text-forest-700">अंतिम भुगतान</span> तक
            </>
          ) : (
            <>
              From the first site check-in to a{' '}
              <span className="italic text-forest-700">final settlement</span>
            </>
          )
        }
        description={tr(
          'Six mutual confirmations replace a contested paper register. Nothing here is automatic on the part of an employer — every step requires a second signature.',
          'छह आपसी पुष्टियाँ विवादित कागज़ी रजिस्टर की जगह लेती हैं। यहाँ नियोक्ता की ओर से कुछ भी अपने-आप नहीं होता — हर कदम पर दूसरा हस्ताक्षर ज़रूरी है।',
        )}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          {(lang === 'hi'
            ? ['कोई हार्डवेयर नहीं चाहिए', 'ऑफ़लाइन चलता है', 'हिंदी + अंग्रेज़ी', 'कामगारों के लिए मुफ़्त']
            : ['No hardware needed', 'Works offline', 'Hindi + English', 'Free for workers']
          ).map(
            (tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 rounded-full border border-sand-200 bg-white/80 px-3 py-1.5 text-[10.5px] font-bold text-ink-600 backdrop-blur"
              >
                <CheckCircle className="h-3 w-3 text-forest-600" />
                {tag}
              </span>
            )
          )}
        </div>
      </PageHeader>

      {/* Timeline */}
      <section className="relative mx-auto max-w-4xl">
        <div
          className="absolute left-[1.4375rem] top-4 bottom-12 w-px bg-gradient-to-b from-brass-300/70 via-forest-300/60 to-transparent sm:left-[1.9375rem]"
          aria-hidden="true"
        />

        <ol className="space-y-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.num} as="li" delay={index * 70} direction="left">
                <div className="group relative flex gap-4 sm:gap-6">
                  <div className="relative z-10 shrink-0">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl border border-sand-200 bg-white text-forest-700 shadow-soft transition-all duration-500 group-hover:-translate-y-0.5 group-hover:border-forest-300 group-hover:bg-forest-800 group-hover:text-white group-hover:shadow-lift sm:h-16 sm:w-16">
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </span>
                  </div>

                  <SpotlightCard className="flex-1 rounded-2xl border border-sand-200 bg-white p-5 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:border-forest-200 group-hover:shadow-lift sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-brass-600">
                        {tr('STEP', 'चरण')} {step.num}
                      </span>
                      <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[9.5px] font-semibold text-ink-500">
                        {tr(step.detail.en, step.detail.hi)}
                      </span>
                    </div>
                    <h2 className="mt-2 text-[15px] leading-snug text-ink-950 sm:text-base">
                      {tr(step.title.en, step.title.hi)}
                    </h2>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-ink-500">
                      {tr(step.desc.en, step.desc.hi)}
                    </p>
                  </SpotlightCard>
                </div>
              </Reveal>
            );
          })}
        </ol>
      </section>

      {/* What it does not do */}
      <section className="mt-20">
        <SectionHeading
          eyebrow={tr('Honest boundaries', 'स्पष्ट सीमाएँ')}
          title={tr('What WurkUp deliberately does not do', 'WurkUp जानबूझकर क्या नहीं करता')}
          description={tr(
            'A tool people trust should be explicit about its limits. These are enforced design decisions, not roadmap gaps.',
            'जिस औज़ार पर लोग भरोसा करें, उसे अपनी सीमाएँ साफ़ बतानी चाहिए। ये जानबूझकर लिए गए डिज़ाइन निर्णय हैं, कोई कमी नहीं।',
          )}
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {GUARANTEES.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title.en} delay={index * 90}>
                <div className="h-full rounded-2xl border border-sand-200 bg-sand-50/80 p-5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-forest-700 shadow-soft">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <h3 className="mt-4 text-[13px] font-bold text-ink-900">
                    {tr(item.title.en, item.title.hi)}
                  </h3>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">
                    {tr(item.body.en, item.body.hi)}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={120}>
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-brass-200 bg-brass-50/70 p-4">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-brass-700" />
            <p className="text-[11.5px] leading-relaxed text-brass-900">
              <strong className="font-bold">
                {tr('WurkUp is not a government portal.', 'WurkUp कोई सरकारी पोर्टल नहीं है।')}
              </strong>{' '}
              {tr(
                'It is an independent transparency project built to align with MP labour statutes and e-Shram / BOCW workflows. It does not replace statutory registration, and it does not verify identity.',
                'यह एक स्वतंत्र पारदर्शिता परियोजना है, जो एमपी श्रम कानूनों तथा e-Shram / BOCW प्रक्रियाओं के अनुरूप बनाई गई है। यह वैधानिक पंजीकरण का विकल्प नहीं है और पहचान सत्यापित नहीं करता।',
              )}
            </p>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="relative mt-20 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-forest-800 via-forest-900 to-ink-950 px-6 py-12 text-white sm:px-12 sm:py-14">
        <div className="pointer-events-none absolute inset-0 bg-grid-dark opacity-50" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full glow-brass opacity-40 blur-3xl animate-aurora"
          aria-hidden="true"
        />
        <div className="relative flex flex-col items-start justify-between gap-7 lg:flex-row lg:items-center">
          <div className="max-w-lg">
            <h2 className="text-[1.75rem] leading-tight text-white sm:text-[2.1rem]">
              {tr('Ready to see your own wage khata?', 'अपना मजदूरी खाता देखने के लिए तैयार हैं?')}
            </h2>
            <p className="mt-3 text-[12.5px] leading-relaxed text-sand-200/65">
              {tr(
                'Create a free account — worker or contractor — and the platform starts empty, with your name on it and nothing else.',
                'मुफ़्त खाता बनाएँ — कामगार या ठेकेदार — और प्लेटफ़ॉर्म खाली शुरू होता है: सिर्फ़ आपका नाम, और कुछ नहीं।',
              )}
            </p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2.5">
            <button
              onClick={() => onNavigate('create-account')}
              className="btn btn-gold w-full justify-between"
            >
              {tr('Create account', 'खाता बनाएँ')}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => onNavigate('sign-in')}
              className="btn w-full border border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              {tr('Sign in', 'साइन इन')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
